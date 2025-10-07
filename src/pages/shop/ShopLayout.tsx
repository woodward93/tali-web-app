import React from 'react';
import { Link, useParams, Outlet } from 'react-router-dom';
import { ShoppingCart, Menu, X, Search } from 'lucide-react';
import { useShop } from '../../hooks/useShop';
import { useCart } from '../../hooks/useCart';

export function ShopLayout() {
  const { shop, loading, error } = useShop();
  const { cartItems, getCartItemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const { domain } = useParams<{ domain: string }>();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Shop Not Found</h1>
          <p className="mt-2 text-gray-600">The shop you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop/${domain}/products?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="relative bg-white shadow-sm">
        <nav aria-label="Top" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="border-b border-gray-200">
            <div className="flex h-16 items-center justify-between">
              {/* Mobile menu button */}
              <button
                type="button"
                className="rounded-md bg-white p-2 text-gray-400 lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Open menu</span>
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="h-6 w-6" aria-hidden="true" />
                )}
              </button>

              {/* Logo */}
              <div className="ml-4 flex lg:ml-0">
                <Link to={`/shop/${domain}`} className="flex items-center gap-3">
                  {shop.business.logo_url ? (
                    <img
                      src={shop.business.logo_url}
                      alt={`${shop.name} logo`}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-600">
                        {shop.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="text-xl font-bold text-gray-900">{shop.name}</span>
                </Link>
              </div>

              {/* Search */}
              <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:space-x-8">
                <form onSubmit={handleSearch} className="flex w-full max-w-lg">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </form>
              </div>

              {/* Navigation */}
              <div className="hidden lg:flex lg:items-center lg:space-x-8">
                <Link
                  to={`/shop/${domain}`}
                  className="text-sm font-medium text-gray-700 hover:text-gray-800"
                >
                  Home
                </Link>
                <Link
                  to={`/shop/${domain}/products`}
                  className="text-sm font-medium text-gray-700 hover:text-gray-800"
                >
                  Products
                </Link>
              </div>

              {/* Cart */}
              <div className="flex items-center">
                <div className="ml-4 flow-root lg:ml-6">
                  <Link to={`/shop/${domain}/cart`} className="group -m-2 flex items-center p-2">
                    <ShoppingCart
                      className="h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
                      aria-hidden="true"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-gray-800">
                      {getCartItemCount()}
                    </span>
                    <span className="sr-only">items in cart, view bag</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile search */}
        <div className="lg:hidden px-4 py-3 border-b border-gray-200">
          <form onSubmit={handleSearch} className="flex">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </form>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-25" aria-hidden="true" />
          <div className="fixed inset-y-0 left-0 z-40 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
            <div className="flex items-center justify-between">
              <Link to={`/shop/${domain}`} className="flex items-center gap-3">
                {shop.business.logo_url ? (
                  <img
                    src={shop.business.logo_url}
                    alt={`${shop.name} logo`}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-600">
                      {shop.name.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="text-xl font-bold text-gray-900">{shop.name}</span>
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-gray-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/10">
                <div className="space-y-2 py-6">
                  <Link
                    to={`/shop/${domain}`}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link
                    to={`/shop/${domain}/products`}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Products
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="py-10">
            <p className="text-center text-sm text-gray-500">
              &copy; {new Date().getFullYear()} {shop.name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}