import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// ─── Primary source: Expo environment variables ──────────────────

let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const SOURCE_PRIMARY = 'EXPO_PUBLIC_';
let source = SOURCE_PRIMARY;

// ─── Fallback: Constants.expoConfig.extra ──────────────────────────

if (!supabaseUrl || !supabaseAnonKey) {
  const extra = Constants.expoConfig?.extra;
  if (extra?.supabaseUrl && extra?.supabaseAnonKey) {
    supabaseUrl = extra.supabaseUrl;
    supabaseAnonKey = extra.supabaseAnonKey;
    source = 'Constants.expoConfig.extra';
  }
}

// ─── Runtime diagnostics (safe: never logs full key) ──────────────

console.log('=== SUPABASE RUNTIME CONFIG ===');
console.log('Source:', source);
console.log('Supabase URL exists:', !!supabaseUrl);
console.log('Supabase URL value:', supabaseUrl || 'MISSING');
console.log('Supabase anon key exists:', !!supabaseAnonKey);
console.log('Supabase anon key (first 12 chars):', supabaseAnonKey ? supabaseAnonKey.substring(0, 12) + '...' : 'MISSING');
console.log('Supabase anon key length:', supabaseAnonKey?.length || 0);
console.log('================================');

// ─── Validation before creating client ─────────────────────────────

const missing: string[] = [];

if (!supabaseUrl) {
  missing.push('EXPO_PUBLIC_SUPABASE_URL');
}
if (!supabaseAnonKey) {
  missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

if (missing.length > 0) {
  console.warn(
    '[SupabaseConfig] MISSING environment variables:',
    missing.join(', '),
    '| Add them to .env and restart with npx expo start --clear'
  );
}

// Strip trailing slash and /rest/v1 from URL to keep it clean
const cleanUrl = supabaseUrl.replace(/\/$/, '').replace(/\/rest\/v1$/, '');

export const isSupabaseConfigured = (): boolean => {
  return !!(cleanUrl && supabaseAnonKey);
};

// ─── Lazy client creation (only when values are valid) ───────────

let _supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Missing: ' +
      missing.join(', ') +
      '. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env'
    );
  }
  if (!_supabaseClient) {
    _supabaseClient = createClient(cleanUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    console.log('[SupabaseConfig] Client initialized successfully');
  }
  return _supabaseClient;
}

/** Safe wrapper — lazily creates the real client on first property access. */
export const supabase = {
  get auth() { return getSupabaseClient().auth; },
  get functions() { return getSupabaseClient().functions; },
  get from() { return getSupabaseClient().from; },
  get storage() { return getSupabaseClient().storage; },
  get rpc() { return getSupabaseClient().rpc; },
  get channel() { return getSupabaseClient().channel; },
  get realtime() { return getSupabaseClient().realtime; },
};

// Startup health check
export async function healthCheckSupabase(): Promise<{ success: boolean; status?: number; error?: string }> {
  if (!cleanUrl || !supabaseAnonKey) {
    console.error('SUPABASE_HEALTH_CHECK: Missing URL or key');
    return { success: false, error: 'Missing URL or key' };
  }

  console.log('=== SUPABASE HEALTH CHECK ===');
  console.log('Testing URL:', cleanUrl);
  console.log('Key length:', supabaseAnonKey.length);

  try {
    const response = await fetch(`${cleanUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
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
