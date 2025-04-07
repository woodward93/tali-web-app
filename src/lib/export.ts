import { utils, writeFile } from 'xlsx';
import { format } from 'date-fns';
import { Transaction } from '../types';

// Helper to format transaction data for export
function formatTransactionData(transactions: Transaction[], currency: string) {
  return transactions.map(t => ({
    'Date': format(new Date(t.date), 'yyyy-MM-dd'),
    'Type': t.type === 'sale' ? 'Sale' : 'Expense',
    'Contact': t.contact?.name || 'N/A',
    'Items': t.items.map(item => `${item.name} (${item.quantity_selected})`).join(', '),
    'Subtotal': `${currency} ${t.subtotal.toFixed(2)}`,
    'Discount': `${currency} ${t.discount.toFixed(2)}`,
    'Total': `${currency} ${t.total.toFixed(2)}`,
    'Amount Paid': `${currency} ${t.amount_paid.toFixed(2)}`,
    'Balance': `${currency} ${t.balance.toFixed(2)}`,
    'Payment Method': t.payment_method.replace('_', ' '),
    'Payment Status': t.payment_status.replace('_', ' '),
  }));
}

// Export to CSV
export function exportToCSV(transactions: Transaction[], currency: string) {
  const data = formatTransactionData(transactions, currency);
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Transactions');
  writeFile(wb, `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`);
}

// Export to Excel
export function exportToExcel(transactions: Transaction[], currency: string) {
  const data = formatTransactionData(transactions, currency);
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Transactions');
  writeFile(wb, `transactions_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}