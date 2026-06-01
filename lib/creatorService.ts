/**
 * creatorService.ts
 *
 * All reads / writes for creator profiles and applications go through this module.
 *
 * Firestore collections:
 *   creatorApplications — submitted applications (status: pending/approved/rejected)
 *   creators            — approved creator profiles (having a doc here = approved)
 *
 * When Firebase is not configured, every read falls back to the seed data in
 * constants/creators.ts so the app stays functional during local development.
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
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirestoreDb, isFirebaseConfigured, getFirebaseApp } from './firebase';
import { CREATORS } from '../constants/creators';
import type { Creator } from '../constants/creators';
import type {
  CreatorApplicationPayload,
  CreatorSubscription,
} from './creatorTypes';

// Re-export canonical types so screens only need to import from this module
export type {
  CreatorType,
  CreatorStatus,
  CreatorSubscriptionPlan,
  CreatorSubscription,
  CreatorApplication,
  CreatorApplicationPayload,
  FirestoreCreator,
  FirestoreCreatorPayload,
} from './creatorTypes';
export {
  CREATOR_SUBSCRIPTION_LIMITS,
  DEFAULT_CREATOR_SUBSCRIPTION,
} from './creatorTypes';

// ─── Collection names ─────────────────────────────────────────────────────────

/** Firestore collection for creator applications */
const APPLICATIONS_COLLECTION = 'creatorApplications';

/** Firestore collection for approved creator profiles */
const CREATORS_COLLECTION = 'creators';

// ─── ApplicationStatus ────────────────────────────────────────────────────────

/**
 * Convenience alias that adds 'none' (no application found) to CreatorStatus.
 * Used only at the service boundary — not stored in Firestore.
 */
export type ApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the Firebase Auth UID of the currently signed-in user, or null.
 */
export function getCurrentUid(): string | null {
  if (!isFirebaseConfigured()) return null;
  try {
    const auth = getAuth(getFirebaseApp());
    return auth.currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/**
 * Derives two-letter initials from a display name.
 * "Sophia Chen" → "SC", "Marco" → "MA"
 */
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Maps a raw Firestore creator document to the UI Creator type.
 * Handles the displayName → name mapping and fills computed fields.
 */
function mapFirestoreCreator(docId: string, data: Record<string, unknown>): Creator {
  const displayName = (data.displayName as string | undefined) ?? (data.name as string | undefined) ?? '';
  return {
    id: docId,
    name: displayName,
    initials: (data.initials as string | undefined) ?? deriveInitials(displayName),
    bio: (data.bio as string | undefined) ?? '',
    avatar: data.avatar as string | undefined,
    instagram: data.instagram as string | undefined,
    youtube: data.youtube as string | undefined,
    tiktok: data.tiktok as string | undefined,
    website: data.website as string | undefined,
    rating: (data.rating as number | undefined) ?? 0,
    followers: (data.followers as number | undefined) ?? 0,
    totalJourneys: (data.totalJourneys as number | undefined) ?? 0,
    creatorType: (data.creatorType as Creator['creatorType']) ?? 'community',
    creatorSubscription: data.creatorSubscription as CreatorSubscription | undefined,
    userId: data.userId as string | undefined,
    isDemo: false,
  };
}

// ─── Creator reads ────────────────────────────────────────────────────────────

/**
 * Returns all approved creators from Firestore.
 *
 * Strategy:
 *  1. Firebase not configured → seed creators (all isDemo: true)
 *  2. Firestore `creators` collection is empty → seed fallback
 *  3. Otherwise → Firestore creators only (seed suppressed)
 *
 * The `creators` collection stores ONLY approved creators — no status filter needed.
 */
export async function getApprovedCreators(): Promise<Creator[]> {
  if (!isFirebaseConfigured()) {
    return [...CREATORS];
  }

  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, CREATORS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return [...CREATORS]; // fallback to seed data
    }
    return snap.docs.map((d) => mapFirestoreCreator(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [...CREATORS];
  }
}

/**
 * Returns a single creator by Firestore document ID.
 * Checks Firestore first, falls back to seed data.
 */
export async function getCreatorById(id: string): Promise<Creator | null> {
  if (!isFirebaseConfigured()) {
    return CREATORS.find((c) => c.id === id) ?? null;
  }

  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, CREATORS_COLLECTION, id));
    if (snap.exists()) {
      return mapFirestoreCreator(snap.id, snap.data() as Record<string, unknown>);
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
    const q = query(collection(db, CREATORS_COLLECTION), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}

// ─── Application reads ────────────────────────────────────────────────────────

/**
 * Application document as returned by the service layer.
 * `applicationId` is the Firestore document ID.
 */
export interface CreatorApplicationDoc {
  applicationId: string;
  userId: string;
  fullName: string;
  email: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
  travelExperience: string;
  countriesVisited?: string;
  travelStyle?: string;
  motivation: string;
  status: ApplicationStatus;
  createdAt: unknown;
  reviewedAt?: unknown;
}

/**
 * Returns the most recent creator application for this UID.
 * Returns null if the user has never applied or Firebase is not configured.
 */
export async function getMyApplication(uid: string): Promise<CreatorApplicationDoc | null> {
  if (!isFirebaseConfigured() || !uid) return null;

  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, APPLICATIONS_COLLECTION),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { applicationId: d.id, ...d.data() } as CreatorApplicationDoc;
  } catch {
    return null;
  }
}

/**
 * Returns the application status for this UID:
 *   'none'     — no application found
 *   'pending'  — submitted, awaiting review
 *   'approved' — approved (creator doc also exists in creators collection)
 *   'rejected' — not accepted
 */
export async function getMyApplicationStatus(uid: string): Promise<ApplicationStatus> {
  const app = await getMyApplication(uid);
  return (app?.status as ApplicationStatus) ?? 'none';
}

/**
 * Private helper — auto-provisions a `creators` doc from an approved application.
 *
 * Called by getMyApprovedCreatorProfile when no creators doc exists for the UID.
 * Uses the auth UID as the Firestore doc ID so that creator.id === auth UID,
 * which matches the `creatorId` field stored on experience documents.
 */
async function provisionCreatorFromApplication(uid: string): Promise<Creator | null> {
  try {
    const db = getFirestoreDb();

    console.log('[CreatorAuth] no creators doc found for uid:', uid, '— checking applications');

    const appQ = query(
      collection(db, APPLICATIONS_COLLECTION),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const appSnap = await getDocs(appQ);

    if (appSnap.empty) {
      console.log('[CreatorAuth] no application found for uid:', uid);
      return null;
    }

    const appDoc = appSnap.docs[0];
    const appData = appDoc.data() as Record<string, unknown>;
    console.log('[CreatorAuth] application found:', appDoc.id, '| status:', appData.status);

    if (appData.status !== 'approved') {
      console.log('[CreatorAuth] application not approved — access denied');
      return null;
    }

    // Provision using auth UID as doc ID so creator.id === creatorId in experiences
    console.log('[CreatorAuth] provisioning creators doc for uid:', uid);
    const creatorDocRef = doc(db, CREATORS_COLLECTION, uid);
    const payload = {
      userId: uid,
      displayName: (appData.fullName as string) ?? '',
      bio: '',
      instagram: (appData.instagram as string | undefined) ?? null,
      youtube: (appData.youtube as string | undefined) ?? null,
      tiktok: (appData.tiktok as string | undefined) ?? null,
      website: (appData.website as string | undefined) ?? null,
      rating: 0,
      followers: 0,
      totalJourneys: 0,
      creatorType: 'community' as const,
      createdAt: serverTimestamp(),
    };
    await setDoc(creatorDocRef, payload);
    console.log('[CreatorAuth] creators doc provisioned at id:', uid);

    return mapFirestoreCreator(uid, { ...payload, createdAt: null });
  } catch (e) {
    console.warn('[CreatorAuth] provision error:', e);
    return null;
  }
}

/**
 * Returns the approved Creator profile for this UID, or null.
 *
 * The `creators` collection stores only approved creators.
 * A document existing here is the authoritative gate for journey uploads.
 *
 * If no creators doc is found, checks creatorApplications for an approved
 * status and auto-provisions a creators doc so the user can immediately
 * access their dashboard without a manual Firestore step.
 */
export async function getMyApprovedCreatorProfile(uid: string): Promise<Creator | null> {
  if (!isFirebaseConfigured() || !uid) return null;

  try {
    const db = getFirestoreDb();
    console.log('[CreatorAuth] checking creators collection for uid:', uid);
    const q = query(
      collection(db, CREATORS_COLLECTION),
      where('userId', '==', uid),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      console.log('[CreatorAuth] creator profile found:', d.id, '→ dashboard access: granted');
      return mapFirestoreCreator(d.id, d.data() as Record<string, unknown>);
    }
  } catch {
    // fall through to provision attempt
  }

  // Not in creators collection — try to provision from an approved application
  return provisionCreatorFromApplication(uid);
}

/**
 * Returns true if the given UID belongs to an approved creator who can
 * publish journeys, and has not exceeded their plan's journey limit.
 */
export async function canPublishJourney(uid: string): Promise<boolean> {
  const profile = await getMyApprovedCreatorProfile(uid);
  if (!profile) return false;

  const sub = profile.creatorSubscription;
  if (!sub) return true; // no subscription info — assume allowed

  const { journeyLimit, journeysUsed } = sub;
  if (journeyLimit === null) return true; // pro plan — unlimited
  return journeysUsed < journeyLimit;
}

// ─── Creator application write ────────────────────────────────────────────────

/**
 * Submits a creator application to Firestore.
 *
 * Idempotency: if the user already has any application on file (regardless of
 * status), returns the existing document ID without creating a duplicate.
 *
 * Rejects anonymous submissions (userId must be a real Firebase Auth UID).
 *
 * @returns The Firestore document ID (new or existing).
 */
export async function submitCreatorApplication(
  payload: CreatorApplicationPayload
): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Cannot submit application.');
  }

  if (!payload.userId || payload.userId === 'pending-auth') {
    throw new Error('You must be signed in to apply as a creator.');
  }

  // Idempotency guard — prevent duplicate submissions
  const existing = await getMyApplication(payload.userId);
  if (existing) {
    return existing.applicationId;
  }

  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, APPLICATIONS_COLLECTION), {
    ...payload,
    status: 'pending' as const,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
