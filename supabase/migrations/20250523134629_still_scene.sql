-- Deploy the process-bank-statement function
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

-- Set up CORS configuration for the function
INSERT INTO cors_rules (
  path_pattern,
  allowed_origins,
  allowed_methods,
  allowed_headers
) VALUES (
  '/process-bank-statement',
  ARRAY['*'],
  ARRAY['POST', 'OPTIONS'],
  ARRAY['authorization', 'x-client-info', 'apikey', 'content-type']
)
ON CONFLICT (path_pattern) DO UPDATE
SET
  allowed_origins = EXCLUDED.allowed_origins,
  allowed_methods = EXCLUDED.allowed_methods,
  allowed_headers = EXCLUDED.allowed_headers;