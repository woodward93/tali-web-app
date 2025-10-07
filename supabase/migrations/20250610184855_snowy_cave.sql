/*
  # Add shop orders table

  1. New Tables
    - `shop_orders`
      - `id` (uuid, primary key)
      - `shop_id` (uuid, foreign key to shops)
      - `order_number` (text, unique)
      - `customer_name` (text)
      - `customer_email` (text)
      - `total` (numeric)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on shop_orders table
    - Add policy for authenticated users to manage their shop orders
*/

-- Create shop_orders table
CREATE TABLE IF NOT EXISTS shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) NOT NULL,
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  total numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shop_orders_shop ON shop_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_orders_number ON shop_orders(order_number);

-- Enable RLS
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage shop orders for their shops"
  ON shop_orders
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
CREATE TRIGGER update_shop_orders_updated_at
  BEFORE UPDATE ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();