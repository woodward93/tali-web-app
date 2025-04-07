/*
  # Add shop_id column to shop_products table

  1. Changes
    - Add shop_id column as a foreign key to shops table
    - Make shop_id column required (NOT NULL)
    - Add index for faster queries
    - Update RLS policies to include shop_id check

  2. Security
    - Maintain existing RLS policies
    - Add shop_id to policy checks
*/

-- Add shop_id column
ALTER TABLE shop_products
ADD COLUMN shop_id uuid REFERENCES shops(id) NOT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_shop_products_shop ON shop_products(shop_id);

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage shop products for their businesses" ON shop_products;

-- Create new policy that includes shop_id check
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