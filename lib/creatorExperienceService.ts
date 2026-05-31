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
    creatorName: (data.creatorName as string) ?? '',
    title: (data.title as string) ?? '',
    country: (data.country as string) ?? '',
    city: (data.city as string) ?? '',
    travelStyle: (data.travelStyle as CreatorExperience['travelStyle']) ?? 'adventure',
    duration: (data.duration as string) ?? '',
    budget: (data.budget as CreatorExperience['budget']) ?? '$$',
    coverImage: (data.coverImage as string | null) ?? null,
    description: (data.description as string) ?? '',
    creatorNotes: (data.creatorNotes as string) ?? '',
    tips: (data.tips as string[]) ?? [],
    hiddenGems: (data.hiddenGems as HiddenGem[]) ?? [],
    restaurants: (data.restaurants as Restaurant[]) ?? [],
    hotels: (data.hotels as Hotel[]) ?? [],
    dailyPlan: (data.dailyPlan as DailyPlanEntry[]) ?? [],
    status: (data.status as CreatorExperience['status']) ?? 'draft',
    published: Boolean(data.published),
    createdAt: null,
    updatedAt: null,
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
