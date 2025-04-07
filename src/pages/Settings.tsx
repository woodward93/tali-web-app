import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Trash2, Search } from 'lucide-react';
import { supabase, requireAuth } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';
import { COUNTRIES, CURRENCIES } from '../lib/countries';
import type { UserProfile } from '../types';

interface BusinessProfile {
  name: string;
  country: string;
  preferred_currency: string;
  logo_url: string;
  address: string;
}

export function Settings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [businessFormData, setBusinessFormData] = useState<BusinessProfile>({
    name: '',
    country: '',
    preferred_currency: '',
    logo_url: '',
    address: '',
  });
  const [userFormData, setUserFormData] = useState<Partial<UserProfile>>({
    first_name: '',
    last_name: '',
    phone: '',
    email: user?.email || '',
    address: '',
  });

  useEffect(() => {
    if (!authLoading && user) {
      loadProfiles();
    }
  }, [user, authLoading]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      await requireAuth();

      // Load business profile
      const { data: businesses, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user?.id);

      if (businessError) throw businessError;
      
      if (businesses && businesses.length > 0) {
        const data = businesses[0];
        setBusinessFormData(data);
        if (data.country) {
          const country = COUNTRIES.find(c => c.code === data.country);
          if (country) {
            setCountrySearch(country.name);
            if (data.preferred_currency === country.currency) {
              const currency = CURRENCIES[country.currency as keyof typeof CURRENCIES];
              if (currency) {
                setCurrencySearch(`${country.currency} - ${currency[1]}`);
              }
            }
          }
        }
        if (data.preferred_currency) {
          const currency = CURRENCIES[data.preferred_currency as keyof typeof CURRENCIES];
          if (currency) {
            setCurrencySearch(`${data.preferred_currency} - ${currency[1]}`);
          }
        }
      }

      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      
      if (profile) {
        setUserFormData(profile);
      } else {
        // Set email from auth user
        setUserFormData(prev => ({ ...prev, email: user?.email }));
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!businessFormData.country || !businessFormData.preferred_currency) {
      setError('Country and Currency are required fields');
      setLoading(false);
      toast.error('Please select both Country and Currency');
      return;
    }

    try {
      // Update business profile
      const { error: businessError } = await supabase
        .from('businesses')
        .upsert({
          user_id: user?.id,
          ...businessFormData,
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // Update user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user?.id,
          ...userFormData,
          email: user?.email, // Ensure we always use the auth email as a string
        })
        .select()
        .single();

      if (profileError) throw profileError;
      
      setSuccess(true);
      toast.success('Settings updated successfully');
      navigate('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error('File size must be less than 3MB');
      return;
    }

    try {
      setLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      if (businessFormData.logo_url) {
        const existingPath = businessFormData.logo_url.split('/').pop();
        if (existingPath) {
          await supabase.storage
            .from('logos')
            .remove([`${user?.id}/${existingPath}`]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      setBusinessFormData(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success('Logo uploaded successfully');
    } catch (err) {
      console.error('Error uploading logo:', err);
      toast.error('Failed to upload logo');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!businessFormData.logo_url) return;

    try {
      setLoading(true);
      const fileName = businessFormData.logo_url.split('/').pop();
      
      if (fileName) {
        const { error: deleteError } = await supabase.storage
          .from('logos')
          .remove([`${user?.id}/${fileName}`]);

        if (deleteError) throw deleteError;

        const { error: updateError } = await supabase
          .from('businesses')
          .update({ logo_url: null })
          .eq('user_id', user?.id);

        if (updateError) throw updateError;

        setBusinessFormData(prev => ({ ...prev, logo_url: '' }));
        toast.success('Logo deleted successfully');
      }
    } catch (err) {
      console.error('Error deleting logo:', err);
      toast.error('Failed to delete logo');
    } finally {
      setLoading(false);
    }
  };

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    country.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredCurrencies = Object.entries(CURRENCIES).filter(([code, [_, name]]) =>
    name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    code.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const selectedCountry = COUNTRIES.find(c => c.code === businessFormData.country);
  const selectedCurrency = businessFormData.preferred_currency ? 
    CURRENCIES[businessFormData.preferred_currency as keyof typeof CURRENCIES] : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1>Settings</h1>

      {error && (
        <div className="form-error rounded-lg p-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
          Settings updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* User Profile Section */}
        <div className="form-card space-y-6">
          <h2 className="text-lg font-medium text-gray-900">User Profile</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label>First Name</label>
              <input
                type="text"
                value={userFormData.first_name || ''}
                onChange={e => setUserFormData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="Enter your first name"
              />
            </div>

            <div>
              <label>Last Name</label>
              <input
                type="text"
                value={userFormData.last_name || ''}
                onChange={e => setUserFormData(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Enter your last name"
              />
            </div>
          </div>

          <div>
            <label>Phone Number</label>
            <input
              type="tel"
              value={userFormData.phone || ''}
              onChange={e => setUserFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Enter your phone number"
            />
          </div>

          <div>
            <label>Email Address</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-gray-50"
            />
            <p className="mt-2 text-sm text-gray-500">
              This is your sign up email address and cannot be changed.
            </p>
          </div>

          <div>
            <label>Address</label>
            <textarea
              value={userFormData.address || ''}
              onChange={e => setUserFormData(prev => ({ ...prev, address: e.target.value }))}
              rows={3}
              placeholder="Enter your address"
            />
          </div>
        </div>

        {/* Business Profile Section */}
        <div className="form-card space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Business Profile</h2>

          <div>
            <label>Business Name</label>
            <input
              type="text"
              required
              value={businessFormData.name}
              onChange={e => setBusinessFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your business name"
            />
          </div>

          <div className="relative">
            <label>
              Country <span className="text-red-500">*</span>
            </label>
            <div className="search-input-wrapper">
              <div className="search-icon">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={countrySearch}
                onChange={e => {
                  setCountrySearch(e.target.value);
                  setShowCountryDropdown(true);
                }}
                onFocus={() => setShowCountryDropdown(true)}
                onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
                placeholder="Search countries..."
              />
            </div>
            {showCountryDropdown && (
              <div className="search-dropdown">
                {filteredCountries.map(country => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      setBusinessFormData(prev => ({
                        ...prev,
                        country: country.code,
                        preferred_currency: country.currency
                      }));
                      setCountrySearch(country.name);
                      setShowCountryDropdown(false);
                      
                      const currency = CURRENCIES[country.currency as keyof typeof CURRENCIES];
                      if (currency) {
                        setCurrencySearch(`${country.currency} - ${currency[1]}`);
                      }
                    }}
                    className="search-dropdown-item"
                  >
                    {country.name}
                  </button>
                ))}
              </div>
            )}
            {selectedCountry && (
              <div className="selected-value">
                Selected: {selectedCountry.name}
              </div>
            )}
          </div>

          <div className="relative">
            <label>
              Preferred Currency <span className="text-red-500">*</span>
            </label>
            <div className="search-input-wrapper">
              <div className="search-icon">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={currencySearch}
                onChange={e => {
                  setCurrencySearch(e.target.value);
                  setShowCurrencyDropdown(true);
                }}
                onFocus={() => setShowCurrencyDropdown(true)}
                onBlur={() => setTimeout(() => setShowCurrencyDropdown(false), 200)}
                placeholder="Search currencies..."
              />
            </div>
            {showCurrencyDropdown && (
              <div className="search-dropdown">
                {filteredCurrencies.map(([code, [_, name]]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setBusinessFormData(prev => ({ ...prev, preferred_currency: code }));
                      setCurrencySearch(`${code} - ${name}`);
                      setShowCurrencyDropdown(false);
                    }}
                    className="search-dropdown-item"
                  >
                    {code} - {name}
                  </button>
                ))}
              </div>
            )}
            {selectedCurrency && (
              <div className="selected-value">
                Selected: {businessFormData.preferred_currency} - {selectedCurrency[1]}
              </div>
            )}
          </div>

          <div>
            <label>Business Logo</label>
            <div className="mt-1 flex items-center gap-4">
              {businessFormData.logo_url && (
                <div className="relative group">
                  <img
                    src={businessFormData.logo_url}
                    alt="Business logo"
                    className="h-16 w-16 rounded-full object-cover bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleDeleteLogo}
                    disabled={loading}
                    className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label 
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  {...(loading ? { disabled: true } : {})}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {loading ? 'Uploading...' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
                <p className="text-xs text-gray-500">
                  Max file size: 3MB. Supported formats: PNG, JPG, GIF
                </p>
              </div>
            </div>
          </div>

          <div>
            <label>Business Address</label>
            <textarea
              value={businessFormData.address}
              onChange={e => setBusinessFormData(prev => ({ ...prev, address: e.target.value }))}
              rows={3}
              placeholder="Enter your business address"
            />
          </div>
        </div>

        <div className="form-footer">
          <button
            type="submit"
            disabled={loading}
            className="primary"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}