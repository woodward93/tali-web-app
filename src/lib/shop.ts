import { supabase } from './supabase';
import type { Shop, ShopProduct, ShopOrder, ShopMetrics } from '../types/shop';

// Load shop details
export const loadShop = async (domain: string): Promise<Shop | null> => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('domain', domain)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
};

// Load shop products
export const loadShopProducts = async (shopId: string): Promise<ShopProduct[]> => {
  const { data, error } = await supabase
    .from('shop_products')
    .select('*')
    .eq('shop_id', shopId)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// Load shop orders
export const loadShopOrders = async (shopId: string): Promise<ShopOrder[]> => {
  const { data, error } = await supabase
    .from('shop_orders')
    .select(`
      *,
      items:shop_order_items(*)
    `)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// Load shop metrics
export const loadShopMetrics = async (shopId: string): Promise<ShopMetrics> => {
  const [
    { data: orders },
    { data: products },
    { data: topProducts }
  ] = await Promise.all([
    // Get all orders
    supabase
      .from('shop_orders')
      .select('total, status')
      .eq('shop_id', shopId)
      .eq('status', 'completed'),
    
    // Get active products count
    supabase
      .from('shop_products')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('active', true),

    // Get top products
    supabase
      .from('shop_order_items')
      .select(`
        product:shop_products(id, name),
        quantity,
        total
      `)
      .eq('shop_products.shop_id', shopId)
      .order('total', { ascending: false })
      .limit(5)
  ]);

  if (!orders || !products || !topProducts) {
    throw new Error('Failed to load shop metrics');
  }

  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  const averageOrderValue = orders.length > 0 ? totalSales / orders.length : 0;

  return {
    totalSales,
    totalOrders: orders.length,
    totalProducts: products.length,
    averageOrderValue,
    topProducts: topProducts.map(item => ({
      id: item.product.id,
      name: item.product.name,
      total_sold: item.quantity,
      revenue: item.total
    }))
  };
};

// Create or update shop product
export const upsertShopProduct = async (
  shopId: string,
  product: Partial<ShopProduct> & { name: string; price: number }
): Promise<ShopProduct> => {
  // Generate slug from name if not provided
  const slug = product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const { data, error } = await supabase
    .from('shop_products')
    .upsert({
      ...product,
      shop_id: shopId,
      slug,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Update product stock
export const updateProductStock = async (
  productId: string,
  inStock: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('shop_products')
    .update({ in_stock: inStock, updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (error) throw error;
};

// Create shop order
export const createShopOrder = async (
  shopId: string,
  orderData: Omit<ShopOrder, 'id' | 'shop_id' | 'created_at' | 'updated_at'>,
  orderItems: Omit<ShopOrderItem, 'id' | 'order_id' | 'created_at'>[]
): Promise<ShopOrder> => {
  const { data: order, error: orderError } = await supabase
    .from('shop_orders')
    .insert({
      ...orderData,
      shop_id: shopId
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // Insert order items
  const { error: itemsError } = await supabase
    .from('shop_order_items')
    .insert(
      orderItems.map(item => ({
        ...item,
        order_id: order.id
      }))
    );

  if (itemsError) throw itemsError;

  return order;
};

// Update order status
export const updateOrderStatus = async (
  orderId: string,
  status: ShopOrder['status']
): Promise<void> => {
  const { error } = await supabase
    .from('shop_orders')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId);

  if (error) throw error;
};