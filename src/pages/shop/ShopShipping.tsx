import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useShop } from '../../hooks/useShop';
import { useCart } from '../../hooks/useCart';
import { formatCurrency } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ShippingMethod {
  id: string;
  type: string;
  name: string;
  cost: number;
  location?: string;
  enabled: boolean;
}

interface CheckoutFormData {
  email: string;
  fullName: string;
  phoneNumber: string;
  state: string;
  address: string;
}

export function ShopShipping() {
  const { shop } = useShop();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const navigate = useNavigate();
  const { domain } = useParams<{ domain: string }>();
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutFormData | null>(null);

  useEffect(() => {
    // Get checkout data from session storage
    const storedData = sessionStorage.getItem('checkoutData');
    if (!storedData) {
      navigate('../checkout');
      return;
    }
    setCheckoutData(JSON.parse(storedData));

    if (shop) {
      loadShippingMethods();
    }
  }, [shop, navigate]);

  const loadShippingMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_shipping_methods')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('enabled', true)
        .order('cost', { ascending: true });

      if (error) throw error;
      setShippingMethods(data || []);
      
      // Auto-select first method if available
      if (data && data.length > 0) {
        setSelectedShipping(data[0].id);
      }
    } catch (err) {
      console.error('Error loading shipping methods:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  };

  const createOrder = async (paymentReference: string, paymentData: any) => {
    if (!shop || !checkoutData) return null;

    const subtotal = getCartTotal();
    const selectedMethod = shippingMethods.find(m => m.id === selectedShipping);
    const shippingCost = selectedMethod?.cost || 0;
    const total = subtotal + shippingCost;

    const orderData = {
      shop_id: shop.id,
      order_number: generateOrderNumber(),
      customer_name: checkoutData.fullName,
      customer_email: checkoutData.email,
      total: total,
      status: paymentData.status === 'success' ? 'completed' : 'pending',
      payment_reference: paymentReference,
      shipping_method: selectedMethod?.name || 'Unknown',
      shipping_cost: shippingCost,
      items: cartItems.map(item => ({
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      shipping_address: {
        name: checkoutData.fullName,
        phone: checkoutData.phoneNumber,
        state: checkoutData.state,
        address: checkoutData.address
      }
    };

    try {
      const { data, error } = await supabase
        .from('shop_orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating order:', err);
      throw err;
    }
  };

  const initializePaystackPayment = async () => {
    if (!selectedShipping) {
      toast.error('Please select a shipping method');
      return;
    }

    if (!checkoutData) {
      toast.error('Checkout data not found');
      return;
    }

    const subtotal = getCartTotal();
    const selectedMethod = shippingMethods.find(m => m.id === selectedShipping);
    const shippingCost = selectedMethod?.cost || 0;
    const total = subtotal + shippingCost;

    setProcessingPayment(true);

    try {
      console.log('Initializing payment with data:', {
        email: checkoutData.email,
        amount: total,
        currency: 'NGN',
        callback_url: `${window.location.origin}/shop/${domain}/payment-success`
      });

      // Initialize payment with Supabase edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack-init`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: checkoutData.email,
          amount: total,
          currency: 'NGN', // You can make this dynamic based on shop currency
          callback_url: `${window.location.origin}/shop/${domain}/payment-success`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Payment initialization failed:', errorData);
        throw new Error(errorData.error || 'Failed to initialize payment');
      }

      const { authorizationUrl, reference } = await response.json();
      console.log('Payment initialized successfully:', { authorizationUrl, reference });

      // Store order data for completion after payment
      const pendingOrderData = {
        reference,
        checkoutData,
        selectedShipping,
        cartItems,
        total,
        shippingCost
      };
      
      console.log('Storing pending order data:', pendingOrderData);
      sessionStorage.setItem('pendingOrderData', JSON.stringify(pendingOrderData));

      // Redirect to Paystack payment page
      console.log('Redirecting to Paystack:', authorizationUrl);
      window.location.href = authorizationUrl;

    } catch (err) {
      console.error('Error initializing payment:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to initialize payment');
      setProcessingPayment(false);
    }
  };

  if (!shop || !checkoutData) return null;

  if (cartItems.length === 0) {
    return (
      <div className="bg-white">
        <div className="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-7xl lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Shipping
          </h1>
          <div className="mt-12 text-center">
            <p className="text-gray-500 mb-8">Your cart is empty</p>
            <Link
              to="../products"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const subtotal = getCartTotal();
  const selectedMethod = shippingMethods.find(m => m.id === selectedShipping);
  const shippingCost = selectedMethod?.cost || 0;
  const total = subtotal + shippingCost;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-7xl lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Shipping Method
          </h1>
          <Link
            to="../checkout"
            className="inline-flex items-center text-sm text-primary-600 hover:text-primary-500"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Checkout
          </Link>
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
          {/* Shipping Methods */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-6">
              Choose Shipping Method
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : shippingMethods.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No shipping methods available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {shippingMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedShipping === method.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedShipping(method.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                          selectedShipping === method.id
                            ? 'border-primary-500 bg-primary-500'
                            : 'border-gray-300'
                        }`}>
                          {selectedShipping === method.id && (
                            <Check className="w-2 h-2 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {method.name}
                          </h3>
                          {method.location && (
                            <p className="text-sm text-gray-500">{method.location}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {method.cost === 0 ? 'Free' : `${formatCurrency(method.cost)} ${shop.business.preferred_currency}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Customer Information Summary */}
            <div className="mt-8 bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Delivery Information</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Name:</span> {checkoutData.fullName}</p>
                <p><span className="font-medium">Email:</span> {checkoutData.email}</p>
                <p><span className="font-medium">Phone:</span> {checkoutData.phoneNumber}</p>
                <p><span className="font-medium">State:</span> {checkoutData.state}</p>
                <p><span className="font-medium">Address:</span> {checkoutData.address}</p>
              </div>
            </div>

            <button
              onClick={initializePaystackPayment}
              disabled={!selectedShipping || processingPayment}
              className="w-full mt-6 rounded-md border border-transparent bg-primary-600 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingPayment ? 'Processing Payment...' : 'Proceed to payment'}
            </button>
          </div>

          {/* Order Summary */}
          <div className="mt-10 lg:mt-0">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Order Summary</h2>

            <div className="bg-gray-50 rounded-lg p-6">
              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-md object-cover object-center bg-gray-200 flex items-center justify-center">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full rounded-md object-cover object-center"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">No image</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Qty: {item.quantity} × {formatCurrency(item.price)} {shop.business.preferred_currency}
                      </p>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(item.price * item.quantity)} {shop.business.preferred_currency}
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Totals */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-600">Subtotal</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {formatCurrency(subtotal)} {shop.business.preferred_currency}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-600">Shipping</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {selectedMethod ? (
                      selectedMethod.cost === 0 ? 'Free' : `${formatCurrency(shippingCost)} ${shop.business.preferred_currency}`
                    ) : (
                      'Select method'
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                  <dt className="text-base font-medium text-gray-900">Total</dt>
                  <dd className="text-base font-medium text-gray-900">
                    {formatCurrency(total)} {shop.business.preferred_currency}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}