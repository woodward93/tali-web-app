/*
  # Add shop products table

  1. New Tables
    - `shop_products`
      - `id` (uuid, primary key)
      - `shop_id` (uuid, foreign key to shops)
      - `inventory_item_id` (uuid, foreign key to inventory_items)
      - `name` (text)
      - `description` (text)
      - `price` (numeric)
      - `active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on shop_products table
    - Add policy for authenticated users to manage their shop products
*/

-- Create shop_products table
CREATE TABLE IF NOT EXISTS shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) NOT NULL,
  inventory_item_id uuid REFERENCES inventory_items(id) NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shop_products_shop ON shop_products(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_inventory_item ON shop_products(inventory_item_id);

-- Enable RLS
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage shop products for their shops"
  ON shop_products
  FOR ALL
  TO authenticated
  USING (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN businesses b ON b.id = s.business_id
      WHERE b.user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at
CREATE TRIGGER update_shop_products_updated_at
  BEFORE UPDATE ON shop_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();