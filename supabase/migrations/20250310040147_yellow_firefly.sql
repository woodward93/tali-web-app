/*
  # Create transactions table

  1. New Tables
    - `transactions`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `type` (text, either 'sale' or 'expense')
      - `items` (jsonb, array of selected items with quantities and prices)
      - `subtotal` (numeric)
      - `discount` (numeric)
      - `total` (numeric)
      - `payment_method` (text)
      - `payment_status` (text)
      - `contact_info` (jsonb)
      - `date` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `transactions` table
    - Add policy for authenticated users to manage their own transactions
*/

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('sale', 'expense')),
  items jsonb NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  discount numeric(12,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'mobile_money')),
  payment_status text NOT NULL CHECK (payment_status IN ('paid', 'partially_paid', 'unpaid')),
  contact_info jsonb NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_business_date ON transactions(business_id, date);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to manage their transactions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'transactions' 
    AND policyname = 'Users can manage transactions for their businesses'
  ) THEN
    CREATE POLICY "Users can manage transactions for their businesses"
      ON transactions
      FOR ALL
      TO authenticated
      USING (
        business_id IN (
          SELECT id FROM businesses WHERE user_id = auth.uid()
        )
      );
  END IF;
END
$$;