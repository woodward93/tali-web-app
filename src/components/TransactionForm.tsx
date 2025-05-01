import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/format';
import { InventoryForm } from './InventoryForm';
import type { 
  TransactionType, 
  InventoryItem, 
  TransactionItem,
  PaymentMethod,
  PaymentStatus,
  Contact,
  Transaction 
} from '../types';

interface TransactionFormProps {
  type: TransactionType;
  onClose: () => void;
  onSuccess: () => void;
  editTransaction?: Transaction;
}

interface BusinessProfile {
  id: string;
  preferred_currency: string;
}

interface StockError {
  itemId: string;
  itemName: string;
  available: number;
  requested: number;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
];

const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'unpaid', label: 'Unpaid' },
];

export function TransactionForm({ type, onClose, onSuccess, editTransaction }: TransactionFormProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'select_items' | 'transaction_details'>('select_items');
  const [loading, setLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<TransactionItem[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [discount, setDiscount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [amountPaid, setAmountPaid] = useState<string>('0');
  const [stockError, setStockError] = useState<StockError | null>(null);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
    }
  }, [user]);

  useEffect(() => {
    if (editTransaction) {
      setSelectedItems(editTransaction.items);
      setDiscount(editTransaction.discount.toString());
      setPaymentMethod(editTransaction.payment_method);
      setPaymentStatus(editTransaction.payment_status);
      setSelectedContactId(editTransaction.contact_id);
      setAmountPaid(editTransaction.amount_paid.toString());
      setTransactionDate(new Date(editTransaction.date).toISOString().split('T')[0]);
    }
  }, [editTransaction]);

  useEffect(() => {
    if (paymentStatus === 'paid') {
      setAmountPaid(total.toString());
    } else if (paymentStatus === 'unpaid') {
      setAmountPaid('0');
    }
  }, [paymentStatus]);

  const loadBusinessProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, preferred_currency')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setBusinessProfile(data);
      
      if (data) {
        await Promise.all([
          loadInventoryItems(data.id),
          loadContacts(data.id)
        ]);
      }
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
    }
  };

  const loadContacts = async (businessId: string) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('business_id', businessId)
        .eq('type', type === 'sale' ? 'customer' : 'supplier')
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
      toast.error('Failed to load contacts');
    }
  };

  const loadInventoryItems = async (businessId: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          category:categories(id, name)
        `)
        .eq('business_id', businessId);

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (err) {
      console.error('Error loading inventory:', err);
      toast.error('Failed to load inventory items');
    }
  };

  const handleCreateContact = async () => {
    if (!businessProfile || !newContact.name.trim()) return;

    try {
      setLoading(true);

      // Check if contact already exists
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('business_id', businessProfile.id)
        .eq('type', type === 'sale' ? 'customer' : 'supplier')
        .eq('name', newContact.name.trim())
        .maybeSingle();

      if (existingContact) {
        setSelectedContactId(existingContact.id);
        setShowNewContactForm(false);
        toast.info('Contact already exists. Selected existing contact.');
        return;
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          business_id: businessProfile.id,
          type: type === 'sale' ? 'customer' : 'supplier',
          name: newContact.name.trim(),
          phone: newContact.phone.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      setContacts([...contacts, data]);
      setSelectedContactId(data.id);
      setNewContact({ name: '', phone: '' });
      setShowNewContactForm(false);
      toast.success('Contact added successfully');
    } catch (err) {
      console.error('Error creating contact:', err);
      toast.error('Failed to create contact');
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (item: InventoryItem) => {
    const existingItem = selectedItems.find(i => i.id === item.id);
    
    if (existingItem) {
      setSelectedItems(selectedItems.filter(i => i.id !== item.id));
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          ...item,
          quantity_selected: 1,
          subtotal: item.selling_price
        }
      ]);
    }
  };

  const handleQuantityChange = (itemId: string, quantityStr: string) => {
    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity) || quantity < 1) return;

    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    // Only check stock for products, not services
    if (type === 'sale' && item.type === 'product' && quantity > item.quantity) {
      setStockError({
        itemId,
        itemName: item.name,
        available: item.quantity,
        requested: quantity
      });
      return;
    }

    setStockError(null);
    setSelectedItems(selectedItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity_selected: quantity,
          subtotal: quantity * item.selling_price
        };
      }
      return item;
    }));
  };

  const handleNewItemSuccess = async () => {
    setShowNewItemForm(false);
    if (businessProfile) {
      await loadInventoryItems(businessProfile.id);
    }
    toast.success('Item added successfully');
  };

  const subtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal - (parseFloat(discount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !businessProfile) return;

    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    if (!selectedContactId && !newContact.name) {
      toast.error(`Please select or create a ${type === 'sale' ? 'customer' : 'supplier'}`);
      return;
    }

    // Validate amount paid based on payment status
    const amountPaidValue = parseFloat(amountPaid);
    if (paymentStatus === 'partially_paid') {
      if (isNaN(amountPaidValue) || amountPaidValue <= 0 || amountPaidValue >= total) {
        toast.error('For partially paid transactions, amount paid must be greater than 0 and less than total');
        return;
      }
    }

    // Check stock levels only for products
    if (type === 'sale') {
      for (const item of selectedItems) {
        const inventoryItem = inventoryItems.find(i => i.id === item.id);
        if (inventoryItem?.type === 'product' && item.quantity_selected > inventoryItem.quantity) {
          setStockError({
            itemId: item.id,
            itemName: item.name,
            available: inventoryItem.quantity,
            requested: item.quantity_selected
          });
          return;
        }
      }
    }

    try {
      setLoading(true);

      // Create contact if new contact form is shown
      let contactId = selectedContactId;
      if (showNewContactForm && newContact.name) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('business_id', businessProfile.id)
          .eq('type', type === 'sale' ? 'customer' : 'supplier')
          .eq('name', newContact.name.trim())
          .maybeSingle();

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const { data, error } = await supabase
            .from('contacts')
            .insert({
              business_id: businessProfile.id,
              type: type === 'sale' ? 'customer' : 'supplier',
              name: newContact.name.trim(),
              phone: newContact.phone.trim() || null
            })
            .select()
            .single();

          if (error) throw error;
          contactId = data.id;
        }
      }

      const transactionData = {
        business_id: businessProfile.id,
        contact_id: contactId,
        type,
        items: selectedItems,
        subtotal,
        discount: parseFloat(discount) || 0,
        total,
        amount_paid: paymentStatus === 'paid' ? total : paymentStatus === 'unpaid' ? 0 : parseFloat(amountPaid),
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        date: transactionDate,
      };

      let error;
      if (editTransaction) {
        ({ error } = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', editTransaction.id));
      } else {
        ({ error } = await supabase
          .from('transactions')
          .insert(transactionData));
      }

      if (error) throw error;

      // Update inventory quantities only for products
      for (const item of selectedItems) {
        const inventoryItem = inventoryItems.find(i => i.id === item.id);
        if (inventoryItem?.type === 'product') {
          const newQuantity = type === 'sale' 
            ? inventoryItem.quantity - item.quantity_selected
            : inventoryItem.quantity + item.quantity_selected;

          const { error: updateError } = await supabase
            .from('inventory_items')
            .update({ quantity: newQuantity })
            .eq('id', item.id);

          if (updateError) throw updateError;
        }
      }

      toast.success(`${type === 'sale' ? 'Sale' : 'Expense'} ${editTransaction ? 'updated' : 'recorded'} successfully`);
      onSuccess();
    } catch (err) {
      console.error('Error saving transaction:', err);
      toast.error(`Failed to ${editTransaction ? 'update' : 'save'} transaction`);
    } finally {
      setLoading(false);
    }
  };

  if (stockError) {
    return (
      <div className="p-6 space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800 mb-2">Insufficient Stock</h3>
          <p className="text-red-700 mb-4">
            Cannot {type === 'sale' ? 'sell' : 'add'} {stockError.requested} units of "{stockError.itemName}". 
            Only {stockError.available} units available in stock.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setStockError(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'select_items') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="form-section">
            Select Items for {type === 'sale' ? 'Sale' : 'Expense'}
          </h3>
          <button
            onClick={() => setShowNewItemForm(true)}
            className="primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Item
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {inventoryItems.map(item => (
              <div
                key={item.id}
                onClick={() => handleItemSelect(item)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors duration-200 ${
                  selectedItems.some(i => i.id === item.id)
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{item.name}</h4>
                    {item.type === 'product' && (
                      <p className="text-sm text-gray-500">
                        Available: {item.quantity}
                      </p>
                    )}
                  </div>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(item.selling_price, businessProfile?.preferred_currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-footer">
          <button
            type="button"
            onClick={onClose}
            className="secondary"
          >
            Cancel
          </button>
          {selectedItems.length > 0 && (
            <button
              onClick={() => setStep('transaction_details')}
              className="primary"
            >
              Continue ({selectedItems.length} items)
            </button>
          )}
        </div>

        {/* New Item Form Modal */}
        {showNewItemForm && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <InventoryForm
                onClose={() => setShowNewItemForm(false)}
                onSuccess={handleNewItemSuccess}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="form-section">
            {type === 'sale' ? 'New Sale' : 'New Expense'}
          </h3>
          <button
            type="button"
            onClick={() => setStep('select_items')}
            className="text-sm text-primary-600 hover:text-primary-500"
          >
            ← Back to items
          </button>
        </div>

        <div className="form-group">
          <div className="form-section">
            <h4 className="font-medium text-gray-900 mb-4">Selected Items</h4>
            <div className="space-y-4">
              {selectedItems.map(item => (
                <div key={item.id} className="flex items-center gap-4">
                  <span className="flex-1">{item.name}</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity_selected}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    className="w-24"
                  />
                  <span className="w-32 text-right">
                    {formatCurrency(item.subtotal, businessProfile?.preferred_currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <div className="flex justify-between mb-2">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, businessProfile?.preferred_currency)}</span>
            </div>
            <div className="flex items-center gap-4 mb-2">
              <span>Discount</span>
              <div className="currency-input-wrapper flex-1">
                <div className="currency-symbol">
                  {businessProfile?.preferred_currency}
                </div>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>{formatCurrency(total, businessProfile?.preferred_currency)}</span>
            </div>
          </div>

          <div className="form-grid">
            <div>
              <label>Transaction Date</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div>
              <label>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map(method => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
              >
                {PAYMENT_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {paymentStatus === 'partially_paid' && (
              <div>
                <label>Amount Paid</label>
                <div className="currency-input-wrapper">
                  <div className="currency-symbol">
                    {businessProfile?.preferred_currency}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">
                {type === 'sale' ? 'Customer' : 'Supplier'} Information
              </h4>
              <button
                type="button"
                onClick={() => setShowNewContactForm(!showNewContactForm)}
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                {showNewContactForm ? 'Select Existing' : 'Add New'}
              </button>
            </div>

            {showNewContactForm ? (
              <div className="form-grid">
                <div>
                  <label>Name</label>
                  <input
                    type="text"
                    value={newContact.name}
                    onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter name"
                    required
                  />
                </div>
                <div>
                  <label>Phone (Optional)</label>
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            ) : (
              <div>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  required
                >
                  <option value="">Select a {type === 'sale' ? 'customer' : 'supplier'}</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="form-footer">
        <button
          type="button"
          onClick={onClose}
          className="secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || selectedItems.length === 0}
          className="primary"
        >
          {loading ? 'Saving...' : 'Save Transaction'}
        </button>
      </div>
    </form>
  );
}