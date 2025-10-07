/*
  # Fix inventory_item_id nullable constraint

  1. Changes
    - Make inventory_item_id column nullable in shop_products table
    - This allows products to be created without linking to inventory items
    - Aligns database schema with application logic

  2. Security
    - No changes to existing RLS policies
    - Maintains all existing constraints except the NOT NULL on inventory_item_id
*/

-- Make inventory_item_id nullable in shop_products table
ALTER TABLE shop_products ALTER COLUMN inventory_item_id DROP NOT NULL;