import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Search, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { FilterBar } from '../components/FilterBar';
import { useFilters } from '../lib/hooks/useFilters';
import { MobileDataControls } from '../components/MobileDataControls';
import { BankStatementUpload } from '../components/BankStatementUpload';
import { InventoryForm } from '../components/InventoryForm';
import { TransactionForm } from '../components/TransactionForm';

interface BankPaymentRecord {
  id: string;
  business_id: string;
  date: string;
  type: 'money-in' | 'money-out';
  description: string;
  amount: number;
  beneficiary_name: string | null;
  transaction_id: string | null;
  processed: boolean;
}

interface TransactionFilters {
  type: 'money-in' | 'money-out' | '';
  date_range: {
    start: string;
    end: string;
  };
}

const FILTER_OPTIONS = [
  {
    key: 'type',
    label: 'Type',
    type: 'select' as const,
    options: [
      { value: 'money-in', label: 'Money In' },
      { value: 'money-out', label: 'Money Out' }
    ]
  },
  {
    key: 'date_range',
    label: 'Date Range',
    type: 'dateRange' as const
  }
];

export function BankPaymentRecords() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<BankPaymentRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [businessProfile, setBusinessProfile] = useState<{ id: string; preferred_currency: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BankPaymentRecord | null>(null);
  const [createdItem, setCreatedItem] = useState<any>(null);

  const {
    state: { page, perPage, search, filters, sortBy, sortDirection },
    setPage,
    setPerPage,
    setSearch,
    setFilter,
    removeFilter,
    clearFilters,
    setSort
  } = useFilters<TransactionFilters>();

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
    }
  }, [user]);

  useEffect(() => {
    if (businessProfile) {
      loadRecords();
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

  const loadRecords = async () => {
    if (!businessProfile) return;

    try {
      setLoading(true);

      let query = supabase
        .from('bank_payment_records')
        .select('*', { count: 'exact' })
        .eq('business_id', businessProfile.id)
        .eq('processed', false); // Only show unprocessed records

      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.date_range?.start) {
        query = query.gte('date', filters.date_range.start);
      }
      if (filters.date_range?.end) {
        query = query.lte('date', filters.date_range.end);
      }

      if (search) {
        query = query.or(`description.ilike.%${search}%,beneficiary_name.ilike.%${search}%`);
      }

      if (sortBy) {
        query = query.order(sortBy, { ascending: sortDirection === 'asc' });
      } else {
        query = query.order('date', { ascending: false });
      }

      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      setRecords(data || []);
      setTotalRecords(count || 0);
    } catch (err) {
      console.error('Error loading records:', err);
      toast.error('Failed to load bank payment records');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = (record: BankPaymentRecord) => {
    setSelectedRecord(record);
    if (record.description) {
      setShowInventoryForm(true);
    } else {
      setShowTransactionForm(true);
    }
  };

  const handleInventorySuccess = (item: any) => {
    setCreatedItem(item);
    setShowInventoryForm(false);
    setShowTransactionForm(true);
  };

  const handleTransactionSuccess = async (transactionId: string) => {
    if (!selectedRecord) return;

    try {
      // Update the bank payment record
      const { error } = await supabase
        .from('bank_payment_records')
        .update({
          transaction_id: transactionId,
          processed: true
        })
        .eq('id', selectedRecord.id);

      if (error) throw error;

      setShowTransactionForm(false);
      setSelectedRecord(null);
      setCreatedItem(null);
      loadRecords();
      toast.success('Transaction created and bank record updated');
    } catch (err) {
      console.error('Error updating bank payment record:', err);
      toast.error('Failed to update bank payment record');
    }
  };

  const handleDelete = async (record: BankPaymentRecord) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      const { error } = await supabase
        .from('bank_payment_records')
        .delete()
        .eq('id', record.id);

      if (error) throw error;

      setRecords(records.filter(r => r.id !== record.id));
      setTotalRecords(prev => prev - 1);
      toast.success('Record deleted successfully');
    } catch (err) {
      console.error('Error deleting record:', err);
      toast.error('Failed to delete record');
    }
  };

  const RecordListItem = ({ record }: { record: BankPaymentRecord }) => (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-gray-500">
            {format(new Date(record.date), 'MMM d, yyyy')}
          </div>
          <div className="font-medium">{record.beneficiary_name || 'N/A'}</div>
          {record.description && (
            <div className="text-sm text-gray-600">{record.description}</div>
          )}
        </div>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          record.type === 'money-in'
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {record.type === 'money-in' ? 'Money In' : 'Money Out'}
        </span>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
        <div className="text-sm font-medium">
          {formatCurrency(record.amount)} {businessProfile?.preferred_currency}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreateTransaction(record)}
            className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
          >
            Create {record.type === 'money-in' ? 'Sale' : 'Expense'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </button>
          <button
            onClick={() => handleDelete(record)}
            className="text-red-600 hover:text-red-900"
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
        <h1 className="text-2xl font-bold mb-2">Bank Payment Records</h1>
        <p className="text-sm text-gray-600 mb-4">
          Upload bank statements to track money movement and convert records into sales and expenses.
        </p>
        <div className="space-y-4">
          <div className="relative">
            <input
              type="search"
              placeholder="Search records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border-0 rounded-lg py-3 pl-4 pr-4 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <BankStatementUpload
            businessId={businessProfile.id}
            onSuccess={loadRecords}
            className="w-full bg-primary-600 text-white rounded-lg py-3 font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            showDownloadButton={false}
          />
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
      <div className="hidden sm:block">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1>Bank Payment Records</h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload bank statements to track money movement and convert records into sales and expenses.
            </p>
          </div>
          <BankStatementUpload
            businessId={businessProfile.id}
            onSuccess={loadRecords}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          />
        </div>
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

      {/* Mobile Record List */}
      <div className="sm:hidden px-4 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No records found</p>
          </div>
        ) : (
          records.map(record => (
            <RecordListItem key={record.id} record={record} />
          ))
        )}

        <MobileDataControls
          totalItems={totalRecords}
          page={page}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* Desktop Data Table */}
      <div className="hidden sm:block">
        <DataTable
          data={records}
          columns={[
            {
              key: 'date',
              title: 'Date',
              sortable: true,
              render: (value: string) => format(new Date(value), 'MMM d, yyyy')
            },
            {
              key: 'type',
              title: 'Type',
              sortable: true,
              render: (value: string) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  value === 'money-in'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {value === 'money-in' ? 'Money In' : 'Money Out'}
                </span>
              )
            },
            {
              key: 'beneficiary_name',
              title: 'Beneficiary/Recipient',
              render: (value: string | null) => value || 'N/A'
            },
            {
              key: 'description',
              title: 'Description',
              render: (value: string) => value || 'N/A'
            },
            {
              key: 'amount',
              title: 'Amount',
              sortable: true,
              render: (value: number) => (
                `${formatCurrency(value)} ${businessProfile?.preferred_currency}`
              )
            },
            {
              key: 'id',
              title: 'Actions',
              render: (_: string, record: BankPaymentRecord) => (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleCreateTransaction(record)}
                    className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                  >
                    Create {record.type === 'money-in' ? 'Sale' : 'Expense'}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </button>
                  <button
                    onClick={() => handleDelete(record)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            }
          ]}
          totalItems={totalRecords}
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

      {/* Inventory Form Modal */}
      {showInventoryForm && selectedRecord && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <InventoryForm
              onClose={() => {
                setShowInventoryForm(false);
                setSelectedRecord(null);
              }}
              onSuccess={handleInventorySuccess}
              initialData={{
                name: selectedRecord.description,
                type: 'service',
                selling_price: selectedRecord.amount
              }}
            />
          </div>
        </div>
      )}

      {/* Transaction Form Modal */}
      {showTransactionForm && selectedRecord && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <TransactionForm
              type={selectedRecord.type === 'money-in' ? 'sale' : 'expense'}
              onClose={() => {
                setShowTransactionForm(false);
                setSelectedRecord(null);
                setCreatedItem(null);
              }}
              onSuccess={handleTransactionSuccess}
              initialData={{
                date: format(new Date(selectedRecord.date), 'yyyy-MM-dd'),
                items: createdItem ? [{ ...createdItem, quantity_selected: 1 }] : [],
                contact_name: selectedRecord.beneficiary_name,
                payment_method: 'bank_transfer',
                payment_status: 'paid',
                amount_paid: selectedRecord.amount
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}