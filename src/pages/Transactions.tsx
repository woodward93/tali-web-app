import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { TransactionForm } from '../components/TransactionForm';
import { formatCurrency } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { FilterBar } from '../components/FilterBar';
import { useFilters } from '../lib/hooks/useFilters';
import { exportToCSV, exportToExcel } from '../lib/export';
import { MobileDataControls } from '../components/MobileDataControls';
import type { Transaction, TransactionType } from '../types';

interface TransactionFilters {
  type: TransactionType | '';
  payment_status: string;
  payment_method: string;
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
      { value: 'sale', label: 'Sale' },
      { value: 'expense', label: 'Expense' }
    ]
  },
  {
    key: 'payment_status',
    label: 'Payment Status',
    type: 'select' as const,
    options: [
      { value: 'paid', label: 'Paid' },
      { value: 'partially_paid', label: 'Partially Paid' },
      { value: 'unpaid', label: 'Unpaid' }
    ]
  },
  {
    key: 'payment_method',
    label: 'Payment Method',
    type: 'select' as const,
    options: [
      { value: 'cash', label: 'Cash' },
      { value: 'card', label: 'Card' },
      { value: 'bank_transfer', label: 'Bank Transfer' },
      { value: 'mobile_money', label: 'Mobile Money' }
    ]
  },
  {
    key: 'date_range',
    label: 'Date Range',
    type: 'dateRange' as const
  }
];

export function Transactions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('sale');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [businessProfile, setBusinessProfile] = useState<{ id: string; preferred_currency: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileExportMenu, setShowMobileExportMenu] = useState(false);

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
      loadTransactions();
    }
  }, [businessProfile, page, perPage, search, filters, sortBy, sortDirection]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.export-menu')) {
        setShowExportMenu(false);
        setShowMobileExportMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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

  const loadTransactions = async () => {
    if (!businessProfile) return;

    try {
      setLoading(true);

      let query = supabase
        .from('transactions')
        .select(`
          *,
          contact:contacts(name)
        `, { count: 'exact' })
        .eq('business_id', businessProfile.id);

      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.payment_status) {
        query = query.eq('payment_status', filters.payment_status);
      }
      if (filters.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
      }
      if (filters.date_range?.start) {
        query = query.gte('date', filters.date_range.start);
      }
      if (filters.date_range?.end) {
        query = query.lte('date', filters.date_range.end);
      }

      if (search) {
        query = query.filter('contact.name', 'ilike', `%${search}%`);
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
      setTransactions(data || []);
      setTotalTransactions(count || 0);
    } catch (err) {
      console.error('Error loading transactions:', err);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction? This will also delete any associated receipts or invoices.')) return;

    try {
      // First delete associated receipts and invoices
      const { error: receiptError } = await supabase
        .from('receipts_invoices')
        .delete()
        .eq('transaction_id', id);

      if (receiptError) {
        throw new Error('Failed to delete associated receipts and invoices');
      }

      // Then delete the transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (transactionError) throw transactionError;

      setTransactions(transactions.filter(t => t.id !== id));
      toast.success('Transaction and associated records deleted successfully');
    } catch (err) {
      console.error('Error deleting transaction:', err);
      toast.error('Failed to delete transaction and associated records');
    }
  };

  const handleNewTransaction = (type: TransactionType) => {
    setTransactionType(type);
    setEditingTransaction(null);
    setShowForm(true);
  };

  const handleEdit = (transaction: Transaction) => {
    setTransactionType(transaction.type);
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleTransactionSuccess = async () => {
    setShowForm(false);
    setEditingTransaction(null);
    await loadTransactions();
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    if (!businessProfile) return;

    try {
      setExporting(true);
      setShowExportMenu(false);
      setShowMobileExportMenu(false);

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          contact:contacts(name)
        `)
        .eq('business_id', businessProfile.id)
        .order('date', { ascending: false });

      if (error) throw error;

      if (format === 'csv') {
        exportToCSV(data, businessProfile.preferred_currency);
      } else {
        exportToExcel(data, businessProfile.preferred_currency);
      }

      toast.success(`Transactions exported to ${format.toUpperCase()} successfully`);
    } catch (err) {
      console.error('Error exporting transactions:', err);
      toast.error('Failed to export transactions');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
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
      render: (value: TransactionType) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'sale'
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {value === 'sale' ? 'Sale' : 'Expense'}
        </span>
      )
    },
    {
      key: 'contact',
      title: 'Contact',
      render: (value: { name: string }) => value?.name || 'N/A'
    },
    {
      key: 'items',
      title: 'Items',
      render: (items: Transaction['items']) => (
        <div className="max-w-xs truncate">
          {items.map(item => item.name).join(', ')}
        </div>
      )
    },
    {
      key: 'total',
      title: 'Total',
      sortable: true,
      render: (value: number) => (
        `${formatCurrency(value)} ${businessProfile?.preferred_currency}`
      )
    },
    {
      key: 'amount_paid',
      title: 'Amount Paid',
      sortable: true,
      render: (value: number) => (
        `${formatCurrency(value)} ${businessProfile?.preferred_currency}`
      )
    },
    {
      key: 'balance',
      title: 'Balance',
      sortable: true,
      render: (value: number) => (
        `${formatCurrency(value)} ${businessProfile?.preferred_currency}`
      )
    },
    {
      key: 'payment_status',
      title: 'Status',
      sortable: true,
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'paid'
            ? 'bg-green-100 text-green-800'
            : value === 'partially_paid'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {value.replace('_', ' ')}
        </span>
      )
    },
    {
      key: 'id',
      title: 'Actions',
      render: (_: string, item: Transaction) => (
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
  ];

  const TransactionListItem = ({ transaction }: { transaction: Transaction }) => (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-gray-500">
            {format(new Date(transaction.date), 'MMM d, yyyy')}
          </div>
          <div className="font-medium">{transaction.contact?.name || 'N/A'}</div>
        </div>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          transaction.type === 'sale'
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {transaction.type === 'sale' ? 'Sale' : 'Expense'}
        </span>
      </div>
      <div className="text-sm text-gray-600 line-clamp-1">
        {transaction.items.map(item => item.name).join(', ')}
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
        <div>
          <div className="text-sm font-medium">
            {formatCurrency(transaction.total)} {businessProfile?.preferred_currency}
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            transaction.payment_status === 'paid'
              ? 'bg-green-100 text-green-800'
              : transaction.payment_status === 'partially_paid'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {transaction.payment_status.replace('_', ' ')}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(transaction)}
            className="p-2 text-primary-600 hover:text-primary-900"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(transaction.id)}
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
        <h1 className="text-2xl font-bold mb-4">Transactions</h1>
        <div className="space-y-4">
          <div className="relative">
            <input
              type="search"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border-0 rounded-lg py-3 pl-4 pr-4 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={() => handleNewTransaction('sale')}
            className="w-full bg-primary-600 text-white rounded-lg py-3 font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            + New Sale
          </button>
          <button
            onClick={() => handleNewTransaction('expense')}
            className="w-full bg-red-600 text-white rounded-lg py-3 font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            + New Expense
          </button>
          <div className="flex gap-4">
            <button
              onClick={() => setShowFilters(true)}
              className="flex-1 flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-200"
            >
              <span className="font-medium">Filters</span>
              <span className="text-gray-400">›</span>
            </button>
            <div className="relative export-menu">
              <button
                onClick={() => setShowMobileExportMenu(!showMobileExportMenu)}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-gray-200"
              >
                <FileDown className="h-5 w-5" />
                <span className="font-medium">Export</span>
              </button>
              {showMobileExportMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1" role="menu">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('excel')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Export as Excel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden sm:flex items-center justify-between px-4 sm:px-0">
        <h1>Transactions</h1>
        <div className="flex items-center gap-4">
          <div className="relative export-menu">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1" role="menu">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Export as Excel
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleNewTransaction('sale')}
              className="inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </button>
            <button
              onClick={() => handleNewTransaction('expense')}
              className="inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm bg-red-600 hover:bg-red-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Expense
            </button>
          </div>
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

      {/* Mobile Transaction List */}
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
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No transactions found</p>
          </div>
        ) : (
          transactions.map(transaction => (
            <TransactionListItem key={transaction.id} transaction={transaction} />
          ))
        )}

        <MobileDataControls
          totalItems={totalTransactions}
          page={page}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* Desktop Data Table */}
      <div className="hidden sm:block">
        <DataTable
          data={transactions}
          columns={columns}
          totalItems={totalTransactions}
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
          onClick={() => handleNewTransaction('sale')}
          className="h-14 w-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Transaction Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <TransactionForm
              type={transactionType}
              editTransaction={editingTransaction || undefined}
              onClose={() => {
                setShowForm(false);
                setEditingTransaction(null);
              }}
              onSuccess={handleTransactionSuccess}
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
                  ✕
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