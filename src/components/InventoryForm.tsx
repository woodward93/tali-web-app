import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/format';

interface Category {
  id: string;
  name: string;
}

interface BusinessProfile {
  id: string;
  preferred_currency: string;
}

interface InventoryItem {
  id?: string;
  type: 'product' | 'service';
  name: string;
  category_id: string;
  sku: string;
  description: string;
  quantity: number;
  selling_price: string | number;
  cost_price: string | number;
}

interface InventoryFormProps {
  onClose: () => void;
  onSuccess: (item: any) => void;
  editItem?: InventoryItem;
  initialData?: Partial<InventoryItem>;
}

export function InventoryForm({ onClose, onSuccess, editItem, initialData }: InventoryFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [formData, setFormData] = useState<InventoryItem>({
    type: initialData?.type || 'product',
    name: initialData?.name || '',
    category_id: '',
    sku: '',
    description: '',
    quantity: 0,
    selling_price: initialData?.selling_price || '',
    cost_price: '',
  });

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
    }
  }, [user]);

  useEffect(() => {
    if (editItem) {
      setFormData({
        ...editItem,
        selling_price: editItem.selling_price.toString(),
        cost_price: editItem.cost_price?.toString() || '',
      });
    }
  }, [editItem]);

  const loadBusinessProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, preferred_currency')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setBusinessProfile(data);
      
      if (data) {
        loadCategories(data.id);
      }
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
    }
  };

  const loadCategories = async (businessId: string) => {
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

  const handleCreateCategory = async () => {
    if (!newCategory.trim() || !businessProfile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .insert({
          business_id: businessProfile.id,
          name: newCategory.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setCategories([...categories, data]);
      setFormData(prev => ({ ...prev, category_id: data.id }));
      setNewCategory('');
      toast.success('Category created successfully');
    } catch (err) {
      console.error('Error creating category:', err);
      toast.error('Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessProfile) {
      toast.error('Business profile not loaded');
      return;
    }
    
    try {
      setLoading(true);
      const itemData = {
        ...formData,
        business_id: businessProfile.id,
        selling_price: parseFloat(formData.selling_price.toString()),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price.toString()) : null,
        quantity: formData.type === 'service' ? null : parseInt(formData.quantity.toString()),
      };

      let error;
      let data;
      if (editItem?.id) {
        const response = await supabase
          .from('inventory_items')
          .update(itemData)
          .eq('id', editItem.id)
          .select()
          .single();
        error = response.error;
        data = response.data;
      } else {
        const response = await supabase
          .from('inventory_items')
          .insert(itemData)
          .select()
          .single();
        error = response.error;
        data = response.data;
      }

      if (error) throw error;

      toast.success(editItem ? 'Item updated successfully' : 'Item added successfully');
      onSuccess(data);
    } catch (err) {
      console.error('Error saving item:', err);
      toast.error('Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">
          {editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700">Type</label>
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
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Category</label>
          <div className="mt-1 flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-1/2">
              <select
                value={formData.category_id}
                onChange={e => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden sm:flex items-center text-gray-500 font-medium">OR</div>
            <div className="flex items-center sm:hidden justify-center text-gray-500 font-medium">OR</div>
            <div className="flex w-full sm:w-auto gap-2">
              <input
                type="text"
                placeholder="Add new category"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="block flex-1 sm:w-48 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={!newCategory.trim() || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {formData.type === 'product' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">SKU (Optional)</label>
              <input
                type="text"
                value={formData.sku}
                onChange={e => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Quantity in Stock</label>
              <input
                type="number"
                min="0"
                value={formData.quantity}
                onChange={e => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
          <textarea
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Selling Price ({businessProfile?.preferred_currency})
          </label>
          <div className="currency-input-wrapper">
            <div className="currency-symbol">
              {businessProfile?.preferred_currency}
            </div>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.selling_price}
              onChange={e => setFormData(prev => ({ ...prev, selling_price: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          </div>
        </div>

        {formData.type === 'product' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cost Price ({businessProfile?.preferred_currency})
            </label>
            <div className="currency-input-wrapper">
              <div className="currency-symbol">
                {businessProfile?.preferred_currency}
              </div>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.cost_price}
                onChange={e => setFormData(prev => ({ ...prev, cost_price: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
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
          className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600 disabled:opacity-50"
        >
          {loading ? 'Saving...' : (editItem ? 'Update Item' : 'Save Item')}
        </button>
      </div>
    </form>
  );
}