import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Configure Supabase client with retries and proper timeout
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage // Explicitly set storage to localStorage
  },
  global: {
    headers: { 'x-application-name': 'tali' }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  // Add retry configuration
  fetch: (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Cache-Control': 'no-cache',
      },
      // Add retry logic
      retry: 3,
      retryDelay: 1000,
    });
  }
});

// Helper function to check if user is authenticated
export const requireAuth = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) {
    throw new Error('Authentication required');
  }
  return session.user;
};

// Helper to load business profile
export const loadBusinessProfile = async () => {
  const user = await requireAuth();
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return businesses || null;
};

// Helper to check database connection
export const checkConnection = async () => {
  try {
    const { error } = await supabase.from('businesses').select('count').limit(1);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Database connection error:', err);
    return false;
  }
};