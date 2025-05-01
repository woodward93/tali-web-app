import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, requireAuth } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { InventoryForm } from '../components/InventoryForm';
import { formatCurrency } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { FilterBar } from '../components/FilterBar';
import { useFilters } from '../lib/hooks/useFilters';
import { MobileDataControls } from '../components/MobileDataControls';

interface InventoryItem {
  id: string;
  type: 'product' | 'service';
  name: string;
  category_id: string;
  sku: string | null;
  description: string | null;
  quantity: number | null;
  selling_price: number;
  cost_price: number | null;
}

interface BusinessProfile {
  id: string;
  preferred_currency: string;
}

interface InventoryFilters {
  type: 'product' | 'service' | '';
  category_id: string;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | '';
}

const FILTER_OPTIONS = [
  {
    key: 'type',
    label: 'Type',
    type: 'select' as const,
    options: [
      { value: 'product', label: 'Product' },
      { value: 'service', label: 'Service' }
    ]
  },
  {
    key: 'category_id',
    label: 'Category',
    type: 'select' as const,
    options: [] // Will be populated dynamically
  },
  {
    key: 'stock_status',
    label: 'Stock Status',
    type: 'select' as const,
    options: [
      { value: 'in_stock', label: 'In Stock' },
      { value: 'low_stock', label: 'Low Stock' },
      { value: 'out_of_stock', label: 'Out of Stock' }
    ]
  }
];

export function Inventory() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const {
    state: { page, perPage, search, filters, sortBy, sortDirection },
    setPage,
    setPerPage,
    setSearch,
    setFilter,
    removeFilter,
    clearFilters,
    setSort
  } = useFilters<InventoryFilters>();

  useEffect(() => {
    if (!authLoading && user) {
      loadBusinessProfile();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (businessProfile) {
      loadInventoryItems();
    }
  }, [businessProfile, page, perPage, search, filters, sortBy, sortDirection]);

  const loadBusinessProfile = async () => {
    try {
      await requireAuth();
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
      await loadCategories(businesses[0].id);
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
      setLoading(false);
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
      
      const categoryOptions = (data || []).map(category => ({
        value: category.id,
        label: category.name
      }));

      setCategories(categoryOptions);
      
      FILTER_OPTIONS[1].options = categoryOptions;
    } catch (err) {
      console.error('Error loading categories:', err);
      toast.error('Failed to load categories');
    }
  };

  const loadInventoryItems = async () => {
    if (!businessProfile) return;

    try {
      setLoading(true);

      let query = supabase
        .from('inventory_items')
        .select('*', { count: 'exact' })
        .eq('business_id', businessProfile.id);

      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters.stock_status) {
        switch (filters.stock_status) {
          case 'in_stock':
            query = query.gt('quantity', 5);
            break;
          case 'low_stock':
            query = query.gt('quantity', 0).lte('quantity', 5);
            break;
          case 'out_of_stock':
            query = query.eq('quantity', 0);
            break;
        }
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
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
      setItems(data || []);
      setTotalItems(count || 0);
    } catch (err) {
      console.error('Error loading inventory:', err);
      toast.error('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setItems(items.filter(item => item.id !== id));
      toast.success('Item deleted successfully');
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error('Failed to delete item');
    }
  };

  const InventoryListItem = ({ item }: { item: InventoryItem }) => (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">{item.name}</div>
          {item.sku && (
            <div className="text-sm text-gray-500">SKU: {item.sku}</div>
          )}
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          item.type === 'product'
            ? 'bg-primary-100 text-primary-800'
            : 'bg-purple-100 text-purple-800'
        }`}>
          {item.type}
        </span>
      </div>
      {item.description && (
        <div className="text-sm text-gray-600">{item.description}</div>
      )}
      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
        <div>
          <div className="text-sm font-medium">
            {formatCurrency(item.selling_price)} {businessProfile?.preferred_currency}
          </div>
          {item.type === 'product' && (
            <div className={`text-sm ${
              item.quantity === 0
                ? 'text-red-600'
                : item.quantity && item.quantity <= 5
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}>
              {item.quantity === 0
                ? 'Out of Stock'
                : `${item.quantity} in stock`}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(item)}
            className="p-2 text-primary-600 hover:text-primary-900"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            className="p-2 text-red-600 hover:text-red-900"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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
        <h1 className="text-2xl font-bold mb-4">Inventory</h1>
        <div className="space-y-4">
          <div className="relative">
            <input
              type="search"
              placeholder="Search inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border-0 rounded-lg py-3 pl-4 pr-4 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
            }}
            className="w-full bg-primary-600 text-white rounded-lg py-3 font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            + Add Item
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
        <h1>Inventory</h1>
        <button
          onClick={() => {
            setEditingItem(null);
            setShowForm(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
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

      {/* Mobile Inventory List */}
      <div className="sm:hidden px-4 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No items found</p>
          </div>
        ) : (
          items.map(item => (
            <InventoryListItem key={item.id} item={item} />
          ))
        )}

        <MobileDataControls
          totalItems={totalItems}
          page={page}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* Desktop Data Table */}
      <div className="hidden sm:block">
        <DataTable
          data={items}
          columns={[
            {
              key: 'name',
              title: 'Name',
              sortable: true
            },
            {
              key: 'type',
              title: 'Type',
              sortable: true,
              render: (value: string) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  value === 'product'
                    ? 'bg-primary-100 text-primary-800'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {value}
                </span>
              )
            },
            {
              key: 'category_id',
              title: 'Category',
              render: (value: string) => {
                const category = categories.find(c => c.value === value);
                return category?.label || '-';
              }
            },
            {
              key: 'sku',
              title: 'SKU',
              render: (value: string | null) => value || '-'
            },
            {
              key: 'quantity',
              title: 'Quantity',
              sortable: true,
              render: (value: number | null, item: InventoryItem) => (
                item.type === 'service' ? '-' : value
              )
            },
            {
              key: 'selling_price',
              title: 'Selling Price',
              sortable: true,
              render: (value: number) => (
                `${formatCurrency(value)} ${businessProfile?.preferred_currency}`
              )
            },
            {
              key: 'cost_price',
              title: 'Cost Price',
              sortable: true,
              render: (value: number | null) => (
                value ? `${formatCurrency(value)} ${businessProfile?.preferred_currency}` : '-'
              )
            },
            {
              key: 'id',
              title: 'Actions',
              render: (_: string, item: InventoryItem) => (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            }
          ]}
          totalItems={totalItems}
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
            setEditingItem(null);
            setShowForm(true);
          }}
          className="h-14 w-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <InventoryForm
              editItem={editingItem || undefined}
              onClose={() => {
                setShowForm(false);
                setEditingItem(null);
              }}
              onSuccess={() => {
                setShowForm(false);
                setEditingItem(null);
                loadInventoryItems();
              }}
            />
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