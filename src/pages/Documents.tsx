import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Send, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/format';
import { generatePDF } from '../lib/pdf';
import { DataTable } from '../components/DataTable';
import { FilterBar } from '../components/FilterBar';
import { useFilters } from '../lib/hooks/useFilters';
import { MobileDataControls } from '../components/MobileDataControls';
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

interface DocumentPreviewProps {
  transaction: Transaction;
  business: BusinessProfile;
  onClose?: () => void;
  onSave?: () => Promise<void>;
  hideCloseButton?: boolean;
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
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
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
  const [showFilters, setShowFilters] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState('');

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

  useEffect(() => {
    if (showTransactionSelector && businessProfile) {
      loadTransactions();
    }
  }, [showTransactionSelector, businessProfile]);

  const loadBusinessProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, logo_url, address, preferred_currency')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setBusinessProfile(data);
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
    }
  };

  const loadTransactions = async () => {
    if (!businessProfile) return;

    try {
      setLoadingTransactions(true);
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          contact:contacts(name)
        `)
        .eq('business_id', businessProfile.id)
        .eq('type', 'sale')
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
      toast.error('Failed to load transactions');
    } finally {
      setLoadingTransactions(false);
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

      if (search) {
        query = query.or(`transaction.contact.name.ilike.%${search}%`);
      }

      if (sortBy) {
        query = query.order(sortBy, { ascending: sortDirection === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

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

  const handleView = async (docItem: ReceiptInvoice) => {
    if (!businessProfile) return;

    try {
      setGeneratingPDF(docItem.id);
      setShowPreview(docItem);

      await new Promise(resolve => setTimeout(resolve, 100));

      const pdf = await generatePDF(
        'document-preview',
        docItem.transaction,
        businessProfile.name,
        docItem.type
      );

      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${businessProfile.name}_${docItem.type}_${format(new Date(docItem.transaction.date), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

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

  const handleSelectTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionSelector(false);
  };

  const handleSaveDocument = async () => {
    if (!businessProfile || !selectedTransaction) return;

    try {
      const { error } = await supabase
        .from('receipts_invoices')
        .insert({
          business_id: businessProfile.id,
          transaction_id: selectedTransaction.id,
          type: selectedTransaction.payment_status === 'paid' ? 'receipt' : 'invoice',
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Document saved successfully');
      setSelectedTransaction(null);
      loadDocuments();
    } catch (err) {
      console.error('Error saving document:', err);
      toast.error('Failed to save document');
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (!transactionSearch) return true;
    return (
      transaction.contact?.name?.toLowerCase().includes(transactionSearch.toLowerCase()) ||
      transaction.items.some(item => 
        item.name.toLowerCase().includes(transactionSearch.toLowerCase())
      )
    );
  });

  const DocumentListItem = ({ document }: { document: ReceiptInvoice }) => (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-gray-500">
            {format(new Date(document.created_at), 'MMM d, yyyy')}
          </div>
          <div className="font-medium">{document.transaction.contact?.name || 'N/A'}</div>
        </div>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          document.type === 'receipt'
            ? 'bg-green-100 text-green-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {document.type}
        </span>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
        <div>
          <div className="text-sm font-medium">
            {formatCurrency(document.transaction.total)} {businessProfile?.preferred_currency}
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            document.status === 'sent'
              ? 'bg-green-100 text-green-800'
              : document.status === 'viewed'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {document.status}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleView(document)}
            className="p-2 text-gray-600 hover:text-gray-900"
            disabled={generatingPDF === document.id}
          >
            {generatingPDF === document.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => handleDelete(document.id)}
            className="p-2 text-red-600 hover:text-red-900"
            disabled={generatingPDF === document.id}
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
        <h1 className="text-2xl font-bold mb-4">Receipts & Invoices</h1>
        <div className="space-y-4">
          <div className="relative">
            <input
              type="search"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border-0 rounded-lg py-3 pl-4 pr-4 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={() => setShowTransactionSelector(true)}
            className="w-full bg-primary-600 text-white rounded-lg py-3 font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            + New Receipt/Invoice
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
        <h1>Receipts & Invoices</h1>
        <button
          onClick={() => setShowTransactionSelector(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Receipt/Invoice
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

      {/* Mobile Document List */}
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
        ) : documents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">No documents found</p>
          </div>
        ) : (
          documents.map(document => (
            <DocumentListItem key={document.id} document={document} />
          ))
        )}

        <MobileDataControls
          totalItems={totalDocuments}
          page={page}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
        />
      </div>

      {/* Desktop Data Table */}
      <div className="hidden sm:block">
        <DataTable
          data={documents}
          columns={[
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
          ]}
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
      </div>

      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-6 right-6 sm:hidden">
        <button
          onClick={() => setShowTransactionSelector(true)}
          className="h-14 w-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Transaction Selector Modal */}
      {showTransactionSelector && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Select Transaction</h3>
                <button
                  onClick={() => setShowTransactionSelector(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Search transactions..."
                    value={transactionSearch}
                    onChange={(e) => setTransactionSearch(e.target.value)}
                    className="w-full bg-gray-50 border-0 rounded-lg py-3 pl-4 pr-4 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="space-y-4">
                {loadingTransactions ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No transactions found
                  </div>
                ) : (
                  filteredTransactions.map(transaction => (
                    <button
                      key={transaction.id}
                      onClick={() => handleSelectTransaction(transaction)}
                      className="w-full text-left bg-white hover:bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-all duration-200"
                    >
                      <div className="space-y-3">
                        {/* Header with date and amount */}
                        <div className="flex justify-between items-start w-full">
                          <div className="text-sm text-gray-500 font-medium">
                            {format(new Date(transaction.date), 'MMM d, yyyy')}
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-lg font-bold text-gray-900">
                              {formatCurrency(transaction.total)} {businessProfile.preferred_currency}
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.payment_status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : transaction.payment_status === 'partially_paid'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.payment_status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        
                        {/* Customer name */}
                        <div>
                          <div className="text-lg font-semibold text-gray-900">
                            {transaction.contact?.name || 'N/A'}
                          </div>
                        </div>
                        
                        {/* Items */}
                        <div>
                          <div className="text-sm text-gray-600 line-clamp-2">
                            {transaction.items.map(item => item.name).join(', ')}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
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

      {/* Document Preview */}
      {selectedTransaction && businessProfile && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <DocumentPreview
              transaction={selectedTransaction}
              business={businessProfile}
              onClose={() => setSelectedTransaction(null)}
              onSave={handleSaveDocument}
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