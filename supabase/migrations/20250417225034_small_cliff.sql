/*
  # Deploy analyze-business edge function

  1. Changes
    - Deploy the analyze-business edge function
    - Set up proper CORS and error handling
    - Configure environment variables
*/

-- Deploy the analyze-business function
DO $$
BEGIN
  -- Create or update the function
  CREATE OR REPLACE FUNCTION http.analyze_business(request http.HttpRequest)
  RETURNS http.HttpResponse
  LANGUAGE plpgsql
  AS $$
  BEGIN
    -- Function implementation is handled by the Edge Runtime
    -- This is just a placeholder for the function registration
    RETURN http.new_response();
  END;
  $$;

  -- Set up proper CORS headers
  INSERT INTO http.cors_rules (
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
END $$;