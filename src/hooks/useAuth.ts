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
      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();

      // Check for session_not_found error (can be in code or message)
      if (error) {
        const isSessionNotFound =
          error.message?.includes('session_not_found') ||
          error.message?.includes('Session from session_id claim in JWT does not exist') ||
          error.status === 404;

        // Only log errors that aren't about missing sessions
        if (!isSessionNotFound) {
          console.error('Sign out error:', error);
        }
      }
    } catch (err: any) {
      // Catch any network or unexpected errors
      console.error('Error during sign out:', err);
    } finally {
      // Always clear local state and storage, regardless of API result
      try {
        // Clear Supabase auth keys from localStorage
        const storageKeys = Object.keys(localStorage);
        storageKeys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
      } catch (storageError) {
        console.error('Error clearing storage:', storageError);
      }

      // Clear user state
      setUser(null);

      // Navigate to auth page
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