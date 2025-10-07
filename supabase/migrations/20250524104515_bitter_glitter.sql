/*
  # Add bank payment records table

  1. New Tables
    - `bank_payment_records`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `date` (timestamptz)
      - `type` (text, either 'money-in' or 'money-out')
      - `description` (text)
      - `amount` (numeric)
      - `beneficiary_name` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on bank_payment_records table
    - Add policy for authenticated users
*/

CREATE TABLE bank_payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  date timestamptz NOT NULL,
  type text NOT NULL CHECK (type IN ('money-in', 'money-out')),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  beneficiary_name text,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_bank_payment_records_business_date 
ON bank_payment_records(business_id, date);

-- Enable RLS
ALTER TABLE bank_payment_records ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage their bank payment records"
  ON bank_payment_records
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );