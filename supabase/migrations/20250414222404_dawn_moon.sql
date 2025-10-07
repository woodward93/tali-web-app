/*
  # Update subscription plans and add usage tracking

  1. Changes
    - Update subscription plan features
    - Add usage tracking tables for transactions, products, and documents
    - Add triggers to enforce usage limits

  2. Security
    - Enable RLS on usage tables
    - Add policies for authenticated users
*/

-- Update subscription plans with correct features
UPDATE subscription_plans 
SET features = '[
  "20 Transactions per month",
  "10 Products & Services",
  "20 Invoices & Receipts"
]'::jsonb
WHERE name = 'Bronze';

UPDATE subscription_plans 
SET features = '[
  "Unlimited Transactions",
  "Unlimited Products & Services",
  "Unlimited Invoices & Receipts"
]'::jsonb
WHERE name = 'Gold';

-- Create usage tracking tables
CREATE TABLE usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES subscription_plans(id) NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('transactions', 'products', 'documents')),
  monthly_limit integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, resource_type)
);

CREATE TABLE usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('transactions', 'products', 'documents')),
  current_usage integer NOT NULL DEFAULT 0,
  reset_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, resource_type)
);

-- Enable RLS
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to usage limits"
  ON usage_limits
  FOR SELECT
  TO public;

CREATE POLICY "Users can view their own usage"
  ON usage_tracking
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_usage_limits_plan ON usage_limits(plan_id);
CREATE INDEX idx_usage_tracking_business ON usage_tracking(business_id);

-- Insert usage limits for Bronze plan
INSERT INTO usage_limits (plan_id, resource_type, monthly_limit)
SELECT 
  id as plan_id,
  'transactions' as resource_type,
  20 as monthly_limit
FROM subscription_plans
WHERE name = 'Bronze';

INSERT INTO usage_limits (plan_id, resource_type, monthly_limit)
SELECT 
  id as plan_id,
  'products' as resource_type,
  10 as monthly_limit
FROM subscription_plans
WHERE name = 'Bronze';

INSERT INTO usage_limits (plan_id, resource_type, monthly_limit)
SELECT 
  id as plan_id,
  'documents' as resource_type,
  20 as monthly_limit
FROM subscription_plans
WHERE name = 'Bronze';

-- Create function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit()
RETURNS trigger AS $$
DECLARE
  current_plan_id uuid;
  usage_limit integer;
  current_usage integer;
BEGIN
  -- Get current plan ID
  SELECT plan_id INTO current_plan_id
  FROM subscriptions s
  WHERE s.business_id = NEW.business_id
  AND s.status IN ('active', 'trialing')
  ORDER BY created_at DESC
  LIMIT 1;

  -- Get usage limit for the plan
  SELECT monthly_limit INTO usage_limit
  FROM usage_limits
  WHERE plan_id = current_plan_id
  AND resource_type = TG_ARGV[0];

  -- If no limit found, it means unlimited
  IF usage_limit IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current usage
  SELECT current_usage INTO current_usage
  FROM usage_tracking
  WHERE business_id = NEW.business_id
  AND resource_type = TG_ARGV[0];

  -- If usage would exceed limit, raise exception
  IF current_usage >= usage_limit THEN
    RAISE EXCEPTION 'Usage limit exceeded for %', TG_ARGV[0];
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update usage tracking
CREATE OR REPLACE FUNCTION update_usage_tracking()
RETURNS trigger AS $$
DECLARE
  next_reset timestamptz;
BEGIN
  -- Calculate next reset date (1st of next month)
  next_reset := date_trunc('month', now()) + interval '1 month';

  -- Update or insert usage tracking
  INSERT INTO usage_tracking (
    business_id,
    resource_type,
    current_usage,
    reset_date
  )
  VALUES (
    NEW.business_id,
    TG_ARGV[0],
    1,
    next_reset
  )
  ON CONFLICT (business_id, resource_type)
  DO UPDATE SET
    current_usage = usage_tracking.current_usage + 1,
    reset_date = next_reset
  WHERE usage_tracking.reset_date <= now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for transactions
CREATE TRIGGER check_transaction_limit
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_usage_limit('transactions');

CREATE TRIGGER update_transaction_usage
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_tracking('transactions');

-- Create triggers for inventory items
CREATE TRIGGER check_product_limit
  BEFORE INSERT ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION check_usage_limit('products');

CREATE TRIGGER update_product_usage
  AFTER INSERT ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_tracking('products');

-- Create triggers for documents
CREATE TRIGGER check_document_limit
  BEFORE INSERT ON receipts_invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_usage_limit('documents');

CREATE TRIGGER update_document_usage
  AFTER INSERT ON receipts_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_tracking('documents');

-- Add comment explaining the usage tracking system
COMMENT ON TABLE usage_tracking IS 'Tracks resource usage per business with monthly resets';
COMMENT ON TABLE usage_limits IS 'Defines usage limits per subscription plan';