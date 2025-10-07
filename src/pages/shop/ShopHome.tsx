import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Package, CreditCard, Truck, Star, Heart, Gift, Tag, ShoppingCart, Zap } from 'lucide-react';
import { useShop } from '../../hooks/useShop';
import { formatCurrency } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { ShopProduct } from '../../types/shop';

export function ShopHome() {
  const { shop } = useShop();
  const [featuredProducts, setFeaturedProducts] = React.useState<ShopProduct[]>([]);
  const [otherProducts, setOtherProducts] = React.useState<ShopProduct[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (shop) {
      loadProducts();
    }
  }, [shop]);

  const loadProducts = async () => {
    try {
      // Load featured products
      const { data: featured, error: featuredError } = await supabase
        .from('shop_products')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('active', true)
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(8);

      if (featuredError) throw featuredError;

      // Load other products (non-featured)
      const { data: others, error: othersError } = await supabase
        .from('shop_products')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('active', true)
        .eq('featured', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (othersError) throw othersError;

      setFeaturedProducts(featured || []);
      setOtherProducts(others || []);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!shop) return null;

  const ProductGrid = ({ products, title }: { products: ShopProduct[], title: string }) => (
    <div className="bg-white">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          {title}
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
                <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-md bg-gray-200 lg:aspect-none group-hover:opacity-75 lg:h-80">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover object-center lg:h-full lg:w-full"
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No image</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-between">
                  <div>
                    <h3 className="text-sm text-gray-700">
                      <Link to={`products/${product.id}`}>
                        <span aria-hidden="true" className="absolute inset-0" />
                        {product.name}
                      </Link>
                    </h3>
                    {product.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(product.price)} {shop.business.preferred_currency}
                    </p>
                    {product.compare_at_price && product.compare_at_price > product.price && (
                      <p className="text-sm text-gray-500 line-through">
                        {formatCurrency(product.compare_at_price)} {shop.business.preferred_currency}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Hero section */}
      <div className="relative">
        {/* Solid blue background */}
        <div className="absolute inset-0 bg-blue-600" />
        
        {/* E-commerce Icons and Doodles */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating Icons */}
          <div className="absolute top-16 left-16 animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }}>
            <ShoppingBag className="h-12 w-12 text-white/20" />
          </div>
          <div className="absolute top-32 right-24 animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }}>
            <Package className="h-10 w-10 text-white/15" />
          </div>
          <div className="absolute top-48 left-1/4 animate-bounce" style={{ animationDelay: '2s', animationDuration: '3.5s' }}>
            <CreditCard className="h-8 w-8 text-white/25" />
          </div>
          <div className="absolute bottom-32 right-16 animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '4.5s' }}>
            <Truck className="h-14 w-14 text-white/20" />
          </div>
          <div className="absolute bottom-48 left-20 animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '3s' }}>
            <Star className="h-6 w-6 text-yellow-300/30" />
          </div>
          <div className="absolute top-20 right-1/3 animate-bounce" style={{ animationDelay: '2.5s', animationDuration: '4s' }}>
            <Heart className="h-8 w-8 text-pink-300/25" />
          </div>
          <div className="absolute bottom-20 left-1/3 animate-bounce" style={{ animationDelay: '3s', animationDuration: '3.5s' }}>
            <Gift className="h-10 w-10 text-white/20" />
          </div>
          <div className="absolute top-40 left-1/2 animate-bounce" style={{ animationDelay: '1s', animationDuration: '4.5s' }}>
            <Tag className="h-7 w-7 text-green-300/25" />
          </div>
          <div className="absolute bottom-40 right-1/3 animate-bounce" style={{ animationDelay: '2s', animationDuration: '3s' }}>
            <ShoppingCart className="h-9 w-9 text-white/20" />
          </div>
          <div className="absolute top-60 right-12 animate-bounce" style={{ animationDelay: '0.8s', animationDuration: '4s' }}>
            <Zap className="h-8 w-8 text-yellow-400/30" />
          </div>
          
          {/* Geometric Shapes */}
          <div className="absolute top-24 left-1/3 w-16 h-16 border-2 border-white/10 rounded-full animate-pulse"></div>
          <div className="absolute bottom-24 right-1/4 w-12 h-12 bg-white/5 rounded-lg rotate-45 animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-12 w-8 h-8 border-2 border-white/15 rotate-45 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-1/3 right-20 w-20 h-20 border border-white/8 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
          
          {/* Dotted Lines */}
          <div className="absolute top-1/4 left-1/4 w-32 h-0.5 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <div className="absolute bottom-1/4 right-1/4 w-24 h-0.5 bg-gradient-to-r from-transparent via-white/15 to-transparent rotate-45"></div>
          
          {/* Subtle Background Circles */}
          <div className="absolute top-10 right-10 w-40 h-40 bg-white/5 rounded-full blur-xl"></div>
          <div className="absolute bottom-10 left-10 w-32 h-32 bg-purple-300/10 rounded-full blur-2xl"></div>
          <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-blue-300/10 rounded-full blur-lg"></div>
        </div>
        
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
                to="products"
                className="inline-block rounded-md border border-transparent bg-white px-8 py-3 text-base font-medium text-primary-600 hover:bg-gray-50 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Featured products */}
      {featuredProducts.length > 0 && (
        <ProductGrid products={featuredProducts} title="Featured Products" />
      )}

      {/* Other products */}
      {otherProducts.length > 0 && (
        <ProductGrid products={otherProducts} title="More Products" />
      )}

      {/* View All Products button - only show if there are products */}
      {(featuredProducts.length > 0 || otherProducts.length > 0) && (
        <div className="bg-white">
          <div className="mx-auto max-w-2xl px-4 pb-16 sm:px-6 lg:max-w-7xl lg:px-8">
            <div className="text-center">
              <Link
                to="products"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100"
              >
                View All Products
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Show message if no products at all */}
      {!loading && featuredProducts.length === 0 && otherProducts.length === 0 && (
        <div className="bg-white">
          <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
            <div className="text-center py-12">
              <p className="text-gray-500">No products available yet.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}