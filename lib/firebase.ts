import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, fetchSignInMethodsForEmail } from 'firebase/auth';

// ─── Raw values from Expo environment variables ────────────────────

const rawApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
const rawAuthDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
const rawProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
const rawStorageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
const rawMessagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '';
const rawAppId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '';

// ─── Placeholder detection ─────────────────────────────────────────

const PLACEHOLDER_PATTERNS = /YOUR_|PLACEHOLDER|TODO|EXAMPLE|CHANGE_ME|INSERT_/i;

function isValidValue(value: string): boolean {
  return value.length > 0 && !PLACEHOLDER_PATTERNS.test(value);
}

const firebaseConfig = {
  apiKey: isValidValue(rawApiKey) ? rawApiKey : '',
  authDomain: isValidValue(rawAuthDomain) ? rawAuthDomain : '',
  projectId: isValidValue(rawProjectId) ? rawProjectId : '',
  storageBucket: isValidValue(rawStorageBucket) ? rawStorageBucket : '',
  messagingSenderId: isValidValue(rawMessagingSenderId) ? rawMessagingSenderId : '',
  appId: isValidValue(rawAppId) ? rawAppId : '',
};

// ─── Configuration diagnostics ─────────────────────────────────────

interface ConfigStatus {
  isReady: boolean;
  apiKey: string;
  authDomain: string;
  projectId: string;
  missing: string[];
  placeholders: string[];
}

export function getFirebaseConfigStatus(): ConfigStatus {
  const status: ConfigStatus = {
    isReady: false,
    apiKey: firebaseConfig.apiKey ? '***set***' : 'MISSING',
    authDomain: firebaseConfig.authDomain || 'MISSING',
    projectId: firebaseConfig.projectId || 'MISSING',
    missing: [],
    placeholders: [],
  };

  const checks = [
    { key: 'apiKey', label: 'EXPO_PUBLIC_FIREBASE_API_KEY', raw: rawApiKey },
    { key: 'authDomain', label: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', raw: rawAuthDomain },
    { key: 'projectId', label: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', raw: rawProjectId },
    { key: 'appId', label: 'EXPO_PUBLIC_FIREBASE_APP_ID', raw: rawAppId },
  ];

  for (const check of checks) {
    if (!check.raw || check.raw.length === 0) {
      status.missing.push(check.label);
    } else if (PLACEHOLDER_PATTERNS.test(check.raw)) {
      status.placeholders.push(check.label);
    }
  }

  status.isReady = status.missing.length === 0 && status.placeholders.length === 0;
  return status;
}

export const isFirebaseConfigured = (): boolean => {
  return getFirebaseConfigStatus().isReady;
};

// ─── Temporary runtime diagnostics ─────────────────────────────────

const status = getFirebaseConfigStatus();
if (status.isReady) {
  console.log('[FirebaseConfig] All Firebase environment variables loaded successfully');
} else {
  if (status.missing.length > 0) {
    console.warn('[FirebaseConfig] MISSING env vars:', status.missing.join(', '));
  }
  if (status.placeholders.length > 0) {
    console.warn(
      '[FirebaseConfig] PLACEHOLDER values detected in:',
      status.placeholders.join(', '),
      '→ Replace them with real values from Firebase Console → Project Settings → Your apps → Web'
    );
  }
}

// ─── Comprehensive runtime diagnostics ─────────────────────────────
// Call this on app startup to verify the ACTUAL Firebase project connected.

export function printFirebaseDiagnostics(): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         FIREBASE RUNTIME DIAGNOSTICS                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const status = getFirebaseConfigStatus();
  console.log('Config status.isReady:', status.isReady);
  console.log('Config status.missing:', status.missing);
  console.log('Config status.placeholders:', status.placeholders);
  console.log('');

  if (!isFirebaseConfigured()) {
    console.warn('[FirebaseDiagnostics] Firebase is NOT configured. Cannot print app config.');
    console.warn('[FirebaseDiagnostics] Check .env file: EXPO_PUBLIC_FIREBASE_* variables');
    return;
  }

  try {
    const activeApp = getFirebaseApp();
    const opts = activeApp.options;
    console.log('[FirebaseDiagnostics] === ACTIVE FIREBASE APP ===');
    console.log('  app.name:', activeApp.name);
    console.log('  projectId:', opts.projectId);
    console.log('  authDomain:', opts.authDomain);
    console.log('  apiKey:', opts.apiKey ? opts.apiKey.substring(0, 8) + '...***' : 'MISSING');
    console.log('  appId:', opts.appId ? opts.appId.substring(0, 16) + '...' : 'MISSING');
    console.log('  storageBucket:', opts.storageBucket || 'MISSING');
    console.log('  messagingSenderId:', opts.messagingSenderId || 'MISSING');
    console.log('');
    console.log('[FirebaseDiagnostics] If projectId is NOT the one you see in Firebase Console,');
    console.log('  your .env file is pointing to the WRONG Firebase project.');
    console.log('  Fix: copy values from Firebase Console → Project Settings → General → Your apps → Web');
    console.log('');
  } catch (e: any) {
    console.error('[FirebaseDiagnostics] Failed to get Firebase app:', e.message);
  }
}

// ─── Auth diagnostics: test fetchSignInMethodsForEmail at startup ──
// This runs once on app startup to prove which auth backend is active.

export async function runFirebaseAuthDiagnostics(testEmail: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    console.warn('[FirebaseAuthDiagnostics] Skipping — Firebase not configured');
    return;
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         FIREBASE AUTH DIAGNOSTICS                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[FirebaseAuthDiagnostics] Testing email: ${testEmail}`);
  console.log('[FirebaseAuthDiagnostics] NOTE: If Email Enumeration Protection is enabled,');
  console.log('  fetchSignInMethodsForEmail returns [] for ALL emails (registered or not).');
  console.log('  This is a Firebase security feature, NOT a bug or wrong project.');
  console.log('  Check: Firebase Console → Authentication → Settings → User actions → Email Enumeration Protection');
  console.log('');

  try {
    const activeApp = getFirebaseApp();
    const auth = getAuth(activeApp);
    console.log('[FirebaseAuthDiagnostics] Auth instance currentUser:', auth.currentUser ? auth.currentUser.email : 'null');
    console.log('[FirebaseAuthDiagnostics] Auth instance app.name:', auth.app.name);

    const methods = await fetchSignInMethodsForEmail(auth, testEmail);
    console.log('[FirebaseAuthDiagnostics] fetchSignInMethodsForEmail result:', methods);
    console.log('[FirebaseAuthDiagnostics] Sign-in methods detected:', methods.length > 0 ? methods.join(', ') : 'NONE (empty array)');

    if (methods.length === 0) {
      console.warn('[FirebaseAuthDiagnostics] ⚠️  Empty sign-in methods array.');
      console.warn('  Possible causes:');
      console.warn('  1. Email Enumeration Protection is enabled (most likely)');
      console.warn('  2. The user was created with social login (Google/Apple) without Email/Password');
      console.warn('  3. The user exists in a DIFFERENT Firebase project');
      console.warn('  4. The email was never registered');
    } else {
      console.log('[FirebaseAuthDiagnostics] ✅ Sign-in methods found:', methods);
    }
  } catch (error: any) {
    console.error('[FirebaseAuthDiagnostics] fetchSignInMethodsForEmail ERROR:', error.code, error.message);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         END FIREBASE DIAGNOSTICS                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

// ─── Lazy initialization ───────────────────────────────────────────

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export const getFirebaseApp = (): FirebaseApp => {
  if (!isFirebaseConfigured()) {
    const diag = getFirebaseConfigStatus();
    let message = 'Firebase is not configured.';
    if (diag.missing.length > 0) {
      message += ` Missing: ${diag.missing.join(', ')}.`;
    }
    if (diag.placeholders.length > 0) {
      message += ` Placeholders found in: ${diag.placeholders.join(', ')}. `;
      message += 'Replace YOUR_* placeholder values in .env with real Firebase config values.';
    }
    throw new Error(message);
  }

  if (!app) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('[FirebaseInit] Firebase app initialized. projectId:', app.options.projectId);
    } else {
      app = getApps()[0];
      console.log('[FirebaseInit] Reusing existing Firebase app. projectId:', app.options.projectId);
    }
  }
  return app;
};

export const getFirestoreDb = (): Firestore => {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
};

// ─── Firebase Console Auto-Checklist (client-side diagnostics) ───
// This logs what we CAN verify automatically and what must be checked manually.

export function printFirebaseConsoleChecklist(): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  FIREBASE CONSOLE VERIFICATION CHECKLIST                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const status = getFirebaseConfigStatus();

  // Auto-verified (from .env)
  console.log('─── AUTO-VERIFIED (from .env) ───');
  console.log(`  projectId:        ${status.projectId}`);
  console.log(`  authDomain:       ${status.authDomain}`);
  console.log(`  apiKey:           ${status.apiKey}`);
  console.log(`  config ready:     ${status.isReady ? '✅' : '❌'}`);
  console.log('');

  // Manual checks (no client-side API for these)
  console.log('─── MANUAL CHECKS (Firebase Console) ───');
  console.log('  ☐ 1. Authentication → Sign-in method → Email/Password = ENABLED');
  console.log('  ☐ 2. Authentication → Users → Your test email EXISTS');
  console.log('     (If missing, reset emails are SILENTLY dropped by Firebase)');
  console.log('  ☐ 3. Authentication → Templates → Password reset = ENABLED');
  console.log('  ☐ 4. Authentication → Settings → Authorized domains includes:');
  console.log('       • marketplace-app-3b3f7.firebaseapp.com');
  console.log('       • marketplace-app-3b3f7.web.app');
  console.log('       • localhost');
  console.log('');

  // Gmail troubleshooting
  console.log('─── GMAIL DELIVERY TROUBLESHOOTING ───');
  console.log('  1. Search Gmail Inbox, Spam, and Promotions for:');
  console.log('     • "Firebase"');
  console.log('     • "reset password"');
  console.log('     • "noreply@marketplace-app-3b3f7.firebaseapp.com"');
  console.log('');
  console.log('  2. Whitelist the sender:');
  console.log('     • Add noreply@marketplace-app-3b3f7.firebaseapp.com to contacts');
  console.log('     • Create a Gmail filter: from:noreply@marketplace-app-3b3f7.firebaseapp.com → Never send to Spam');
  console.log('');
  console.log('  3. Test with another email provider:');
  console.log('     • Create a test Gmail account and register it in Firebase Auth');
  console.log('     • Or try Outlook / Yahoo to rule out Gmail-specific filtering');
  console.log('');
  console.log('  4. Simplify the email template (Firebase Console):');
  console.log('     • Subject: "Reset your Marketplace password" (no ALL CAPS, no !!!)');
  console.log('     • Body: plain text, no spam trigger words (FREE, URGENT, ACT NOW, WINNER)');
  console.log('     • Include only: greeting, one sentence, %LINK%, footer');
  console.log('');
  console.log('  5. Check corporate / school email restrictions:');
  console.log('     • Some domains block all emails from @firebaseapp.com');
  console.log('     • Corporate firewalls may quarantine unknown senders');
  console.log('');
  console.log('  6. If all above fail → use Admin SDK fallback:');
  console.log('     • npm run test:reset-link  (generates a direct reset link)');
  console.log('     • Send the link via your own email provider (SendGrid, Resend, AWS SES)');
  console.log('');
}
