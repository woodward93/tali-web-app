import React, { useState, useEffect } from 'react';
import { Plus, Settings, Share2, ExternalLink, DollarSign, Package, ShoppingBag, Search, Edit2, Trash2, Eye, Pencil, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/format';
import { ProductForm } from '../components/shop/ProductForm';

interface Shop {
  id: string;
  business_id: string;
  name: string;
  domain: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ShopProduct {
  id: string;
  shop_id: string;
  inventory_item_id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  images: string[];
  active: boolean;
  featured: boolean;
  created_at: string;
  inventory_item: {
    name: string;
    selling_price: number;
    description: string | null;
    type: string;
  };
}

interface ShopOrder {
  id: string;
  shop_id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  total: number;
  status: string;
  created_at: string;
  payment_reference?: string;
  shipping_method?: string;
  shipping_cost?: number;
  items?: Array<{
    product_id: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  shipping_address?: {
    name: string;
    phone: string;
    state: string;
    address: string;
  };
}

interface BusinessProfile {
  id: string;
  name: string;
  preferred_currency: string;
}

interface ShippingMethod {
  id: string;
  type: 'free' | 'pickup' | 'standard' | 'flat_rate' | 'custom';
  name: string;
  cost: number;
  location?: string; // For custom shipping methods
  enabled: boolean;
}

interface ShopSettings {
  shipping_methods: ShippingMethod[];
  bank_name: string;
  bank_account_number: string;
  account_holder_name: string;
}

interface OrderDetailsModalProps {
  order: ShopOrder;
  currency: string;
  onClose: () => void;
}

function OrderDetailsModal({ order, currency, onClose }: OrderDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">Order Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Information */}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Order Information</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Order Number:</span>
                  <span className="text-sm font-medium text-gray-900">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Date:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    order.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : order.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : order.status === 'processing'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
                {order.payment_reference && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Payment Reference:</span>
                    <span className="text-sm font-medium text-gray-900">{order.payment_reference}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Information */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Customer Information</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Name:</span>
                  <span className="text-sm font-medium text-gray-900">{order.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Email:</span>
                  <span className="text-sm font-medium text-gray-900">{order.customer_email}</span>
                </div>
                {order.shipping_address && (
                  <>
                    {order.shipping_address.phone && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Phone:</span>
                        <span className="text-sm font-medium text-gray-900">{order.shipping_address.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">State:</span>
                      <span className="text-sm font-medium text-gray-900">{order.shipping_address.state}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Address:</span>
                      <span className="text-sm font-medium text-gray-900 text-right max-w-xs">
                        {order.shipping_address.address}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Shipping Information */}
            {order.shipping_method && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Shipping Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Method:</span>
                    <span className="text-sm font-medium text-gray-900">{order.shipping_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Cost:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {order.shipping_cost === 0 ? 'Free' : `${formatCurrency(order.shipping_cost || 0)} ${currency}`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Items and Summary */}
          <div className="space-y-6">
            {/* Order Items */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Order Items</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                {order.items && order.items.length > 0 ? (
                  <div className="space-y-3">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            Qty: {item.quantity} × {formatCurrency(item.price)} {currency}
                          </p>
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(item.total)} {currency}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No item details available</p>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Order Summary</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {order.items && order.items.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(order.items.reduce((sum, item) => sum + item.total, 0))} {currency}
                    </span>
                  </div>
                )}
                {order.shipping_cost !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Shipping:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {order.shipping_cost === 0 ? 'Free' : `${formatCurrency(order.shipping_cost)} ${currency}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="text-base font-medium text-gray-900">Total:</span>
                  <span className="text-base font-medium text-gray-900">
                    {formatCurrency(order.total)} {currency}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnlineShop() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditShop, setShowEditShop] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<ShopOrder | null>(null);
  const [editShopData, setEditShopData] = useState({
    name: '',
    description: ''
  });
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [shopMetrics, setShopMetrics] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0
  });
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    shipping_methods: [],
    bank_name: '',
    bank_account_number: '',
    account_holder_name: ''
  });
  const [settingsActiveTab, setSettingsActiveTab] = useState<'shipping' | 'settlement'>('shipping');
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    description: ''
  });

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
    }
  }, [user]);

  useEffect(() => {
    if (shop && showEditShop) {
      setEditShopData({
        name: shop.name,
        description: shop.description || ''
      });
    }
  }, [shop, showEditShop]);

  const loadBusinessProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, preferred_currency')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setBusinessProfile(data);
      setFormData(prev => ({ ...prev, name: data.name, domain: data.name.toLowerCase().replace(/[^a-z0-9]/g, '-') }));
      
      if (data) {
        await loadShop(data.id);
      }
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
    } finally {
      setLoading(false);
    }
  };

  const loadShop = async (businessId: string) => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('business_id', businessId)
        .eq('active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No shop found - this is valid
          return;
        }
        throw error;
      }

      setShop(data);
      await Promise.all([
        loadShopProducts(data.id),
        loadShopOrders(data.id),
        loadShopMetrics(data.id),
        loadShopSettings(data.id)
      ]);
    } catch (err) {
      console.error('Error loading shop:', err);
      toast.error('Failed to load shop');
    }
  };

  const loadShopProducts = async (shopId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select(`
          *,
          inventory_item:inventory_items(name, selling_price, description, type)
        `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShopProducts(data || []);
    } catch (err) {
      console.error('Error loading shop products:', err);
      toast.error('Failed to load shop products');
    }
  };

  const loadShopOrders = async (shopId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShopOrders(data || []);
    } catch (err) {
      console.error('Error loading shop orders:', err);
      toast.error('Failed to load shop orders');
    }
  };

  const loadShopMetrics = async (shopId: string) => {
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('shop_orders')
        .select('total')
        .eq('shop_id', shopId)
        .eq('status', 'completed');

      if (ordersError) throw ordersError;

      const { count: activeProductsCount, error: productsError } = await supabase
        .from('shop_products')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('active', true);

      if (productsError) throw productsError;

      const totalSales = orders?.reduce((sum, order) => sum + order.total, 0) || 0;
      const totalOrders = orders?.length || 0;
      const totalProducts = activeProductsCount || 0;

      setShopMetrics({
        totalSales,
        totalOrders,
        totalProducts
      });
    } catch (err) {
      console.error('Error loading shop metrics:', err);
    }
  };

  const loadInventoryItems = async () => {
    if (!businessProfile) return;

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('business_id', businessProfile.id)
        .order('name');

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (err) {
      console.error('Error loading inventory items:', err);
      toast.error('Failed to load inventory items');
    }
  };

  const loadShopSettings = async (shopId: string) => {
    try {
      // Load shipping methods
      const { data: shippingMethods, error: shippingError } = await supabase
        .from('shop_shipping_methods')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at');

      if (shippingError && shippingError.code !== 'PGRST116') throw shippingError;

      // Load bank details
      const { data: bankDetails, error: bankError } = await supabase
        .from('shop_bank_details')
        .select('*')
        .eq('shop_id', shopId)
        .single();

      // Bank details might not exist yet, so don't throw error if not found
      if (bankError && bankError.code !== 'PGRST116') throw bankError;

      setShopSettings({
        shipping_methods: shippingMethods || [],
        bank_name: bankDetails?.bank_name || '',
        bank_account_number: bankDetails?.account_number || '',
        account_holder_name: bankDetails?.account_holder_name || ''
      });
    } catch (err) {
      console.error('Error loading shop settings:', err);
      toast.error('Failed to load shop settings');
    }
  };

  const handleSetupShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessProfile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shops')
        .insert({
          business_id: businessProfile.id,
          name: formData.name,
          domain: formData.domain,
          description: formData.description || null,
          active: true
        })
        .select()
        .single();

      if (error) throw error;

      setShop(data);
      setShowSetupForm(false);
      toast.success('Shop created successfully!');
    } catch (err: any) {
      console.error('Error creating shop:', err);
      toast.error(err.message || 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  const handleEditShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('shops')
        .update({
          name: editShopData.name.trim(),
          description: editShopData.description.trim() || null
        })
        .eq('id', shop.id);

      if (error) throw error;

      // Update local shop state
      setShop(prev => prev ? {
        ...prev,
        name: editShopData.name.trim(),
        description: editShopData.description.trim() || null
      } : null);

      setShowEditShop(false);
      toast.success('Shop updated successfully!');
    } catch (err: any) {
      console.error('Error updating shop:', err);
      toast.error(err.message || 'Failed to update shop');
    } finally {
      setLoading(false);
    }
  };

  const handleShareShop = () => {
    if (!shop) return;
    const url = `${window.location.origin}/shop/${shop.domain}`;
    navigator.clipboard.writeText(url);
    toast.success('Shop URL copied to clipboard!');
  };

  const handleViewShop = () => {
    if (!shop) return;
    const url = `${window.location.origin}/shop/${shop.domain}`;
    window.open(url, '_blank');
  };

  const handleAddExistingProduct = async (item: any) => {
    if (!shop) return;

    try {
      const { error } = await supabase
        .from('shop_products')
        .insert({
          shop_id: shop.id,
          business_id: businessProfile.id,
          inventory_item_id: item.id,
          name: item.name,
          description: item.description,
          price: item.selling_price,
          active: true,
          featured: false,
          images: []
        });

      if (error) throw error;

      await loadShopProducts(shop.id);
      await loadShopMetrics(shop.id);
      setShowProductSelector(false);
      toast.success('Product added to shop!');
    } catch (err: any) {
      console.error('Error adding product to shop:', err);
      toast.error(err.message || 'Failed to add product to shop');
    }
  };

  const handleEditProduct = (product: ShopProduct) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleProductFormSuccess = () => {
    setShowProductForm(false);
    setEditingProduct(null);
    if (shop) {
      loadShopProducts(shop.id);
      loadShopMetrics(shop.id);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to remove this product from your shop?')) return;

    try {
      const { error } = await supabase
        .from('shop_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      if (shop) {
        await loadShopProducts(shop.id);
        await loadShopMetrics(shop.id);
      }
      toast.success('Product removed from shop');
    } catch (err: any) {
      console.error('Error deleting product:', err);
      toast.error(err.message || 'Failed to remove product');
    }
  };

  const handleViewOrderDetails = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      setSelectedOrderDetails(data);
      setShowOrderDetailsModal(true);
    } catch (err: any) {
      console.error('Error fetching order details:', err);
      toast.error(err.message || 'Failed to load order details');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;

    try {
      const { error } = await supabase
        .from('shop_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      if (shop) {
        await loadShopOrders(shop.id);
        await loadShopMetrics(shop.id);
      }
      toast.success('Order deleted');
    } catch (err: any) {
      console.error('Error deleting order:', err);
      toast.error(err.message || 'Failed to delete order');
    }
  };

  const handleSaveSettings = async () => {
    if (!shop) return;

    try {
      // Save shipping methods
      for (const method of shopSettings.shipping_methods) {
        if (method.id.startsWith('temp-')) {
          // New method
          const { error } = await supabase
            .from('shop_shipping_methods')
            .insert({
              shop_id: shop.id,
              type: method.type,
              name: method.name,
              cost: method.cost,
              location: method.location,
              enabled: method.enabled
            });
          if (error) throw error;
        } else {
          // Update existing method
          const { error } = await supabase
            .from('shop_shipping_methods')
            .update({
              type: method.type,
              name: method.name,
              cost: method.cost,
              location: method.location,
              enabled: method.enabled
            })
            .eq('id', method.id);
          if (error) throw error;
        }
      }

      // Save bank details
      const { error: bankError } = await supabase
        .from('shop_bank_details')
        .upsert({
          shop_id: shop.id,
          bank_name: shopSettings.bank_name,
          account_number: shopSettings.bank_account_number,
          account_holder_name: shopSettings.account_holder_name
        }, {
          onConflict: 'shop_id'
        });

      if (bankError) throw bankError;

      await loadShopSettings(shop.id);
      setShowSettings(false);
      toast.success('Settings saved successfully!');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error(err.message || 'Failed to save settings');
    }
  };

  const addCustomShippingMethod = () => {
    const newMethod: ShippingMethod = {
      id: `temp-${Date.now()}`,
      type: 'custom',
      name: '',
      cost: 0,
      location: '',
      enabled: true
    };
    setShopSettings(prev => ({
      ...prev,
      shipping_methods: [...prev.shipping_methods, newMethod]
    }));
  };

  const updateShippingMethod = (id: string, updates: Partial<ShippingMethod>) => {
    setShopSettings(prev => ({
      ...prev,
      shipping_methods: prev.shipping_methods.map(method =>
        method.id === id ? { ...method, ...updates } : method
      )
    }));
  };

  const removeShippingMethod = (id: string) => {
    setShopSettings(prev => ({
      ...prev,
      shipping_methods: prev.shipping_methods.filter(method => method.id !== id)
    }));
  };

  const getShippingMethodLabel = (method: ShippingMethod) => {
    switch (method.type) {
      case 'free':
        return 'Free Shipping';
      case 'pickup':
        return 'Store Pickup';
      case 'standard':
        return 'Standard Shipping';
      case 'flat_rate':
        return 'Flat Rate Shipping';
      case 'custom':
        return method.location ? `${method.location} Shipping` : 'Custom Shipping';
      default:
        return method.name;
    }
  };

  const filteredProducts = shopProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = shopOrders.filter(order =>
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInventoryItems = inventoryItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !shopProducts.some(sp => sp.inventory_item_id === item.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!businessProfile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-base font-semibold text-primary-600">No Business Profile</h2>
        <p className="mt-2 text-sm text-gray-500">Please set up your business profile first.</p>
      </div>
    );
  }

  // Shop Setup Form
  if (!shop && !showSetupForm) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Your Online Shop</h2>
          <p className="text-gray-600 mb-8">
            Start selling your products online with a custom shop that's easy to set up and manage.
          </p>
          <button
            onClick={() => setShowSetupForm(true)}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Set Up Shop
          </button>
        </div>
      </div>
    );
  }

  if (showSetupForm) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Set Up Your Online Shop</h2>
          <form onSubmit={handleSetupShop} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Shop Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Shop Domain</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  shop/
                </span>
                <input
                  type="text"
                  required
                  value={formData.domain}
                  onChange={e => setFormData(prev => ({ ...prev, domain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                  className="flex-1 rounded-none rounded-r-md border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Only lowercase letters, numbers, and hyphens are allowed.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Shop Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Describe your shop and what you sell..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSetupForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Shop'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Product Selector Modal
  if (showProductSelector) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Add Products to Shop</h3>
            <button
              onClick={() => setShowProductSelector(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search inventory items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredInventoryItems.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No items available</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All your inventory items are already in your shop or you haven't created any yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredInventoryItems.map(item => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      <span className="text-lg font-bold text-gray-900">
                        {formatCurrency(item.selling_price)} {businessProfile.preferred_currency}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {item.type}
                      </span>
                      <button
                        onClick={() => handleAddExistingProduct(item)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-primary-600 hover:bg-primary-700"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add to Shop
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Settings Modal
  if (showSettings) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Shop Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setSettingsActiveTab('shipping')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  settingsActiveTab === 'shipping'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Shipping Methods
              </button>
              <button
                onClick={() => setSettingsActiveTab('settlement')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  settingsActiveTab === 'settlement'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Settlement Details
              </button>
            </nav>
          </div>

          {settingsActiveTab === 'shipping' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-gray-900">Shipping Methods</h4>
                <button
                  onClick={addCustomShippingMethod}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-primary-600 hover:bg-primary-700"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Custom Method
                </button>
              </div>

              <div className="space-y-3">
                {shopSettings.shipping_methods.map(method => (
                  <div key={method.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Method</label>
                        <select
                          value={method.type}
                          onChange={e => updateShippingMethod(method.id, { type: e.target.value as any })}
                          className="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="free">Free Shipping</option>
                          <option value="pickup">Store Pickup</option>
                          <option value="standard">Standard Shipping</option>
                          <option value="flat_rate">Flat Rate</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={method.name || getShippingMethodLabel(method)}
                          onChange={e => updateShippingMethod(method.id, { name: e.target.value })}
                          className="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>

                      {method.type === 'custom' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                          <input
                            type="text"
                            value={method.location || ''}
                            onChange={e => updateShippingMethod(method.id, { location: e.target.value })}
                            className="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                            placeholder="e.g., Lagos, Abuja"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Cost ({businessProfile.preferred_currency})</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={method.cost}
                          onChange={e => updateShippingMethod(method.id, { cost: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={method.enabled}
                          onChange={e => updateShippingMethod(method.id, { enabled: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-600">Enabled</span>
                      </label>

                      <button
                        onClick={() => removeShippingMethod(method.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Bank Name</label>
                <input
                  type="text"
                  value={shopSettings.bank_name}
                  onChange={e => setShopSettings(prev => ({ ...prev, bank_name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Enter bank name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Account Number</label>
                <input
                  type="text"
                  value={shopSettings.bank_account_number}
                  onChange={e => setShopSettings(prev => ({ ...prev, bank_account_number: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Enter account number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Account Holder Name</label>
                <input
                  type="text"
                  value={shopSettings.account_holder_name}
                  onChange={e => setShopSettings(prev => ({ ...prev, account_holder_name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Enter account holder name"
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shop Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
            {shop.description && (
              <p className="mt-1 text-gray-600">{shop.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleShareShop}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </button>
            <button
              onClick={handleViewShop}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Shop
            </button>
            <button
              onClick={() => setShowEditShop(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </button>
          </div>
        </div>

        {/* Shop Metrics */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-green-500 bg-opacity-10 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Total Sales</p>
                <p className="text-xl font-bold text-green-900">
                  {formatCurrency(shopMetrics.totalSales)} {businessProfile.preferred_currency}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-blue-500 bg-opacity-10 rounded-full">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Total Orders</p>
                <p className="text-xl font-bold text-blue-900">{shopMetrics.totalOrders}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-purple-500 bg-opacity-10 rounded-full">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Active Products</p>
                <p className="text-xl font-bold text-purple-900">{shopMetrics.totalProducts}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm">
        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('products')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'products'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Products ({shopProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'orders'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Orders ({shopOrders.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            {activeTab === 'products' && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    loadInventoryItems();
                    setShowProductSelector(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Existing Product
                </button>
                <button
                  onClick={() => setShowProductForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Product
                </button>
              </div>
            )}
          </div>

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by adding products to your shop.
                  </p>
                  <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => {
                        loadInventoryItems();
                        setShowProductSelector(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add from Inventory
                    </button>
                    <button
                      onClick={() => setShowProductForm(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Product
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 line-clamp-2">{product.name}</h4>
                          {product.featured && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                              Featured
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {product.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                      )}
                      
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="text-lg font-bold text-gray-900">
                            {formatCurrency(product.price)} {businessProfile.preferred_currency}
                          </span>
                          {product.compare_at_price && product.compare_at_price > product.price && (
                            <span className="ml-2 text-sm line-through text-gray-500">
                              {formatCurrency(product.compare_at_price)} {businessProfile.preferred_currency}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {product.inventory_item?.type || 'Product'}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No orders yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Orders will appear here when customers make purchases from your shop.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Order
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredOrders.map(order => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {order.order_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>{order.customer_name}</div>
                            <div className="text-xs text-gray-400">{order.customer_email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(order.total)} {businessProfile.preferred_currency}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              order.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : order.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : order.status === 'processing'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleViewOrderDetails(order.id)}
                                className="text-primary-600 hover:text-primary-900"
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(order.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete order"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Shop Modal */}
      {showEditShop && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Shop</h3>
              <button
                onClick={() => setShowEditShop(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditShop} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Shop Name</label>
                <input
                  type="text"
                  required
                  value={editShopData.name}
                  onChange={e => setEditShopData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={3}
                  value={editShopData.description}
                  onChange={e => setEditShopData(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditShop(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <ProductForm
              shopId={shop?.id || ''}
              businessId={businessProfile?.id || ''}
              currency={businessProfile?.preferred_currency || 'USD'}
              editProduct={editingProduct || undefined}
              onClose={() => {
                setShowProductForm(false);
                setEditingProduct(null);
              }}
              onSuccess={handleProductFormSuccess}
            />
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetailsModal && selectedOrderDetails && (
        <OrderDetailsModal
          order={selectedOrderDetails}
          currency={businessProfile?.preferred_currency || 'USD'}
          onClose={() => {
            setShowOrderDetailsModal(false);
            setSelectedOrderDetails(null);
          }}
        />
      )}
    </div>
  );
}