import type { CreatorType, CreatorSubscription, CreatorSubscriptionPlan } from '../lib/creatorTypes';

export interface Creator {
  /** Firestore document ID (or seed slug for demo creators) */
  id: string;
  /** Public display name — maps to `displayName` in Firestore */
  name: string;
  /** Two-letter initials displayed when no avatar is available */
  initials: string;
  bio: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
  /** URL to the creator's profile avatar image */
  avatar?: string;
  rating: number;
  /** Total platform followers */
  followers: number;
  /** Number of published journeys */
  totalJourneys: number;
  /**
   * Verification tier — 'verified' | 'community'.
   * Defaults to 'community' for new creators and demo data.
   */
  creatorType?: CreatorType;
  /**
   * Subscription plan details. Present on real creators; absent on seed data.
   * See lib/creatorTypes.ts — CreatorSubscription.
   */
  creatorSubscription?: CreatorSubscription;
  /**
   * Firebase Auth UID of the creator's user account.
   * Empty string for demo/seed creators (no real user).
   */
  userId?: string;
  /**
   * true  — populated from hardcoded seed data; not a real person on the platform.
   * false — a real creator who signed up via creator onboarding.
   */
  isDemo: boolean;
  /**
   * Whether the creator account is active.
   * Defaults to true if not present (legacy creators provisioned before this field).
   */
  creatorEnabled?: boolean;
  /** Creator plan tier: 'free' | 'pro' | 'elite'. Defaults to 'free'. */
  creatorPlan?: CreatorSubscriptionPlan;
  /** Published experiences count — used to enforce free plan limit. */
  publishedExperiencesCount?: number;
}

// Real creators are stored in Firestore (creators collection) and
// fetched via lib/creatorService.ts.
export const CREATORS: readonly Creator[] = [];

/** Lookup helper — returns undefined if not found */
export function getCreatorById(id: string): Creator | undefined {
  return CREATORS.find((c) => c.id === id);
}

/** Format follower count: 84200 → "84.2K" */
export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format save count: 1840 → "1.8K" */
export function formatSaves(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
