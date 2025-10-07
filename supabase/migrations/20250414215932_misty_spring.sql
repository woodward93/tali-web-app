/*
  # Add subscription system tables

  1. New Tables
    - `subscription_plans`
      - `id` (uuid, primary key)
      - `name` (text) - Plan name (Bronze, Gold)
      - `price` (numeric) - Monthly price
      - `features` (jsonb) - List of features included
      - `is_default` (boolean) - Default plan for new users
      - `active` (boolean) - Whether plan is active
      - `trial_days` (integer) - Number of trial days (14 for Gold)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `subscriptions`
      - `id` (uuid, primary key)
      - `business_id` (uuid) - Reference to businesses
      - `plan_id` (uuid) - Reference to subscription_plans
      - `status` (text) - active, trialing, canceled, past_due
      - `trial_ends_at` (timestamptz)
      - `current_period_starts_at` (timestamptz)
      - `current_period_ends_at` (timestamptz)
      - `canceled_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `subscription_payments`
      - `id` (uuid, primary key)
      - `subscription_id` (uuid) - Reference to subscriptions
      - `amount` (numeric)
      - `currency` (text)
      - `payment_provider` (text)
      - `payment_id` (text)
      - `status` (text)
      - `paid_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create subscription_plans table
CREATE TABLE subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL,
  features jsonb NOT NULL DEFAULT '[]',
  is_default boolean DEFAULT false,
  active boolean DEFAULT true,
  trial_days integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  plan_id uuid REFERENCES subscription_plans(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'trialing', 'canceled', 'past_due')),
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz NOT NULL DEFAULT now(),
  current_period_ends_at timestamptz NOT NULL,
  canceled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_payments table
CREATE TABLE subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  payment_provider text NOT NULL DEFAULT 'paystack',
  payment_id text,
  status text NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to subscription plans"
  ON subscription_plans
  FOR SELECT
  TO public
  USING (active = true);

CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own payments"
  ON subscription_payments
  FOR SELECT
  TO authenticated
  USING (
    subscription_id IN (
      SELECT s.id FROM subscriptions s
      JOIN businesses b ON b.id = s.business_id
      WHERE b.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX idx_subscription_payments_subscription ON subscription_payments(subscription_id);

-- Create trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default plans
INSERT INTO subscription_plans (name, price, features, is_default, trial_days) VALUES
  ('Bronze', 0, '[
    "Basic business management",
    "Up to 100 transactions per month",
    "Basic reporting"
  ]'::jsonb, true, 0),
  ('Gold', 3000, '[
    "Unlimited transactions",
    "Advanced analytics",
    "Priority support",
    "Custom branding",
    "Multiple users",
    "API access"
  ]'::jsonb, false, 14);