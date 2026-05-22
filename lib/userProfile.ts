import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  FieldValue,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';

// ─── Types ─────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string | null;
  fullName: string | null;
  photoURL: string | null;
  provider: 'email' | 'google' | 'apple' | 'guest';
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
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
