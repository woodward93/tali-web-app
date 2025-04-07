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

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.export-menu')) {
        setShowExportMenu(false);
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

      // Apply filters
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

      // Apply search - only search by contact name
      if (search) {
        query = query.or(`contact.name.ilike.%${search}%`);
      }

      // Apply sorting
      if (sortBy) {
        query = query.order(sortBy, { ascending: sortDirection === 'asc' });
      } else {
        query = query.order('date', { ascending: false });
      }

      // Apply pagination
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
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransactions(transactions.filter(t => t.id !== id));
      toast.success('Transaction deleted successfully');
    } catch (err) {
      console.error('Error deleting transaction:', err);
      toast.error('Failed to delete transaction');
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

      // Load all transactions for export
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

  if (!businessProfile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-base font-semibold text-primary-600">No Business Profile</h2>
        <p className="mt-2 text-sm text-gray-500">Please set up your business profile first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Transactions</h1>
        <div className="flex items-center gap-4">
          <div className="relative export-menu">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting || loading}
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

      <FilterBar
        filters={filters}
        options={FILTER_OPTIONS}
        onFilterChange={setFilter}
        onFilterRemove={removeFilter}
        onFiltersClear={clearFilters}
      />

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
    </div>
  );
}