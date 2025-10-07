import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, Star, X } from 'lucide-react';
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
  const [imageUploading, setImageUploading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    compare_at_price: '',
    inventory_item_id: '',
    active: true,
    featured: false,
    images: [] as string[],
    // New inventory item fields
    category_id: '',
    cost_price: '',
    type: 'product' as 'product' | 'service',
    quantity: '0'
  });

  useEffect(() => {
    loadInventoryItems();
    loadCategories();
    if (editProduct) {
      setFormData({
        name: editProduct.name,
        description: editProduct.description || '',
        price: editProduct.price.toString(),
        compare_at_price: editProduct.compare_at_price?.toString() || '',
        inventory_item_id: editProduct.inventory_item_id || '',
        active: editProduct.active,
        featured: editProduct.featured,
        images: editProduct.images || [],
        category_id: '',
        cost_price: '',
        type: 'product',
        quantity: '0'
      });
    }
  }, [editProduct]);

  const loadInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('business_id', businessId)
        .order('name');

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (err) {
      console.error('Error loading inventory items:', err);
      toast.error('Failed to load inventory items');
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('business_id', businessId)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error loading categories:', err);
      toast.error('Failed to load categories');
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
        inventory_item_id: item.id,
        category_id: item.category_id || '',
        cost_price: item.cost_price?.toString() || '',
        type: item.type || 'product',
        quantity: item.quantity?.toString() || '0'
      }));
    } else {
      // Clear selection
      setSelectedInventoryItem(null);
      setFormData(prev => ({
        ...prev,
        inventory_item_id: '',
        category_id: '',
        cost_price: '',
        type: 'product',
        quantity: '0'
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
      setImageUploading(true);
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
      setImageUploading(false);
    }
  };

  const handleRemoveImage = async (url: string) => {
    try {
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
    }
  };

  const generateUniqueSlug = async (name: string, excludeProductId?: string) => {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      // Check if slug exists in the same shop
      let query = supabase
        .from('shop_products')
        .select('id')
        .eq('shop_id', shopId)
        .eq('slug', slug);

      // Only add the exclusion filter if we have a valid product ID to exclude
      if (excludeProductId) {
        query = query.neq('id', excludeProductId);
      }
      
      const { data: existingProducts, error } = await query;

      if (error) throw error;

      if (!existingProducts || existingProducts.length === 0) {
        return slug; // Slug is unique
      }

      // Generate new slug with counter
      slug = `${baseSlug}-${counter}`;
      counter++;
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

    // If creating a new product (not from existing inventory), validate additional fields
    if (!formData.inventory_item_id && !editProduct) {
      if (!formData.category_id) {
        toast.error('Category is required for new products');
        return;
      }
      if (formData.type === 'product' && (!formData.cost_price || parseFloat(formData.cost_price) <= 0)) {
        toast.error('Cost price is required for products');
        return;
      }
    }

    try {
      setLoading(true);

      let inventoryItemId = formData.inventory_item_id;

      // Create inventory item if this is a new product (not from existing inventory)
      if (!inventoryItemId && !editProduct) {
        const inventoryData = {
          business_id: businessId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          type: formData.type,
          category_id: formData.category_id,
          selling_price: parseFloat(formData.price),
          cost_price: formData.type === 'product' ? parseFloat(formData.cost_price) : null,
          quantity: formData.type === 'product' ? parseInt(formData.quantity) : null,
          sku: null
        };

        const { data: inventoryItem, error: inventoryError } = await supabase
          .from('inventory_items')
          .insert(inventoryData)
          .select()
          .single();

        if (inventoryError) throw inventoryError;
        inventoryItemId = inventoryItem.id;
      }

      // Generate unique slug
      const slug = await generateUniqueSlug(
        formData.name.trim(), 
        editProduct?.id
      );

      const productData = {
        shop_id: shopId,
        business_id: businessId,
        name: formData.name.trim(),
        slug,
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        inventory_item_id: inventoryItemId,
        active: formData.active,
        featured: formData.featured,
        images: formData.images,
        in_stock: true
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

  const isNewProduct = !formData.inventory_item_id && !editProduct;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {editProduct ? 'Edit Product' : 'Add Product'}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {!editProduct && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Create from Inventory Item</label>
            <select
              value={formData.inventory_item_id}
              onChange={e => handleInventoryItemSelect(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">Create new product</option>
              {inventoryItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} - {formatCurrency(item.selling_price)} {currency}
                </option>
              ))}
            </select>
            {selectedInventoryItem && (
              <p className="mt-2 text-sm text-gray-500">
                Stock: {selectedInventoryItem.quantity} | Type: {selectedInventoryItem.type}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Product Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            placeholder="Enter product name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            placeholder="Describe your product..."
          />
        </div>

        {/* Additional fields for new products */}
        {isNewProduct && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Product Type</label>
              <div className="mt-1 flex gap-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="product"
                    checked={formData.type === 'product'}
                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'product' | 'service' }))}
                    className="form-radio text-primary-600"
                  />
                  <span className="ml-2">Product</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="service"
                    checked={formData.type === 'service'}
                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'product' | 'service' }))}
                    className="form-radio text-primary-600"
                  />
                  <span className="ml-2">Service</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                value={formData.category_id}
                onChange={e => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required={isNewProduct}
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {formData.type === 'product' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity in Stock</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Price ({currency})
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.price}
              onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Compare at Price ({currency})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.compare_at_price}
              onChange={e => setFormData(prev => ({ ...prev, compare_at_price: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="0.00"
            />
            <p className="mt-1 text-sm text-gray-500">
              Show a crossed-out higher price
            </p>
          </div>

          {isNewProduct && formData.type === 'product' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cost Price ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.cost_price}
                onChange={e => setFormData(prev => ({ ...prev, cost_price: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="0.00"
                required={isNewProduct && formData.type === 'product'}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Product Images</label>
          <div className="space-y-4">
            {formData.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {formData.images.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Product image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(url)}
                      className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
              {imageUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {imageUploading ? 'Uploading...' : 'Add Image'}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={imageUploading}
                className="hidden"
              />
            </label>
            <p className="text-sm text-gray-500">
              Upload high-quality images. Max file size: 5MB
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={e => setFormData(prev => ({ ...prev, active: e.target.checked }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
              Active (visible in shop)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="featured"
              checked={formData.featured}
              onChange={e => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="featured" className="ml-2 flex items-center text-sm text-gray-900">
              <Star className="h-4 w-4 mr-1 text-yellow-500" />
              Featured product
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : (editProduct ? 'Update Product' : 'Add Product')}
          </button>
        </div>
      </form>
    </div>
  );
}