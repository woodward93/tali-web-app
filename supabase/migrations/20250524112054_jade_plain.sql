-- Create bank_statement_analysis table
CREATE TABLE bank_statement_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) NOT NULL,
  analysis_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_bank_statement_analysis_business 
ON bank_statement_analysis(business_id);

-- Enable RLS
ALTER TABLE bank_statement_analysis ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage their bank statement analysis"
  ON bank_statement_analysis
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Set up CORS configuration for the analyze-bank-statement function
INSERT INTO cors_rules (
  path_pattern,
  allowed_origins,
  allowed_methods,
  allowed_headers
) VALUES (
  '/analyze-bank-statement',
  ARRAY['*'],
  ARRAY['POST', 'OPTIONS'],
  ARRAY['authorization', 'x-client-info', 'apikey', 'content-type']
)
ON CONFLICT (path_pattern) DO UPDATE
SET
  allowed_origins = EXCLUDED.allowed_origins,
  allowed_methods = EXCLUDED.allowed_methods,
  allowed_headers = EXCLUDED.allowed_headers;