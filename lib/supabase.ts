import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Runtime environment diagnostics
console.log('=== SUPABASE RUNTIME CONFIG ===');
console.log('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl || 'MISSING');
console.log('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (first 20 chars):', supabasePublishableKey ? supabasePublishableKey.substring(0, 20) : 'MISSING');
console.log('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (full length):', supabasePublishableKey?.length || 0);
console.log('Key format:', supabasePublishableKey?.startsWith('sb_publishable_') ? 'NEW publishable key format' : 'Legacy format');
console.log('================================');

// Basic validation - only check presence, not format
if (!supabaseUrl) {
  console.warn('EXPO_PUBLIC_SUPABASE_URL is missing in .env file');
}

if (!supabasePublishableKey) {
  console.warn('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing in .env file');
}

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabasePublishableKey);
};

// Supabase client - works with new sb_publishable_ key format
// The new publishable keys are used the same way as anon keys
export const supabase = createClient(
  supabaseUrl ?? '',
  supabasePublishableKey ?? '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

// Startup health check
export async function healthCheckSupabase(): Promise<{ success: boolean; status?: number; error?: string }> {
  if (!supabaseUrl || !supabasePublishableKey) {
    console.error('SUPABASE_HEALTH_CHECK: Missing URL or key');
    return { success: false, error: 'Missing URL or key' };
  }

  console.log('=== SUPABASE HEALTH CHECK ===');
  console.log('Testing URL:', supabaseUrl);
  console.log('Key length:', supabasePublishableKey.length);

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        'apikey': supabasePublishableKey,
        'Authorization': `Bearer ${supabasePublishableKey}`,
      },
    });

    console.log('Status code:', response.status);
    console.log('Status text:', response.statusText);
    console.log('OK:', response.ok);

    const responseText = await response.text();
    console.log('Response body (first 300 chars):', responseText.substring(0, 300));

    if (response.ok) {
      console.log('SUPABASE_HEALTH_CHECK: ✓ PASS');
      return { success: true, status: response.status };
    } else {
      console.error('SUPABASE_HEALTH_CHECK: ✗ FAIL - Status', response.status);
      return { success: false, status: response.status, error: `Status ${response.status}` };
    }
  } catch (error: any) {
    console.error('SUPABASE_HEALTH_CHECK: ✗ FAIL');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return { success: false, error: error.message };
  }
}
