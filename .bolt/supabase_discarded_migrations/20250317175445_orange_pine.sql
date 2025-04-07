-- Drop shop-related tables and storage
DO $$ 
BEGIN
  -- Drop shop_products table if it exists
  DROP TABLE IF EXISTS shop_products;

  -- Drop shops table if it exists
  DROP TABLE IF EXISTS shops;

  -- Remove shop-images bucket and its contents
  DELETE FROM storage.objects WHERE bucket_id = 'shop-images';
  DELETE FROM storage.buckets WHERE id = 'shop-images';

  -- Drop storage policies
  DROP POLICY IF EXISTS "Users can upload shop images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update shop images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete shop images" ON storage.objects;
  DROP POLICY IF EXISTS "Public read access to shop images" ON storage.objects;
END $$;