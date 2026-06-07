/**
 * experienceStore.ts
 *
 * Local persistence for the Experience Detail page:
 *   - Free unlock credits (3 free full experience views)
 *   - Previously-unlocked experience IDs (persist unlock across sessions)
 *   - Saved experience IDs (bookmarks)
 *
 * Mirrors the shape of journeyStore.ts so the two are interchangeable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncExperienceSavedCount } from '../lib/creatorExperienceService';

export const FREE_EXPERIENCE_LIMIT = 3;

let _experienceStoreUid: string | null = null;
export function setExperienceStoreUid(uid: string | null): void { _experienceStoreUid = uid; }
const _e = () => _experienceStoreUid ?? 'anon';
const KEY_FREE_REMAINING  = () => `@experiences/${_e()}/free_remaining`;
const KEY_UNLOCKED_IDS    = () => `@experiences/${_e()}/unlocked_ids`;
const KEY_SAVED_IDS       = () => `@experiences/${_e()}/saved_ids`;

// ── Free credits ──────────────────────────────────────────────────────────────

export async function getFreeExperienceRemaining(): Promise<number> {
  const stored = await AsyncStorage.getItem(KEY_FREE_REMAINING());
  if (stored === null) return FREE_EXPERIENCE_LIMIT;
  const n = parseInt(stored, 10);
  return isNaN(n) ? FREE_EXPERIENCE_LIMIT : Math.max(0, n);
}

/**
 * Marks an experience as fully unlocked (first time only) and decrements
 * the free credit counter.
 *
 * Returns the updated remaining count.
 * Returns current remaining unchanged if the experience was already unlocked.
 */
export async function consumeFreeExperience(id: string): Promise<number> {
  const [remaining, unlockedRaw] = await Promise.all([
    getFreeExperienceRemaining(),
    AsyncStorage.getItem(KEY_UNLOCKED_IDS()),
  ]);

  const unlocked: string[] = unlockedRaw ? JSON.parse(unlockedRaw) : [];

  if (unlocked.includes(id)) {
    // Already unlocked — free to view again, no decrement
    return remaining;
  }

  const newUnlocked = [...unlocked, id];
  const newRemaining = Math.max(0, remaining - 1);

  await Promise.all([
    AsyncStorage.setItem(KEY_UNLOCKED_IDS(), JSON.stringify(newUnlocked)),
    AsyncStorage.setItem(KEY_FREE_REMAINING(), String(newRemaining)),
  ]);

  return newRemaining;
}

/**
 * Returns whether the user has a full view (unlocked) for a given experience ID.
 */
export async function isExperienceUnlocked(id: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY_UNLOCKED_IDS());
  const unlocked: string[] = raw ? JSON.parse(raw) : [];
  return unlocked.includes(id);
}

export async function markExperienceUnlocked(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY_UNLOCKED_IDS());
  const unlocked: string[] = raw ? JSON.parse(raw) : [];
  if (unlocked.includes(id)) return;
  await AsyncStorage.setItem(KEY_UNLOCKED_IDS(), JSON.stringify([...unlocked, id]));
}

// ── Saved experiences ─────────────────────────────────────────────────────────

export async function getSavedExperienceIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY_SAVED_IDS());
  return raw ? JSON.parse(raw) : [];
}

/**
 * Toggles saved state. Returns the new saved IDs list.
 */
export async function toggleSavedExperience(id: string): Promise<string[]> {
  const saved = await getSavedExperienceIds();
  const wasSaved = saved.includes(id);
  const next = wasSaved
    ? saved.filter((s) => s !== id)
    : [...saved, id];
  await AsyncStorage.setItem(KEY_SAVED_IDS(), JSON.stringify(next));

  // Keep Firestore social-proof counter in sync, but never block UX on failures.
  syncExperienceSavedCount(id, wasSaved ? -1 : 1).catch(() => {});

  return next;
}
