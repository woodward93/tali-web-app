-- Fix Business Logo Public Access
-- This SQL fixes the RLS policy so that business data (including logo_url)
-- is returned when querying shops through the public anon key

-- Step 1: Drop any existing conflicting policies
DROP POLICY IF EXISTS "Public can view business info for active shops" ON businesses;
DROP POLICY IF EXISTS "Anyone can view business info through shops" ON businesses;

-- Step 2: Create a new policy that allows anon users to view businesses with active shops
CREATE POLICY "anon_select_businesses_with_active_shops"
  ON businesses
  FOR SELECT
  TO anon, authenticated
  USING (
    id IN (
      SELECT business_id FROM shops WHERE active = true
    )
  );
