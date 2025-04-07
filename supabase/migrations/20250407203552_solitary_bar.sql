/*
  # Add email column to user_profiles table

  1. Changes
    - Add email column to user_profiles table
    - Make email column required
    - Add unique constraint on email column

  2. Security
    - Maintain existing RLS policies
*/

-- Add email column if it doesn't exist
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email text NOT NULL;

-- Add unique constraint
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_email_key UNIQUE (email);

-- Add comment
COMMENT ON COLUMN user_profiles.email IS 'User''s email address from auth.users';