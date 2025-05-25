import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    if (!deepseekKey) {
      throw new Error('Missing DeepSeek API key');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const businessId = formData.get('businessId') as string;

    if (!file || !businessId) {
      throw new Error('File and business ID are required');
    }

    // Validate file type
    if (file.type !== 'text/csv') {
      throw new Error('Only CSV files are supported');
    }

    console.log('Processing file:', file.name, 'size:', file.size, 'type:', file.type);

    // Read file content
    const text = await file.text();
    console.log('File content length:', text.length, 'characters');

    // Call DeepSeek API with improved prompt
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are a CSV bank statement parser. Extract transactions from the CSV and return them in JSON format. Each transaction must have:
- date: YYYY-MM-DD format
- description: clear description of the transaction
- amount: numeric value without currency symbol
- type: "money-in" for deposits/credits or "money-out" for withdrawals/debits
- beneficiary_name: name of the sender/recipient if available

Return only a JSON object with a "records" array containing the transactions. Do not include any other text or formatting.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error response:', errorText);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('DeepSeek API response:', data);

    const content = data.choices[0].message.content.trim();
    console.log('Raw content:', content);
    
    // Remove any markdown code fences if present
    const jsonStr = content.replace(/^```json\n|\n```$/g, '');
    console.log('Cleaned JSON string:', jsonStr);
    
    // Parse JSON response
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed.records)) {
      console.error('Invalid response format:', parsed);
      throw new Error('Invalid response format: records array not found');
    }

    console.log('Parsed records:', parsed.records);

    // Validate records before insertion
    const validRecords = parsed.records.filter((record: any) => {
      const isValid = 
        record.date && 
        record.description && 
        typeof record.amount === 'number' &&
        ['money-in', 'money-out'].includes(record.type);

      if (!isValid) {
        console.warn('Invalid record:', record);
      }

      return isValid;
    });

    console.log('Valid records count:', validRecords.length);

    if (validRecords.length === 0) {
      throw new Error('No valid transactions found in the statement');
    }

    // Insert records into database
    const { data: insertedRecords, error: insertError } = await supabase
      .from('bank_payment_records')
      .insert(
        validRecords.map((record: any) => ({
          business_id: businessId,
          ...record
        }))
      )
      .select();

    if (insertError) {
      console.error('Database insertion error:', insertError);
      throw insertError;
    }

    console.log('Successfully inserted records:', insertedRecords?.length);

    return new Response(
      JSON.stringify({ 
        message: `Successfully processed ${validRecords.length} transactions` 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error processing bank statement:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});