-- Drop the bank_statement_analysis table
DROP TABLE IF EXISTS bank_statement_analysis;

-- Remove CORS configuration for analyze-bank-statement function
DELETE FROM cors_rules WHERE path_pattern = '/analyze-bank-statement';