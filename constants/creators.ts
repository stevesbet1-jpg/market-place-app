import type { CreatorType, CreatorSubscription } from '../lib/creatorTypes';

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
}

// ─── Seed-data notice ─────────────────────────────────────────────────────────
//
// CREATORS below are DEMO / SEED data only.
// They exist to make the UI testable before real creators onboard.
// These are NOT real people verified on this platform.
// Real creators are stored in Firestore (creators collection) and
// fetched via lib/creatorService.ts.
//
// ─────────────────────────────────────────────────────────────────────────────

export const CREATORS: readonly Creator[] = [
  {
    id: 'sophia-chen',
    isDemo: true,
    name: 'Sophia Chen',
    initials: 'SC',
    bio: 'Tokyo-based travel writer and photographer specialising in Asia\'s hidden cultural gems, ancient temple circuits and hyper-modern city escapes.',
    instagram: '@sophiatravels',
    youtube: 'SophiaChenTravel',
    website: 'sophiachen.travel',
    rating: 4.9,
    followers: 84200,
    totalJourneys: 3,
  },
  {
    id: 'marco-vitale',
    isDemo: true,
    name: 'Marco Vitale',
    initials: 'MV',
    bio: 'Italian explorer and lifestyle journalist. Six years documenting the Riviera, Aegean islands and Tuscan countryside for the world\'s top luxury travel titles.',
    instagram: '@marcovitale',
    youtube: 'MarcoVitaleMed',
    website: 'marcovitale.com',
    rating: 4.8,
    followers: 121400,
    totalJourneys: 6,
  },
  {
    id: 'james-hartley',
    isDemo: true,
    name: 'James Hartley',
    initials: 'JH',
    bio: 'Underwater photographer and ocean conservationist. Specialises in remote island sanctuaries, overwater living and rare marine encounters.',
    instagram: '@hartleyocean',
    website: 'jameshart.co',
    rating: 4.9,
    followers: 63800,
    totalJourneys: 2,
  },
  {
    id: 'elena-kovacs',
    isDemo: true,
    name: 'Elena Kovacs',
    initials: 'EK',
    bio: 'Adventure travel guide with a passion for remote wilderness. From Patagonian glaciers to Icelandic highlands, she finds luxury in the extremes.',
    instagram: '@elenabeyondborders',
    youtube: 'ElenaKovacsAdventure',
    website: 'elenabeyond.com',
    rating: 4.7,
    followers: 49600,
    totalJourneys: 3,
  },
  {
    id: 'nadia-al-rashid',
    isDemo: true,
    name: 'Nadia Al-Rashid',
    initials: 'NA',
    bio: 'Dubai-born cultural storyteller blending desert heritage with contemporary luxury. Known for her intimate guides to Morocco, Cappadocia and the Gulf.',
    instagram: '@nadiaalrashid',
    website: 'nadiatravel.me',
    rating: 4.8,
    followers: 72100,
    totalJourneys: 3,
  },
  {
    id: 'amara-osei',
    isDemo: true,
    name: 'Amara Osei',
    initials: 'AO',
    bio: 'Tropical island specialist born in Accra. Her acclaimed guides to Zanzibar, Seychelles and Bali have reshaped how travellers experience island culture.',
    instagram: '@amaraosei',
    youtube: 'AmaraIslandLife',
    website: 'amaraosei.com',
    rating: 4.9,
    followers: 95300,
    totalJourneys: 3,
  },
];

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
