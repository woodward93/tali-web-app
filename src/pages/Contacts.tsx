import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { FilterBar } from '../components/FilterBar';
import { useFilters } from '../lib/hooks/useFilters';
import { MobileDataControls } from '../components/MobileDataControls';

interface Contact {
  id: string;
  business_id: string;
  type: 'customer' | 'supplier';
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  transaction_count: number;
  total_amount: number;
  amount_owed: number;
}

interface ContactFilters {
  type: 'customer' | 'supplier' | '';
}

interface ContactFormData {
  name: string;
  phone: string;
  type: 'customer' | 'supplier';
}

interface BusinessProfile {
  id: string;
  preferred_currency: string;
}

const FILTER_OPTIONS = [
  {
    key: 'type',
    label: 'Type',
    type: 'select' as const,
    options: [
      { value: 'customer', label: 'Customer' },
      { value: 'supplier', label: 'Supplier' }
    ]
  }
];

export function Contacts() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    phone: '',
    type: 'customer'
  });

  const {
    state: { page, perPage, search, filters, sortBy, sortDirection },
    setPage,
    setPerPage,
    setSearch,
    setFilter,
    removeFilter,
    clearFilters,
    setSort
  } = useFilters<ContactFilters>();

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
    }
  }, [user]);

  useEffect(() => {
    if (businessProfile) {
      loadContacts();
    }
  }, [businessProfile, page, perPage, search, filters, sortBy, sortDirection]);

  const loadBusinessProfile = async () => {
    try {
      const { data: businesses, error: businessError } = await supabase
        .from('businesses')
        .select('id, preferred_currency')
        .eq('user_id', user?.id);

      if (businessError) throw businessError;
      if (!businesses || businesses.length === 0) {
        setLoading(false);
        return;
      }

      setBusinessProfile(businesses[0]);
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    if (!businessProfile) return;

    try {
      setLoading(true);

      // First get all contacts
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('business_id', businessProfile.id);

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      if (sortBy) {
        query = query.order(sortBy, { ascending: sortDirection === 'asc' });
      } else {
        query = query.order('name');
      }

      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Get transaction data for each contact
      const processedContacts = await Promise.all((data || []).map(async (contact) => {
        const { data: transactions, error: transactionError } = await supabase
          .from('transactions')
          .select('type, total, balance')
          .eq('business_id', businessProfile.id)
          .eq('contact_id', contact.id)
          .eq('type', contact.type === 'customer' ? 'sale' : 'expense');

        if (transactionError) {
          console.error('Error loading transactions for contact:', transactionError);
          return {
            ...contact,
            transaction_count: 0,
            total_amount: 0,
            amount_owed: 0
          };
        }

        const transaction_count = transactions?.length || 0;
        const total_amount = transactions?.reduce((sum, t) => sum + t.total, 0) || 0;
        const amount_owed = transactions?.reduce((sum, t) => sum + t.balance, 0) || 0;

        return {
          ...contact,
          transaction_count,
          total_amount,
          amount_owed
        };
      }));

      setContacts(processedContacts);
      setTotalContacts(count || 0);
    } catch (err) {
      console.error('Error loading contacts:', err);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessProfile) return;

    if (!formData.name.trim()) {
      toast.error('Contact name is required');
      return;
    }

    try {
      setLoading(true);

      const contactData = {
        business_id: businessProfile.id,
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        type: formData.type
      };

      let error;
      if (editingContact) {
        ({ error } = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', editingContact.id));
      } else {
        ({ error } = await supabase
          .from('contacts')
          .insert(contactData));
      }

      if (error) throw error;

      toast.success(`Contact ${editingContact ? 'updated' : 'added'} successfully`);
      setShowForm(false);
      setEditingContact(null);
      setFormData({ name: '', phone: '', type: 'customer' });
      loadContacts();
    } catch (err) {
      console.error('Error saving contact:', err);
      toast.error('Failed to save contact');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone || '',
      type: contact.type
    });
    setShowForm(true);
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) return;

    try {
      // First check if the contact has any transactions
      const { data: transactions, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('contact_id', contactId)
        .limit(1);

      if (checkError) throw checkError;

      if (transactions && transactions.length > 0) {
        toast.error('Cannot delete contact because it is linked to one or more transactions. Please remove all transactions for this contact first.');
        return;
      }

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast.success('Contact deleted successfully');
      loadContacts();
    } catch (err) {
      console.error('Error deleting contact:', err);
      // Check if it's a foreign key constraint error
      if (err instanceof Error && err.message.includes('foreign key')) {
        toast.error('Cannot delete contact because it is linked to transactions. Please remove all transactions for this contact first.');
      } else {
        toast.error('Failed to delete contact');
      }
    }
  };

  const ContactListItem = ({ contact }: { contact: Contact }) => (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium text-lg">{contact.name}</div>
          {contact.phone && (
            <div className="text-sm text-gray-500">{contact.phone}</div>
          )}
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          contact.type === 'customer'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-purple-100 text-purple-800'
        }`}>
          {contact.type}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-500">
            {contact.type === 'customer' ? 'Sales' : 'Expenses'}
          </div>
          <div className="font-medium">{contact.transaction_count}</div>
        </div>
        <div>
          <div className="text-gray-500">Total Amount</div>
          <div className="font-medium">
            {formatCurrency(contact.total_amount)} {businessProfile?.preferred_currency}
          </div>
        </div>
      </div>
      
      {contact.amount_owed > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <div className="text-sm">
            <span className="text-gray-500">Amount Owed: </span>
            <span className="font-medium text-red-600">
              {formatCurrency(contact.amount_owed)} {businessProfile?.preferred_currency}
            </span>
          </div>
        </div>
      )}
      
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => handleEdit(contact)}
          className="p-2 text-primary-600 hover:text-primary-900"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleDelete(contact.id)}
          className="p-2 text-red-600 hover:text-red-900"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  if (!businessProfile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-base font-semibold text-primary-600">No Business Profile</h2>
        <p className="mt-2 text-sm text-gray-500">Please set up your business profile first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile Header */}
      <div className="sm:hidden px-4">
        <h1 className="text-2xl font-bold mb-4">Customers & Suppliers</h1>
        <div className="space-y-4">
          <div className="relative">
            <input
              type="search"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border-0 rounded-lg py-3 pl-4 pr-4 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={() => {
              setEditingContact(null);
              setFormData({ name: '', phone: '', type: 'customer' });
              setShowForm(true);
            }}
            className="w-full bg-primary-600 text-white rounded-lg py-3 font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            + Add Contact
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-200"
          >
            <span className="font-medium">Filters</span>
            <span className="text-gray-400">›</span>
          </button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden sm:flex items-center justify-between">
        <h1>Customers & Suppliers</h1>
        <button
          onClick={() => {
            setEditingContact(null);
            setFormData({ name: '', phone: '', type: 'customer' });
            setShowForm(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </button>
      </div>

      {/* Filters */}
      <div className="hidden sm:block">
        <FilterBar
          filters={filters}
          options={FILTER_OPTIONS}
          onFilterChange={setFilter}
          onFilterRemove={removeFilter}
          onFiltersClear={clearFilters}
        />
      </div>

      {/* Mobile Contact List */}
      <div className="sm:hidden px-4 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No contacts</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding a customer or supplier.</p>
            <div className="mt-6">
              <button
                onClick={() => {
                  setEditingContact(null);
                  setFormData({ name: '', phone: '', type: 'customer' });
                  setShowForm(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </button>
            </div>
          </div>
        ) : (
          contacts.map(contact => (
            <ContactListItem key={contact.id} contact={contact} />
          ))
        )}

        <MobileDataControls
          totalItems={totalContacts}
          page={page}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* Desktop Data Table */}
      <div className="hidden sm:block">
        <DataTable
          data={contacts}
          columns={[
            {
              key: 'name',
              title: 'Name',
              sortable: true,
              render: (value: string, contact: Contact) => (
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    contact.type === 'customer' 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'bg-purple-100 text-purple-600'
                  }`}>
                    {contact.type === 'customer' ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{value}</div>
                    {contact.phone && (
                      <div className="text-sm text-gray-500">{contact.phone}</div>
                    )}
                  </div>
                </div>
              )
            },
            {
              key: 'type',
              title: 'Type',
              sortable: true,
              render: (value: string) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  value === 'customer'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {value}
                </span>
              )
            },
            {
              key: 'transaction_count',
              title: 'Transactions',
              sortable: true,
              render: (value: number) => (
                <div className="font-medium">{value}</div>
              )
            },
            {
              key: 'total_amount',
              title: 'Total Amount',
              sortable: true,
              render: (value: number) => (
                <div className="font-medium">
                  {formatCurrency(value)} {businessProfile?.preferred_currency}
                </div>
              )
            },
            {
              key: 'amount_owed',
              title: 'Amount Owed',
              sortable: true,
              render: (value: number) => (
                <div className={`font-medium ${value > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {value > 0 
                    ? `${formatCurrency(value)} ${businessProfile?.preferred_currency}`
                    : '-'
                  }
                </div>
              )
            },
            {
              key: 'id',
              title: 'Actions',
              render: (_: string, contact: Contact) => (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleEdit(contact)}
                    className="text-primary-600 hover:text-primary-900"
                    title="Edit contact"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="text-red-600 hover:text-red-900"
                    title="Delete contact"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            }
          ]}
          totalItems={totalContacts}
          page={page}
          perPage={perPage}
          search={search}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          onSearchChange={setSearch}
          onSort={setSort}
        />
      </div>

      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-6 right-6 sm:hidden">
        <button
          onClick={() => {
            setEditingContact(null);
            setFormData({ name: '', phone: '', type: 'customer' });
            setShowForm(true);
          }}
          className="h-14 w-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Contact Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingContact ? 'Edit Contact' : 'Add New Contact'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingContact(null);
                    setFormData({ name: '', phone: '', type: 'customer' });
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <div className="mt-1 flex gap-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="customer"
                        checked={formData.type === 'customer'}
                        onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'customer' | 'supplier' }))}
                        className="form-radio text-primary-600"
                      />
                      <span className="ml-2">Customer</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="supplier"
                        checked={formData.type === 'supplier'}
                        onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'customer' | 'supplier' }))}
                        className="form-radio text-primary-600"
                      />
                      <span className="ml-2">Supplier</span>
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
                    placeholder="Enter contact name"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingContact(null);
                    setFormData({ name: '', phone: '', type: 'customer' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : (editingContact ? 'Update Contact' : 'Add Contact')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Filters Modal */}
      {showFilters && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 sm:hidden">
          <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <FilterBar
                filters={filters}
                options={FILTER_OPTIONS}
                onFilterChange={setFilter}
                onFilterRemove={removeFilter}
                onFiltersClear={clearFilters}
              />
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setShowFilters(false)}
                className="w-full bg-primary-600 text-white rounded-lg py-3 font-medium"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}