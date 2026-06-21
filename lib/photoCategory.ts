export type NormalizedPhotoCategory = 'places' | 'food' | 'activities' | 'other';

export type NormalizedPhotoSource = 'ai' | 'fallback' | 'needs_review';

export function normalizePhotoCategory(value: string | undefined | null): NormalizedPhotoCategory {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'places' || normalized === 'place') return 'places';
  if (normalized === 'food') return 'food';
  if (normalized === 'activities' || normalized === 'activity') return 'activities';
  if (normalized === 'other' || normalized === 'uncategorized' || normalized === 'needs_review') return 'other';

  return 'other';
}

export function normalizePhotoSource(
  value: string | undefined | null,
  category: NormalizedPhotoCategory,
): NormalizedPhotoSource {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'ai' || normalized === 'fallback' || normalized === 'needs_review') {
    return normalized;
  }
  return category === 'other' ? 'needs_review' : 'fallback';
}
