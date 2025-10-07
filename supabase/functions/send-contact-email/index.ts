import { serve } from 'https://deno.land/std@0.152.0/http/server.ts'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ContactRequest {
  name: string
  email: string
  subject: string
  message: string
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
    const body: ContactRequest = await req.json()
    
    // Validate required fields
    if (!body.name || !body.email || !body.message) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: name, email, and message are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get email service configuration from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      // Log the message for manual follow-up
      console.log('=== CONTACT FORM SUBMISSION ===')
      console.log('Name:', body.name)
      console.log('Email:', body.email)
      console.log('Subject:', body.subject || 'Contact Form Submission')
      console.log('Message:', body.message)
      console.log('Timestamp:', new Date().toISOString())
      console.log('================================')
      
      return new Response(
        JSON.stringify({ 
          message: 'Contact form submitted successfully. We will get back to you soon!',
          note: 'Email service not configured - message logged for manual processing'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepare email content
    const emailSubject = body.subject || 'Contact Form Submission from Tali App'
    const emailContent = `
New contact form submission from Tali App:

Name: ${body.name}
Email: ${body.email}
Subject: ${body.subject || 'No subject provided'}

Message:
${body.message}

---
Submitted at: ${new Date().toISOString()}
User can be reached at: ${body.email}
    `.trim()

    // Send email using Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tali App <no-reply@tali.ng>',
        to: ['hello@tali.ng'],
        reply_to: body.email,
        subject: emailSubject,
        text: emailContent,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066FF;">New Contact Form Submission</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${body.name}</p>
              <p><strong>Email:</strong> <a href="mailto:${body.email}">${body.email}</a></p>
              <p><strong>Subject:</strong> ${body.subject || 'No subject provided'}</p>
            </div>
            <div style="margin: 20px 0;">
              <h3>Message:</h3>
              <p style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 8px;">${body.message}</p>
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">
              Submitted at: ${new Date().toLocaleString()}<br>
              From: Tali Business Management App
            </p>
          </div>
        `
      }),
    })

    const emailData = await emailResponse.json()

    // Handle email API errors
    if (!emailResponse.ok) {
      console.error('Email sending failed:', emailData)
      
      // Log the message as fallback
      console.log('=== CONTACT FORM SUBMISSION (EMAIL FAILED) ===')
      console.log('Name:', body.name)
      console.log('Email:', body.email)
      console.log('Subject:', body.subject || 'Contact Form Submission')
      console.log('Message:', body.message)
      console.log('Timestamp:', new Date().toISOString())
      console.log('Email Error:', emailData)
      console.log('===============================================')
      
      return new Response(
        JSON.stringify({ 
          message: 'Contact form submitted successfully. We will get back to you soon!',
          note: 'Email delivery encountered an issue but your message was logged'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Email sent successfully:', emailData)

    // Return successful response
    return new Response(
      JSON.stringify({
        message: 'Message sent successfully! We will get back to you soon.',
        emailId: emailData.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    // Handle JSON parsing errors and other exceptions
    console.error('Error in send-contact-email:', error)
    
    // Log the submission for manual follow-up
    console.log('=== CONTACT FORM SUBMISSION (ERROR OCCURRED) ===')
    console.log('Error:', error)
    console.log('Request URL:', req.url)
    console.log('Timestamp:', new Date().toISOString())
    console.log('================================================')
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process contact form submission. Please try again or contact us directly at hello@tali.ng' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})