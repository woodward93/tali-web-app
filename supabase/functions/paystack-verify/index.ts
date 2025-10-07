import { serve } from 'https://deno.land/std@0.152.0/http/server.ts'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface VerifyRequest {
  reference: string
}

interface PaystackVerifyResponse {
  status: boolean
  message: string
  data: {
    id: number
    domain: string
    status: string
    reference: string
    amount: number
    message: string | null
    gateway_response: string
    paid_at: string | null
    created_at: string
    channel: string
    currency: string
    ip_address: string
    metadata: any
    log: any
    fees: number | null
    fees_split: any | null
    authorization: any
    customer: any
    plan: any | null
    split: any
    order_id: any | null
    paidAt: string | null
    createdAt: string
    requested_amount: number
    pos_transaction_data: any | null
    source: any | null
    fees_breakdown: any | null
    transaction_date: string
    plan_object: any
    subaccount: any
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Parse and validate request body
    const body: VerifyRequest = await req.json()
    
    // Validate required reference field
    if (!body.reference || typeof body.reference !== 'string' || body.reference.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Missing or invalid reference field' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Paystack secret key from environment
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Paystack secret key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call Paystack Verify Transaction endpoint
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(body.reference)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const paystackData: PaystackVerifyResponse = await paystackResponse.json()

    // Return the entire Paystack response with appropriate status code
    return new Response(
      JSON.stringify(paystackData),
      { 
        status: paystackResponse.ok ? 200 : paystackResponse.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    // Handle JSON parsing errors and other exceptions
    console.error('Error in paystack-verify:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Invalid request body or internal server error' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})