import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setError(error);
      } else {
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return data.user;
    } catch (err) {
      console.error('Sign in error:', err);
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            created_at: new Date().toISOString()
          }
        }
      });
      if (error) throw error;
      return data.user;
    } catch (err) {
      console.error('Sign up error:', err);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });
      if (error) throw error;
    } catch (err) {
      console.error('Reset password error:', err);
      throw err;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
    } catch (err) {
      console.error('Update password error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      // First clear any stored session data
      localStorage.removeItem('sb-' + import.meta.env.VITE_SUPABASE_URL.split('//')[1] + '-auth-token');
      sessionStorage.removeItem('sb-' + import.meta.env.VITE_SUPABASE_URL.split('//')[1] + '-auth-token');
      
      try {
        // Attempt to sign out from Supabase
        await supabase.auth.signOut();
      } catch (signOutError: any) {
        // Ignore session_not_found errors as we're logging out anyway
        if (signOutError?.message !== 'session_not_found') {
          console.error('Sign out error:', signOutError);
        }
      }
      
      // Clear user state
      setUser(null);
      
      // Navigate to auth page
      window.location.href = '/auth';
    } catch (err) {
      console.error('Error during sign out cleanup:', err);
      // Even if there's an error, clear the user state and redirect
      setUser(null);
      window.location.href = '/auth';
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword
  };
}