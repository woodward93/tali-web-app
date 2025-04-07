import React from 'react';
import { Link } from 'react-router-dom';
import { useShop } from '../../hooks/useShop';
import { formatCurrency } from '../../lib/format';

export function ShopProducts() {
  const { shop } = useShop();
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  if (!shop) return null;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Products</h1>

        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
          {/* Products will be loaded here */}
          <div className="h-96 w-full bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-96 w-full bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-96 w-full bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-96 w-full bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}