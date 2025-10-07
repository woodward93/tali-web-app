/*
  # Update shop products table for editing features

  1. Changes
    - Add `featured` column to shop_products table
    - Add `images` column to shop_products table (jsonb array)
    - Add `compare_at_price` column for sale pricing
    - Add `slug` column for SEO-friendly URLs
    - Add `seo_title` and `seo_description` columns
    - Add `in_stock` column for stock status

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to shop_products table
ALTER TABLE shop_products 
ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS compare_at_price numeric(12,2),
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS seo_title text,
ADD COLUMN IF NOT EXISTS seo_description text,
ADD COLUMN IF NOT EXISTS in_stock boolean DEFAULT true;

-- Create index for featured products
CREATE INDEX IF NOT EXISTS idx_shop_products_featured ON shop_products(featured);

-- Create index for slug
CREATE INDEX IF NOT EXISTS idx_shop_products_slug ON shop_products(slug);

-- Create storage bucket for shop images
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload shop images
CREATE POLICY "Users can upload shop images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shop-images'
);

-- Policy to allow authenticated users to update shop images
CREATE POLICY "Users can update shop images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'shop-images')
WITH CHECK (bucket_id = 'shop-images');

-- Policy to allow authenticated users to delete shop images
CREATE POLICY "Users can delete shop images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'shop-images');

-- Policy to allow public read access to shop images
CREATE POLICY "Public read access to shop images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shop-images');