/**
 * creatorExperienceService.ts
 *
 * All reads / writes for creator experiences go through this module.
 *
 * Firestore collection: creatorExperiences
 *
 * Status lifecycle:
 *   draft          → saved by creator, private
 *   pending_review → submitted for editorial review
 *   published      → approved and visible to subscribers
 *   rejected       → declined by editorial team
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  documentId,
  increment,
  limit,
  startAfter,
  runTransaction,
  type QueryDocumentSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';
import type {
  CreatorExperience,
  ExperienceUploadPayload,
  Hotel,
  Restaurant,
  HiddenGem,
  DailyPlanEntry,
} from '../constants/creatorExperienceModel';

// ─── Collection name ──────────────────────────────────────────────────────────

const COLLECTION = 'creatorExperiences';

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
}

function normalizeDailyPlan(value: unknown): DailyPlanEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw, index) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      const activities = toStringArray(item.activities);
      const title =
        (typeof item.title === 'string' && item.title.trim()) ||
        (typeof item.dayTitle === 'string' && item.dayTitle.trim()) ||
        '';
      const description =
        (typeof item.description === 'string' && item.description.trim()) ||
        (typeof item.dayDescription === 'string' && item.dayDescription.trim()) ||
        (activities.length > 0 ? activities.join(', ') : '');

      return {
        day:
          (typeof item.day === 'number' && item.day > 0 ? item.day : null) ??
          (typeof item.dayNumber === 'number' && item.dayNumber > 0 ? item.dayNumber : null) ??
          index + 1,
        title,
        description,
      };
    })
    .sort((a, b) => a.day - b.day);
}

function likelyFragmentedSentence(parts: string[]): boolean {
  if (parts.length < 2) return false;
  const first = parts[0] ?? '';
  const firstWords = first.split(/\s+/).filter(Boolean).length;
  const hasLowercaseContinuation = parts
    .slice(1)
    .some((p) => /^[a-z]/.test(p));
  return hasLowercaseContinuation && (first.length > 40 || firstWords >= 8);
}

function normalizeTips(data: Record<string, unknown>): string[] {
  const rawTips = data.tips;

  if (typeof rawTips === 'string') {
    const text = rawTips.trim();
    return text ? [text] : [];
  }

  const tipsArray = toStringArray(rawTips);
  if (tipsArray.length > 0) {
    if (likelyFragmentedSentence(tipsArray)) {
      return [tipsArray.join(', ')];
    }
    return tipsArray;
  }

  const legacyText = typeof data.tipsText === 'string' ? data.tipsText.trim() : '';
  return legacyText ? [legacyText] : [];
}

// ─── Guards ───────────────────────────────────────────────────────────────────

function requireFirebase(): void {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Add your Firebase environment variables.'
    );
  }
}

// ─── Map Firestore doc → CreatorExperience ────────────────────────────────────

function mapDoc(id: string, data: Record<string, unknown>): CreatorExperience {
  return {
    id,
    creatorId: (data.creatorId as string) ?? '',
    creatorType: (data.creatorType as CreatorExperience['creatorType']) ?? 'community',
    creatorName: (data.creatorName as string) ?? '',
    title: (data.title as string) ?? '',
    country: (data.country as string) ?? '',
    city: (data.city as string) ?? '',
    travelStyle: (data.travelStyle as CreatorExperience['travelStyle']) ?? 'adventure',
    duration: (data.duration as string) ?? '',
    budget: (data.budget as CreatorExperience['budget']) ?? '$$',
    coverImage: (data.coverImage as string | null) ?? null,
    description: (data.description as string) ?? '',
    whoIsItFor: (data.whoIsItFor as string) ?? '',
    highlights: (data.highlights as string[]) ?? [],
    creatorNotes: (data.creatorNotes as string) ?? '',
    tips: normalizeTips(data),
    bestTimeToVisit: (data.bestTimeToVisit as string) ?? '',
    warnings: (data.warnings as string) ?? '',
    hiddenGems: (data.hiddenGems as HiddenGem[]) ?? [],
    restaurants: (data.restaurants as Restaurant[]) ?? [],
    hotels: (data.hotels as Hotel[]) ?? [],
    dailyPlan: normalizeDailyPlan(
      data.dailyPlan ?? data.itinerary ?? data.dayByDay ?? data.daily_plan
    ),
    googleMapsUrl: (data.googleMapsUrl as string) ?? '',
    appleMapsUrl: (data.appleMapsUrl as string) ?? '',
    freePreview: Boolean(data.freePreview),
    status: (data.status as CreatorExperience['status']) ?? 'draft',
    published: Boolean(data.published),
    views: (data.views as number) ?? 0,
    unlocks: (data.unlocks as number) ?? 0,
    savedCount: (data.savedCount as number) ?? 0,
    createdAt: data.createdAt
      ? (data.createdAt as { toMillis(): number }).toMillis?.() ?? null
      : null,
    updatedAt: data.updatedAt
      ? (data.updatedAt as { toMillis(): number }).toMillis?.() ?? null
      : null,
    publishedAt: data.publishedAt
      ? (data.publishedAt as { toMillis(): number }).toMillis?.() ?? null
      : null,
  };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Saves a new experience as a draft (status: 'draft').
 * Not visible to users until submitted and approved.
 *
 * @returns Firestore document ID
 */
export async function saveExperienceDraft(
  payload: ExperienceUploadPayload
): Promise<string> {
  requireFirebase();
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    status: 'draft',
    savedCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Submits a new experience for editorial review (status: 'pending_review').
 * Not visible to users until published.
 *
 * @returns Firestore document ID
 */
export async function submitExperienceForReview(
  payload: ExperienceUploadPayload
): Promise<string> {
  requireFirebase();
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    status: 'pending_review',
    savedCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Updates an existing experience document.
 * Use to edit drafts or change status (e.g. draft → pending_review).
 */
export async function updateExperience(
  experienceId: string,
  changes: Partial<Omit<CreatorExperience, 'id' | 'createdAt'>>
): Promise<void> {
  requireFirebase();
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, experienceId), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Publishes an experience directly.
 * Sets status: 'published' and published: true.
 * Used when a creator clicks Publish on their own experience.
 */
export async function publishExperience(experienceId: string): Promise<void> {
  requireFirebase();
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, experienceId), {
    status: 'published',
    published: true,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Permanently deletes an experience document.
 * Confirmed by the caller before calling this function.
 */
export async function deleteExperience(experienceId: string): Promise<void> {
  requireFirebase();
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLLECTION, experienceId));
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Returns all experiences (all statuses) for a specific creator.
 * Used on the creator's own dashboard.
 */
export async function getCreatorExperiences(
  creatorId: string
): Promise<CreatorExperience[]> {
  if (!isFirebaseConfigured()) return [];

  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('creatorId', '==', creatorId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) =>
      mapDoc(d.id, d.data() as Record<string, unknown>)
    );
  } catch {
    return [];
  }
}

/**
 * Returns all published experiences across all creators.
 * Used on browse / Explore surfaces (future use).
 */
export async function getPublishedExperiences(): Promise<CreatorExperience[]> {
  if (!isFirebaseConfigured()) return [];

  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('published', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) =>
      mapDoc(d.id, d.data() as Record<string, unknown>)
    );
  } catch {
    return [];
  }
}

/**
 * Returns a list of experiences by their Firestore document IDs.
 * IDs that no longer exist or fail individually are silently omitted.
 * Used by the Trips screen to load saved experiences directly by ID,
 * so they appear regardless of their published/draft status.
 */
export async function getExperiencesByIds(
  ids: string[]
): Promise<CreatorExperience[]> {
  if (ids.length === 0) return [];
  if (!isFirebaseConfigured()) {
    // Fallback: individual fetches (no seed data for experiences)
    const results = await Promise.all(ids.map((id) => getExperienceById(id)));
    return results.filter(Boolean) as CreatorExperience[];
  }

  // Firestore 'in' query supports max 30 items per batch
  const BATCH_SIZE = 30;
  const db = getFirestoreDb();
  const allResults: CreatorExperience[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    try {
      const snap = await getDocs(
        query(collection(db, COLLECTION), where(documentId(), 'in', batch))
      );
      snap.forEach((d) => allResults.push(mapDoc(d.id, d.data() as Record<string, unknown>)));
    } catch {
      // On error fall back to individual fetches for this batch
      const fallback = await Promise.all(batch.map((id) => getExperienceById(id)));
      fallback.forEach((e) => e && allResults.push(e));
    }
  }

  return allResults;
}

/**
 * Returns a single experience by Firestore document ID.
 * Returns null if not found or Firebase is not configured.
 */
export async function getExperienceById(
  experienceId: string
): Promise<CreatorExperience | null> {
  if (!isFirebaseConfigured()) return null;

  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, COLLECTION, experienceId));
    if (!snap.exists()) return null;
    return mapDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Atomically increments the `views` counter on an experience document.
 * Fire-and-forget: errors are swallowed to avoid disrupting the UI.
 */
export function incrementExperienceViews(experienceId: string): void {
  if (!isFirebaseConfigured() || !experienceId) return;
  try {
    const db = getFirestoreDb();
    updateDoc(doc(db, COLLECTION, experienceId), { views: increment(1) }).catch(() => {});
  } catch { /* silently ignore */ }
}

/**
 * Atomically increments the `unlocks` counter on an experience document.
 * Fire-and-forget: errors are swallowed to avoid disrupting the UI.
 */
export function incrementExperienceUnlocks(experienceId: string): void {
  if (!isFirebaseConfigured() || !experienceId) return;
  try {
    const db = getFirestoreDb();
    updateDoc(doc(db, COLLECTION, experienceId), { unlocks: increment(1) }).catch(() => {});
  } catch { /* silently ignore */ }
}

export const EXPERIENCES_PAGE_SIZE = 20;

export interface ExperiencesPage {
  items: CreatorExperience[];
  cursor: QueryDocumentSnapshot | null;
}

/**
 * Returns the first page of published experiences (newest first).
 */
export async function getPublishedExperiencesPage(
  pageSize = EXPERIENCES_PAGE_SIZE
): Promise<ExperiencesPage> {
  if (!isFirebaseConfigured()) return { items: [], cursor: null };
  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('published', '==', true),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
    const cursor = snap.docs[snap.docs.length - 1] ?? null;
    return { items, cursor: snap.docs.length < pageSize ? null : cursor };
  } catch {
    return { items: [], cursor: null };
  }
}

/**
 * Returns the next page of published experiences after `cursor`.
 */
export async function getMorePublishedExperiences(
  cursor: QueryDocumentSnapshot,
  pageSize = EXPERIENCES_PAGE_SIZE
): Promise<ExperiencesPage> {
  if (!isFirebaseConfigured()) return { items: [], cursor: null };
  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, COLLECTION),
      where('published', '==', true),
      orderBy('createdAt', 'desc'),
      startAfter(cursor),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
    const nextCursor = snap.docs[snap.docs.length - 1] ?? null;
    return { items, cursor: snap.docs.length < pageSize ? null : nextCursor };
  } catch {
    return { items: [], cursor: null };
  }
}

/**
 * Applies a save-count delta atomically and clamps at 0.
 * Fire-and-forget callers should swallow errors to avoid blocking UX.
 */
export async function syncExperienceSavedCount(
  experienceId: string,
  delta: 1 | -1
): Promise<void> {
  if (!isFirebaseConfigured() || !experienceId) return;
  const db = getFirestoreDb();
  const ref = doc(db, COLLECTION, experienceId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current = Number(snap.data().savedCount ?? 0);
    const next = Math.max(0, current + delta);
    tx.update(ref, { savedCount: next });
  });
}
