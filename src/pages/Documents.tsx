import React, { useState, useEffect } from 'react';
import { Plus, Send, Trash2, X, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/format';
import { generatePDF } from '../lib/pdf';
import { DataTable } from '../components/DataTable';
import { FilterBar } from '../components/FilterBar';
import { useFilters } from '../lib/hooks/useFilters';
import type { Transaction } from '../types';

interface BusinessProfile {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  preferred_currency: string;
}

interface ReceiptInvoice {
  id: string;
  transaction_id: string;
  type: 'receipt' | 'invoice';
  status: 'draft' | 'sent' | 'viewed';
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
  pdf_url: string | null;
  transaction: Transaction;
}

interface DocumentFilters {
  type: 'receipt' | 'invoice' | '';
  status: 'draft' | 'sent' | 'viewed' | '';
  date_range: {
    option: string;
    customRange: { start: string; end: string };
  };
}

interface TransactionSelectorProps {
  onSelect: (transaction: Transaction) => void;
  onClose: () => void;
}

const FILTER_OPTIONS = [
  {
    key: 'type',
    label: 'Type',
    type: 'select' as const,
    options: [
      { value: 'receipt', label: 'Receipt' },
      { value: 'invoice', label: 'Invoice' }
    ]
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'sent', label: 'Sent' },
      { value: 'viewed', label: 'Viewed' }
    ]
  },
  {
    key: 'date_range',
    label: 'Date Range',
    type: 'dateRange' as const
  }
];

function TransactionSelector({ onSelect, onClose }: TransactionSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          contact:contacts(name)
        `)
        .eq('type', 'sale') // Only load sales transactions
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(transaction => 
    transaction.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
    transaction.items.some(item => item.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Select Transaction</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b bg-gray-50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer name or items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full border-gray-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg font-medium">No transactions found</p>
            <p className="text-sm mt-1">Try adjusting your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map(transaction => (
              <button
                key={transaction.id}
                onClick={() => onSelect(transaction)}
                className="w-full p-4 text-left bg-white border rounded-lg hover:border-primary-500 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {transaction.contact?.name || 'No Contact'}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({transaction.items.length} items)
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500 truncate">
                      {transaction.items.map(item => item.name).join(', ')}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-medium text-primary-600">
                      {formatCurrency(transaction.total)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(transaction.date), 'MMM d, yyyy')}
                    </div>
                    <div className={`text-sm mt-1 ${
                      transaction.payment_status === 'paid' 
                        ? 'text-green-600' 
                        : transaction.payment_status === 'partially_paid'
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      {transaction.payment_status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface DocumentPreviewProps {
  transaction: Transaction;
  business: BusinessProfile;
  onClose?: () => void;
  onSave?: () => Promise<void>;
  hideCloseButton?: boolean;
}

function DocumentPreview({ transaction, business, onClose, onSave, hideCloseButton }: DocumentPreviewProps) {
  const documentType = transaction.payment_status === 'paid' ? 'Receipt' : 'Invoice';
  const [saving, setSaving] = useState(false);

  return (
    <div className="bg-white p-8 max-w-2xl mx-auto" id="document-preview">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt={`${business.name} logo`}
              className="h-16 w-16 object-contain"
            />
          ) : (
            <div className="h-16 w-16 bg-gray-100 flex items-center justify-center rounded-lg">
              <span className="text-2xl font-medium text-gray-500">
                {business.name.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{business.name}</h2>
            {business.address && (
              <p className="text-gray-500">{business.address}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-gray-900">{documentType}</h1>
          <p className="text-gray-500">
            Date: {format(new Date(transaction.date), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-8">
        <h3 className="text-gray-700 font-medium mb-2">Customer:</h3>
        <p className="text-gray-900">{transaction.contact?.name}</p>
      </div>

      {/* Items */}
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Item</th>
            <th className="text-right py-2">Quantity</th>
            <th className="text-right py-2">Price</th>
            <th className="text-right py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {transaction.items.map((item, index) => (
            <tr key={index} className="border-b">
              <td className="py-2">{item.name}</td>
              <td className="text-right py-2">{item.quantity_selected}</td>
              <td className="text-right py-2">
                {formatCurrency(item.selling_price, business.preferred_currency)}
              </td>
              <td className="text-right py-2">
                {formatCurrency(item.subtotal, business.preferred_currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="w-1/2 ml-auto">
        <div className="flex justify-between py-2">
          <span>Subtotal:</span>
          <span>{formatCurrency(transaction.subtotal, business.preferred_currency)}</span>
        </div>
        {transaction.discount > 0 && (
          <div className="flex justify-between py-2 text-gray-500">
            <span>Discount:</span>
            <span>-{formatCurrency(transaction.discount, business.preferred_currency)}</span>
          </div>
        )}
        <div className="flex justify-between py-2 font-bold border-t">
          <span>Total:</span>
          <span>{formatCurrency(transaction.total, business.preferred_currency)}</span>
        </div>
        {transaction.payment_status !== 'paid' && (
          <>
            <div className="flex justify-between py-2 text-gray-500">
              <span>Amount Paid:</span>
              <span>{formatCurrency(transaction.amount_paid, business.preferred_currency)}</span>
            </div>
            <div className="flex justify-between py-2 font-bold text-red-600">
              <span>Balance Due:</span>
              <span>{formatCurrency(transaction.balance, business.preferred_currency)}</span>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-8 border-t text-center text-gray-500">
        <p>Thank you for your business!</p>
      </div>

      {/* Actions */}
      {!hideCloseButton && (
        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="secondary"
          >
            Close
          </button>
          {onSave && (
            <button
              onClick={async () => {
                setSaving(true);
                await onSave();
                setSaving(false);
              }}
              disabled={saving}
              className="primary"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Documents() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showTransactionSelector, setShowTransactionSelector] = useState(false);
  const [documents, setDocuments] = useState<ReceiptInvoice[]>([]);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [showPreview, setShowPreview] = useState<ReceiptInvoice | null>(null);

  const {
    state: { page, perPage, search, filters, sortBy, sortDirection },
    setPage,
    setPerPage,
    setSearch,
    setFilter,
    removeFilter,
    clearFilters,
    setSort
  } = useFilters<DocumentFilters>();

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
    }
  }, [user]);

  useEffect(() => {
    if (businessProfile) {
      loadDocuments();
    }
  }, [businessProfile, page, perPage, search, filters, sortBy, sortDirection]);

  const loadBusinessProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, logo_url, address, preferred_currency')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      setBusinessProfile(data);
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (!businessProfile) return;

    try {
      setLoading(true);

      let query = supabase
        .from('receipts_invoices')
        .select(`
          *,
          transaction:transactions(
            *,
            contact:contacts(name)
          )
        `, { count: 'exact' })
        .eq('business_id', businessProfile.id);

      // Apply filters
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.date_range?.customRange) {
        query = query
          .gte('created_at', filters.date_range.customRange.start)
          .lte('created_at', filters.date_range.customRange.end);
      }

      // Apply search - only search by contact name
      if (search) {
        query = query.or(`transaction.contact.name.ilike.%${search}%`);
      }

      // Apply sorting
      if (sortBy) {
        query = query.order(sortBy, { ascending: sortDirection === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      setDocuments(data || []);
      setTotalDocuments(count || 0);
    } catch (err) {
      console.error('Error loading documents:', err);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTransaction || !businessProfile) return;

    try {
      // Determine document type based on payment status
      const documentType = selectedTransaction.payment_status === 'paid' ? 'receipt' : 'invoice';
      
      const { error } = await supabase
        .from('receipts_invoices')
        .insert({
          business_id: businessProfile.id,
          transaction_id: selectedTransaction.id,
          type: documentType,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`${documentType === 'receipt' ? 'Receipt' : 'Invoice'} saved successfully`);
      setSelectedTransaction(null);
      loadDocuments();
    } catch (err) {
      console.error('Error saving document:', err);
      toast.error('Failed to save document');
      throw err;
    }
  };

  const handleView = async (docItem: ReceiptInvoice) => {
    if (!businessProfile) return;

    try {
      setGeneratingPDF(docItem.id);
      setShowPreview(docItem);

      // Wait for the preview to render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate PDF
      const pdf = await generatePDF(
        'document-preview',
        docItem.transaction,
        businessProfile.name,
        docItem.type
      );

      // Create download link
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${businessProfile.name}_${docItem.type}_${format(new Date(docItem.transaction.date), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Update document status if it's in draft
      if (docItem.status === 'draft') {
        const { error } = await supabase
          .from('receipts_invoices')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', docItem.id);

        if (error) throw error;
        loadDocuments();
      }

      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Failed to download PDF');
    } finally {
      setGeneratingPDF(null);
      setShowPreview(null);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!businessProfile || !confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error } = await supabase
        .from('receipts_invoices')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast.success('Document deleted successfully');
      loadDocuments();
    } catch (err) {
      console.error('Error deleting document:', err);
      toast.error('Failed to delete document');
    }
  };

  const columns = [
    {
      key: 'created_at',
      title: 'Date',
      sortable: true,
      render: (value: string) => format(new Date(value), 'MMM d, yyyy')
    },
    {
      key: 'type',
      title: 'Type',
      sortable: true,
      render: (value: string) => (
        <span className={`badge ${
          value === 'receipt' ? 'badge-success' : 'badge-info'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'transaction',
      title: 'Contact',
      render: (transaction: Transaction) => transaction.contact?.name
    },
    {
      key: 'transaction',
      title: 'Amount',
      render: (transaction: Transaction) => (
        `${formatCurrency(transaction.total)} ${businessProfile?.preferred_currency}`
      )
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (value: string) => (
        <span className={`badge ${
          value === 'sent' ? 'badge-success' :
          value === 'viewed' ? 'badge-info' : 'badge-warning'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'id',
      title: 'Actions',
      render: (_: string, doc: ReceiptInvoice) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleView(doc)}
            className="text-gray-600 hover:text-gray-900"
            title="Send PDF"
            disabled={generatingPDF === doc.id}
          >
            {generatingPDF === doc.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => handleDelete(doc.id)}
            className="text-red-600 hover:text-red-900"
            title="Delete"
            disabled={generatingPDF === doc.id}
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
        <h1>Receipts & Invoices</h1>
        <button
          onClick={() => setShowTransactionSelector(true)}
          className="primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Receipt/Invoice
        </button>
      </div>

      <FilterBar
        filters={filters}
        options={FILTER_OPTIONS}
        onFilterChange={setFilter}
        onFilterRemove={removeFilter}
        onFiltersClear={clearFilters}
      />

      <DataTable
        data={documents}
        columns={columns}
        totalItems={totalDocuments}
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

      {/* Transaction Selector Modal */}
      {showTransactionSelector && (
        <div className="fixed inset-0 bg-gray-500/75 flex items-center justify-center p-4 z-50">
          <TransactionSelector
            onSelect={(transaction) => {
              setSelectedTransaction(transaction);
              setShowTransactionSelector(false);
            }}
            onClose={() => setShowTransactionSelector(false)}
          />
        </div>
      )}

      {/* Document Preview Modal */}
      {selectedTransaction && businessProfile && !showTransactionSelector && (
        <div className="fixed inset-0 bg-gray-500/75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <DocumentPreview
              transaction={selectedTransaction}
              business={businessProfile}
              onClose={() => setSelectedTransaction(null)}
              onSave={handleSave}
            />
          </div>
        </div>
      )}

      {/* Hidden Preview for PDF Generation */}
      {showPreview && businessProfile && (
        <div className="fixed left-[-9999px] top-[-9999px]">
          <DocumentPreview
            transaction={showPreview.transaction}
            business={businessProfile}
            hideCloseButton
          />
        </div>
      )}
    </div>
  );
}