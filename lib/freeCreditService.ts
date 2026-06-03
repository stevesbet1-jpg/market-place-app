/**
 * freeCreditService.ts  (P2.6)
 *
 * Server-side free credit enforcement via Firestore.
 *
 * Authenticated users:
 *   - Credits stored in `users/{uid}.freeCredits` (number field, default 3)
 *   - Decrements via Firestore transaction — survives reinstall / device swap
 *   - AsyncStorage continues to be updated for instant UI feedback
 *
 * Unauthenticated users:
 *   - Fall back to the existing AsyncStorage-only flow (unchanged behaviour)
 *
 * Calling conventions mirror the existing experienceStore helpers so
 * experience-detail.tsx only needs minor changes.
 */

import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirestoreDb, getFirebaseApp, isFirebaseConfigured } from './firebase';
import {
  FREE_EXPERIENCE_LIMIT,
  getFreeExperienceRemaining,
  consumeFreeExperience as consumeLocal,
  isExperienceUnlocked,
} from '../constants/experienceStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the current user uid or null. */
function currentUid(): string | null {
  try {
    return getAuth(getFirebaseApp()).currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns remaining free credits.
 *
 * For authenticated users: reads from Firestore (source of truth).
 * For unauthenticated users: reads from AsyncStorage.
 */
export async function getFreeCreditCount(): Promise<number> {
  const uid = currentUid();
  if (!uid || !isFirebaseConfigured()) {
    return getFreeExperienceRemaining();
  }
  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return FREE_EXPERIENCE_LIMIT;
    const data = snap.data() as Record<string, unknown>;
    const stored = data.freeCredits;
    if (typeof stored === 'number') return Math.max(0, stored);
    return FREE_EXPERIENCE_LIMIT;
  } catch {
    return getFreeExperienceRemaining();
  }
}

/**
 * Atomically consume one free credit for an experience.
 *
 * - If the experience is already unlocked (locally), no credit is spent.
 * - For authenticated users: Firestore transaction decrements `freeCredits`
 *   and appends to `unlockedExperienceIds` array.  AsyncStorage is also updated.
 * - For unauthenticated users: delegates entirely to the existing local store.
 *
 * Returns the updated remaining credit count.
 * Throws if the user has no credits remaining.
 */
export async function consumeCredit(experienceId: string): Promise<number> {
  const uid = currentUid();

  // Already unlocked — no credit needed
  if (await isExperienceUnlocked(experienceId)) {
    return getFreeCreditCount();
  }

  if (!uid || !isFirebaseConfigured()) {
    // Unauthenticated path — use local store only
    return consumeLocal(experienceId);
  }

  try {
    const db = getFirestoreDb();
    const userRef = doc(db, 'users', uid);

    let newRemaining = 0;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      let current: number;
      if (!snap.exists()) {
        current = FREE_EXPERIENCE_LIMIT;
      } else {
        const data = snap.data() as Record<string, unknown>;
        current = typeof data.freeCredits === 'number' ? data.freeCredits : FREE_EXPERIENCE_LIMIT;
      }

      if (current <= 0) {
        throw new Error('NO_CREDITS');
      }

      newRemaining = current - 1;

      // Build updated unlocked list
      const unlocked: string[] = snap.exists()
        ? ((snap.data() as Record<string, unknown>).unlockedExperienceIds as string[] | undefined ?? [])
        : [];

      if (!unlocked.includes(experienceId)) {
        unlocked.push(experienceId);
      }

      if (!snap.exists()) {
        tx.set(userRef, {
          uid,
          freeCredits: newRemaining,
          unlockedExperienceIds: unlocked,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(userRef, {
          freeCredits: newRemaining,
          unlockedExperienceIds: unlocked,
          updatedAt: serverTimestamp(),
        });
      }
    });

    // Mirror to AsyncStorage for instant local reads
    await consumeLocal(experienceId).catch(() => {});

    return newRemaining;
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_CREDITS') {
      throw new Error('No free credits remaining.');
    }
    // Firestore failed — fall back to local store so user isn't blocked
    return consumeLocal(experienceId);
  }
}
