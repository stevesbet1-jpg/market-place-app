import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  FieldValue,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';
import type { MembershipRecord } from './membershipService';

// ─── Types ─────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string | null;
  fullName: string | null;
  photoURL: string | null;
  provider: 'email' | 'google' | 'apple' | 'guest';
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  /** Populated after the user purchases a membership (Phase 4: Stripe) */
  membership?: MembershipRecord;
}

export type UserProfileInput = Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>;

// ─── Upsert (idempotent create-or-update) ─────────────────────────

/**
 * Creates the user profile on first sign-up, or updates non-timestamp
 * fields on subsequent sign-ins. createdAt is only written once.
 */
export async function upsertUserProfile(
  uid: string,
  data: UserProfileInput
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    const db = getFirestoreDb();
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      // Preserve existing createdAt — only refresh updatedAt
      await setDoc(
        ref,
        { ...data, uid, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } else {
      // First time: write both timestamps
      await setDoc(ref, {
        ...data,
        uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e: any) {
    console.warn('[UserProfile] upsertUserProfile failed:', e.message);
  }
}

// ─── Read ──────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (e: any) {
    console.warn('[UserProfile] getUserProfile failed:', e.message);
    return null;
  }
}

// ─── Notification preferences ─────────────────────────────────────

export interface NotificationPrefs {
  newJourneys: boolean;   // notify when a creator publishes a new journey
  newExperiences: boolean; // notify when a creator publishes a new experience
  promotions: boolean;    // marketing / offer emails
  membershipAlerts: boolean; // membership renewal / expiry alerts
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newJourneys: true,
  newExperiences: true,
  promotions: false,
  membershipAlerts: true,
};

export async function getNotificationPrefs(uid: string): Promise<NotificationPrefs> {
  if (!isFirebaseConfigured()) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return DEFAULT_NOTIFICATION_PREFS;
    const data = snap.data() as Record<string, unknown>;
    return {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(data.notificationPrefs as Partial<NotificationPrefs> ?? {}),
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export async function saveNotificationPrefs(
  uid: string,
  prefs: NotificationPrefs
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    const db = getFirestoreDb();
    await setDoc(
      doc(db, 'users', uid),
      { notificationPrefs: prefs, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e: any) {
    console.warn('[UserProfile] saveNotificationPrefs failed:', e.message);
  }
}
