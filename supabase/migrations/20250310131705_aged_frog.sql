/*
  # Add balance column to transactions table

  1. Changes
    - Add `balance` column to `transactions` table
      - Computed column that calculates the remaining balance based on payment status and amount paid
      - For paid transactions: balance = 0
      - For unpaid transactions: balance = total
      - For partially paid transactions: balance = total - amount_paid

  2. Notes
    - The balance is automatically computed, no need to update it manually
    - The balance will update automatically when total or amount_paid changes
*/

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance numeric(12,2) 
GENERATED ALWAYS AS (
  CASE 
    WHEN payment_status = 'paid' THEN 0
    WHEN payment_status = 'unpaid' THEN total
    ELSE total - amount_paid
  END
) STORED;

COMMENT ON COLUMN transactions.balance IS 'Computed remaining balance based on payment status and amount paid';