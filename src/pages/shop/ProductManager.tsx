import React, { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { ProductForm } from '../../components/shop/ProductForm';
import { ProductList } from '../../components/shop/ProductList';
import type { ShopProduct } from '../../types/shop';

interface ProductManagerProps {
  shopId: string;
  businessId: string;
  currency: string;
}

export function ProductManager({ shopId, businessId, currency }: ProductManagerProps) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error loading products:', err);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (product: ShopProduct) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      setLoading(true);

      // Delete product images from storage
      for (const imageUrl of product.images) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('shop-images')
            .remove([`${shopId}/${fileName}`]);
        }
      }

      // Delete product record
      const { error } = await supabase
        .from('shop_products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Product deleted successfully');
      loadProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error('Failed to delete product');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (product: ShopProduct) => {
    window.open(`/shop/${shopId}/products/${product.slug}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Products</h2>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowForm(true);
          }}
          className="primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <ProductForm
              shopId={shopId}
              businessId={businessId}
              currency={currency}
              editProduct={editingProduct || undefined}
              onClose={() => {
                setShowForm(false);
                setEditingProduct(null);
              }}
              onSuccess={() => {
                setShowForm(false);
                setEditingProduct(null);
                loadProducts();
              }}
            />
          </div>
        </div>
      )}

      <ProductList
        products={products}
        currency={currency}
        onEdit={(product) => {
          setEditingProduct(product);
          setShowForm(true);
        }}
        onDelete={handleDelete}
        onView={handleView}
      />
    </div>
  );
}