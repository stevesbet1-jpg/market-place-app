export const DEFAULT_COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80';

export function isValidRemoteImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function remoteImageOrPlaceholder(url: string | null | undefined): string {
  return isValidRemoteImageUrl(url) ? (url as string).trim() : DEFAULT_COVER_IMAGE_URL;
}
