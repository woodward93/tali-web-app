/*
  # Add receipts and invoices table

  1. New Tables
    - `receipts_invoices`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `transaction_id` (uuid, foreign key to transactions)
      - `type` (text, either 'receipt' or 'invoice')
      - `status` (text, either 'draft', 'sent', 'viewed')
      - `sent_at` (timestamptz)
      - `viewed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on receipts_invoices table
    - Add policy for authenticated users to manage their own receipts and invoices
*/

-- Create receipts_invoices table
CREATE TABLE receipts_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  transaction_id uuid REFERENCES transactions(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('receipt', 'invoice')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed')),
  sent_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_receipts_invoices_business ON receipts_invoices(business_id);
CREATE INDEX idx_receipts_invoices_transaction ON receipts_invoices(transaction_id);

-- Enable RLS
ALTER TABLE receipts_invoices ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage receipts and invoices for their businesses"
  ON receipts_invoices
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at
CREATE TRIGGER update_receipts_invoices_updated_at
  BEFORE UPDATE ON receipts_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();