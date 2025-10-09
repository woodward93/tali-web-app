/*
  # Fix infinite recursion in RLS policies

  1. Changes
    - Fix the "Users can manage their shops" policy on shops table to avoid circular dependency
    - The policy was recursively querying shops table within its own definition
    - Replace with direct join to businesses table to check user ownership

  2. Security
    - Maintains same security model: users can only manage their own shops
    - Breaks circular dependency that was causing infinite recursion
    - Preserves public access for active shops
*/

-- Fix the shops table policy that's causing infinite recursion
DROP POLICY IF EXISTS "Users can manage their shops" ON shops;

CREATE POLICY "Users can manage their shops"
  ON shops
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE businesses.id = shops.business_id 
      AND businesses.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE businesses.id = shops.business_id 
      AND businesses.user_id = auth.uid()
    )
  );