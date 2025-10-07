/*
  # Add Paystack integration columns to shop_orders table

  1. Changes
    - Add `payment_reference` column to store Paystack payment reference
    - Add `shipping_method` column to store selected shipping method name
    - Add `shipping_cost` column to store shipping cost
    - Add `items` column to store order items as JSONB
    - Add `shipping_address` column to store shipping address as JSONB

  2. Security
    - Maintain existing RLS policies
    - No changes to existing constraints
*/

-- Add new columns to shop_orders table
ALTER TABLE shop_orders 
ADD COLUMN IF NOT EXISTS payment_reference text,
ADD COLUMN IF NOT EXISTS shipping_method text,
ADD COLUMN IF NOT EXISTS shipping_cost numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS shipping_address jsonb DEFAULT '{}'::jsonb;

-- Create index for payment reference lookups
CREATE INDEX IF NOT EXISTS idx_shop_orders_payment_reference ON shop_orders(payment_reference);

-- Add comments for documentation
COMMENT ON COLUMN shop_orders.payment_reference IS 'Paystack payment reference for tracking payments';
COMMENT ON COLUMN shop_orders.shipping_method IS 'Name of the selected shipping method';
COMMENT ON COLUMN shop_orders.shipping_cost IS 'Cost of shipping for this order';
COMMENT ON COLUMN shop_orders.items IS 'Array of order items with product details';
COMMENT ON COLUMN shop_orders.shipping_address IS 'Customer shipping address and contact information';