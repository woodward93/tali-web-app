import { serve } from 'https://deno.land/std@0.152.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Simple Excel (.xlsx) file parser using basic XML extraction
async function extractTextFromExcel(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to string to search for XML content
    const excelString = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
    
    // Excel files are ZIP archives containing XML files
    // Look for shared strings and worksheet data
    const sharedStringsRegex = /<si[^>]*>.*?<\/si>/gs;
    const cellValueRegex = /<c[^>]*r="[A-Z]+\d+"[^>]*>.*?<\/c>/gs;
    const textRegex = /<t[^>]*>(.*?)<\/t>/gs;
    const valueRegex = /<v[^>]*>(.*?)<\/v>/gs;
    
    let extractedText = '';
    
    // Extract shared strings (text values)
    const sharedStrings: string[] = [];
    let sharedStringMatch;
    while ((sharedStringMatch = sharedStringsRegex.exec(excelString)) !== null) {
      const textMatches = sharedStringMatch[0].match(textRegex);
      if (textMatches) {
        for (const textMatch of textMatches) {
          const text = textMatch.replace(/<\/?t[^>]*>/g, '').trim();
          if (text && text.length > 0) {
            sharedStrings.push(text);
            extractedText += text + ' ';
          }
        }
      }
    }
    
    // Extract cell values (numbers and direct text)
    let cellMatch;
    while ((cellMatch = cellValueRegex.exec(excelString)) !== null) {
      // Extract numeric values
      const valueMatches = cellMatch[0].match(valueRegex);
      if (valueMatches) {
        for (const valueMatch of valueMatches) {
          const value = valueMatch.replace(/<\/?v[^>]*>/g, '').trim();
          if (value && /^\d+(\.\d+)?$/.test(value)) {
            extractedText += value + ' ';
          }
        }
      }
      
      // Extract inline text
      const inlineTextMatches = cellMatch[0].match(textRegex);
      if (inlineTextMatches) {
        for (const textMatch of inlineTextMatches) {
          const text = textMatch.replace(/<\/?t[^>]*>/g, '').trim();
          if (text && text.length > 0) {
            extractedText += text + ' ';
          }
        }
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (!extractedText || extractedText.length < 10) {
      throw new Error('No readable content found in Excel file. Please ensure the file contains bank statement data.');
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('Excel text extraction error:', error);
    throw new Error(`Excel file processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

interface BankRecord {
  date: string;
  type: 'money-in' | 'money-out';
  description: string;
  amount: number;
  beneficiary_name: string | null;
}

// Simple PDF text extraction using basic PDF structure parsing
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to string to search for text content
    const pdfString = new TextDecoder('latin1').decode(uint8Array);
    
    // Look for text objects in PDF structure
    const textRegex = /\(([^)]+)\)/g;
    const streamRegex = /stream\s*(.*?)\s*endstream/gs;
    
    let extractedText = '';
    
    // Extract text from parentheses (simple text objects)
    let match;
    while ((match = textRegex.exec(pdfString)) !== null) {
      const text = match[1];
      // Filter out non-printable characters and decode basic escape sequences
      const cleanText = text
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\(.)/g, '$1');
      
      // Only include text that looks like it could be from a bank statement
      if (cleanText.length > 1 && /[a-zA-Z0-9]/.test(cleanText)) {
        extractedText += cleanText + ' ';
      }
    }
    
    // Also try to extract from stream objects (more complex text)
    const streamMatches = pdfString.match(streamRegex);
    if (streamMatches) {
      for (const streamMatch of streamMatches) {
        // Look for text commands in the stream
        const textCommands = streamMatch.match(/\([^)]+\)/g);
        if (textCommands) {
          for (const cmd of textCommands) {
            const text = cmd.slice(1, -1); // Remove parentheses
            if (text.length > 1 && /[a-zA-Z0-9]/.test(text)) {
              extractedText += text + ' ';
            }
          }
        }
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (!extractedText || extractedText.length < 10) {
      throw new Error('No readable text content found in PDF. The PDF might be image-based or encrypted.');
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('PDF text extraction error:', error);
    throw new Error(`PDF text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const businessId = formData.get('businessId') as string;

    if (!file || !businessId) {
      return new Response(
        JSON.stringify({ error: 'Missing file or business ID' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File size must be less than 5MB' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let fileContent: string;

    // Extract content based on file type
    if (file.type === 'text/csv') {
      // Handle CSV files
      fileContent = await file.text();
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
               file.name.toLowerCase().endsWith('.xlsx')) {
      // Handle Excel files
      try {
        const arrayBuffer = await file.arrayBuffer();
        fileContent = await extractTextFromExcel(arrayBuffer);
        
        console.log('Excel text extraction successful, content length:', fileContent.length);
        
      } catch (excelError) {
        console.error('Excel parsing error details:', excelError);
        
        let errorDetails = 'Unknown Excel parsing error';
        if (excelError instanceof Error) {
          errorDetails = excelError.message;
        }
        
        return new Response(
          JSON.stringify({ 
            error: `Failed to parse Excel file: ${errorDetails}. Please ensure the Excel file contains readable bank statement data, or try converting it to CSV format.`
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } else if (file.type === 'application/pdf') {
      // Handle PDF files using simple text extraction
      try {
        const arrayBuffer = await file.arrayBuffer();
        fileContent = await extractTextFromPDF(arrayBuffer);
        
        console.log('PDF text extraction successful, content length:', fileContent.length);
        
      } catch (pdfError) {
        console.error('PDF parsing error details:', pdfError);
        
        // Get detailed error information
        let errorDetails = 'Unknown PDF parsing error';
        if (pdfError instanceof Error) {
          errorDetails = pdfError.message;
        } else if (typeof pdfError === 'string') {
          errorDetails = pdfError;
        } else if (pdfError && typeof pdfError === 'object') {
          errorDetails = JSON.stringify(pdfError);
        }
        
        return new Response(
          JSON.stringify({ 
            error: `Failed to parse PDF file: ${errorDetails}. Please ensure the PDF is not password-protected and contains readable text, or try converting it to CSV format.`
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type. Please upload CSV, Excel (.xlsx), or PDF files only.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate that we have content
    if (!fileContent || fileContent.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'File appears to be empty or contains insufficient data for processing' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Prepare OpenAI prompt
    const prompt = `
You are a financial data analyst. Analyze the following bank statement data and extract transaction records.

IMPORTANT INSTRUCTIONS:
1. Return ONLY a valid JSON object with a "records" array
2. Each record must have exactly these fields:
   - date: string in YYYY-MM-DD format
   - type: either "money-in" or "money-out" 
   - description: string describing the transaction
   - amount: positive number (always positive, regardless of type)
   - beneficiary_name: string or null (the person/company involved)

3. Rules for determining type:
   - "money-in": deposits, credits, incoming payments, salary, sales
   - "money-out": withdrawals, debits, outgoing payments, expenses, purchases

4. Clean and standardize the data:
   - Remove any currency symbols from amounts
   - Ensure dates are in YYYY-MM-DD format
   - Clean up description text
   - Extract meaningful beneficiary names

5. If a row has both money-in and money-out values, create separate records for each

Here is the bank statement data to analyze:

${fileContent}

Return the response in this exact JSON format:
{
  "records": [
    {
      "date": "2025-01-15",
      "type": "money-in",
      "description": "Salary Payment",
      "amount": 5000.00,
      "beneficiary_name": "Employer Name"
    }
  ]
}
`;

    // Call OpenAI API with exponential backoff
    const MAX_RETRIES = 5;
    const INITIAL_BACKOFF_MS = 1000;
    
    let openaiResponse: Response;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`OpenAI API attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
        
        openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are a financial data analyst that extracts structured data from bank statements. Always respond with valid JSON only.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 4000
          })
        });

        // If successful or non-retryable error, break out of retry loop
        if (openaiResponse.ok || (openaiResponse.status !== 429 && openaiResponse.status !== 500 && openaiResponse.status !== 502 && openaiResponse.status !== 503 && openaiResponse.status !== 504)) {
          break;
        }

        // Handle rate limiting and server errors with exponential backoff
        if (openaiResponse.status === 429 || openaiResponse.status >= 500) {
          const errorData = await openaiResponse.json().catch(() => ({}));
          console.warn(`OpenAI API error (attempt ${attempt + 1}):`, openaiResponse.status, errorData);
          
          lastError = new Error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`);
          
          // If this is the last attempt, don't wait
          if (attempt === MAX_RETRIES) {
            break;
          }
          
          // Calculate exponential backoff delay
          const backoffDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          const jitter = Math.random() * 0.1 * backoffDelay; // Add 10% jitter
          const totalDelay = backoffDelay + jitter;
          
          console.log(`Retrying in ${Math.round(totalDelay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, totalDelay));
        } else {
          // Non-retryable error
          const errorData = await openaiResponse.json().catch(() => ({}));
          console.error('OpenAI API non-retryable error:', errorData);
          throw new Error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`);
        }
      } catch (fetchError) {
        console.error(`OpenAI API fetch error (attempt ${attempt + 1}):`, fetchError);
        lastError = fetchError instanceof Error ? fetchError : new Error('Unknown fetch error');
        
        // If this is the last attempt, don't wait
        if (attempt === MAX_RETRIES) {
          break;
        }
        
        // Wait before retrying
        const backoffDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    // Check if we have a successful response
    if (!openaiResponse! || !openaiResponse.ok) {
      if (lastError) {
        throw lastError;
      }
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('OpenAI API final error:', errorData);
      throw new Error(`OpenAI API error after ${MAX_RETRIES + 1} attempts: ${openaiResponse.status} ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    
    if (!openaiData.choices || !openaiData.choices[0] || !openaiData.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    // Parse the OpenAI response
    let analysisResult;
    try {
      analysisResult = JSON.parse(openaiData.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', openaiData.choices[0].message.content);
      throw new Error('Failed to parse AI analysis result');
    }

    if (!analysisResult.records || !Array.isArray(analysisResult.records)) {
      throw new Error('Invalid analysis result format - missing records array');
    }

    // Validate and process records
    const validRecords: BankRecord[] = [];
    
    for (const record of analysisResult.records) {
      // Validate required fields
      if (!record.date || !record.type || !record.description || typeof record.amount !== 'number') {
        console.warn('Skipping invalid record:', record);
        continue;
      }

      // Validate type
      if (record.type !== 'money-in' && record.type !== 'money-out') {
        console.warn('Skipping record with invalid type:', record);
        continue;
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(record.date)) {
        console.warn('Skipping record with invalid date format:', record);
        continue;
      }

      // Ensure amount is positive
      const amount = Math.abs(record.amount);
      
      validRecords.push({
        date: record.date,
        type: record.type,
        description: record.description.trim(),
        amount: amount,
        beneficiary_name: record.beneficiary_name ? record.beneficiary_name.trim() : null
      });
    }

    if (validRecords.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid bank records found in the uploaded file' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Insert records into Supabase
    const recordsToInsert = validRecords.map(record => ({
      business_id: businessId,
      date: record.date,
      type: record.type,
      description: record.description,
      amount: record.amount,
      beneficiary_name: record.beneficiary_name,
      processed: false
    }));

    const { data, error } = await supabase
      .from('bank_payment_records')
      .insert(recordsToInsert)
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      throw new Error(`Failed to save records: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        message: `Successfully processed ${validRecords.length} bank payment records`,
        recordsProcessed: validRecords.length,
        records: data
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing bank statement:', error);
    
    // Return appropriate error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});