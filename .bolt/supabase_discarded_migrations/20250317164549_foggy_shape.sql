/*
  # Update shop products table and storage policies

  1. Storage Setup
    - Create 'shop-images' bucket for storing product images
    - Enable public access for image URLs
  
  2. Security
    - Add policies to allow authenticated users to:
      - Upload images to their own shop's directory
      - Update their own shop's images
      - Delete their own shop's images
    - Allow public read access to all images

  3. Table Changes
    - Remove SEO columns
    - Add featured column
    - Update images column type
*/

-- Ensure shop-images bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update shop images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete shop images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to shop images" ON storage.objects;

-- Create new policies
CREATE POLICY "Users can upload shop images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT b.user_id FROM shops s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.id::text = (storage.foldername(objects.name))[1]
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
    WHERE s.id::text = (storage.foldername(objects.name))[1]
  )
)
WITH CHECK (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT b.user_id FROM shops s
    JOIN businesses b ON b.id = s.business_id
    WHERE s.id::text = (storage.foldername(objects.name))[1]
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
    WHERE s.id::text = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Public read access to shop images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shop-images');

-- Update shop_products table
DO $$ 
BEGIN
  -- Drop SEO columns if they exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_products' AND column_name = 'seo_title') THEN
    ALTER TABLE shop_products DROP COLUMN seo_title;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_products' AND column_name = 'seo_description') THEN
    ALTER TABLE shop_products DROP COLUMN seo_description;
  END IF;

  -- Add featured column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_products' AND column_name = 'featured') THEN
    ALTER TABLE shop_products ADD COLUMN featured boolean DEFAULT false;
  END IF;

  -- Update images column to be text[] instead of jsonb
  ALTER TABLE shop_products 
    ALTER COLUMN images TYPE text[] USING CASE 
      WHEN images IS NULL THEN ARRAY[]::text[]
      WHEN jsonb_typeof(images) = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(images))
      ELSE ARRAY[]::text[]
    END;
END $$;