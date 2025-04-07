import React from 'react';
import { useParams } from 'react-router-dom';
import { useShop } from '../../hooks/useShop';
import { formatCurrency } from '../../lib/format';

export function ShopProduct() {
  const { shop } = useShop();
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  if (!shop) return null;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
        {/* Product details will be loaded here */}
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
          {/* Image gallery */}
          <div className="aspect-h-1 aspect-w-1 w-full">
            <div className="h-full w-full bg-gray-100 rounded-lg animate-pulse" />
          </div>

          {/* Product info */}
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