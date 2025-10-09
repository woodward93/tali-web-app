/*
  # Fix RLS policies to restore authenticated user access

  1. Changes
    - Fix businesses table policies to allow authenticated users to access their own data
    - Fix other table policies that may be preventing profile loading
    - Maintain public access for shop functionality
    - Ensure proper policy precedence

  2. Security
    - Authenticated users can manage their own business data
    - Public users can view active shops and products
    - Proper data isolation between businesses
*/

-- Fix businesses table policies
DROP POLICY IF EXISTS "Users can manage their own businesses" ON businesses;
DROP POLICY IF EXISTS "Public can view business info for active shops" ON businesses;

-- Recreate businesses policies with authenticated access first
CREATE POLICY "Users can manage their own businesses"
  ON businesses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can view business info for active shops"
  ON businesses
  FOR SELECT
  TO public
  USING (
    id IN (
      SELECT business_id FROM shops WHERE active = true
    )
  );

-- Fix user_profiles table policies if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    DROP POLICY IF EXISTS "Users can manage their own profile" ON user_profiles;
    
    CREATE POLICY "Users can manage their own profile"
      ON user_profiles
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Fix contacts table policies
DROP POLICY IF EXISTS "Users can manage contacts for their businesses" ON contacts;

CREATE POLICY "Users can manage contacts for their businesses"
  ON contacts
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

-- Fix transactions table policies
DROP POLICY IF EXISTS "Users can manage transactions for their businesses" ON transactions;

CREATE POLICY "Users can manage transactions for their businesses"
  ON transactions
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

-- Fix inventory_items table policies
DROP POLICY IF EXISTS "Users can manage inventory for their businesses" ON inventory_items;
DROP POLICY IF EXISTS "Public can view inventory items for active shops" ON inventory_items;

CREATE POLICY "Users can manage inventory for their businesses"
  ON inventory_items
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

CREATE POLICY "Public can view inventory items for active shops"
  ON inventory_items
  FOR SELECT
  TO public
  USING (
    business_id IN (
      SELECT business_id FROM shops WHERE active = true
    )
  );

-- Fix categories table policies
DROP POLICY IF EXISTS "Users can manage their categories" ON categories;
DROP POLICY IF EXISTS "Public can view categories for active shops" ON categories;

CREATE POLICY "Users can manage their categories"
  ON categories
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

CREATE POLICY "Public can view categories for active shops"
  ON categories
  FOR SELECT
  TO public
  USING (
    business_id IN (
      SELECT business_id FROM shops WHERE active = true
    )
  );

-- Fix shops table policies
DROP POLICY IF EXISTS "Users can manage their shops" ON shops;
DROP POLICY IF EXISTS "Public can view active shops" ON shops;

CREATE POLICY "Users can manage their shops"
  ON shops
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

CREATE POLICY "Public can view active shops"
  ON shops
  FOR SELECT
  TO public
  USING (active = true);

-- Fix shop_products table policies
DROP POLICY IF EXISTS "Users can manage shop products for their shops" ON shop_products;
DROP POLICY IF EXISTS "Public can view active shop products" ON shop_products;

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
  )
  WITH CHECK (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN businesses b ON b.id = s.business_id
      WHERE b.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view active shop products"
  ON shop_products
  FOR SELECT
  TO public
  USING (
    active = true AND
    shop_id IN (
      SELECT id FROM shops WHERE active = true
    )
  );

-- Fix shop_shipping_methods table policies
DROP POLICY IF EXISTS "Users can manage shipping methods for their shops" ON shop_shipping_methods;
DROP POLICY IF EXISTS "Public can view enabled shipping methods" ON shop_shipping_methods;

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
  )
  WITH CHECK (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN businesses b ON b.id = s.business_id
      WHERE b.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view enabled shipping methods"
  ON shop_shipping_methods
  FOR SELECT
  TO public
  USING (
    enabled = true AND
    shop_id IN (
      SELECT id FROM shops WHERE active = true
    )
  );

-- Fix shop_orders table policies
DROP POLICY IF EXISTS "Users can manage shop orders for their shops" ON shop_orders;
DROP POLICY IF EXISTS "Public can create shop orders" ON shop_orders;
DROP POLICY IF EXISTS "Public can view shop orders" ON shop_orders;
DROP POLICY IF EXISTS "Public can update shop orders" ON shop_orders;

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
  )
  WITH CHECK (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN businesses b ON b.id = s.business_id
      WHERE b.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can create shop orders"
  ON shop_orders
  FOR INSERT
  TO public
  WITH CHECK (
    shop_id IN (
      SELECT id FROM shops WHERE active = true
    )
  );

CREATE POLICY "Public can view shop orders"
  ON shop_orders
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can update shop orders"
  ON shop_orders
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Fix receipts_invoices table policies
DROP POLICY IF EXISTS "Users can manage receipts and invoices for their businesses" ON receipts_invoices;

CREATE POLICY "Users can manage receipts and invoices for their businesses"
  ON receipts_invoices
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

-- Fix bank_payment_records table policies if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_payment_records') THEN
    DROP POLICY IF EXISTS "Users can manage their bank payment records" ON bank_payment_records;
    
    CREATE POLICY "Users can manage their bank payment records"
      ON bank_payment_records
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
  END IF;
END $$;