/**
 * creatorService.ts
 *
 * All reads / writes for creator profiles go through this module.
 *
 * When Firebase is not configured (local dev without .env), every read falls
 * back to the seed data in constants/creators.ts so the app stays functional.
 *
 * "Real" creators are documents in the `creators` Firestore collection,
 * created during creator onboarding (apply-creator flow + admin approval).
 *
 * Key rule: seed creators are NEVER presented as verified platform members.
 * The `isDemo` flag on every Creator record gates the UI disclaimer.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';
import { CREATORS } from '../constants/creators';
import type { Creator } from '../constants/creators';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECTION = 'creators';

// ─── Application payload ─────────────────────────────────────────────────────

export interface CreatorApplicationPayload {
  /** Applicant's full name */
  name: string;
  /** Short bio (max ~300 chars) */
  bio: string;
  instagram?: string;
  youtube?: string;
  website?: string;
  /** Why the applicant wants to be a creator on this platform */
  motivation: string;
  /** User's Firebase Auth UID (set by the service, not the form) */
  applicantUid: string;
  /** Applicant's email, for follow-up */
  email: string;
}

// ─── Creator reads ────────────────────────────────────────────────────────────

/**
 * Returns all approved real creators from Firestore.
 *
 * Strategy:
 *  1. Firebase not configured → return seed creators (all isDemo: true)
 *  2. Firestore has 0 approved creators → return seed creators as fallback
 *  3. Otherwise → return only real creators (seed data suppressed)
 *
 * This means the Discover screen always has content, even before
 * any real creator has been approved.
 */
export async function getApprovedCreators(): Promise<Creator[]> {
  if (!isFirebaseConfigured()) {
    return [...CREATORS];
  }

  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'approved'),
      orderBy('approvedAt', 'desc')
    );
    const snap = await getDocs(q);
    const live: Creator[] = snap.docs.map(
      (d) => ({ id: d.id, ...d.data(), isDemo: false } as Creator)
    );

    if (live.length === 0) {
      // No real creators yet — show seed data
      return [...CREATORS];
    }

    return live;
  } catch {
    return [...CREATORS];
  }
}

/**
 * Returns a single creator by ID.
 * Checks Firestore first, falls back to seed data.
 */
export async function getCreatorById(id: string): Promise<Creator | null> {
  if (!isFirebaseConfigured()) {
    return CREATORS.find((c) => c.id === id) ?? null;
  }

  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data(), isDemo: false } as Creator;
    }
  } catch {
    // fall through to seed lookup
  }

  return CREATORS.find((c) => c.id === id) ?? null;
}

/**
 * Returns true if Firestore has at least one approved real creator.
 * Used to decide whether to show the "Creators joining soon" empty state.
 */
export async function hasRealCreators(): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'approved')
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}

// ─── Creator application write ────────────────────────────────────────────────

/**
 * Submits a creator application to Firestore.
 * Applications start with status='pending' and are reviewed before approval.
 *
 * @returns The new Firestore document ID.
 */
export async function submitCreatorApplication(
  payload: CreatorApplicationPayload
): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Cannot submit application.'
    );
  }

  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, 'creator_applications'), {
    ...payload,
    status: 'pending',
    isDemo: false,
    rating: 0,
    followers: 0,
    totalJourneys: 0,
    submittedAt: serverTimestamp(),
  });
  return ref.id;
}
