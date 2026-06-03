/**
 * creatorJourneyService.ts
 *
 * All reads / writes for creator journeys go through this module.
 *
 * When Firebase is not configured (local dev without .env), every read falls
 * back to the seed data in constants/journeys.ts so the app stays functional.
 * Writes throw a clear error so the UI can prompt the user to subscribe/configure.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';
import { JOURNEYS, mapSeedToCreatorJourney } from '../constants/journeys';
import type {
  CreatorJourney,
  JourneyUploadPayload,
} from '../constants/creatorJourneyModel';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECTION = 'creator_journeys';

// ─── Creator writes ───────────────────────────────────────────────────────────

/**
 * Publishes a new creator journey to Firestore.
 * Requires Firebase to be configured; throws otherwise.
 *
 * @returns The new Firestore document ID.
 */
export async function publishCreatorJourney(
  payload: JourneyUploadPayload
): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Please add your Firebase environment variables to publish journeys.'
    );
  }
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    rating: 0,
    savedCount: 0,
    status: 'published',
    isDemo: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Saves a journey as a draft (not yet visible to users).
 */
export async function saveDraftJourney(
  payload: JourneyUploadPayload
): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Cannot save draft.'
    );
  }
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    rating: 0,
    savedCount: 0,
    status: 'draft',
    isDemo: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Submits a new journey for editorial review (status: pending_review).
 * Not visible to users until approved and status set to 'published'.
 *
 * @returns The new Firestore document ID.
 */
export async function submitJourneyForReview(
  payload: JourneyUploadPayload
): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Cannot submit journey for review.'
    );
  }
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    rating: 0,
    savedCount: 0,
    status: 'pending_review',
    isDemo: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Updates an existing journey document (e.g. to publish a draft).
 */
export async function updateCreatorJourney(
  journeyId: string,
  changes: Partial<Omit<CreatorJourney, 'id'>>
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured.');
  }
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, journeyId), changes as Record<string, unknown>);
}

// ─── User reads ───────────────────────────────────────────────────────────────

/**
 * Returns all published journeys.
 *
 * Strategy:
 *  1. If Firebase is not configured → return seed data (all marked isDemo: true)
 *  2. If Firestore has zero published journeys → return seed data as fallback
 *  3. Otherwise → return live Firestore journeys (seed data suppressed)
 *
 * This ensures the app always has content, even before any creator publishes.
 */
export async function getPublishedJourneys(): Promise<CreatorJourney[]> {
  if (!isFirebaseConfigured()) {
    return JOURNEYS.map(mapSeedToCreatorJourney);
  }

  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const live: CreatorJourney[] = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as CreatorJourney)
    );

    if (live.length === 0) {
      // No real creator content yet — show seed data
      return JOURNEYS.map(mapSeedToCreatorJourney);
    }

    return live;
  } catch {
    // Firestore error (network, rules, etc.) — fall back to seed data
    return JOURNEYS.map(mapSeedToCreatorJourney);
  }
}

/**
 * Returns all journeys (published + drafts) for a specific creator.
 * Used on the creator's own profile/dashboard.
 */
export async function getCreatorJourneys(
  creatorId: string
): Promise<CreatorJourney[]> {
  if (!isFirebaseConfigured()) {
    return JOURNEYS
      .filter((j) => j.creatorId === creatorId)
      .map(mapSeedToCreatorJourney);
  }

  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('creatorId', '==', creatorId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const live: CreatorJourney[] = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as CreatorJourney)
    );

    // Merge with seed journeys attributed to this creator
    const seedForCreator = JOURNEYS
      .filter((j) => j.creatorId === creatorId)
      .map(mapSeedToCreatorJourney);

    // Avoid duplicates — live docs take precedence
    const liveIds = new Set(live.map((j) => j.id));
    const seedFallback = seedForCreator.filter((j) => !liveIds.has(j.id));

    return [...live, ...seedFallback];
  } catch {
    return JOURNEYS
      .filter((j) => j.creatorId === creatorId)
      .map(mapSeedToCreatorJourney);
  }
}

/**
 * Returns a single journey by ID.
 * Falls back to seed data if the document doesn't exist in Firestore.
 */
export async function getJourneyById(id: string): Promise<CreatorJourney | null> {
  if (!isFirebaseConfigured()) {
    const seed = JOURNEYS.find((j) => j.id === id);
    return seed ? mapSeedToCreatorJourney(seed) : null;
  }

  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as CreatorJourney;
    }
  } catch {
    // fall through to seed lookup
  }

  // Not in Firestore — check seed data
  const seed = JOURNEYS.find((j) => j.id === id);
  return seed ? mapSeedToCreatorJourney(seed) : null;
}

/**
 * Returns a list of journeys by their Firestore document IDs.
 * Used by the Profile screen to load saved journeys directly by ID,
 * bypassing the published-status filter.
 * IDs that no longer exist are silently omitted.
 */
export async function getJourneysByIds(ids: string[]): Promise<CreatorJourney[]> {
  if (!ids.length) return [];
  const results = await Promise.allSettled(ids.map((id) => getJourneyById(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<CreatorJourney | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((j): j is CreatorJourney => j !== null);
}

export const JOURNEYS_PAGE_SIZE = 20;

export interface JourneysPage {
  items: CreatorJourney[];
  cursor: QueryDocumentSnapshot | null; // pass to nextPage; null = no more pages
}

/**
 * Returns the first page of published journeys (newest first).
 * Falls back to all seed data when Firebase is not configured.
 */
export async function getPublishedJourneysPage(
  pageSize = JOURNEYS_PAGE_SIZE
): Promise<JourneysPage> {
  if (!isFirebaseConfigured()) {
    return { items: JOURNEYS.map(mapSeedToCreatorJourney), cursor: null };
  }
  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CreatorJourney));
    if (items.length === 0) return { items: JOURNEYS.map(mapSeedToCreatorJourney), cursor: null };
    const cursor = snap.docs[snap.docs.length - 1] ?? null;
    return { items, cursor: snap.docs.length < pageSize ? null : cursor };
  } catch {
    return { items: JOURNEYS.map(mapSeedToCreatorJourney), cursor: null };
  }
}

/**
 * Returns the next page of published journeys after `cursor`.
 */
export async function getMorePublishedJourneys(
  cursor: QueryDocumentSnapshot,
  pageSize = JOURNEYS_PAGE_SIZE
): Promise<JourneysPage> {
  if (!isFirebaseConfigured()) return { items: [], cursor: null };
  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      startAfter(cursor),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CreatorJourney));
    const nextCursor = snap.docs[snap.docs.length - 1] ?? null;
    return { items, cursor: snap.docs.length < pageSize ? null : nextCursor };
  } catch {
    return { items: [], cursor: null };
  }
}
