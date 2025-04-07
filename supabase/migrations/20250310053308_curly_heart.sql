/*
  # Add contacts table and update transactions

  1. New Tables
    - `contacts`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `type` (text, either 'customer' or 'supplier')
      - `name` (text)
      - `phone` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes
    - Add `contact_id` to transactions table
    - Remove `contact_info` from transactions table

  3. Security
    - Enable RLS on contacts table
    - Add policies for authenticated users to manage their business contacts
*/

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  type text NOT NULL CHECK (type IN ('customer', 'supplier')),
  name text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (business_id, name)
);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can manage contacts for their businesses"
  ON contacts
  FOR ALL
  TO authenticated
  USING (business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  ));

-- Add contact_id to transactions
ALTER TABLE transactions 
  ADD COLUMN contact_id uuid REFERENCES contacts(id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for contacts
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX idx_contacts_business_type ON contacts(business_id, type);
CREATE INDEX idx_contacts_name ON contacts(name);