/*
  # Rename slug column to description in shop_products table

  1. Changes
    - Rename 'slug' column to 'description' in shop_products table
    - Ensure description is nullable
    - Maintain existing data by converting slug values to descriptions
*/

-- Rename slug column to description
ALTER TABLE shop_products 
RENAME COLUMN slug TO description;

-- Make sure description is nullable
ALTER TABLE shop_products 
ALTER COLUMN description DROP NOT NULL;