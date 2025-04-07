import React from 'react';
import { Link, useParams, Outlet } from 'react-router-dom';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { useShop } from '../../hooks/useShop';

export function ShopLayout() {
  const { shop, loading, error } = useShop();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="relative bg-white">
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
                <Link to={`/shop/${domain}`} className="text-xl font-bold text-gray-900">
                  tali
                </Link>
              </div>

              {/* Navigation */}
              <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:space-x-8">
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
                      0
                    </span>
                    <span className="sr-only">items in cart, view bag</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-25" aria-hidden="true" />
          <div className="fixed inset-y-0 left-0 z-40 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
            <div className="flex items-center justify-between">
              <Link to={`/shop/${domain}`} className="text-xl font-bold text-gray-900">
                tali
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
                  >
                    Home
                  </Link>
                  <Link
                    to={`/shop/${domain}/products`}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
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