export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

export interface TransactionItem extends InventoryItem {
  quantity_selected: number;
  subtotal: number;
}

export type TransactionType = 'sale' | 'expense';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'mobile_money';
export type PaymentStatus = 'paid' | 'partially_paid' | 'unpaid';

export interface Contact {
  id: string;
  business_id: string;
  type: 'customer' | 'supplier';
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  business_id: string;
  contact_id: string;
  type: TransactionType;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  total: number;
  amount_paid: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  date: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  created_at: string;
  updated_at: string;
}