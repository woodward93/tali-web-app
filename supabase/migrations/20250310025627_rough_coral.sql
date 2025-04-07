/*
  # Initial Schema Setup for BusinessBook

  1. New Tables
    - businesses
      - Basic business information
    - transactions
      - Sales and expense records
    - inventory_items
      - Product inventory tracking
    - shop_products
      - Online shop products
    - documents
      - Receipts and invoices

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Businesses table
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own businesses"
  ON businesses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Transactions table
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses NOT NULL,
  type text NOT NULL CHECK (type IN ('sale', 'expense')),
  amount decimal(12,2) NOT NULL,
  description text,
  date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage transactions for their businesses"
  ON transactions
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Inventory items table
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses NOT NULL,
  name text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 0,
  unit_price decimal(12,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage inventory for their businesses"
  ON inventory_items
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Shop products table
CREATE TABLE shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses NOT NULL,
  inventory_item_id uuid REFERENCES inventory_items,
  name text NOT NULL,
  description text,
  price decimal(12,2) NOT NULL,
  image_url text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage shop products for their businesses"
  ON shop_products
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Documents table
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses NOT NULL,
  type text NOT NULL CHECK (type IN ('receipt', 'invoice')),
  number text NOT NULL,
  amount decimal(12,2) NOT NULL,
  issued_to text,
  issued_date timestamptz DEFAULT now(),
  due_date timestamptz,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage documents for their businesses"
  ON documents
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX idx_transactions_business_date ON transactions(business_id, date);
CREATE INDEX idx_inventory_items_business ON inventory_items(business_id);
CREATE INDEX idx_shop_products_business ON shop_products(business_id);
CREATE INDEX idx_documents_business_type ON documents(business_id, type);