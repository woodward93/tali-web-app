/*
  # Add shop settings tables

  1. New Tables
    - `shop_shipping_methods`
      - `id` (uuid, primary key)
      - `shop_id` (uuid, foreign key to shops)
      - `type` (text, shipping method type)
      - `name` (text, display name)
      - `cost` (numeric, shipping cost)
      - `location` (text, for custom shipping methods)
      - `enabled` (boolean, whether method is active)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `shop_bank_details`
      - `id` (uuid, primary key)
      - `shop_id` (uuid, foreign key to shops)
      - `bank_name` (text)
      - `account_number` (text)
      - `account_holder_name` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their shop settings
*/

-- Create shop_shipping_methods table
CREATE TABLE shop_shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('free', 'pickup', 'standard', 'flat_rate', 'custom')),
  name text NOT NULL,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  location text,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_shop_shipping_methods_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Create shop_bank_details table
CREATE TABLE shop_bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL UNIQUE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_shop_bank_details_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_shop_shipping_methods_shop ON shop_shipping_methods(shop_id);
CREATE INDEX idx_shop_shipping_methods_enabled ON shop_shipping_methods(enabled);
CREATE INDEX idx_shop_bank_details_shop ON shop_bank_details(shop_id);

-- Enable RLS
ALTER TABLE shop_shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_bank_details ENABLE ROW LEVEL SECURITY;

-- Create policies for shop_shipping_methods
CREATE POLICY "Users can manage shipping methods for their shops"
  ON shop_shipping_methods
  FOR ALL
  TO authenticated
  USING (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN businesses b ON b.id = s.business_id
      WHERE b.user_id = auth.uid()
    )
  );

-- Create policies for shop_bank_details
CREATE POLICY "Users can manage bank details for their shops"
  ON shop_bank_details
  FOR ALL
  TO authenticated
  USING (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN businesses b ON b.id = s.business_id
      WHERE b.user_id = auth.uid()
    )
  );

-- Create update triggers if the function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    -- Create trigger for shop_shipping_methods
    CREATE TRIGGER update_shop_shipping_methods_updated_at
      BEFORE UPDATE ON shop_shipping_methods
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Create trigger for shop_bank_details
    CREATE TRIGGER update_shop_bank_details_updated_at
      BEFORE UPDATE ON shop_bank_details
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Insert default shipping methods for existing shops
INSERT INTO shop_shipping_methods (shop_id, type, name, cost, enabled)
SELECT 
  id as shop_id,
  'free' as type,
  'Free Shipping' as name,
  0 as cost,
  true as enabled
FROM shops
WHERE active = true
ON CONFLICT DO NOTHING;

INSERT INTO shop_shipping_methods (shop_id, type, name, cost, enabled)
SELECT 
  id as shop_id,
  'pickup' as type,
  'Store Pickup' as name,
  0 as cost,
  true as enabled
FROM shops
WHERE active = true
ON CONFLICT DO NOTHING;

INSERT INTO shop_shipping_methods (shop_id, type, name, cost, enabled)
SELECT 
  id as shop_id,
  'standard' as type,
  'Standard Shipping' as name,
  10 as cost,
  false as enabled
FROM shops
WHERE active = true
ON CONFLICT DO NOTHING;

INSERT INTO shop_shipping_methods (shop_id, type, name, cost, enabled)
SELECT 
  id as shop_id,
  'flat_rate' as type,
  'Flat Rate Shipping' as name,
  15 as cost,
  false as enabled
FROM shops
WHERE active = true
ON CONFLICT DO NOTHING;