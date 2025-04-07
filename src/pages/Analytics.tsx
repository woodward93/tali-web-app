import React, { useState, useEffect } from 'react';
import { 
  Card,
  Title,
  Text,
  Tab,
  TabList,
  TabGroup,
  TabPanel,
  TabPanels,
  AreaChart,
  DonutChart,
  BarChart,
} from '@tremor/react';
import { 
  DollarSign,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react';
import { format, subMonths, startOfYear, isAfter } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/format';
import type { Transaction } from '../types';

type DateRange = '1M' | '3M' | '6M' | 'YTD' | 'ALL';

interface BusinessProfile {
  preferred_currency: string;
}

interface ChartData {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
}

interface ProductPerformance {
  name: string;
  quantity: number;
  revenue: number;
}

interface CustomerPerformance {
  name: string;
  transactions: number;
  revenue: number;
}

interface CategoryPerformance {
  name: string;
  sales: number;
  revenue: number;
}

export function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('3M');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerPerformance[]>([]);
  const [metrics, setMetrics] = useState({
    averageOrderValue: 0,
    repeatCustomerRate: 0,
    salesGrowth: 0,
    profitMargin: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    totalProfit: 0,
    totalOrders: 0
  });

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
    }
  }, [user]);

  useEffect(() => {
    if (transactions.length > 0) {
      processData();
    }
  }, [transactions, dateRange]);

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
        await loadTransactions(data.id);
      }
    } catch (err) {
      console.error('Error loading business profile:', err);
      toast.error('Failed to load business profile');
    }
  };

  const loadTransactions = async (businessId: string) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          contact:contacts(name)
        `)
        .eq('business_id', businessId)
        .order('date', { ascending: true });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeStart = () => {
    const now = new Date();
    switch (dateRange) {
      case '1M':
        return subMonths(now, 1);
      case '3M':
        return subMonths(now, 3);
      case '6M':
        return subMonths(now, 6);
      case 'YTD':
        return startOfYear(now);
      case 'ALL':
        return new Date(0);
      default:
        return subMonths(now, 3);
    }
  };

  const processData = () => {
    const rangeStart = getDateRangeStart();
    const filteredTransactions = transactions.filter(t => 
      isAfter(new Date(t.date), rangeStart)
    );

    // Process transactions by date
    const dataByDate = new Map<string, ChartData>();
    filteredTransactions.forEach(transaction => {
      const date = format(new Date(transaction.date), 'yyyy-MM-dd');
      const existing = dataByDate.get(date) || { 
        date, 
        sales: 0, 
        expenses: 0,
        profit: 0
      };

      if (transaction.type === 'sale') {
        existing.sales += transaction.total;
      } else {
        existing.expenses += transaction.total;
      }
      existing.profit = existing.sales - existing.expenses;
      dataByDate.set(date, existing);
    });

    setChartData(Array.from(dataByDate.values()));

    // Calculate top products
    const productPerformance = new Map<string, ProductPerformance>();
    filteredTransactions
      .filter(t => t.type === 'sale')
      .forEach(transaction => {
        transaction.items.forEach(item => {
          const existing = productPerformance.get(item.name) || {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
          existing.quantity += item.quantity_selected;
          existing.revenue += item.subtotal;
          productPerformance.set(item.name, existing);
        });
      });

    setTopProducts(
      Array.from(productPerformance.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
    );

    // Calculate top customers
    const customerPerformance = new Map<string, CustomerPerformance>();
    filteredTransactions
      .filter(t => t.type === 'sale' && t.contact?.name)
      .forEach(transaction => {
        const customerName = transaction.contact!.name;
        const existing = customerPerformance.get(customerName) || {
          name: customerName,
          transactions: 0,
          revenue: 0
        };
        existing.transactions += 1;
        existing.revenue += transaction.total;
        customerPerformance.set(customerName, existing);
      });

    setTopCustomers(
      Array.from(customerPerformance.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
    );

    // Calculate metrics
    const sales = filteredTransactions.filter(t => t.type === 'sale');
    const totalSales = sales.reduce((sum, t) => sum + t.total, 0);
    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.total, 0);

    // Average order value
    const averageOrderValue = sales.length > 0 ? totalSales / sales.length : 0;

    // Repeat customer rate
    const uniqueCustomers = new Set(sales.map(t => t.contact_id)).size;
    const repeatCustomers = uniqueCustomers > 0 
      ? uniqueCustomers / sales.length 
      : 0;

    // Sales growth (comparing with previous period)
    const midPoint = new Date((new Date().getTime() + rangeStart.getTime()) / 2);
    const recentSales = sales
      .filter(t => isAfter(new Date(t.date), midPoint))
      .reduce((sum, t) => sum + t.total, 0);
    const previousSales = sales
      .filter(t => !isAfter(new Date(t.date), midPoint))
      .reduce((sum, t) => sum + t.total, 0);
    const salesGrowth = previousSales > 0 
      ? ((recentSales - previousSales) / previousSales) * 100 
      : 0;

    // Profit margin
    const profitMargin = totalSales > 0 
      ? ((totalSales - totalExpenses) / totalSales) * 100 
      : 0;

    setMetrics({
      averageOrderValue,
      repeatCustomerRate: repeatCustomers * 100,
      salesGrowth,
      profitMargin,
      totalRevenue: totalSales,
      totalExpenses,
      totalProfit: totalSales - totalExpenses,
      totalOrders: sales.length
    });
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
      <div className="flex items-center justify-between">
        <Title>Analytics</Title>
        <div className="flex gap-2">
          {(['1M', '3M', '6M', 'YTD', 'ALL'] as DateRange[]).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1 text-sm rounded-md ${
                dateRange === range
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6 bg-gradient-to-br from-rose-50 to-rose-100">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-rose-500 bg-opacity-10 rounded-full">
              <DollarSign className="h-6 w-6 text-rose-500" />
            </div>
            <div>
              <Text className="text-sm font-medium text-rose-600">Total Revenue</Text>
              <Text className="text-2xl font-bold text-rose-900">
                {formatCurrency(metrics.totalRevenue)} {businessProfile?.preferred_currency}
              </Text>
            </div>
          </div>
          <Text className="mt-4 text-sm text-rose-600">
            {metrics.salesGrowth >= 0 ? '+' : ''}{metrics.salesGrowth.toFixed(1)}% vs previous period
          </Text>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-amber-500 bg-opacity-10 rounded-full">
              <Wallet className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <Text className="text-sm font-medium text-amber-600">Total Profit</Text>
              <Text className="text-2xl font-bold text-amber-900">
                {formatCurrency(metrics.totalProfit)} {businessProfile?.preferred_currency}
              </Text>
            </div>
          </div>
          <Text className="mt-4 text-sm text-amber-600">
            {metrics.profitMargin.toFixed(1)}% margin
          </Text>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-emerald-500 bg-opacity-10 rounded-full">
              <ShoppingBag className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <Text className="text-sm font-medium text-emerald-600">Average Order Value</Text>
              <Text className="text-2xl font-bold text-emerald-900">
                {formatCurrency(metrics.averageOrderValue)} {businessProfile?.preferred_currency}
              </Text>
            </div>
          </div>
          <Text className="mt-4 text-sm text-emerald-600">
            {metrics.totalOrders} total orders
          </Text>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-violet-50 to-violet-100">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-violet-500 bg-opacity-10 rounded-full">
              <Users className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <Text className="text-sm font-medium text-violet-600">Customer Retention</Text>
              <Text className="text-2xl font-bold text-violet-900">
                {metrics.repeatCustomerRate.toFixed(1)}%
              </Text>
            </div>
          </div>
          <Text className="mt-4 text-sm text-violet-600">
            repeat customer rate
          </Text>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <Title>Revenue Overview</Title>
          <TabGroup>
            <TabList className="mt-4">
              <Tab>Revenue</Tab>
              <Tab>Profit</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <div className="mt-8">
                  <AreaChart
                    className="h-96"
                    data={chartData}
                    index="date"
                    categories={["sales", "expenses"]}
                    colors={["emerald", "red"]}
                    valueFormatter={(value) => `${formatCurrency(value)} ${businessProfile?.preferred_currency}`}
                    showLegend
                    showGridLines
                    showAnimation
                    yAxisWidth={120}
                    minValue={0}
                  />
                </div>
              </TabPanel>
              <TabPanel>
                <div className="mt-8">
                  <AreaChart
                    className="h-96"
                    data={chartData}
                    index="date"
                    categories={["profit"]}
                    colors={["blue"]}
                    valueFormatter={(value) => `${formatCurrency(value)} ${businessProfile?.preferred_currency}`}
                    showLegend
                    showGridLines
                    showAnimation
                    yAxisWidth={120}
                    minValue={0}
                  />
                </div>
              </TabPanel>
            </TabPanels>
          </TabGroup>
        </Card>

        <Card className="p-6">
          <Title>Top Products</Title>
          <div className="mt-8">
            <BarChart
              className="h-96"
              data={topProducts}
              index="name"
              categories={["revenue"]}
              colors={["blue"]}
              valueFormatter={(value) => `${formatCurrency(value)} ${businessProfile?.preferred_currency}`}
              showLegend={false}
              showGridLines
              showAnimation
              yAxisWidth={120}
              minValue={0}
            />
          </div>
        </Card>

        <Card className="p-6">
          <Title>Top Customers</Title>
          <div className="mt-8">
            <BarChart
              className="h-96"
              data={topCustomers}
              index="name"
              categories={["revenue"]}
              colors={["emerald"]}
              valueFormatter={(value) => `${formatCurrency(value)} ${businessProfile?.preferred_currency}`}
              showLegend={false}
              showGridLines
              showAnimation
              yAxisWidth={120}
              minValue={0}
            />
          </div>
        </Card>

        <Card className="p-6">
          <Title>Sales by Payment Method</Title>
          <div className="mt-8">
            <DonutChart
              className="h-96"
              data={transactions
                .filter(t => t.type === 'sale')
                .reduce((acc, t) => {
                  const method = acc.find(m => m.name === t.payment_method);
                  if (method) {
                    method.value += t.total;
                  } else {
                    acc.push({
                      name: t.payment_method,
                      value: t.total
                    });
                  }
                  return acc;
                }, [] as { name: string; value: number }[])}
              category="value"
              index="name"
              valueFormatter={(value) => `${formatCurrency(value)} ${businessProfile?.preferred_currency}`}
              colors={["slate", "violet", "indigo", "rose", "cyan", "amber"]}
              showAnimation
            />
          </div>
        </Card>
      </div>
    </div>
  );
}