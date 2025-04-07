/*
  # Update businesses table with additional fields

  1. Changes
    - Add new columns to businesses table:
      - `country` (text, required)
      - `logo_url` (text, optional)
      - `address` (text, optional)
      - `preferred_currency` (text, required)

  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'USD';