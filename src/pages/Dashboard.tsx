import React, { useState, useEffect } from 'react';
import { 
  Card,
  Title,
  Text,
  Badge,
} from '@tremor/react';
import { 
  DollarSign,
  Wallet,
  Package,
  Users,
  AlertTriangle,
  ArrowRight,
  Landmark,
} from 'lucide-react';
import { format, subMonths, startOfYear, isAfter } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/format';
import type { Transaction } from '../types';

type DateRange = '1M' | '3M' | '6M' | 'YTD' | 'ALL';

interface BusinessProfile {
  id: string;
  preferred_currency: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  quantity: number;
  sku: string | null;
}

interface CustomerDebt {
  contact_id: string;
  contact_name: string;
  total_owed: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('3M');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [topDebtors, setTopDebtors] = useState<CustomerDebt[]>([]);
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalExpenses: 0,
    totalProducts: 0,
    totalCustomerDebt: 0,
    totalSupplierDebt: 0,
    salesGrowth: 0,
    profitMargin: 0,
    totalOrders: 0,
  });
  const [unprocessedPayments, setUnprocessedPayments] = useState<number>(0);

  // Load business profile on auth
  useEffect(() => {
    if (user) loadBusinessProfile();
  }, [user]);

  // After profile, load all data
  useEffect(() => {
    if (businessProfile) {
      loadUnprocessedPayments();
      Promise.all([
        loadTransactions(),
        loadInventoryMetrics(),
        loadDebtMetrics(),
      ]).finally(() => setLoading(false));
    }
  }, [businessProfile, dateRange]);

  // Fetch user business profile
  const loadBusinessProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, preferred_currency')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      setBusinessProfile(data);
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
      setLoading(false);
    }
  };

  // Count unprocessed payments
  const loadUnprocessedPayments = async () => {
    try {
      const { count, error } = await supabase
        .from('bank_payment_records')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessProfile!.id)
        .eq('processed', false);
      if (error) throw error;
      setUnprocessedPayments(count || 0);
    } catch (err) {
      console.error('Error loading unprocessed payments:', err);
    }
  };

  // Load transactions
  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, contact:contacts(name)')
        .order('date', { ascending: true });
      if (error) throw error;
      setTransactions(data || []);
      processTransactionData(data || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
      toast.error('Failed to load transactions');
    }
  };

  // Load inventory metrics
  const loadInventoryMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, quantity, sku', { count: 'exact' })
        .eq('type', 'product');
      if (error) throw error;
      setLowStockProducts((data || []).filter(p => p.quantity <= 3));
      setMetrics(prev => ({ ...prev, totalProducts: data?.length || 0 }));
    } catch (err) {
      console.error('Error loading inventory metrics:', err);
      toast.error('Failed to load inventory metrics');
    }
  };

  // Load debt metrics
  const loadDebtMetrics = async () => {
    try {
      // Customer debts
      const { data: cust, error: custErr } = await supabase
        .from('transactions')
        .select('contact_id, contact:contacts(name), total, amount_paid')
        .eq('type', 'sale')
        .neq('payment_status', 'paid');
      if (custErr) throw custErr;
      // Supplier debts
      const { data: supp, error: suppErr } = await supabase
        .from('transactions')
        .select('contact_id, contact:contacts(name), total, amount_paid')
        .eq('type', 'expense')
        .neq('payment_status', 'paid');
      if (suppErr) throw suppErr;

      const totalCust = (cust || []).reduce((sum, t) => sum + (t.total - (t.amount_paid || 0)), 0);
      const totalSupp = (supp || []).reduce((sum, t) => sum + (t.total - (t.amount_paid || 0)), 0);

      // Top debtors
      const map = new Map<string, CustomerDebt>();
      (cust || []).forEach(t => {
        const ex = map.get(t.contact_id) || { contact_id: t.contact_id, contact_name: t.contact.name, total_owed: 0 };
        ex.total_owed += (t.total - (t.amount_paid || 0));
        map.set(t.contact_id, ex);
      });
      setTopDebtors(Array.from(map.values()).sort((a, b) => b.total_owed - a.total_owed).slice(0, 5));

      setMetrics(prev => ({ ...prev, totalCustomerDebt: totalCust, totalSupplierDebt: totalSupp }));
    } catch (err) {
      console.error('Error loading debt metrics:', err);
      toast.error('Failed to load debt metrics');
    }
  };

  // Process transaction data for metrics
  const processTransactionData = (txs: Transaction[]) => {
    const start = (() => {
      const now = new Date();
      switch (dateRange) {
        case '1M': return subMonths(now, 1);
        case '3M': return subMonths(now, 3);
        case '6M': return subMonths(now, 6);
        case 'YTD': return startOfYear(now);
        case 'ALL': return new Date(0);
        default: return subMonths(now, 3);
      }
    })();
    const filtered = txs.filter(t => isAfter(new Date(t.date), start));
    const sales = filtered.filter(t => t.type === 'sale');
    const expenses = filtered.filter(t => t.type === 'expense');
    const totalSales = sales.reduce((s, t) => s + t.total, 0);
    const totalExpenses = expenses.reduce((s, t) => s + t.total, 0);

    // Sales growth
    const mid = new Date((new Date().getTime() + start.getTime()) / 2);
    const recent = sales.filter(t => isAfter(new Date(t.date), mid)).reduce((s, t) => s + t.total, 0);
    const prev = sales.filter(t => !isAfter(new Date(t.date), mid)).reduce((s, t) => s + t.total, 0);
    const salesGrowth = prev > 0 ? ((recent - prev) / prev) * 100 : 0;

    const profitMargin = totalSales > 0 ? ((totalSales - totalExpenses) / totalSales) * 100 : 0;

    setMetrics(prev => ({ ...prev, totalSales, totalExpenses, salesGrowth, profitMargin, totalOrders: sales.length }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner for unprocessed bank records */}
      {unprocessedPayments > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <Landmark className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-800">
                Unprocessed Bank Records
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                You have {unprocessedPayments} unprocessed bank payment{' '}
                {unprocessedPayments === 1 ? 'record' : 'records'} that need attention.
              </p>
            </div>
            <Link
              to="/bank-records"
              className="flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900"
            >
              View Records
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Dashboard header */}
      <div className="flex items-center justify-between">
        <Title>Dashboard</Title>
        <div className="flex gap-2">
          {(['1M', '3M', '6M', 'YTD', 'ALL'] as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1 text-sm rounded-md ${
                dateRange === r
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Sales */}
        <Card className="p-6 bg-gradient-to-br from-rose-50 to-rose-100">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-rose-500 bg-opacity-10 rounded-full">
              <DollarSign className="h-6 w-6 text-rose-500" />
            </div>
            <div>
              <Text className="text-sm font-medium text-rose-600">Total Sales</Text>
              <Text className="text-2xl font-bold text-rose-900">
                {formatCurrency(metrics.totalSales)} {businessProfile?.preferred_currency}
              </Text>
            </div>
          </div>
          <Text className="mt-4 text-sm text-rose-600">
            {metrics.salesGrowth >= 0 ? '+' : ''}{metrics.salesGrowth.toFixed(1)}% from previous period
          </Text>
        </Card>

        {/* Total Expenses */}
        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-amber-500 bg-opacity-10 rounded-full">
              <Wallet className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <Text className="text-sm font-medium text-amber-600">Total Expenses</Text>
              <Text className="text-2xl font-bold text-amber-900">
                {formatCurrency(metrics.totalExpenses)} {businessProfile?.preferred_currency}
              </Text>
            </div>
          </div>
          <Text className="mt-4 text-sm text-amber-600">
            {metrics.profitMargin.toFixed(1)}% profit margin
          </Text>
        </Card>

        {/* Products in Stock */}
        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-emerald-500 bg-opacity-10 rounded-full">
              <Package className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <Text className="text-sm font-medium text-emerald-600">Products in Stock</Text>
              <Text className="text-2xl font-bold text-emerald-900">
                {metrics.totalProducts}
              </Text>
            </div>
          </div>
          <Text className="mt-4 text-sm text-emerald-600">
            {lowStockProducts.length} items low on stock
          </Text>
        </Card>

        {/* Outstanding Balance */}
        <Card className="p-6 bg-gradient-to-br from-violet-50 to-violet-100">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-violet-500 bg-opacity-10 rounded-full">
              <Users className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <Text className="text-sm font-medium text-violet-600">Outstanding Balance</Text>
              <Text className="text-2xl font-bold text-violet-900">
                {formatCurrency(metrics.totalCustomerDebt)} {businessProfile?.preferred_currency}
              </Text>
            </div>
          </div>
          <Text className="mt-4 text-sm text-violet-600">
            Owed by customers
          </Text>
        </Card>
      </div>

      {/* Low Stock Items */}
      {lowStockProducts.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <Title>Low Stock Items</Title>
            </div>
            <Link to="/inventory" className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
              Manage Inventory<ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium">{p.name}</h3>
                  {p.sku && <p className="text-sm text-gray-500">SKU: {p.sku}</p>}
                </div>
                <Badge color={p.quantity === 0 ? 'red' : 'yellow'}>
                  {p.quantity === 0 ? 'Out of Stock' : `${p.quantity} left`}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top Owing Customers */}
      {topDebtors.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <Title>Top Owing Customers</Title>
            <Link to="/transactions" className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
              Manage Transactions<ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {topDebtors.map(d => (
              <div key={d.contact_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium">{d.contact_name}</h3>
                <p className="font-medium text-red-600">
                  {formatCurrency(d.total_owed)} {businessProfile?.preferred_currency}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
