import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Shop } from '../types/shop';

interface ShopData extends Shop {
  business: {
    logo_url: string | null;
    preferred_currency: string;
  };
}

export function useShop() {
  const { domain } = useParams<{ domain: string }>();
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (domain) {
      loadShop(domain);
    }
  }, [domain]);

  const loadShop = async (shopDomain: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('shops')
        .select(`
          *,
          business:public_business_info(
            logo_url,
            preferred_currency
          )
        `)
        .eq('domain', shopDomain)
        .eq('active', true)
        .maybeSingle();

      if (error) throw error;
      setShop(data);
    } catch (err) {
      console.error('Error loading shop:', err);
      setError(err instanceof Error ? err : new Error('Failed to load shop'));
    } finally {
      setLoading(false);
    }
  };

  return { shop, loading, error };
}