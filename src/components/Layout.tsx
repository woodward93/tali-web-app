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
  Store,
  HelpCircle,
  MessageCircle,
  Send,
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

const baseNavigation = [
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
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submittingContact, setSubmittingContact] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

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
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
      toast.error('Failed to sign out');
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmittingContact(true);

    try {
      // Send contact form via Supabase edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contact-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactForm)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }
      
      toast.success(data.message || 'Message sent successfully! We\'ll get back to you soon.');
      setShowContactModal(false);
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error('Error sending contact form:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
    } finally {
      setSubmittingContact(false);
    }
  };

  const faqData = [
    {
      question: "How do I add a new product to my inventory?",
      answer: "Go to the Inventory page and click 'Add Item'. Fill in the product details including name, category, quantity, and pricing information."
    },
    {
      question: "How can I track customer payments?",
      answer: "In the Transactions page, you can record sales and track payment status. Use 'Partially Paid' status for customers who haven't paid in full."
    },
    {
      question: "How do I generate receipts and invoices?",
      answer: "Go to the 'Receipts & Invoices' page, click 'New Receipt/Invoice', select a transaction, and the system will generate a professional document."
    },
    {
      question: "Can I export my transaction data?",
      answer: "Yes! On the Transactions page, click the 'Export' button to download your data in CSV or Excel format."
    },
    {
      question: "How do I set up my online shop?",
      answer: "Visit the Online Shop page to create your shop, add products, and configure shipping methods. Your shop will be accessible via a custom domain."
    },
    {
      question: "What payment methods are supported?",
      answer: "You can record payments via Cash, Card, Bank Transfer, and Mobile Money. For online shops, we support Paystack integration."
    },
    {
      question: "How do I upload bank statements?",
      answer: "Go to Bank Records page and upload your bank statement (CSV, Excel, or PDF). The system will automatically extract transaction data."
    },
    {
      question: "Can I track inventory levels?",
      answer: "Yes! The system automatically updates inventory when you record sales. You'll get alerts when items are running low."
    }
  ];

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

  const baseDesktopNavigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: Receipt },
    { name: 'Bank Records', href: '/bank-records', icon: Landmark },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Customers & Suppliers', href: '/contacts', icon: Users },
    { name: 'Receipts & Invoices', href: '/documents', icon: FileText },
    { name: 'Analytics', href: '/analytics', icon: BarChart2 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  // Only show Online Shop for Nigerian businesses
  const isNigeria = business?.country === 'Nigeria';

  const navigation = isNigeria
    ? [
        ...baseNavigation.slice(0, 3),
        { name: 'Online Shop', href: '/online-shop', icon: Store },
        ...baseNavigation.slice(3),
      ]
    : baseNavigation;

  const desktopNavigation = isNigeria
    ? [
        ...baseDesktopNavigation.slice(0, 6),
        { name: 'Online Shop', href: '/online-shop', icon: Store },
        ...baseDesktopNavigation.slice(6),
      ]
    : baseDesktopNavigation;

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
          
          {/* Header Actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowFAQModal(true)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              title="FAQ"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowContactModal(true)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              title="Contact Support"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <form onSubmit={handleContactSubmit} className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Contact Support</h3>
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={e => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={e => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  value={contactForm.subject}
                  onChange={e => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Brief description of your inquiry"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Message *</label>
                <textarea
                  required
                  rows={4}
                  value={contactForm.message}
                  onChange={e => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Describe your question or issue in detail..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingContact}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {submittingContact ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {showFAQModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Frequently Asked Questions</h3>
                <button
                  onClick={() => setShowFAQModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {faqData.map((faq, index) => (
                  <div key={index} className="border-b border-gray-200 pb-4 last:border-0">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      {faq.question}
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">
                  Can't find what you're looking for?
                </p>
                <button
                  onClick={() => {
                    setShowFAQModal(false);
                    setShowContactModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Contact Support
                </button>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowFAQModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
