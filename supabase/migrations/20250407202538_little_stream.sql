/*
  # Roll back user profiles changes

  1. Changes
    - Drop user_profiles table
    - Remove associated indexes and policies
*/

-- Drop the user_profiles table if it exists
DROP TABLE IF EXISTS user_profiles;

-- Note: Triggers and policies are automatically dropped when the table is dropped