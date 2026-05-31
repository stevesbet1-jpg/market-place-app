export type ImageKey = 'islands' | 'villas' | 'yacht' | 'desert' | 'mountain' | 'city' | 'temple' | 'bali' | 'seychelles' | 'zanzibar' | 'lakecomo' | 'alps';
export type BudgetLevel = '$' | '$$' | '$$$' | '$$$$';

export interface ItineraryDay {
  day: number;
  activities: readonly string[];
}

export interface Journey {
  id: string;
  name: string;
  destination: string;
  region: string;
  duration: string;
  bestTime: string;
  overview: string;
  imageKey: ImageKey;
  budget: BudgetLevel;
  dailyBudget: string;
  rating: number;
  creatorId: string;
  savedCount: number;
  itinerary: readonly ItineraryDay[];
  readonly places: readonly string[];
  readonly restaurants: readonly string[];
  readonly experiences: readonly string[];
}

// All journeys come from Firestore. No hardcoded seed journeys.
export const JOURNEYS: readonly Journey[] = [];

import type { CreatorJourney } from './creatorJourneyModel';

/**
 * Maps a hardcoded seed Journey to the canonical CreatorJourney model.
 * Kept for compatibility with creatorJourneyService.ts seed fallback.
 */
export function mapSeedToCreatorJourney(j: Journey): CreatorJourney {
  return {
    id: j.id,
    creatorId: j.creatorId,
    creatorName: '',
    title: j.name,
    destination: j.destination,
    region: j.region,
    duration: j.duration,
    bestTime: j.bestTime,
    overview: j.overview,
    budget: j.budget,
    dailyBudget: j.dailyBudget,
    imageUri: null,
    imageKey: j.imageKey,
    places: [...j.places],
    restaurants: [...j.restaurants],
    experiences: [...j.experiences],
    itinerary: j.itinerary.map((d) => ({
      day: d.day,
      activities: [...d.activities],
    })),
    rating: j.rating,
    savedCount: j.savedCount,
    status: 'published',
    isDemo: true,
    createdAt: null,
  };
}
