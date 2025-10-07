import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useShop } from '../../hooks/useShop';
import { useCart } from '../../hooks/useCart';
import { formatCurrency } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, Filter } from 'lucide-react';
import { toast } from 'sonner';
import type { ShopProduct } from '../../types/shop';

interface Category {
  id: string;
  name: string;
  count: number;
}

export function ShopProducts() {
  const { shop } = useShop();
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = React.useState<ShopProduct[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<string>('newest');
  const [showFilters, setShowFilters] = React.useState(false);

  const searchQuery = searchParams.get('search') || '';

  React.useEffect(() => {
    if (shop) {
      loadProducts();
      loadCategories();
    }
  }, [shop, selectedCategory, sortBy, searchQuery]);

  const loadProducts = async () => {
    try {
      let query = supabase
        .from('shop_products')
        .select(`
          *,
          inventory_item:inventory_items(quantity, category:categories(name))
        `)
        .eq('shop_id', shop.id)
        .eq('active', true);

      // Apply category filter
      if (selectedCategory !== 'all') {
        query = query.eq('inventory_item.category.name', selectedCategory);
      }

      // Apply search filter
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Apply sorting
      switch (sortBy) {
        case 'price-low':
          query = query.order('price', { ascending: true });
          break;
        case 'price-high':
          query = query.order('price', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        default: // newest
          query = query.order('created_at', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select(`
          inventory_item:inventory_items(category:categories(name))
        `)
        .eq('shop_id', shop.id)
        .eq('active', true);

      if (error) throw error;

      // Count products by category
      const categoryCount = new Map<string, number>();
      data?.forEach(product => {
        const categoryName = product.inventory_item?.category?.name;
        if (categoryName) {
          categoryCount.set(categoryName, (categoryCount.get(categoryName) || 0) + 1);
        }
      });

      const categoriesArray = Array.from(categoryCount.entries()).map(([name, count]) => ({
        id: name,
        name,
        count
      }));

      setCategories(categoriesArray);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const handleAddToCart = (e: React.MouseEvent, product: ShopProduct) => {
    // Prevent the click from bubbling up to the Link component
    e.preventDefault();
    e.stopPropagation();
    
    const maxQuantity = product.inventory_item?.quantity || 999;
    if (maxQuantity <= 0) {
      toast.error('This product is out of stock');
      return;
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      maxQuantity,
      images: product.images
    }, 1);

    toast.success('Added to cart');
  };

  if (!shop) return null;

  const filteredProducts = products;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {searchQuery ? `Search results for "${searchQuery}"` : 'Products'}
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>

        <div className="mt-6 lg:grid lg:grid-cols-4 lg:gap-x-8">
          {/* Filters */}
          <div className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
            <div className="space-y-6">
              {/* Categories */}
              <div>
                <h3 className="text-sm font-medium text-gray-900">Categories</h3>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`block text-sm ${
                      selectedCategory === 'all'
                        ? 'text-primary-600 font-medium'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All Products ({products.length})
                  </button>
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.name)}
                      className={`block text-sm ${
                        selectedCategory === category.name
                          ? 'text-primary-600 font-medium'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {category.name} ({category.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <h3 className="text-sm font-medium text-gray-900">Sort by</h3>
                <div className="mt-4">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="mt-6 lg:col-span-3 lg:mt-0">
            {loading ? (
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="group relative animate-pulse">
                    <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-md bg-gray-200 lg:aspect-none lg:h-80" />
                    <div className="mt-4 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchQuery ? 'No products found matching your search.' : 'No products available.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.inventory_item?.quantity === 0;
                  
                  return (
                    <div key={product.id} className="group relative">
                      <Link to={`${product.id}`}>
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
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                              <span className="text-white font-medium">Out of Stock</span>
                            </div>
                          )}
                         {product.featured && (
                           <div className="absolute top-2 left-2">
                             <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
                               Featured
                             </span>
                           </div>
                         )}
                        </div>
                        <div className="mt-4 flex justify-between">
                          <div className="flex-1">
                            <h3 className="text-sm text-gray-700">
                              <span aria-hidden="true" className="absolute inset-0" />
                              {product.name}
                            </h3>
                            {product.description && (
                              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                                {product.description}
                              </p>
                            )}
                            <div className="mt-2">
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
                      </Link>
                      <div className="mt-4 relative z-10">
                        <button
                          onClick={(e) => handleAddToCart(e, product)}
                          disabled={isOutOfStock}
                          className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}