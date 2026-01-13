import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Trash2, Search, User, Building2 } from 'lucide-react';
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

type SettingsModule = 'profile' | 'business';

export function Settings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<SettingsModule>('profile');
  const [loading, setLoading] = useState(true);
  const [logoLoading, setLogoLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
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

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      
      if (!profile) {
        setIsFirstTimeUser(true);
        setUserFormData(prev => ({ ...prev, email: user?.email }));
      } else {
        setUserFormData(profile);
        
        const { data: businesses } = await supabase
          .from('businesses')
          .select('*')
          .eq('user_id', user?.id);
        
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
        } else {
          setActiveModule('business');
        }
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
      setProfileLoaded(true);
    }
  };

  const handleUserProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!userFormData.phone || userFormData.phone.trim() === '') {
      setError('Phone number is required');
      setLoading(false);
      toast.error('Please enter a phone number');
      return;
    }

    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user?.id,
          ...userFormData,
          email: user?.email,
        })
        .select()
        .single();

      if (profileError) throw profileError;
      
      setSuccess(true);
      toast.success('User profile updated successfully');

      if (isFirstTimeUser) {
        setIsFirstTimeUser(false);
        setActiveModule('business');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessProfileSubmit = async (e: React.FormEvent) => {
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
      const { error: businessError } = await supabase
        .from('businesses')
        .upsert({
          user_id: user?.id,
          ...businessFormData,
        })
        .select()
        .single();

      if (businessError) throw businessError;
      
      setSuccess(true);
      toast.success('Business profile updated successfully');
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
      setLogoLoading(true);
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
      setLogoLoading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!businessFormData.logo_url) return;

    try {
      setLogoLoading(true);
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
      setLogoLoading(false);
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

  if (!profileLoaded || (loading && !isFirstTimeUser)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // For first-time users, show only the profile form
  if (isFirstTimeUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-4 py-4 sm:px-6 border-b">
            <h2 className="text-lg font-medium text-gray-900">Welcome! Let's set up your profile</h2>
          </div>
          <div className="p-4 sm:p-6">
            <form onSubmit={handleUserProfileSubmit} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    value={userFormData.first_name || ''}
                    onChange={e => setUserFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Enter your first name"
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    value={userFormData.last_name || ''}
                    onChange={e => setUserFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Enter your last name"
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  required
                  value={userFormData.phone || ''}
                  onChange={e => setUserFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter your phone number"
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="mt-1 block w-full rounded-lg border-gray-300 bg-gray-50 shadow-sm"
                />
                <p className="mt-2 text-sm text-gray-500">
                  This is your sign up email address and cannot be changed.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  value={userFormData.address || ''}
                  onChange={e => setUserFormData(prev => ({ ...prev, address: e.target.value }))}
                  rows={3}
                  placeholder="Enter your address"
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Mobile Tabs */}
      <div className="sm:hidden mb-6">
        <div className="bg-gray-100 rounded-lg p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setActiveModule('profile')}
              className={`py-2 text-sm font-medium rounded-md ${
                activeModule === 'profile'
                  ? 'bg-white text-primary-600 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              User Profile
            </button>
            <button
              onClick={() => setActiveModule('business')}
              className={`py-2 text-sm font-medium rounded-md ${
                activeModule === 'business'
                  ? 'bg-white text-primary-600 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Business Profile
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop Sidebar Navigation */}
        <div className="hidden sm:block w-64 shrink-0">
          <div className="bg-white rounded-lg shadow-sm p-4 sticky top-24">
            <h2 className="text-lg font-semibold text-gray-900 px-2 mb-4">Settings</h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveModule('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeModule === 'profile'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <User className="h-5 w-5" />
                User Profile
              </button>
              <button
                onClick={() => setActiveModule('business')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeModule === 'business'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Building2 className="h-5 w-5" />
                Business Profile
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Alert Messages */}
          <div className="space-y-4 mb-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
                Settings updated successfully!
              </div>
            )}
          </div>

          {/* Module Content */}
          <div className="bg-white rounded-lg shadow-sm">
            {/* Module Header */}
            <div className="px-4 py-4 sm:px-6 border-b">
              <h2 className="text-lg font-medium text-gray-900">
                {activeModule === 'profile' ? 'User Profile' : 'Business Profile'}
              </h2>
            </div>

            {/* Module Content */}
            <div className="p-4 sm:p-6">
              {activeModule === 'profile' ? (
                <form onSubmit={handleUserProfileSubmit} className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">First Name</label>
                      <input
                        type="text"
                        value={userFormData.first_name || ''}
                        onChange={e => setUserFormData(prev => ({ ...prev, first_name: e.target.value }))}
                        placeholder="Enter your first name"
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Last Name</label>
                      <input
                        type="text"
                        value={userFormData.last_name || ''}
                        onChange={e => setUserFormData(prev => ({ ...prev, last_name: e.target.value }))}
                        placeholder="Enter your last name"
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      required
                      value={userFormData.phone || ''}
                      onChange={e => setUserFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter your phone number"
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="mt-1 block w-full rounded-lg border-gray-300 bg-gray-50 shadow-sm"
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      This is your sign up email address and cannot be changed.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <textarea
                      value={userFormData.address || ''}
                      onChange={e => setUserFormData(prev => ({ ...prev, address: e.target.value }))}
                      rows={3}
                      placeholder="Enter your address"
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto px-6 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleBusinessProfileSubmit} className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business Name</label>
                    <input
                      type="text"
                      required
                      value={businessFormData.name}
                      onChange={e => setBusinessFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter your business name"
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700">
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
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 pl-10"
                      />
                    </div>
                    {showCountryDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
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
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                          >
                            {country.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedCountry && (
                      <div className="mt-2 text-sm text-gray-500">
                        Selected: {selectedCountry.name}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700">
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
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 pl-10"
                      />
                    </div>
                    {showCurrencyDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
                        {filteredCurrencies.map(([code, [_, name]]) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              setBusinessFormData(prev => ({ ...prev, preferred_currency: code }));
                              setCurrencySearch(`${code} - ${name}`);
                              setShowCurrencyDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                          >
                            {code} - {name}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedCurrency && (
                      <div className="mt-2 text-sm text-gray-500">
                        Selected: {businessFormData.preferred_currency} - {selectedCurrency[1]}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business Logo</label>
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
                            disabled={logoLoading}
                            className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <label 
                          className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {logoLoading ? 'Uploading...' : 'Upload Logo'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={logoLoading}
                          />
                        </label>
                        <p className="text-xs text-gray-500">
                          Max file size: 3MB. Supported formats: PNG, JPG, GIF
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business Address</label>
                    <textarea
                      value={businessFormData.address}
                      onChange={e => setBusinessFormData(prev => ({ ...prev, address: e.target.value }))}
                      rows={3}
                      placeholder="Enter your business address"
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto px-6 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}