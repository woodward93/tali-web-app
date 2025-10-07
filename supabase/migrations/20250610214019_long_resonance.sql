/*
  # Fix shop database schema issues

  1. Ensure inventory_items table exists with proper structure
  2. Recreate shop_products table with correct foreign key
  3. Recreate shop_orders table
  4. Add proper indexes and RLS policies

  This migration fixes the relationship issues between shop_products and inventory_items
  and ensures all required tables exist.
*/

-- First, ensure inventory_items table exists (if not already created)
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  cost_price numeric(12,2) DEFAULT 0,
  quantity integer DEFAULT 0,
  low_stock_threshold integer DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on inventory_items if not already enabled
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Drop and recreate shop_products table to ensure proper foreign key relationship
DROP TABLE IF EXISTS shop_products CASCADE;

CREATE TABLE shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_shop_products_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_products_inventory FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

-- Create indexes for shop_products
CREATE INDEX IF NOT EXISTS idx_shop_products_shop ON shop_products(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_inventory_item ON shop_products(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_active ON shop_products(active);

-- Enable RLS on shop_products
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

-- Create policy for shop_products
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

-- Drop and recreate shop_orders table
DROP TABLE IF EXISTS shop_orders CASCADE;

CREATE TABLE shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  total numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_shop_orders_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Create indexes for shop_orders
CREATE INDEX IF NOT EXISTS idx_shop_orders_shop ON shop_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_orders_number ON shop_orders(order_number);

-- Enable RLS on shop_orders
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

-- Create policy for shop_orders
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

-- Create update triggers if the function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    -- Create trigger for shop_products
    DROP TRIGGER IF EXISTS update_shop_products_updated_at ON shop_products;
    CREATE TRIGGER update_shop_products_updated_at
      BEFORE UPDATE ON shop_products
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Create trigger for shop_orders
    DROP TRIGGER IF EXISTS update_shop_orders_updated_at ON shop_orders;
    CREATE TRIGGER update_shop_orders_updated_at
      BEFORE UPDATE ON shop_orders
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;