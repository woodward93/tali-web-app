-- Rollback migration
DO $$ 
BEGIN
  -- Drop shop_products table if it exists
  DROP TABLE IF EXISTS shop_products;

  -- Drop shops table if it exists
  DROP TABLE IF EXISTS shops;

  -- Remove shop-images bucket
  DELETE FROM storage.buckets WHERE id = 'shop-images';
END $$;