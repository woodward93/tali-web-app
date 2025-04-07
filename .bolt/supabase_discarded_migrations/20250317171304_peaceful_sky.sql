/*
  # Add slug column and rename to description

  1. Changes
    - Add 'slug' column to shop_products table
    - Rename 'slug' column to 'description'
    - Ensure description is nullable
*/

-- First add the slug column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_products' 
    AND column_name = 'slug'
  ) THEN
    ALTER TABLE shop_products 
    ADD COLUMN slug text;
  END IF;
END $$;

-- Then rename it to description
ALTER TABLE shop_products 
RENAME COLUMN slug TO description;

-- Make sure description is nullable
ALTER TABLE shop_products 
ALTER COLUMN description DROP NOT NULL;