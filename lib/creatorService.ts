/**
 * creatorService.ts
 *
 * All reads / writes for creator profiles go through this module.
 *
 * Firestore collections:
 *   creators — active creator profiles
 *              Any user can become a creator by calling activateCreator().
 *              Having a document here is the authoritative gate for all creator features.
 *
 * Creator plans (no payments yet — model only):
 *   free  — max 3 published experiences
 *   pro   — unlimited published experiences
 *   elite — unlimited published experiences
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
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirestoreDb, isFirebaseConfigured, getFirebaseApp } from './firebase';
import { CREATORS } from '../constants/creators';
import type { Creator } from '../constants/creators';
import type {
  CreatorSubscription,
} from './creatorTypes';
import { DEFAULT_CREATOR_SUBSCRIPTION } from './creatorTypes';

// Re-export canonical types so screens only need to import from this module
export type {
  CreatorType,
  CreatorStatus,
  CreatorSubscriptionPlan,
  CreatorSubscription,
  FirestoreCreator,
  FirestoreCreatorPayload,
} from './creatorTypes';
export {
  CREATOR_SUBSCRIPTION_LIMITS,
  DEFAULT_CREATOR_SUBSCRIPTION,
} from './creatorTypes';

// ─── Collection names ─────────────────────────────────────────────────────────

/** Firestore collection for creator profiles (all active creators) */
const CREATORS_COLLECTION = 'creators';
const CREATOR_FOLLOWERS_SUBCOLLECTION = 'followers';

// ─── Creator plan constants ───────────────────────────────────────────────────

/** Maximum number of experiences a free-plan creator can publish */
export const FREE_PUBLISH_LIMIT = 3;

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
  const followersCount = Number(data.followersCount ?? data.followers ?? 0);
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
    followers: Number.isFinite(followersCount) ? followersCount : 0,
    totalJourneys: (data.totalJourneys as number | undefined) ?? 0,
    creatorType: (data.creatorType as Creator['creatorType']) ?? 'community',
    creatorSubscription: data.creatorSubscription as CreatorSubscription | undefined,
    creatorEnabled: (data.creatorEnabled as boolean | undefined) ?? true,
    creatorPlan: (data.creatorPlan as Creator['creatorPlan']) ?? 'free',
    publishedExperiencesCount: (data.publishedExperiencesCount as number | undefined) ?? 0,
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

export function subscribeApprovedCreators(
  onChange: (creators: Creator[]) => void,
  onError?: () => void,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    onChange([...CREATORS]);
    return () => {};
  }

  const db = getFirestoreDb();
  const q = query(
    collection(db, CREATORS_COLLECTION),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onChange([...CREATORS]);
        return;
      }
      onChange(snap.docs.map((d) => mapFirestoreCreator(d.id, d.data() as Record<string, unknown>)));
    },
    () => {
      onError?.();
    }
  );
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

export function subscribeCreatorById(
  id: string,
  onChange: (creator: Creator | null) => void,
  onError?: () => void,
): Unsubscribe {
  if (!isFirebaseConfigured() || !id) {
    onChange(CREATORS.find((c) => c.id === id) ?? null);
    return () => {};
  }

  const db = getFirestoreDb();
  const ref = doc(db, CREATORS_COLLECTION, id);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(mapFirestoreCreator(snap.id, snap.data() as Record<string, unknown>));
    },
    () => {
      onError?.();
    }
  );
}

export async function isFollowingCreator(creatorId: string, followerUserId: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !creatorId || !followerUserId) return false;
  try {
    const db = getFirestoreDb();
    const followRef = doc(db, CREATORS_COLLECTION, creatorId, CREATOR_FOLLOWERS_SUBCOLLECTION, followerUserId);
    const followSnap = await getDoc(followRef);
    return followSnap.exists();
  } catch {
    return false;
  }
}

export async function followCreator(creatorId: string, followerUserId: string): Promise<number> {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured.');
  if (!creatorId || !followerUserId) throw new Error('Missing creator or follower ID.');
  if (creatorId === followerUserId) throw new Error('You cannot follow yourself.');

  const db = getFirestoreDb();
  const creatorRef = doc(db, CREATORS_COLLECTION, creatorId);
  const followRef = doc(db, CREATORS_COLLECTION, creatorId, CREATOR_FOLLOWERS_SUBCOLLECTION, followerUserId);

  return runTransaction(db, async (tx) => {
    const creatorSnap = await tx.get(creatorRef);
    if (!creatorSnap.exists()) {
      throw new Error('Creator not found.');
    }

    const followSnap = await tx.get(followRef);
    const creatorData = creatorSnap.data() as Record<string, unknown>;
    const current = Math.max(0, Number(creatorData.followersCount ?? creatorData.followers ?? 0));

    if (followSnap.exists()) {
      return current;
    }

    const next = current + 1;
    tx.set(followRef, {
      creatorId,
      followerUserId,
      createdAt: serverTimestamp(),
    });
    tx.update(creatorRef, {
      followers: next,
      followersCount: next,
      updatedAt: serverTimestamp(),
    });

    return next;
  });
}

export async function unfollowCreator(creatorId: string, followerUserId: string): Promise<number> {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured.');
  if (!creatorId || !followerUserId) throw new Error('Missing creator or follower ID.');
  if (creatorId === followerUserId) throw new Error('You cannot unfollow yourself.');

  const db = getFirestoreDb();
  const creatorRef = doc(db, CREATORS_COLLECTION, creatorId);
  const followRef = doc(db, CREATORS_COLLECTION, creatorId, CREATOR_FOLLOWERS_SUBCOLLECTION, followerUserId);

  return runTransaction(db, async (tx) => {
    const creatorSnap = await tx.get(creatorRef);
    if (!creatorSnap.exists()) {
      throw new Error('Creator not found.');
    }

    const followSnap = await tx.get(followRef);
    const creatorData = creatorSnap.data() as Record<string, unknown>;
    const current = Math.max(0, Number(creatorData.followersCount ?? creatorData.followers ?? 0));

    if (!followSnap.exists()) {
      return current;
    }

    const next = Math.max(0, current - 1);
    tx.delete(followRef);
    tx.update(creatorRef, {
      followers: next,
      followersCount: next,
      updatedAt: serverTimestamp(),
    });

    return next;
  });
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

// ─── My creator profile ───────────────────────────────────────────────────────

/**
 * Returns the creator profile for this UID, or null if not a creator.
 *
 * Uses a direct doc lookup (O(1)) since creator docs use the auth UID as their ID.
 * Falls back to a query for backward compat with pre-migration creator docs.
 */
export async function getMyApprovedCreatorProfile(uid: string): Promise<Creator | null> {
  if (!isFirebaseConfigured() || !uid) return null;
  try {
    const db = getFirestoreDb();
    console.log('[CreatorAuth] checking creators collection for uid:', uid);
    // Direct O(1) lookup — all new/provisioned creators use UID as doc ID
    const directSnap = await getDoc(doc(db, CREATORS_COLLECTION, uid));
    if (directSnap.exists()) {
      const data = directSnap.data() as Record<string, unknown>;
      // creatorEnabled defaults to true when field is absent (legacy docs)
      if (data.creatorEnabled !== false) {
        console.log('[CreatorAuth] creator profile found → dashboard access: granted');
        return mapFirestoreCreator(directSnap.id, data);
      }
    }
    // Fallback query for any legacy creator docs not using UID as doc ID
    const q = query(collection(db, CREATORS_COLLECTION), where('userId', '==', uid), limit(1));
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      const d = qSnap.docs[0];
      const data = d.data() as Record<string, unknown>;
      if (data.creatorEnabled !== false) {
        console.log('[CreatorAuth] creator profile found (legacy query):', d.id, '→ granted');
        return mapFirestoreCreator(d.id, data);
      }
    }
  } catch {
    // fall through
  }
  console.log('[CreatorAuth] no creator profile found for uid:', uid);
  return null;
}

/**
 * Activates the signed-in user as a creator (open model — no approval required).
 *
 * Creates a `creators/{uid}` document with plan=free and publishedExperiencesCount=0.
 * Safe to call when user is already a creator — returns the existing profile.
 *
 * Email verification is the only prerequisite (enforced at the UI layer).
 */
export async function activateCreator(uid: string, displayName: string): Promise<Creator> {
  console.log('[CreatorService:activate] activateCreator called — uid:', uid, '| displayName:', displayName || '(empty)');
  if (!isFirebaseConfigured()) {
    console.error('[CreatorService:activate] Firebase is not configured');
    throw new Error('Firebase is not configured.');
  }
  if (!uid) {
    console.error('[CreatorService:activate] uid is empty');
    throw new Error('Firebase is not configured.');
  }

  // Idempotency — if already a creator, return existing profile
  console.log('[CreatorService:activate] Checking for existing creator profile...');
  const existing = await getMyApprovedCreatorProfile(uid);
  if (existing) {
    console.log('[CreatorService:activate] Already a creator — returning existing profile:', existing.name);
    return existing;
  }
  console.log('[CreatorService:activate] No existing profile found — creating new creator doc...');

  const db = getFirestoreDb();
  const creatorDocRef = doc(db, CREATORS_COLLECTION, uid);
  const payload = {
    userId: uid,
    displayName: displayName.trim() || 'Creator',
    bio: '',
    creatorEnabled: true,
    creatorPlan: 'free' as const,
    publishedExperiencesCount: 0,
    creatorType: 'community' as const,
    creatorSubscription: DEFAULT_CREATOR_SUBSCRIPTION,
    rating: 0,
    followers: 0,
    followersCount: 0,
    totalJourneys: 0,
    createdAt: serverTimestamp(),
  };
  await setDoc(creatorDocRef, payload);
  console.log('[CreatorService:activate] setDoc succeeded — creator doc written for uid:', uid);

  return mapFirestoreCreator(uid, { ...payload, createdAt: null });
}

/**
 * Returns whether this creator can publish another experience.
 *
 * Free plan: max FREE_PUBLISH_LIMIT published experiences.
 * Pro / Elite: unlimited.
 */
export async function canPublishExperience(uid: string): Promise<{ allowed: boolean; reason?: string }> {
  const profile = await getMyApprovedCreatorProfile(uid);
  if (!profile) {
    return { allowed: false, reason: 'You must activate your creator account before publishing.' };
  }
  const plan = profile.creatorPlan ?? 'free';
  if (plan !== 'free') return { allowed: true };
  const count = profile.publishedExperiencesCount ?? 0;
  if (count >= FREE_PUBLISH_LIMIT) {
    return {
      allowed: false,
      reason: `You have reached your free creator limit of ${FREE_PUBLISH_LIMIT} published experiences. Upgrade your plan to publish more.`,
    };
  }
  return { allowed: true };
}

/**
 * Returns true if the creator has not exceeded their plan's journey limit.
 */
export async function canPublishJourney(uid: string): Promise<boolean> {
  const profile = await getMyApprovedCreatorProfile(uid);
  if (!profile) return false;
  const plan = profile.creatorPlan ?? 'free';
  if (plan !== 'free') return true; // pro / elite — unlimited
  const count = profile.publishedExperiencesCount ?? 0;
  return count < FREE_PUBLISH_LIMIT;
}
