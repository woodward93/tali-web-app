import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useShop } from '../../hooks/useShop';
import { useCart } from '../../hooks/useCart';
import { formatCurrency } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, Minus, Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { ShopProduct } from '../../types/shop';

export function ShopProduct() {
  const { shop } = useShop();
  const { addToCart } = useCart();
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = React.useState<ShopProduct | null>(null);
  const [relatedProducts, setRelatedProducts] = React.useState<ShopProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [quantity, setQuantity] = React.useState(1);
  const [selectedImage, setSelectedImage] = React.useState(0);

  React.useEffect(() => {
    if (shop && productId) {
      loadProduct();
    }
  }, [shop, productId]);

  React.useEffect(() => {
    if (product) {
      loadRelatedProducts();
    }
  }, [product]);

  const loadProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select(`
          *,
          inventory_item:inventory_items(quantity, category:categories(name))
        `)
        .eq('shop_id', shop.id)
        .eq('id', productId)
        .eq('active', true)
        .single();

      if (error) throw error;
      setProduct(data);
    } catch (err) {
      console.error('Error loading product:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedProducts = async () => {
    if (!product?.inventory_item?.category?.name) return;

    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select(`
          *,
          inventory_item:inventory_items(category:categories(name))
        `)
        .eq('shop_id', shop.id)
        .eq('active', true)
        .eq('inventory_item.category.name', product.inventory_item.category.name)
        .neq('id', product.id)
        .limit(4);

      if (error) throw error;
      setRelatedProducts(data || []);
    } catch (err) {
      console.error('Error loading related products:', err);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;

    const maxQuantity = product.inventory_item?.quantity || 999;
    if (maxQuantity <= 0) {
      toast.error('This product is out of stock');
      return;
    }

    if (quantity > maxQuantity) {
      toast.error(`Only ${maxQuantity} items available`);
      return;
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      maxQuantity,
      images: product.images
    }, quantity);

    toast.success(`Added ${quantity} item(s) to cart`);
  };

  const adjustQuantity = (delta: number) => {
    const maxQuantity = product?.inventory_item?.quantity || 999;
    const newQuantity = Math.max(1, Math.min(quantity + delta, maxQuantity));
    setQuantity(newQuantity);
  };

  if (!shop) return null;

  if (loading) {
    return (
      <div className="bg-white">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
            <div className="aspect-h-1 aspect-w-1 w-full">
              <div className="h-full w-full bg-gray-100 rounded-lg animate-pulse" />
            </div>
            <div className="mt-10 px-4 sm:mt-16 sm:px-0 lg:mt-0">
              <div className="h-8 w-3/4 bg-gray-100 rounded animate-pulse" />
              <div className="mt-3 h-6 w-1/4 bg-gray-100 rounded animate-pulse" />
              <div className="mt-6 h-24 w-full bg-gray-100 rounded animate-pulse" />
              <div className="mt-6 h-12 w-full bg-primary-600 rounded-md animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Product Not Found</h1>
            <p className="mt-2 text-gray-600">The product you're looking for doesn't exist.</p>
            <Link
              to="../products"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOutOfStock = product.inventory_item?.quantity === 0;
  const maxQuantity = product.inventory_item?.quantity || 999;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex mb-8">
          <ol className="flex items-center space-x-2">
            <li>
              <Link to="../" className="text-gray-400 hover:text-gray-500">
                Home
              </Link>
            </li>
            <li>
              <span className="text-gray-400">/</span>
            </li>
            <li>
              <Link to="../products" className="text-gray-400 hover:text-gray-500">
                Products
              </Link>
            </li>
            <li>
              <span className="text-gray-400">/</span>
            </li>
            <li>
              <span className="text-gray-900">{product.name}</span>
            </li>
          </ol>
        </nav>

        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
          {/* Image gallery */}
          <div className="flex flex-col-reverse">
            {/* Image selector */}
            {product.images && product.images.length > 1 && (
              <div className="mx-auto mt-6 hidden w-full max-w-2xl sm:block lg:max-w-none">
                <div className="grid grid-cols-4 gap-6">
                  {product.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`relative flex h-24 cursor-pointer items-center justify-center rounded-md bg-white text-sm font-medium uppercase text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring focus:ring-opacity-50 focus:ring-offset-4 ${
                        index === selectedImage
                          ? 'ring-2 ring-primary-500'
                          : ''
                      }`}
                    >
                      <span className="sr-only">Image {index + 1}</span>
                      <span className="absolute inset-0 overflow-hidden rounded-md">
                        <img
                          src={image}
                          alt=""
                          className="h-full w-full object-cover object-center"
                        />
                      </span>
                     {index === selectedImage && (
                       <span className="absolute inset-0 ring-2 ring-primary-500 rounded-md" aria-hidden="true" />
                     )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main image */}
            <div className="aspect-h-1 aspect-w-1 w-full">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[selectedImage] || product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover object-center sm:rounded-lg"
                />
              ) : (
                <div className="h-full w-full bg-gray-200 flex items-center justify-center sm:rounded-lg">
                  <span className="text-gray-400">No image available</span>
                </div>
              )}
            </div>
          </div>

          {/* Product info */}
          <div className="mt-10 px-4 sm:mt-16 sm:px-0 lg:mt-0">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {product.name}
            </h1>

            <div className="mt-3">
              <h2 className="sr-only">Product information</h2>
              <div className="flex items-center gap-4">
                <p className="text-3xl tracking-tight text-gray-900">
                  {formatCurrency(product.price)} {shop.business.preferred_currency}
                </p>
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <p className="text-xl text-gray-500 line-through">
                    {formatCurrency(product.compare_at_price)} {shop.business.preferred_currency}
                  </p>
                )}
              </div>
             {product.featured && (
               <div className="mt-2">
                 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                   Featured Product
                 </span>
               </div>
             )}
            </div>

            {/* Stock status */}
            <div className="mt-4">
              {isOutOfStock ? (
                <p className="text-red-600 font-medium">Out of stock</p>
              ) : maxQuantity < 10 ? (
                <p className="text-yellow-600 font-medium">Only {maxQuantity} left in stock</p>
              ) : (
                <p className="text-green-600 font-medium">In stock</p>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mt-6">
                <h3 className="sr-only">Description</h3>
                <div className="space-y-6 text-base text-gray-700">
                  <p>{product.description}</p>
                </div>
              </div>
            )}

            {/* Quantity and Add to cart */}
            <div className="mt-6">
              <div className="flex items-center gap-4 mb-4">
                <label htmlFor="quantity" className="text-sm font-medium text-gray-700">
                  Quantity:
                </label>
                <div className="flex items-center border border-gray-300 rounded-md">
                  <button
                    type="button"
                    onClick={() => adjustQuantity(-1)}
                    disabled={quantity <= 1}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-4 py-2 text-gray-900 font-medium">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => adjustQuantity(1)}
                    disabled={quantity >= maxQuantity}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex w-full items-center justify-center rounded-md border border-transparent bg-primary-600 px-8 py-3 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Related Products
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
              {relatedProducts.map((relatedProduct) => (
                <div key={relatedProduct.id} className="group relative">
                  <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-md bg-gray-200 lg:aspect-none group-hover:opacity-75 lg:h-80">
                    {relatedProduct.images && relatedProduct.images.length > 0 ? (
                      <img
                        src={relatedProduct.images[0]}
                        alt={relatedProduct.name}
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
                        <Link to={`../${relatedProduct.id}`}>
                          <span aria-hidden="true" className="absolute inset-0" />
                          {relatedProduct.name}
                        </Link>
                      </h3>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(relatedProduct.price)} {shop.business.preferred_currency}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}