import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { BankPaymentRecords } from './pages/BankPaymentRecords';
import { Inventory } from './pages/Inventory';
import { Contacts } from './pages/Contacts';
import { Documents } from './pages/Documents';
import { Analytics } from './pages/Analytics';
import { OnlineShop } from './pages/OnlineShop';
import { Settings } from './pages/Settings';
import { Auth } from './pages/Auth';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { ShopLayout } from './pages/shop/ShopLayout';
import { ShopHome } from './pages/shop/ShopHome';
import { ShopProducts } from './pages/shop/ShopProducts';
import { ShopProduct } from './pages/shop/ShopProduct';
import { ShopCart } from './pages/shop/ShopCart';
import { ShopCheckout } from './pages/shop/ShopCheckout';
import { ShopShipping } from './pages/shop/ShopShipping';
import { ShopPaymentSuccess } from './pages/shop/ShopPaymentSuccess';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/auth" />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication routes */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />

        {/* Public shop routes */}
        <Route path="/shop/:domain" element={<ShopLayout />}>
          <Route index element={<ShopHome />} />
          <Route path="products" element={<ShopProducts />} />
          <Route path="products/:productId" element={<ShopProduct />} />
          <Route path="cart" element={<ShopCart />} />
          <Route path="checkout" element={<ShopCheckout />} />
          <Route path="shipping" element={<ShopShipping />} />
          <Route path="payment-success" element={<ShopPaymentSuccess />} />
        </Route>

        {/* Protected application routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="bank-records" element={<BankPaymentRecords />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="online-shop" element={<OnlineShop />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="documents" element={<Documents />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
