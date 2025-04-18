import React, { useState } from 'react';
import { Brain, Lightbulb, TrendingUp, X } from 'lucide-react';
import { Card, Title } from '@tremor/react';
import { toast } from 'sonner';

interface AIInsightsProps {
  metrics: {
    totalSales: number;
    totalExpenses: number;
    totalProfit: number;
    salesGrowth: number;
    profitMargin: number;
    averageOrderValue: number;
    repeatCustomerRate: number;
    totalOrders: number;
  };
  topProducts: {
    name: string;
    revenue: number;
  }[];
  topCustomers: {
    name: string;
    revenue: number;
  }[];
}

export function AIInsights({ metrics, topProducts, topCustomers }: AIInsightsProps) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);

  const generateInsights = async () => {
    try {
      setLoading(true);
      setShowModal(true);

      // Call the edge function with proper error handling
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-business`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics,
          topProducts,
          topCustomers
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.insights || !Array.isArray(data.insights)) {
        throw new Error('Invalid response format from AI service');
      }

      setInsights(data.insights);
    } catch (err) {
      console.error('Error generating insights:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate AI insights');
      // Close the modal on error after a short delay
      setTimeout(() => setShowModal(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={generateInsights}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
      >
        <Brain className="h-4 w-4 mr-2" />
        {loading ? 'Analyzing...' : 'Generate AI Insights'}
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Brain className="h-6 w-6 text-primary-600" />
                  </div>
                  <Title>AI Business Insights</Title>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Brain className="h-8 w-8 text-primary-600 animate-pulse" />
                    </div>
                    <svg className="h-16 w-16 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    AI is analyzing your business data
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Please wait while we generate personalized insights...
                  </p>
                </div>
              ) : insights.length > 0 ? (
                <div className="space-y-8">
                  {insights.map((insight, index) => {
                    const [title, ...content] = insight.split('\n\n');
                    return (
                      <div key={index} className="pb-6 border-b border-gray-200 last:border-0">
                        <div className="flex items-center gap-2 mb-4">
                          <Lightbulb className="h-5 w-5 text-amber-500" />
                          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                        </div>
                        <div className="space-y-4 pl-7">
                          {content.map((section, sectionIndex) => {
                            if (section.startsWith('Recommendations:')) {
                              const [recTitle, ...recItems] = section.split('\n');
                              return (
                                <div key={sectionIndex}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                    <p className="font-medium text-gray-900">{recTitle}</p>
                                  </div>
                                  <ul className="space-y-2 pl-7">
                                    {recItems.map((item, itemIndex) => (
                                      <li key={itemIndex} className="text-gray-700">
                                        {item.replace('-', '•')}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            }
                            return (
                              <p key={sectionIndex} className="text-gray-700">
                                {section.replace('Insight:', '')}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No insights available. Please try again.
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}