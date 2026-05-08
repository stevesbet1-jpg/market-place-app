import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROJECT_URL = Deno.env.get('PROJECT_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')

console.log('=== RESET PASSWORD FUNCTION ===')
console.log('PROJECT_URL present:', !!PROJECT_URL)
console.log('SERVICE_ROLE_KEY present:', !!SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  try {
    const { token, newPassword } = await req.json()

    if (!token) {
      console.error('ERROR: Token is required')
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!newPassword) {
      console.error('ERROR: New password is required')
      return new Response(
        JSON.stringify({ error: 'New password is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(PROJECT_URL!, SERVICE_ROLE_KEY!)

    console.log('Looking up token:', token)

    // Find valid reset token
    const { data: resetData, error: resetError } = await supabase
      .from('password_resets')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single()

    if (resetError || !resetData) {
      console.error('ERROR: Invalid or expired token:', resetError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired reset link' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if token is expired
    const expiresAt = new Date(resetData.expires_at)
    if (expiresAt < new Date()) {
      console.error('ERROR: Token expired')
      return new Response(
        JSON.stringify({ error: 'Reset link has expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('Token valid for email:', resetData.email)

    // Update user password in Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      resetData.email,
      { password: newPassword }
    )

    if (updateError) {
      console.error('ERROR: Failed to update password:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update password' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Mark token as used
    const { error: markUsedError } = await supabase
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    if (markUsedError) {
      console.error('WARNING: Failed to mark token as used:', markUsedError)
      // Continue anyway - password was updated
    }

    console.log('SUCCESS: Password updated for', resetData.email)

    return new Response(
      JSON.stringify({ success: true }),
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
     export PROJECT_URL=your_supabase_url
     export SERVICE_ROLE_KEY=your_service_role_key
  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/reset-password' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"token":"your_token","newPassword":"new_password"}'

*/
