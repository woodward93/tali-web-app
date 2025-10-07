/*
  # Add processed column to bank_payment_records table

  1. Changes
    - Add `processed` column to track which records have been converted to transactions
    - Add `transaction_id` column to link bank records to created transactions
    - Update existing records to set processed = false by default

  2. Security
    - No changes to existing RLS policies
*/

-- Add processed and transaction_id columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_payment_records' 
    AND column_name = 'processed'
  ) THEN
    ALTER TABLE bank_payment_records ADD COLUMN processed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_payment_records' 
    AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE bank_payment_records ADD COLUMN transaction_id uuid REFERENCES transactions(id);
  END IF;
END $$;

-- Create index for faster queries on processed status
CREATE INDEX IF NOT EXISTS idx_bank_payment_records_processed 
ON bank_payment_records(business_id, processed);

-- Create index for transaction_id
CREATE INDEX IF NOT EXISTS idx_bank_payment_records_transaction 
ON bank_payment_records(transaction_id);

-- Update existing records to set processed = false
UPDATE bank_payment_records 
SET processed = false 
WHERE processed IS NULL;