/*
  # Add PDF URL column to receipts_invoices table

  1. Changes
    - Add `pdf_url` column to store the URL of generated PDFs
*/

-- Add PDF URL column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipts_invoices' 
    AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE receipts_invoices ADD COLUMN pdf_url text;
  END IF;
END $$;