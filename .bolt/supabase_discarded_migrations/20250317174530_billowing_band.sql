/*
  # Restore Online Shop Schema

  1. New Tables
    - `shops`
      - Basic shop information and settings
    - `shop_products`
      - Products available in the online shop

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create shops table
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

-- Create indexes for shops
CREATE INDEX IF NOT EXISTS idx_shops_business ON shops(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_domain ON shops(domain);

-- Enable RLS on shops
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Create policy for shops
CREATE POLICY "Users can manage their shops"
  ON shops
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Create shop_products table
CREATE TABLE IF NOT EXISTS shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES shops(id) NOT NULL,
  inventory_item_id uuid REFERENCES inventory_items(id),
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL,
  compare_at_price numeric(12,2),
  images text[] DEFAULT ARRAY[]::text[],
  active boolean DEFAULT true,
  featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for shop_products
CREATE INDEX IF NOT EXISTS idx_shop_products_shop ON shop_products(shop_id);

-- Enable RLS on shop_products
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

-- Create policy for shop_products
CREATE POLICY "Users can manage shop products"
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

-- Create shop-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for shop images
CREATE POLICY "Users can upload shop images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT b.user_id FROM shops s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can update shop images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT b.user_id FROM shops s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT b.user_id FROM shops s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete shop images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT b.user_id FROM shops s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Public read access to shop images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shop-images');