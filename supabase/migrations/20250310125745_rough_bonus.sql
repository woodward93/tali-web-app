/*
  # Add amount_paid column to transactions table

  1. Changes
    - Add amount_paid column to transactions table with default value of 0
    - Update existing transactions to set amount_paid based on payment_status:
      - paid: set to total amount
      - partially_paid: set to 0 (will need manual update)
      - unpaid: set to 0
*/

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) DEFAULT 0;

-- Update existing transactions
UPDATE transactions
SET amount_paid = total
WHERE payment_status = 'paid';

UPDATE transactions
SET amount_paid = 0
WHERE payment_status IN ('partially_paid', 'unpaid');