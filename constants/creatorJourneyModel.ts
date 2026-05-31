/**
 * CreatorJourney — canonical data model for creator-uploaded journeys.
 *
 * This is the single source of truth for journey data, used by both
 * the Firestore service (live) and the seed-data mapper (demo fallback).
 *
 * The hardcoded entries in constants/journeys.ts are DEMO / SEED data only.
 * They exist to populate the app before real creator content is present.
 * All real content flows through this type and is stored in Firestore.
 */

export type BudgetLevel = '$' | '$$' | '$$$' | '$$$$';

export interface CreatorItineraryDay {
  day: number;
  activities: string[];
}

export interface CreatorJourney {
  /** Firestore document ID (or seed journey ID for demo data) */
  id: string;

  // ── Creator attribution ─────────────────────────────────────────────
  /** Firestore UID of the creator who uploaded this journey */
  creatorId: string;
  /** Display name at time of upload */
  creatorName: string;

  // ── Core details ────────────────────────────────────────────────────
  title: string;
  destination: string;
  /** Broad region label, e.g. "East Asia" */
  region: string;
  /** Human-readable duration, e.g. "7 Days" */
  duration: string;
  /** Best travel window, e.g. "Mar – May" */
  bestTime: string;
  /** Short paragraph describing the journey */
  overview: string;

  // ── Budget ──────────────────────────────────────────────────────────
  budget: BudgetLevel;
  /** Human-readable daily budget range, e.g. "$150–300/day" */
  dailyBudget: string;

  // ── Content ─────────────────────────────────────────────────────────
  places: string[];
  restaurants: string[];
  experiences: string[];
  itinerary: CreatorItineraryDay[];

  // ── Media ───────────────────────────────────────────────────────────
  /**
   * Public URL of the destination hero image, or null.
   * Seed journeys use imageKey (local asset); real uploads provide imageUri.
   */
  imageUri: string | null;
  /**
   * Only present on journeys mapped from seed data (constants/journeys.ts).
   * Used by the image resolver to fall back to a local require().
   */
  imageKey?: string;

  // ── Social proof ────────────────────────────────────────────────────
  /** Average user rating (0 = unrated). Computed server-side. */
  rating: number;
  /** Platform save count for social proof. */
  savedCount: number;

  // ── Lifecycle ───────────────────────────────────────────────────────
  /**
   * 'draft'     — saved by creator but not submitted
   * 'published' — live and visible to users
   */
  status: 'draft' | 'published';
  /**
   * true  — populated from hardcoded seed data (constants/journeys.ts)
   * false — real creator upload stored in Firestore
   */
  isDemo: boolean;

  /** Unix ms timestamp of creation. Null on seed data. */
  createdAt: number | null;
}

/**
 * Shape of the Firestore document.
 * createdAt is stored as a Firestore serverTimestamp; we cast to `any`
 * to avoid importing the Timestamp type into this model file.
 */
export interface CreatorJourneyDoc
  extends Omit<CreatorJourney, 'id' | 'createdAt'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

/**
 * The fields a creator fills in when uploading a journey.
 * id / rating / savedCount / status / isDemo / createdAt are set by the service.
 */
export type JourneyUploadPayload = Omit<
  CreatorJourney,
  'id' | 'rating' | 'savedCount' | 'status' | 'isDemo' | 'createdAt' | 'imageKey'
>;
