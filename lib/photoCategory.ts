export type NormalizedPhotoCategory = 'places' | 'food' | 'activities' | 'beach' | 'animals';

export type NormalizedPhotoSource = 'ai' | 'fallback' | 'needs_review' | 'manual';

export function normalizePhotoCategory(value: string | undefined | null): NormalizedPhotoCategory {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'places' || normalized === 'place') return 'places';
  if (normalized === 'food') return 'food';
  if (normalized === 'activities' || normalized === 'activity') return 'activities';
  if (normalized === 'beach' || normalized === 'beaches') return 'beach';
  if (normalized === 'animals' || normalized === 'animal' || normalized === 'wildlife') return 'animals';
  if (normalized === 'other' || normalized === 'uncategorized' || normalized === 'needs_review') return 'beach';

  return 'beach';
}

export function normalizePhotoSource(
  value: string | undefined | null,
  category: NormalizedPhotoCategory,
): NormalizedPhotoSource {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'ai' || normalized === 'fallback' || normalized === 'needs_review' || normalized === 'manual') {
    return normalized;
  }
  return category === 'beach' ? 'needs_review' : 'fallback';
}
