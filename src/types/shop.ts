// Shop Types
export interface Shop {
  id: string;
  business_id: string;
  name: string;
  domain: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopProduct {
  id: string;
  shop_id: string;
  business_id: string;
  inventory_item_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  images: string[];
  seo_title: string | null;
  seo_description: string | null;
  active: boolean;
  in_stock: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
  inventory_item?: {
    quantity: number;
    category?: {
      name: string;
    };
  };
}

export interface ShopOrder {
  id: string;
  shop_id: string;
  order_number: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  customer_email: string;
  customer_name: string;
  shipping_address: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
    phone?: string;
  };
  billing_address: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
    phone?: string;
  };
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  total: number;
  created_at: string;
}

export interface ShopMetrics {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  topProducts: {
    id: string;
    name: string;
    total_sold: number;
    revenue: number;
  }[];
}