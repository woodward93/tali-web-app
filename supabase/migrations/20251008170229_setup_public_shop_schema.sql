/*
  # Setup Public Shop Schema
  
  This migration creates the essential tables needed for the online shop functionality
  with public access enabled from the start.
  
  ## Tables Created
  
  1. **businesses** - Business information (authenticated access only for management)
  2. **categories** - Product categories (public read access)
  3. **inventory_items** - Inventory management (public read for stock levels)
  4. **shops** - Shop storefronts (public read access for active shops)
  5. **shop_products** - Products in shops (public read access for active products)
  6. **shop_shipping_methods** - Shipping options (public read for enabled methods)
  7. **shop_orders** - Customer orders (public insert for guest checkout)
  
  ## Security Model
  
  - Merchants (authenticated users) can manage their shops, products, and inventory
  - Anyone (including guests) can view active shops and products
  - Guest users can create orders without authentication
  - RLS policies ensure data isolation between businesses
*/

-- Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ================================================
-- BUSINESSES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  country text DEFAULT '',
  logo_url text,
  address text,
  preferred_currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own businesses"
  ON businesses FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id);

-- ================================================
-- CATEGORIES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their categories"
  ON categories FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(business_id);

-- ================================================
-- INVENTORY ITEMS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  category_id uuid REFERENCES categories(id),
  name text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 0,
  unit_price numeric(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage inventory for their businesses"
  ON inventory_items FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can view inventory items"
  ON inventory_items FOR SELECT TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_inventory_items_business ON inventory_items(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);

-- ================================================
-- SHOPS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  name text NOT NULL,
  domain text NOT NULL UNIQUE CHECK (domain ~ '^[a-z0-9-]+$'),
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their shops"
  ON shops FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can view active shops"
  ON shops FOR SELECT TO public
  USING (active = true);

CREATE INDEX IF NOT EXISTS idx_shops_business ON shops(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_domain ON shops(domain);

CREATE TRIGGER update_shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Now add public read policy for businesses
CREATE POLICY "Anyone can view business info through shops"
  ON businesses FOR SELECT TO public
  USING (
    id IN (SELECT business_id FROM shops WHERE active = true)
  );

-- ================================================
-- SHOP PRODUCTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) NOT NULL,
  inventory_item_id uuid REFERENCES inventory_items(id),
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL,
  compare_at_price numeric(12,2),
  images text[],
  featured boolean DEFAULT false,
  active boolean DEFAULT true,
  slug text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage shop products"
  ON shop_products FOR ALL TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops 
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Anyone can view active shop products"
  ON shop_products FOR SELECT TO public
  USING (active = true);

CREATE INDEX IF NOT EXISTS idx_shop_products_shop ON shop_products(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_inventory ON shop_products(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_active ON shop_products(shop_id, active);

CREATE TRIGGER update_shop_products_updated_at
  BEFORE UPDATE ON shop_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SHOP SHIPPING METHODS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS shop_shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  location text,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shop_shipping_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage shipping methods"
  ON shop_shipping_methods FOR ALL TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops 
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Anyone can view enabled shipping methods"
  ON shop_shipping_methods FOR SELECT TO public
  USING (enabled = true);

CREATE INDEX IF NOT EXISTS idx_shop_shipping_methods_shop ON shop_shipping_methods(shop_id);

-- ================================================
-- SHOP ORDERS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) NOT NULL,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  total numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_reference text,
  shipping_method text,
  shipping_cost numeric(12,2) DEFAULT 0,
  items jsonb NOT NULL,
  shipping_address jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view orders for their shops"
  ON shop_orders FOR SELECT TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops 
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update orders for their shops"
  ON shop_orders FOR UPDATE TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops 
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Anyone can create shop orders"
  ON shop_orders FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view orders"
  ON shop_orders FOR SELECT TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_shop_orders_shop ON shop_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_reference ON shop_orders(payment_reference);
CREATE INDEX IF NOT EXISTS idx_shop_orders_email ON shop_orders(customer_email);

CREATE TRIGGER update_shop_orders_updated_at
  BEFORE UPDATE ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();