import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const PROJECT_URL = Deno.env.get('PROJECT_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')

console.log('=== SEND RESET EMAIL FUNCTION INIT ===')
console.log('RESEND_API_KEY present:', !!RESEND_API_KEY)
console.log('PROJECT_URL present:', !!PROJECT_URL)
console.log('SERVICE_ROLE_KEY present:', !!SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  console.log('=== REQUEST RECEIVED ===')
  console.log('Method:', req.method)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))

  try {
    const body = await req.json()
    console.log('BODY:', body)
    const { email } = body
    console.log('EMAIL:', email)

    if (!email) {
      console.error('ERROR: Email is required')
      return new Response(
        JSON.stringify({ success: false, error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!RESEND_API_KEY) {
      console.error('ERROR: RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Generate a secure reset token
    const resetToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour from now
    console.log('Generated reset token:', resetToken)

    // Store reset token in Supabase
    const supabase = createClient(PROJECT_URL!, SERVICE_ROLE_KEY!)

    console.log('Storing reset token for email:', email)

    const { error: dbError } = await supabase
      .from('password_resets')
      .insert({
        email: email.toLowerCase(),
        token: resetToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      })

    if (dbError) {
      console.error('ERROR: Failed to store reset token:', dbError)
      // Continue anyway to avoid exposing whether email exists
    } else {
      console.log('Reset token stored successfully')
    }

    // Send email via Resend
    console.log('Sending email via Resend to:', email)

    // Use direct deep link for native app handling
    const deepLink = `marketplace://reset-password?token=${resetToken}`
    console.log("DEEP_LINK:", deepLink)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Reset Your Password',
        html: `
          <h2>Reset Your Password</h2>
          <p>Copy the link below and paste it into Safari to reset your password:</p>
          <p style="font-family: monospace; background-color: #f5f5f5; padding: 15px; word-break: break-all; font-size: 14px;">${deepLink}</p>
          <p><strong>Instructions:</strong></p>
          <ol>
            <li>Copy the full marketplace:// link above</li>
            <li>Open Safari on your device</li>
            <li>Paste the link into the address bar</li>
            <li>The app will open automatically</li>
          </ol>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, you can ignore this email.</p>
        `,
        text: `Reset Your Password

Copy this link and paste it into Safari to reset your password:
${deepLink}

Instructions:
1. Copy the full marketplace:// link above
2. Open Safari on your device
3. Paste the link into the address bar
4. The app will open automatically

This link will expire in 1 hour.`,
      }),
    })

    const resendData = await resendResponse.json()
    console.log('Resend response status:', resendResponse.status)
    console.log('Resend response:', JSON.stringify(resendData))

    if (!resendResponse.ok) {
      console.error('ERROR: Resend API failed:', resendData)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send email', details: resendData }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('SUCCESS: Email sent via Resend, ID:', resendData.id)

    return new Response(
      JSON.stringify({ success: true, messageId: resendData.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('=== EDGE FUNCTION ERROR ===')
    console.error('Error message:', err.message)
    console.error('Error stack:', err.stack)
    console.error('Error name:', err.name)

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        stack: err.stack
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Set environment variables:
     export RESEND_API_KEY=your_resend_api_key
     export PROJECT_URL=your_supabase_url
     export SERVICE_ROLE_KEY=your_service_role_key
  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-reset-email' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"email":"test@example.com"}'

*/
