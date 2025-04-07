import React from 'react';
import { Link } from 'react-router-dom';
import { useShop } from '../../hooks/useShop';
import { formatCurrency } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { ShopProduct } from '../../types/shop';

export function ShopHome() {
  const { shop } = useShop();
  const [products, setProducts] = React.useState<ShopProduct[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (shop) {
      loadProducts();
    }
  }, [shop]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!shop) return null;

  return (
    <div>
      {/* Hero section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-800" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              {shop.name}
            </h1>
            {shop.description && (
              <p className="mt-6 text-xl text-white/90">
                {shop.description}
              </p>
            )}
            <div className="mt-10">
              <Link
                to="/products"
                className="inline-block rounded-md border border-transparent bg-white px-8 py-3 text-base font-medium text-primary-600 hover:bg-gray-50"
              >
                View Products
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Featured products */}
      <div className="bg-white">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Featured Products
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
            {loading ? (
              // Loading skeletons
              [...Array(4)].map((_, index) => (
                <div key={index} className="group relative animate-pulse">
                  <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-md bg-gray-200 lg:aspect-none lg:h-80" />
                  <div className="mt-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              ))
            ) : products.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">No products available yet.</p>
              </div>
            ) : (
              products.map((product) => (
                <div key={product.id} className="group relative">
                  <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-md bg-gray-200 lg:aspect-none lg:h-80">
                    {product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full object-cover object-center lg:h-full lg:w-full"
                      />
                    ) : (
                      <div className="h-full w-full bg-gray-200" />
                    )}
                  </div>
                  <div className="mt-4 flex justify-between">
                    <div>
                      <h3 className="text-sm text-gray-700">
                        <Link to={`/products/${product.id}`}>
                          <span aria-hidden="true" className="absolute inset-0" />
                          {product.name}
                        </Link>
                      </h3>
                      {product.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(product.price)} {shop.business.preferred_currency}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}