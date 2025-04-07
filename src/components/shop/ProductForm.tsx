import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import type { ShopProduct } from '../../types/shop';

interface ProductFormProps {
  shopId: string;
  businessId: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
  editProduct?: ShopProduct;
}

export function ProductForm({ shopId, businessId, currency, onClose, onSuccess, editProduct }: ProductFormProps) {
  const [loading, setLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    compare_at_price: '',
    inventory_item_id: '',
    active: true,
    featured: false,
    images: [] as string[]
  });

  useEffect(() => {
    loadInventoryItems();
    if (editProduct) {
      setFormData({
        name: editProduct.name,
        description: editProduct.description || '',
        price: editProduct.price.toString(),
        compare_at_price: editProduct.compare_at_price?.toString() || '',
        inventory_item_id: editProduct.inventory_item_id || '',
        active: editProduct.active,
        featured: editProduct.featured,
        images: editProduct.images
      });
    }
  }, [editProduct]);

  const loadInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('business_id', businessId)
        .eq('type', 'product')
        .order('name');

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (err) {
      console.error('Error loading inventory items:', err);
      toast.error('Failed to load inventory items');
    }
  };

  const handleInventoryItemSelect = (itemId: string) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
      setSelectedInventoryItem(item);
      setFormData(prev => ({
        ...prev,
        name: item.name,
        description: item.description || '',
        price: item.selling_price.toString(),
        inventory_item_id: item.id
      }));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${shopId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('shop-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('shop-images')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, publicUrl]
      }));

      toast.success('Image uploaded successfully');
    } catch (err) {
      console.error('Error uploading image:', err);
      toast.error('Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImage = async (url: string) => {
    try {
      setLoading(true);
      const fileName = url.split('/').pop();
      if (!fileName) return;

      const { error } = await supabase.storage
        .from('shop-images')
        .remove([`${shopId}/${fileName}`]);

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        images: prev.images.filter(img => img !== url)
      }));

      toast.success('Image removed successfully');
    } catch (err) {
      console.error('Error removing image:', err);
      toast.error('Failed to remove image');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error('Valid price is required');
      return;
    }

    try {
      setLoading(true);

      const productData = {
        ...formData,
        shop_id: shopId,
        business_id: businessId, // Add business_id to the product data
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        inventory_item_id: formData.inventory_item_id || null
      };

      let error;
      if (editProduct) {
        ({ error } = await supabase
          .from('shop_products')
          .update(productData)
          .eq('id', editProduct.id));
      } else {
        ({ error } = await supabase
          .from('shop_products')
          .insert(productData));
      }

      if (error) throw error;

      toast.success(`Product ${editProduct ? 'updated' : 'added'} successfully`);
      onSuccess();
    } catch (err) {
      console.error('Error saving product:', err);
      toast.error('Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-6">
          {editProduct ? 'Edit Product' : 'Add Product'}
        </h3>

        {!editProduct && (
          <div className="mb-6">
            <label>Create from Inventory Item</label>
            <select
              value={formData.inventory_item_id}
              onChange={e => handleInventoryItemSelect(e.target.value)}
              className="mt-1"
            >
              <option value="">Create new product</option>
              {inventoryItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} (Stock: {item.quantity})
                </option>
              ))}
            </select>
            {selectedInventoryItem && (
              <p className="mt-2 text-sm text-gray-500">
                Product details will be pre-filled from the selected inventory item.
                You can still modify them before saving.
              </p>
            )}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label>Product Images</label>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {formData.images.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Product image ${index + 1}`}
                    className="h-32 w-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(url)}
                    className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <label className="cursor-pointer flex items-center justify-center h-32 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400">
                <div className="text-center">
                  <Upload className="mx-auto h-6 w-6 text-gray-400" />
                  <span className="mt-2 block text-sm font-medium text-gray-600">
                    Add Image
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label>Product Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter product name"
            />
          </div>

          <div>
            <label>Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter product description"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label>Price ({currency})</label>
              <div className="currency-input-wrapper">
                <div className="currency-symbol">{currency}</div>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label>Compare at Price ({currency})</label>
              <div className="currency-input-wrapper">
                <div className="currency-symbol">{currency}</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.compare_at_price}
                  onChange={e => setFormData(prev => ({ ...prev, compare_at_price: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={e => setFormData(prev => ({ ...prev, active: e.target.checked }))}
              />
              <span>Active</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={e => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
              />
              <span>Featured</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="secondary"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="primary"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Product'
          )}
        </button>
      </div>
    </form>
  );
}