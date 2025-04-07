/*
  # Add PDF URL to receipts and invoices

  1. Changes
    - Add pdf_url column to receipts_invoices table
    - Create storage bucket for documents
    - Add storage policies for document access
*/

-- Add PDF URL column
ALTER TABLE receipts_invoices
ADD COLUMN pdf_url text;

-- Create documents bucket
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('documents', 'documents', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Policy to allow authenticated users to upload documents
CREATE POLICY "Users can upload their documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
);

-- Policy to allow authenticated users to update their documents
CREATE POLICY "Users can update their documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- Policy to allow authenticated users to delete their documents
CREATE POLICY "Users can delete their documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');

-- Policy to allow public read access to documents
CREATE POLICY "Public read access to documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');