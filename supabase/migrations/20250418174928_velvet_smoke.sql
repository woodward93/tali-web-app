-- Remove previous function attempt if it exists
DROP FUNCTION IF EXISTS http.analyze_business;

-- Set up CORS configuration
CREATE TABLE IF NOT EXISTS cors_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_pattern text NOT NULL UNIQUE,
  allowed_origins text[] NOT NULL,
  allowed_methods text[] NOT NULL,
  allowed_headers text[] NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Insert CORS rules for analyze-business function
INSERT INTO cors_rules (
  path_pattern,
  allowed_origins,
  allowed_methods,
  allowed_headers
) VALUES (
  '/analyze-business',
  ARRAY['*'],
  ARRAY['POST', 'OPTIONS'],
  ARRAY['authorization', 'x-client-info', 'apikey', 'content-type']
)
ON CONFLICT (path_pattern) DO UPDATE
SET
  allowed_origins = EXCLUDED.allowed_origins,
  allowed_methods = EXCLUDED.allowed_methods,
  allowed_headers = EXCLUDED.allowed_headers;