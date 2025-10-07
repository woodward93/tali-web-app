/*
  # Add payment records functionality

  1. New Tables
    - `payment_records`
      - Links bank payment records to transactions
      - Tracks payment amounts and dates
      - Associates payments with sales/expenses

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  transaction_id uuid REFERENCES transactions(id) NOT NULL,
  bank_record_id uuid REFERENCES bank_payment_records(id) NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_date timestamptz NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(bank_record_id)
);

-- Create indexes
CREATE INDEX idx_payment_records_business ON payment_records(business_id);
CREATE INDEX idx_payment_records_transaction ON payment_records(transaction_id);
CREATE INDEX idx_payment_records_bank_record ON payment_records(bank_record_id);

-- Enable RLS
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage their payment records"
  ON payment_records
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Add trigger to update transaction payment status
CREATE OR REPLACE FUNCTION update_transaction_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid numeric;
  transaction_total numeric;
BEGIN
  -- Get total amount paid for this transaction
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM payment_records
  WHERE transaction_id = NEW.transaction_id;

  -- Get transaction total
  SELECT total INTO transaction_total
  FROM transactions
  WHERE id = NEW.transaction_id;

  -- Update transaction payment status and amount_paid
  UPDATE transactions
  SET 
    amount_paid = total_paid,
    payment_status = CASE
      WHEN total_paid >= transaction_total THEN 'paid'
      WHEN total_paid > 0 THEN 'partially_paid'
      ELSE 'unpaid'
    END
  WHERE id = NEW.transaction_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_transaction_payment_status_on_insert
  AFTER INSERT ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_payment_status();

CREATE TRIGGER update_transaction_payment_status_on_update
  AFTER UPDATE OF amount ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_payment_status();

CREATE TRIGGER update_transaction_payment_status_on_delete
  AFTER DELETE ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_payment_status();