import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useShop } from '../../hooks/useShop';
import { useCart } from '../../hooks/useCart';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PendingOrderData {
  reference: string;
  checkoutData: {
    email: string;
    fullName: string;
    phoneNumber: string;
    state: string;
    address: string;
  };
  selectedShipping: string;
  cartItems: any[];
  total: number;
  shippingCost: number;
}

interface ShopData {
  id: string;
  name: string;
  domain: string;
  business: {
    preferred_currency: string;
  };
}

export function ShopPaymentSuccess() {
  const { shop: hookShop, loading: shopLoading } = useShop();
  const { clearCart } = useCart();
  const { domain } = useParams<{ domain: string }>();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | 'pending'>('pending');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [shop, setShop] = useState<ShopData | null>(null);
  
  // Use refs to prevent multiple operations
  const verificationAttempted = useRef(false);
  const orderCreated = useRef(false);
  const processedReference = useRef<string>('');

  // Load shop data directly if the hook fails
  useEffect(() => {
    if (hookShop) {
      setShop(hookShop);
    } else if (domain && !shopLoading) {
      loadShopDirectly();
    }
  }, [hookShop, domain, shopLoading]);

  const loadShopDirectly = async () => {
    try {
      console.log('Loading shop directly for domain:', domain);
      const { data, error } = await supabase
        .from('shops')
        .select(`
          *,
          business:businesses(
            preferred_currency
          )
        `)
        .eq('domain', domain)
        .eq('active', true)
        .single();

      if (error) {
        console.error('Error loading shop:', error);
        throw error;
      }

      if (data) {
        console.log('Shop loaded successfully:', data);
        setShop(data);
      } else {
        throw new Error('Shop not found');
      }
    } catch (err) {
      console.error('Failed to load shop:', err);
      setError('Shop not found');
      setPaymentStatus('failed');
      setVerifying(false);
    }
  };

  useEffect(() => {
    // Only proceed with payment verification if we have shop data and haven't attempted verification yet
    if (shop && !verificationAttempted.current) {
      const urlParams = new URLSearchParams(window.location.search);
      const reference = urlParams.get('reference');
      
      if (reference) {
        // Check if we've already processed this reference
        if (processedReference.current === reference) {
          console.log('Reference already processed, skipping verification');
          return;
        }
        
        verificationAttempted.current = true;
        processedReference.current = reference;
        verifyPayment(reference);
      } else {
        setError('No payment reference found');
        setVerifying(false);
        setPaymentStatus('failed');
      }
    }
  }, [shop]);

  const generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  };

  const getShippingMethodName = async (shippingMethodId: string): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('shop_shipping_methods')
        .select('name')
        .eq('id', shippingMethodId)
        .single();

      if (error) {
        console.error('Error fetching shipping method:', error);
        return 'Standard Shipping';
      }

      return data?.name || 'Standard Shipping';
    } catch (err) {
      console.error('Error fetching shipping method:', err);
      return 'Standard Shipping';
    }
  };

  const checkExistingOrder = async (paymentReference: string): Promise<string | null> => {
    try {
      console.log('Checking for existing order with reference:', paymentReference);
      
      const { data, error } = await supabase
        .from('shop_orders')
        .select('order_number')
        .eq('payment_reference', paymentReference)
        .eq('shop_id', shop?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking existing order:', error);
        return null;
      }

      if (data) {
        console.log('Found existing order:', data.order_number);
        return data.order_number;
      }

      return null;
    } catch (err) {
      console.error('Error checking existing order:', err);
      return null;
    }
  };

  const verifyPayment = async (reference: string) => {
    try {
      console.log('Verifying payment with reference:', reference);
      
      // First check if an order already exists for this payment reference
      const existingOrderNumber = await checkExistingOrder(reference);
      if (existingOrderNumber) {
        console.log('Order already exists for this payment reference:', existingOrderNumber);
        setOrderNumber(existingOrderNumber);
        setPaymentStatus('success');
        setVerifying(false);
        
        // Clear cart and session data
        clearCart();
        sessionStorage.removeItem('checkoutData');
        sessionStorage.removeItem('pendingOrderData');
        
        // Clear URL parameters to prevent re-processing
        window.history.replaceState({}, document.title, window.location.pathname);
        
        toast.success('Order already processed successfully!');
        return;
      }
      
      // Verify payment with Supabase edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack-verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Payment verification failed:', errorData);
        throw new Error(errorData.error || 'Failed to verify payment');
      }

      const verificationData = await response.json();
      console.log('Payment verification response:', verificationData);
      
      if (verificationData.status && verificationData.data.status === 'success') {
        // Payment successful, create order (only if not already created)
        if (!orderCreated.current) {
          console.log('Payment verified successfully, creating order...');
          orderCreated.current = true;
          await createOrder(reference, verificationData.data);
          setPaymentStatus('success');
          
          // Clear URL parameters to prevent re-processing
          window.history.replaceState({}, document.title, window.location.pathname);
          
          toast.success('Order placed successfully!');
        }
      } else {
        console.error('Payment verification failed:', verificationData);
        setPaymentStatus('failed');
        setError(verificationData.message || 'Payment verification failed');
        toast.error('Payment verification failed');
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      setPaymentStatus('failed');
      setError(err instanceof Error ? err.message : 'Payment verification failed');
      toast.error('Payment verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const createOrder = async (paymentReference: string, paymentData: any) => {
    if (!shop) {
      throw new Error('Shop not found');
    }

    // Triple-check that order doesn't already exist (race condition protection)
    const existingOrderNumber = await checkExistingOrder(paymentReference);
    if (existingOrderNumber) {
      console.log('Order already exists during creation, skipping:', existingOrderNumber);
      setOrderNumber(existingOrderNumber);
      
      // Clear cart and session data
      clearCart();
      sessionStorage.removeItem('checkoutData');
      sessionStorage.removeItem('pendingOrderData');
      
      return;
    }

    // Get pending order data from session storage
    const pendingOrderDataStr = sessionStorage.getItem('pendingOrderData');
    if (!pendingOrderDataStr) {
      throw new Error('Order data not found in session storage');
    }

    console.log('Pending order data found:', pendingOrderDataStr);

    let pendingOrderData: PendingOrderData;
    try {
      pendingOrderData = JSON.parse(pendingOrderDataStr);
    } catch (parseError) {
      console.error('Error parsing pending order data:', parseError);
      throw new Error('Invalid order data format');
    }

    // Validate required data
    if (!pendingOrderData.checkoutData || !pendingOrderData.cartItems || pendingOrderData.cartItems.length === 0) {
      throw new Error('Incomplete order data');
    }

    // Validate that this is the correct payment reference
    if (pendingOrderData.reference !== paymentReference) {
      console.error('Payment reference mismatch:', {
        pending: pendingOrderData.reference,
        current: paymentReference
      });
      throw new Error('Payment reference mismatch');
    }

    const orderNum = generateOrderNumber();

    // Get shipping method name
    const shippingMethodName = await getShippingMethodName(pendingOrderData.selectedShipping);

    console.log('Creating order with data:', {
      shop_id: shop.id,
      order_number: orderNum,
      customer_name: pendingOrderData.checkoutData.fullName,
      customer_email: pendingOrderData.checkoutData.email,
      total: pendingOrderData.total,
      payment_reference: paymentReference,
      shipping_method: shippingMethodName,
      shipping_cost: pendingOrderData.shippingCost,
      items_count: pendingOrderData.cartItems.length
    });

    const orderData = {
      shop_id: shop.id,
      order_number: orderNum,
      customer_name: pendingOrderData.checkoutData.fullName,
      customer_email: pendingOrderData.checkoutData.email,
      total: pendingOrderData.total,
      status: 'completed',
      payment_reference: paymentReference,
      shipping_method: shippingMethodName,
      shipping_cost: pendingOrderData.shippingCost,
      items: pendingOrderData.cartItems.map(item => ({
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      shipping_address: {
        name: pendingOrderData.checkoutData.fullName,
        phone: pendingOrderData.checkoutData.phoneNumber,
        state: pendingOrderData.checkoutData.state,
        address: pendingOrderData.checkoutData.address
      }
    };

    console.log('Inserting order into database...');

    const { data, error } = await supabase
      .from('shop_orders')
      .insert(orderData)
      .select()
      .single();

    if (error) {
      console.error('Database error creating order:', error);
      
      // Check if this is a duplicate key error (order already exists)
      if (error.code === '23505') { // PostgreSQL unique violation error code
        console.log('Duplicate order detected, checking existing order...');
        const existingOrderNumber = await checkExistingOrder(paymentReference);
        if (existingOrderNumber) {
          setOrderNumber(existingOrderNumber);
          
          // Clear cart and session data
          clearCart();
          sessionStorage.removeItem('checkoutData');
          sessionStorage.removeItem('pendingOrderData');
          
          return;
        }
      }
      
      throw new Error(`Failed to create order: ${error.message}`);
    }

    console.log('Order created successfully:', data);
    setOrderNumber(orderNum);
    
    // Clear cart and session data immediately after successful creation
    clearCart();
    sessionStorage.removeItem('checkoutData');
    sessionStorage.removeItem('pendingOrderData');
    
    console.log('Cart and session data cleared');
  };

  // Show loading while shop is being loaded
  if (shopLoading || (!shop && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600">Loading shop...</p>
        </div>
      </div>
    );
  }

  // Show error if shop couldn't be loaded
  if (!shop) {
    return (
      <div className="bg-white">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
          <div className="text-center">
            <div className="flex flex-col items-center">
              <XCircle className="h-16 w-16 text-red-500 mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Shop Not Found
              </h1>
              <p className="text-gray-600 mb-4">
                {error || 'The shop you are looking for could not be found.'}
              </p>
              <Link
                to="/"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Go to Homepage
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
        <div className="text-center">
          {verifying ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-16 w-16 text-primary-600 animate-spin mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Verifying Payment
              </h1>
              <p className="text-gray-600">
                Please wait while we confirm your payment and create your order...
              </p>
            </div>
          ) : paymentStatus === 'success' ? (
            <div className="flex flex-col items-center">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Payment Successful!
              </h1>
              <p className="text-gray-600 mb-4">
                Thank you for your order. Your payment has been processed successfully.
              </p>
              {orderNumber && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-green-800 font-medium">
                    Order Number: {orderNumber}
                  </p>
                  <p className="text-green-600 text-sm">
                    You will receive an email confirmation shortly.
                  </p>
                </div>
              )}
              <div className="flex gap-4">
                <Link
                  to={`/shop/${domain}`}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  Continue Shopping
                </Link>
                <Link
                  to={`/shop/${domain}/products`}
                  className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  View Products
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <XCircle className="h-16 w-16 text-red-500 mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Payment Failed
              </h1>
              <p className="text-gray-600 mb-4">
                {error || 'There was an issue processing your payment. Please try again.'}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800 text-sm">
                  If you believe this is an error, please contact our support team.
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => navigate(`/shop/${domain}/checkout`)}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  Try Again
                </button>
                <Link
                  to={`/shop/${domain}`}
                  className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Back to Shop
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}