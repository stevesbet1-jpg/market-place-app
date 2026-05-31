export interface Review {
  id: string;
  author: string;
  initials: string;
  /** Author's home city/country */
  location: string;
  rating: number;
  date: string;
  text: string;
}

// All reviews come from Firestore. No fake review data.
const REVIEW_POOL: readonly Review[] = [];

/** Returns reviews for a given journey ID (Firestore-backed; empty until real reviews exist) */
export function getReviewsForJourney(_journeyId: string): Review[] {
  return [];
}

/** Average of ratings for a journey's reviews */
export function getAverageRating(_journeyId: string): number {
  return 0;
}
