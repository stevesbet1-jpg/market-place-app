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
  activities: string[];
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
  /** Creator's personal tips for this experience */
  tips: string[];
  /** Off-the-beaten-path spots */
  hiddenGems: string[];
  restaurants: string[];
  hotels: string[];
  /** Day-by-day plan */
  dailyPlan: DailyPlanEntry[];

  // ── Lifecycle ───────────────────────────────────────────────────────
  status: ExperienceStatus;

  // ── Timestamps ──────────────────────────────────────────────────────
  /** Unix-ms at creation. Null until server writes createdAt. */
  createdAt: number | null;
}

// ─── Firestore document shape ─────────────────────────────────────────────────

/** As stored in Firestore — createdAt is a Timestamp, not a number. */
export interface CreatorExperienceDoc
  extends Omit<CreatorExperience, 'id' | 'createdAt'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

// ─── Upload payload ───────────────────────────────────────────────────────────

/**
 * Fields a creator fills in when submitting an experience.
 * id / status / createdAt are set by the service layer.
 */
export type ExperienceUploadPayload = Omit<
  CreatorExperience,
  'id' | 'status' | 'createdAt'
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
