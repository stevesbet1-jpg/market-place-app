/**
 * creatorTypes.ts
 *
 * Canonical TypeScript interfaces for the Creator Marketplace.
 * These mirror the Firestore schema exactly.
 *
 * Firestore collections:
 *   creatorApplications — submitted creator applications
 *   creators            — approved creator profiles
 *
 * This file has zero runtime dependencies — types only.
 */

// ─── Primitive union types ────────────────────────────────────────────────────

/**
 * Verification tier displayed on the creator profile badge.
 *   verified  — creators with a substantial, verified following
 *   community — community contributors (default for new creators)
 */
export type CreatorType = 'verified' | 'community';

/**
 * Lifecycle status of a creator application.
 * Applications begin as 'pending' and are reviewed manually.
 */
export type CreatorStatus = 'pending' | 'approved' | 'rejected';

/**
 * Creator subscription plan.
 *   free — up to CREATOR_FREE_JOURNEY_LIMIT published journeys
 *   pro  — unlimited published journeys
 *
 * NOTE: Payments are NOT connected yet. This is the model only.
 */
export type CreatorSubscriptionPlan = 'free' | 'pro';

// ─── Subscription constants ───────────────────────────────────────────────────

/**
 * Maximum number of journeys a creator can publish per plan.
 * null = unlimited.
 */
export const CREATOR_SUBSCRIPTION_LIMITS: Record<CreatorSubscriptionPlan, number | null> = {
  free: 3,
  pro: null,
};

// ─── CreatorSubscription ──────────────────────────────────────────────────────

/**
 * Embedded on the Creator document.
 * Tracks subscription plan and usage.
 *
 * Payments NOT wired — model only.
 */
export interface CreatorSubscription {
  /** Active subscription plan */
  plan: CreatorSubscriptionPlan;
  /**
   * Maximum journeys the creator may publish.
   * null = unlimited (pro plan).
   */
  journeyLimit: number | null;
  /** Number of journeys published so far against this limit */
  journeysUsed: number;
  /** Firestore Timestamp — when the subscription was activated */
  activatedAt: unknown;
  /** Firestore Timestamp — when the plan expires, or null if it doesn't */
  expiresAt: unknown | null;
}

/** Default subscription assigned to newly approved creators */
export const DEFAULT_CREATOR_SUBSCRIPTION: CreatorSubscription = {
  plan: 'free',
  journeyLimit: CREATOR_SUBSCRIPTION_LIMITS.free,
  journeysUsed: 0,
  activatedAt: null,
  expiresAt: null,
};

// ─── CreatorApplication ───────────────────────────────────────────────────────

/**
 * Firestore document in the `creatorApplications` collection.
 *
 * Created when a user submits an application via the Apply as Creator screen.
 * Reviewed manually; status is flipped to 'approved' or 'rejected' by admins.
 * On approval, a corresponding document is created in the `creators` collection.
 */
export interface CreatorApplication {
  /** Firestore document ID */
  applicationId: string;
  /** Firebase Auth UID of the applicant */
  userId: string;
  /** Applicant's display / full name */
  fullName: string;
  /** Contact email for follow-up */
  email: string;
  /** Instagram handle (optional) */
  instagram?: string;
  /** YouTube channel name or URL (optional) */
  youtube?: string;
  /** TikTok handle (optional) */
  tiktok?: string;
  /** Website or blog URL (optional — not in core spec but accepted) */
  website?: string;
  /** Description of travel experience and content focus */
  travelExperience: string;
  /** Countries visited — free text or comma-separated list (optional) */
  countriesVisited?: string;
  /** Why the applicant wants to join as a creator */
  motivation: string;
  /** Current status of the application */
  status: CreatorStatus;
  /** Firestore server timestamp — when the application was submitted */
  createdAt: unknown;
}

/**
 * Payload to create a new creator application.
 * Server-set fields (applicationId, status, createdAt) are excluded.
 */
export type CreatorApplicationPayload = Omit<
  CreatorApplication,
  'applicationId' | 'status' | 'createdAt'
>;

// ─── Creator ──────────────────────────────────────────────────────────────────

/**
 * Firestore document in the `creators` collection.
 *
 * Documents in this collection represent APPROVED creators only.
 * Created by admin after approving a creator application.
 * Having a document here is the source of truth for creator access.
 */
export interface FirestoreCreator {
  /** Firestore document ID (also stored as a field for denormalisation) */
  creatorId: string;
  /** Firebase Auth UID — links back to the creator's user account */
  userId: string;
  /** Verification tier */
  creatorType: CreatorType;
  /** Subscription plan details */
  creatorSubscription: CreatorSubscription;
  /** Public display name */
  displayName: string;
  /** Short bio / content description */
  bio: string;
  /** URL to the creator's profile avatar image (optional) */
  avatar?: string;
  /** Instagram handle (optional) */
  instagram?: string;
  /** YouTube channel name or URL (optional) */
  youtube?: string;
  /** TikTok handle (optional) */
  tiktok?: string;
  /** Website or blog URL (optional) */
  website?: string;
  /** Average rating across all published journeys (0–5) */
  rating: number;
  /** Total followers on this platform */
  followers: number;
  /** Number of published journeys */
  totalJourneys: number;
  /** Firestore server timestamp — when the creator was approved */
  createdAt: unknown;
}

/**
 * Payload to create a new creator document (admin-only operation).
 * Server-set fields are excluded.
 */
export type FirestoreCreatorPayload = Omit<FirestoreCreator, 'createdAt'>;
