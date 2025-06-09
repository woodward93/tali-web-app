import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Package,
  FileText,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  AlertCircle,
  X,
  Calculator,
  Landmark,
  Users,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase, loadBusinessProfile } from '../lib/supabase';
import { toast } from 'sonner';

interface BusinessProfile {
  name: string;
  logo_url: string | null;
  country: string;
  address: string | null;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Customers & Suppliers', href: '/contacts', icon: Users },
  { name: 'Receipts & Invoices', href: '/documents', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      loadBusinessData();
    }
  }, [user, authLoading]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);
      setError(null);

      const businessProfile = await loadBusinessProfile();

      if (!businessProfile) {
        if (location.pathname !== '/settings') {
          navigate('/settings');
          toast.info('Please set up your business profile');
        }
      } else {
        setBusiness(businessProfile);
      }
    } catch (err) {
      console.error('Error loading business profile:', err);
      setError('Failed to load business profile');
      toast.error('Failed to load business profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (err) {
      console.error('Error signing out:', err);
      toast.error('Failed to sign out');
    }
  };

  const BusinessProfile = () => {
    if (loading) {
      return (
        <div className="px-4 py-5 border-b">
          <div className="animate-pulse flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-32 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="px-4 py-5 border-b">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">Failed to load profile</span>
          </div>
          <button
            onClick={loadBusinessData}
            className="mt-2 text-sm text-blue-600 hover:text-blue-500"
          >
            Try again
          </button>
        </div>
      );
    }

    return (
      <div className="px-4 py-5 border-b">
        <div className="flex items-center gap-3">
          {business?.logo_url ? (
            <img
              src={business.logo_url}
              alt={`${business.name} logo`}
              className="h-12 w-12 rounded-full object-cover bg-gray-100"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-xl font-medium text-gray-500">
                {business?.name?.charAt(0) || 'B'}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-gray-900 truncate">
              {business?.name || 'My Business'}
            </h2>
            {business?.address && (
              <p className="text-xs text-gray-500 truncate">
                {business.address}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const desktopNavigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: Receipt },
    { name: 'Bank Records', href: '/bank-records', icon: Landmark },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Customers & Suppliers', href: '/contacts', icon: Users },
    { name: 'Receipts & Invoices', href: '/documents', icon: FileText },
    { name: 'Analytics', href: '/analytics', icon: BarChart2 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-gray-900/80 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-white transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-20 items-center justify-between px-6 border-b">
            <div className="flex items-center gap-3 text-primary-600">
              <Calculator className="h-8 w-8" />
              <span className="text-2xl font-semibold">tali</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 -mr-2 text-gray-500 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <BusinessProfile />
          <div className="flex flex-col h-[calc(100vh-180px)]">
            <nav className="flex-1 p-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                    location.pathname === item.href
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t mt-auto">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-2 w-full rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow border-r border-gray-200 bg-white">
          <div className="flex h-20 items-center px-6 border-b">
            <div className="flex items-center gap-3 text-primary-600">
              <Calculator className="h-8 w-8" />
              <span className="text-2xl font-semibold">tali</span>
            </div>
          </div>
          <BusinessProfile />
          <nav className="flex flex-col gap-1 p-4 flex-1">
            {desktopNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                  location.pathname === item.href
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-2 w-full rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        <div className="sticky top-0 z-10 flex h-20 items-center gap-4 border-b bg-white px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-600"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-3 text-primary-600 lg:hidden">
            <Calculator className="h-8 w-8" />
            <span className="text-2xl font-semibold">tali</span>
          </div>
        </div>
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
