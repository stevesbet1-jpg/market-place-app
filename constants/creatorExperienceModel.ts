/**
 * CreatorExperience — data model for the Creator Experiences Marketplace.
 *
 * Creators publish travel experiences, travel blueprints, and curated travel
 * plans. Travelers subscribe to access them.
 *
 * This model is intentionally separate from CreatorJourney (legacy) so we
 * can migrate incrementally without breaking existing data.
 *
 * Firestore collection: creatorExperiences
 */

// ─── Enums / Literals ─────────────────────────────────────────────────────────

export type TravelStyle =
  | 'luxury'
  | 'adventure'
  | 'budget'
  | 'family'
  | 'food';

export type ExperienceStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'rejected';

export type BudgetRange = '$' | '$$' | '$$$' | '$$$$';

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface DailyPlanEntry {
  day: number;
  title: string;
  description: string;
}

export interface Hotel {
  name: string;
  address: string;
  notes?: string;
  mapsLink?: string;
}

export interface Restaurant {
  name: string;
  description: string;
  mapsLink?: string;
}

export interface HiddenGem {
  name: string;
  description: string;
  mapsLink?: string;
}

// ─── Main model ───────────────────────────────────────────────────────────────

export interface CreatorExperience {
  /** Firestore document ID */
  id: string;

  // ── Creator attribution ─────────────────────────────────────────────
  creatorId: string;
  creatorName: string;

  // ── Core fields ─────────────────────────────────────────────────────
  title: string;
  country: string;
  city: string;
  travelStyle: TravelStyle;
  duration: string;
  budget: BudgetRange;

  // ── Media ───────────────────────────────────────────────────────────
  /** Public URL for the cover image, or null */
  coverImage: string | null;

  // ── Content ─────────────────────────────────────────────────────────
  description: string;
  /** Who this experience is suited for */
  whoIsItFor: string;
  /** Bullet-point highlights of this experience */
  highlights: string[];
  /** Creator's private notes — separate from public description */
  creatorNotes: string;
  /** Creator's personal tips for this experience */
  tips: string[];
  /** Best season / time of year */
  bestTimeToVisit: string;
  /** Warnings, cautions, or things to avoid */
  warnings: string;
  /** Off-the-beaten-path spots */
  hiddenGems: HiddenGem[];
  restaurants: Restaurant[];
  hotels: Hotel[];
  /** Day-by-day plan */
  dailyPlan: DailyPlanEntry[];

  // ── Pricing ─────────────────────────────────────────────────────────
  /** When true the first section is accessible without subscription */
  freePreview: boolean;

  // ── Lifecycle ───────────────────────────────────────────────────────
  status: ExperienceStatus;
  /** true once the creator publishes — drives Discover / Trips queries */
  published: boolean;

  // ── Stats ────────────────────────────────────────────────────────────
  /** Total profile / card views */
  views: number;
  /** Total subscription unlocks of this experience */
  unlocks: number;

  // ── Timestamps ──────────────────────────────────────────────────────
  /** Unix-ms at creation. Null until server writes createdAt. */
  createdAt: number | null;
  /** Unix-ms of last update. Null until first update. */
  updatedAt: number | null;
  /** Unix-ms when published. Null until published. */
  publishedAt: number | null;
}

// ─── Firestore document shape ─────────────────────────────────────────────────

/** As stored in Firestore — createdAt/updatedAt are Timestamps, not numbers. */
export interface CreatorExperienceDoc
  extends Omit<CreatorExperience, 'id' | 'createdAt' | 'updatedAt'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedAt: any;
}

// ─── Upload payload ───────────────────────────────────────────────────────────

/**
 * Fields a creator fills in when submitting an experience.
 * id / status / createdAt / updatedAt are set by the service layer.
 */
export type ExperienceUploadPayload = Omit<
  CreatorExperience,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'views' | 'unlocks'
>;

// ─── Display helpers ──────────────────────────────────────────────────────────

export const TRAVEL_STYLES: { value: TravelStyle; label: string; icon: string }[] = [
  { value: 'luxury', label: 'Luxury', icon: '✦' },
  { value: 'adventure', label: 'Adventure', icon: '⛰' },
  { value: 'budget', label: 'Budget', icon: '💰' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧' },
  { value: 'food', label: 'Food', icon: '🍴' },
];

export const BUDGET_RANGES: BudgetRange[] = ['$', '$$', '$$$', '$$$$'];

export function travelStyleLabel(s: TravelStyle): string {
  return TRAVEL_STYLES.find((t) => t.value === s)?.label ?? s;
}

export function statusLabel(s: ExperienceStatus): string {
  switch (s) {
    case 'draft': return 'Draft';
    case 'pending_review': return 'Pending Review';
    case 'published': return 'Published';
    case 'rejected': return 'Rejected';
  }
}

export function statusColor(s: ExperienceStatus): string {
  // colors are string literals to avoid importing LuxuryColors into the model
  switch (s) {
    case 'draft': return '#7A7668';          // LuxuryColors.textTertiary
    case 'pending_review': return '#D4AF37'; // LuxuryColors.gold
    case 'published': return '#2ED573';      // LuxuryColors.success
    case 'rejected': return '#FF4757';       // LuxuryColors.error
  }
}
