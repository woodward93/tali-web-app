import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { metrics, topProducts, topCustomers } = await req.json();

    // Verify we have the API key
    const apiKey = Deno.env.get('VITE_DEEPSEEK_API_KEY');
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is not set');
    }

    // Prepare the prompt for analysis
    const prompt = `As a business analytics expert, please analyze this business data and provide 3 actionable insights. Use natural, conversational language and avoid any special formatting or symbols.

Here's the business performance data:

The business has a sales growth of ${metrics.salesGrowth}% and a profit margin of ${metrics.profitMargin}%. The average order value is ${metrics.averageOrderValue} with a customer retention rate of ${metrics.repeatCustomerRate}%. They've processed ${metrics.totalOrders} total orders.

Their top performing products by revenue are:
${topProducts.map(p => `${p.name} generating ${p.revenue} in revenue`).join(', ')}

Their most valuable customers are:
${topCustomers.map(c => `${c.name} with ${c.revenue} in purchases`).join(', ')}

Please provide 3 key insights about the business performance. For each insight:
1. Start with a clear title
2. Explain what you've observed and why it matters
3. Provide specific recommendations for improvement

Keep your response conversational and easy to read, as if you're speaking directly to the business owner.

Respond only in natural language, with no JSON, markdown, code blocks, or extra characters like '{' or '#' or '*' etc. Just return a direct, conversational response.`;

    // Call DeepSeek API with proper error handling
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a business analytics expert having a conversation with a business owner. Provide clear, actionable insights in natural language without any special formatting or symbols.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', errorText);
      throw new Error(`DeepSeek API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const insights = data.choices[0].message.content
      .split('\n')
      .filter(line => line.trim());

    return new Response(
      JSON.stringify({ insights }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in analyze-business function:', error);
    
    // Return a proper error response with the error message
    if (error.message.includes('DEEPSEEK_API_KEY')) {
      return new Response(
        JSON.stringify({ 
          error: 'Configuration error: DeepSeek API key not set',
          details: error.message 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      );
    }

    // Use metrics from the request for fallback insights if available
    try {
      const { metrics } = await req.json();
      const fallbackInsights = [
        `Your sales growth is ${metrics.salesGrowth >= 0 ? 'positive' : 'negative'} at ${metrics.salesGrowth.toFixed(1)}%. ${
          metrics.salesGrowth >= 0 
            ? 'Keep up the good work! Consider expanding your product line or entering new markets.'
            : 'Consider implementing promotional strategies and reviewing your pricing strategy to boost sales.'
        }`,
        `Your profit margin is ${metrics.profitMargin.toFixed(1)}%. ${
          metrics.profitMargin > 20
            ? 'This is healthy! Maintain your pricing and cost control strategies. Look for bulk purchasing opportunities to further improve margins.'
            : 'Look for ways to reduce costs or optimize pricing. Consider negotiating better rates with suppliers and reviewing operational efficiency.'
        }`,
        `Customer retention rate is ${metrics.repeatCustomerRate.toFixed(1)}%. ${
          metrics.repeatCustomerRate > 50
            ? 'Great customer loyalty! Consider implementing a rewards program to maintain this momentum.'
            : 'Focus on improving customer experience through better service and personalized offers.'
        }`,
      ];

      return new Response(
        JSON.stringify({ insights: fallbackInsights }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    } catch (fallbackError) {
      // If even the fallback fails, return a generic error
      return new Response(
        JSON.stringify({ 
          error: 'Failed to generate insights',
          details: error.message 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      );
    }
  }
});