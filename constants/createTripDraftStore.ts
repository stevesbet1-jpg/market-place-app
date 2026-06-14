import AsyncStorage from '@react-native-async-storage/async-storage';

export const CREATE_TRIP_DRAFT_KEY = '@createTrip/draft/v1';

export type TripType = 'Luxury' | 'Adventure' | 'Food' | 'Romantic' | 'Family';
export type PhotoCategory =
  | 'places'
  | 'food'
  | 'activities'
  | 'uncategorized'
  | 'Places'
  | 'Food'
  | 'Activities';

export type ItineraryDayDraft = {
  id: string;
  dayLabel: string;
  dateLabel: string;
  title: string;
  subtitle: string;
  imageUri: string;
  activities: string[];
};

export type PhotoEntryDraft = {
  id: string;
  uri: string;
  caption: string;
  category: PhotoCategory;
};

export type ExperienceDraft = {
  id: string;
  title: string;
  locationDate: string;
  rating: number;
  imageUri: string;
  location?: string;
  dateDay?: string;
  category?: string;
  notes?: string;
  sourcePhotoId?: string;
  aiGenerated?: boolean;
};

export type TripInfoDraft = {
  destination: string;
  startDate: string;
  endDate: string;
  tripTitle: string;
  duration: string;
  travelers: string;
  tripType: TripType;
  budget: string;
  flightCost: string;
  stayCost: string;
  foodCost: string;
  activitiesCost: string;
  notes: string;
  highlights: string[];
  coverUri: string | null;
  galleryUris: string[];
};

export type CreateTripDraft = {
  tripInfo: TripInfoDraft;
  itineraryDays: ItineraryDayDraft[];
  photos: PhotoEntryDraft[];
  experiences: ExperienceDraft[];
  updatedAt: number;
};

const MONTH_LOOKUP: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_TRIP_INFO: TripInfoDraft = {
  destination: 'Amalfi Coast, Italy',
  startDate: 'May 14, 2026',
  endDate: 'May 21, 2026',
  tripTitle: 'Seven Days of Coastal Indulgence',
  duration: '7 Days',
  travelers: '2',
  tripType: 'Luxury',
  budget: '4200',
  flightCost: '1400',
  stayCost: '1800',
  foodCost: '700',
  activitiesCost: '300',
  notes: 'Capture the villa check-in moment, reserve the tasting menu early, and keep a flexible final evening for discoveries.',
  highlights: ['Sunrise Views', 'Fine Dining'],
  coverUri: null,
  galleryUris: [],
};

const EMPTY_DRAFT: CreateTripDraft = {
  tripInfo: DEFAULT_TRIP_INFO,
  itineraryDays: [],
  photos: [],
  experiences: [],
  updatedAt: Date.now(),
};

export async function getCreateTripDraft(): Promise<CreateTripDraft> {
  try {
    const raw = await AsyncStorage.getItem(CREATE_TRIP_DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<CreateTripDraft>;
    return {
      tripInfo: {
        ...DEFAULT_TRIP_INFO,
        ...(parsed.tripInfo ?? {}),
      },
      itineraryDays: Array.isArray(parsed.itineraryDays) ? parsed.itineraryDays : [],
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export async function saveCreateTripDraft(next: CreateTripDraft): Promise<void> {
  const payload: CreateTripDraft = {
    ...next,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(CREATE_TRIP_DRAFT_KEY, JSON.stringify(payload));
}

export async function patchCreateTripDraft(patch: Partial<CreateTripDraft>): Promise<CreateTripDraft> {
  const current = await getCreateTripDraft();
  const merged: CreateTripDraft = {
    ...current,
    ...patch,
    tripInfo: {
      ...current.tripInfo,
      ...(patch.tripInfo ?? {}),
    },
    itineraryDays: Array.isArray(patch.itineraryDays) ? patch.itineraryDays : current.itineraryDays,
    photos: Array.isArray(patch.photos) ? patch.photos : current.photos,
    experiences: Array.isArray(patch.experiences) ? patch.experiences : current.experiences,
    updatedAt: Date.now(),
  };
  await saveCreateTripDraft(merged);
  return merged;
}

export async function clearCreateTripDraft(): Promise<void> {
  await AsyncStorage.removeItem(CREATE_TRIP_DRAFT_KEY);
}

export function formatTripDate(date: Date): string {
  return `${date.getDate()} ${date.toLocaleDateString(undefined, { month: 'short' })}`;
}

export function parseTripDate(value: string): Date {
  const trimmed = value.trim();
  const compactMatch = /^(\d{1,2})\s+([A-Za-z]{3})$/.exec(trimmed);
  if (compactMatch) {
    const day = Number(compactMatch[1]);
    const month = MONTH_LOOKUP[compactMatch[2]];
    if (Number.isFinite(day) && month !== undefined) {
      return new Date(new Date().getFullYear(), month, day);
    }
  }

  const legacyMatch = /^([A-Za-z]{3,})\s+(\d{1,2})(?:,\s*(\d{4}))?$/.exec(trimmed);
  if (legacyMatch) {
    const monthName = legacyMatch[1].slice(0, 3);
    const month = MONTH_LOOKUP[monthName];
    const day = Number(legacyMatch[2]);
    const year = legacyMatch[3] ? Number(legacyMatch[3]) : new Date().getFullYear();
    if (month !== undefined && Number.isFinite(day)) {
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function durationLabelFromCount(days: number): string {
  const safeDays = Math.max(1, days);
  return `${safeDays} ${safeDays === 1 ? 'Day' : 'Days'}`;
}

export function durationLabelFromDates(startDate: Date, endDate: Date): string {
  const startUTC = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endUTC = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const diff = Math.max(1, Math.round((endUTC - startUTC) / DAY_MS) || 0);
  return durationLabelFromCount(diff);
}

export function endDateFromStartAndDays(startDate: Date, totalDays: number): Date {
  const normalized = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const safeDays = Math.max(1, totalDays);
  normalized.setDate(normalized.getDate() + safeDays);
  return normalized;
}

export function syncTripInfoWithItinerary(tripInfo: TripInfoDraft, itineraryDays: ItineraryDayDraft[]): TripInfoDraft {
  return syncTripInfoWithDayCount(tripInfo, itineraryDays.length);
}

export function syncTripInfoWithDayCount(tripInfo: TripInfoDraft, totalDays: number): TripInfoDraft {
  if (totalDays <= 0) {
    return tripInfo;
  }

  const start = parseTripDate(tripInfo.startDate);
  const nextEnd = endDateFromStartAndDays(start, totalDays);

  return {
    ...tripInfo,
    endDate: formatTripDate(nextEnd),
    duration: durationLabelFromCount(totalDays),
  };
}
