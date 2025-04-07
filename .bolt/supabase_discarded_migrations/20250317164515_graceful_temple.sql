/*
  # Create shop-images bucket and storage policies

  1. Storage Setup
    - Create 'shop-images' bucket for storing product images
    - Enable public access for image URLs
  
  2. Security
    - Add policies to allow authenticated users to:
      - Upload images to their own shop's directory
      - Update their own shop's images
      - Delete their own shop's images
    - Allow public read access to all images
*/

-- Create the shop-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update shop images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete shop images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to shop images" ON storage.objects;

-- Create new policies with proper folder structure enforcement
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