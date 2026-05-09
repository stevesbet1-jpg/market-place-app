import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

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
    } else {
      app = getApps()[0];
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
