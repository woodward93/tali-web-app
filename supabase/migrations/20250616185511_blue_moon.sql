/*
  # Add automatic transaction creation for completed shop orders

  1. New Functions
    - `create_transaction_from_order()` - Creates a transaction when an order is completed
    - Handles both INSERT and UPDATE scenarios for shop orders

  2. Triggers
    - `auto_create_transaction_on_order_completion` - Triggers transaction creation

  3. Security
    - Function runs with security definer privileges
    - Maintains data integrity between orders and transactions
*/

-- Create function to automatically create transaction from completed shop order
CREATE OR REPLACE FUNCTION create_transaction_from_order()
RETURNS TRIGGER AS $$
DECLARE
  shop_business_id uuid;
  customer_contact_id uuid;
  transaction_items jsonb;
BEGIN
  -- Only proceed if the order status is 'completed'
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Skip if this is an UPDATE and status was already 'completed'
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get the business_id from the shop
  SELECT business_id INTO shop_business_id
  FROM shops
  WHERE id = NEW.shop_id;

  IF shop_business_id IS NULL THEN
    RAISE EXCEPTION 'Shop not found for order %', NEW.id;
  END IF;

  -- Find or create customer contact
  SELECT id INTO customer_contact_id
  FROM contacts
  WHERE business_id = shop_business_id
    AND type = 'customer'
    AND name = NEW.customer_name;

  -- Create customer contact if it doesn't exist
  IF customer_contact_id IS NULL THEN
    INSERT INTO contacts (
      business_id,
      type,
      name,
      phone,
      created_at,
      updated_at
    )
    VALUES (
      shop_business_id,
      'customer',
      NEW.customer_name,
      (NEW.shipping_address->>'phone'),
      now(),
      now()
    )
    RETURNING id INTO customer_contact_id;
  END IF;

  -- Prepare transaction items from order items
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', item->>'name',
      'quantity_selected', (item->>'quantity')::integer,
      'selling_price', (item->>'price')::numeric,
      'subtotal', (item->>'total')::numeric
    )
  ) INTO transaction_items
  FROM jsonb_array_elements(NEW.items) AS item;

  -- Create the transaction
  INSERT INTO transactions (
    business_id,
    contact_id,
    type,
    items,
    subtotal,
    discount,
    total,
    amount_paid,
    payment_method,
    payment_status,
    date,
    created_at
  )
  VALUES (
    shop_business_id,
    customer_contact_id,
    'sale',
    transaction_items,
    NEW.total - COALESCE(NEW.shipping_cost, 0),
    0, -- No discount for shop orders
    NEW.total,
    NEW.total, -- Assume fully paid since order is completed
    'card', -- Assume card payment for online orders
    'paid',
    NEW.created_at,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT operations
CREATE TRIGGER auto_create_transaction_on_order_insert
  AFTER INSERT ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_transaction_from_order();

-- Create trigger for UPDATE operations
CREATE TRIGGER auto_create_transaction_on_order_update
  AFTER UPDATE ON shop_orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION create_transaction_from_order();

-- Add comment explaining the automatic transaction creation
COMMENT ON FUNCTION create_transaction_from_order() IS 'Automatically creates a transaction record when a shop order is marked as completed';