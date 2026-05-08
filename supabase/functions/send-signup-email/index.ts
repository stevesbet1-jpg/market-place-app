import "@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

console.log('=== SEND SIGNUP EMAIL FUNCTION ===')
console.log('RESEND_API_KEY present:', !!RESEND_API_KEY)

Deno.serve(async (req) => {
  try {
    const { email, fullName } = await req.json()

    if (!email) {
      console.error('ERROR: Email is required')
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!RESEND_API_KEY) {
      console.error('ERROR: RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Send welcome email via Resend
    console.log('Sending welcome email via Resend to:', email)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Welcome to Marketplace',
        html: `
          <h2>Welcome to Marketplace!</h2>
          <p>Hi ${fullName || 'there'},</p>
          <p>Your account has been created successfully.</p>
          <p>You can now sign in to the app with your email and password.</p>
          <p>If you didn't create this account, you can ignore this email.</p>
        `,
      }),
    })

    const resendData = await resendResponse.json()
    console.log('Resend response status:', resendResponse.status)
    console.log('Resend response:', JSON.stringify(resendData))

    if (!resendResponse.ok) {
      console.error('ERROR: Resend API failed:', resendData)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: resendData }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('SUCCESS: Welcome email sent via Resend, ID:', resendData.id)

    return new Response(
      JSON.stringify({ success: true, messageId: resendData.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('ERROR: Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Set environment variables:
     export RESEND_API_KEY=your_resend_api_key
  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-signup-email' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"email":"test@example.com","fullName":"John Doe"}'

*/
