import type { PhotoEntryDraft } from '../constants/createTripDraftStore';

export const MEMORY_GALLERY_SELECTION_KEY = '@memoryGallery/selectedPhotos';

export function sortPhotosByDate(photos: PhotoEntryDraft[]): PhotoEntryDraft[] {
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => {
      const aCreatedAt = (a.photo as unknown as { createdAt?: string | number }).createdAt;
      const bCreatedAt = (b.photo as unknown as { createdAt?: string | number }).createdAt;

      const aTime = typeof aCreatedAt === 'number' ? aCreatedAt : Date.parse(String(aCreatedAt ?? ''));
      const bTime = typeof bCreatedAt === 'number' ? bCreatedAt : Date.parse(String(bCreatedAt ?? ''));

      const aValid = Number.isFinite(aTime);
      const bValid = Number.isFinite(bTime);

      // Newest first when timestamps are available.
      if (aValid && bValid && aTime !== bTime) return bTime - aTime;
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;

      // Stable fallback to original insertion order.
      return a.index - b.index;
    })
    .map(({ photo }) => photo);
}
