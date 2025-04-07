import React, { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { ProductManager } from './shop/ProductManager';

interface Shop {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  active: boolean;
}

interface BusinessProfile {
  id: string;
  preferred_currency: string;
}

export function OnlineShop() {
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [showShopForm, setShowShopForm] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    description: '',
  });

  useEffect(() => {
    loadBusinessProfile();
  }, []);

  const loadBusinessProfile = async () => {
    try {
      const { data: businesses, error: businessError } = await supabase
        .from('businesses')
        .select('id, preferred_currency')
        .limit(1);

      if (businessError) throw businessError;
      if (!businesses || businesses.length === 0) {
        setLoading(false);
        return;
      }

      setBusinessProfile(businesses[0]);
      await loadShop(businesses[0].id);
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
      setLoading(false);
    }
  };

  const loadShop = async (businessId: string) => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('business_id', businessId)
        .eq('active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No shop found - this is a valid state
          setLoading(false);
          return;
        }
        throw error;
      }

      setShop(data);
    } catch (err) {
      console.error('Error loading shop:', err);
      toast.error('Failed to load shop');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessProfile) return;

    try {
      setLoading(true);

      // Validate domain format
      if (!/^[a-z0-9-]+$/.test(formData.domain)) {
        toast.error('Domain can only contain lowercase letters, numbers, and hyphens');
        return;
      }

      // Check if domain is available
      const { data: existingShop, error: checkError } = await supabase
        .from('shops')
        .select('id')
        .eq('domain', formData.domain)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existingShop) {
        toast.error('This domain is already taken');
        return;
      }

      // Create shop
      const { data, error } = await supabase
        .from('shops')
        .insert({
          business_id: businessProfile.id,
          name: formData.name,
          domain: formData.domain,
          description: formData.description || null,
        })
        .select()
        .single();

      if (error) throw error;

      setShop(data);
      setShowShopForm(false);
      toast.success('Shop created successfully');
    } catch (err) {
      console.error('Error creating shop:', err);
      toast.error('Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!businessProfile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-base font-semibold text-primary-600">No Business Profile</h2>
        <p className="mt-2 text-sm text-gray-500">Please set up your business profile first.</p>
      </div>
    );
  }

  if (!shop && !showShopForm) {
    return (
      <div className="text-center py-12">
        <h2 className="text-base font-semibold text-primary-600">Create Your Online Shop</h2>
        <p className="mt-2 text-sm text-gray-500">
          Start selling your products online with a custom shop.
        </p>
        <button
          onClick={() => setShowShopForm(true)}
          className="mt-6 primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Shop
        </button>
      </div>
    );
  }

  if (showShopForm) {
    return (
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-6">
              Create Your Shop
            </h3>

            <div className="space-y-6">
              <div>
                <label>Shop Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your shop name"
                />
              </div>

              <div>
                <label>Shop Domain</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    shop/
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.domain}
                    onChange={e => setFormData(prev => ({ ...prev, domain: e.target.value.toLowerCase() }))}
                    placeholder="your-shop-name"
                    pattern="[a-z0-9-]+"
                    className="flex-1 rounded-none rounded-r-md"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Only lowercase letters, numbers, and hyphens are allowed.
                </p>
              </div>

              <div>
                <label>Description (Optional)</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your shop"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowShopForm(false)}
              className="secondary"
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
                  Creating...
                </>
              ) : (
                'Create Shop'
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{shop.name}</h2>
            {shop.description && (
              <p className="mt-1 text-gray-500">{shop.description}</p>
            )}
            <div className="mt-2">
              <a
                href={`/shop/${shop.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-500"
              >
                View Shop →
              </a>
            </div>
          </div>
        </div>
      </div>

      <ProductManager
        shopId={shop.id}
        businessId={businessProfile.id}
        currency={businessProfile.preferred_currency}
      />
    </div>
  );
}