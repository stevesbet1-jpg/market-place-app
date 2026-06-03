/**
 * linkingUtils.ts
 *
 * Safe wrappers around Expo/React-Native Linking.
 *
 * Only URLs with an explicitly allowed scheme are opened.  Anything else is
 * rejected before it ever reaches the OS — preventing open-redirect / URL
 * injection attacks if a URL value comes from user-supplied or remote data.
 */

import { Linking, Alert } from 'react-native';

/** Schemes we are willing to open in an external app. */
const ALLOWED_SCHEMES = ['https://', 'http://', 'maps://', 'comgooglemaps://'];

/**
 * Returns true if `url` starts with one of the allowed schemes.
 * Validation is intentionally strict: an empty string or scheme-relative URL
 * ("//" prefix) is rejected.
 */
export function isAllowedUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  return ALLOWED_SCHEMES.some((scheme) => lower.startsWith(scheme));
}

/**
 * Validates `url` before calling `Linking.openURL`.
 * Shows an alert and returns false for invalid URLs instead of throwing.
 *
 * @param url - The URL to open.
 * @param fallbackMessage - Optional message shown when the URL is invalid.
 */
export async function safeOpenUrl(
  url: string,
  fallbackMessage = 'This link cannot be opened.',
): Promise<boolean> {
  if (!isAllowedUrl(url)) {
    Alert.alert('Invalid Link', fallbackMessage);
    return false;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert('Could not open link', fallbackMessage);
    return false;
  }
}
