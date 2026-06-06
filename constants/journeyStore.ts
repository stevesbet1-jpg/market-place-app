import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BudgetLevel } from './journeys';
import { syncJourneySavedCount } from '../lib/creatorJourneyService';

export const FREE_JOURNEY_LIMIT = 3;

let _journeyStoreUid: string | null = null;
export function setJourneyStoreUid(uid: string | null): void { _journeyStoreUid = uid; }
const _u = () => _journeyStoreUid ?? 'anon';
const KEY_FREE_REMAINING = () => `@journeys/${_u()}/free_remaining`;
const KEY_OPENED_IDS     = () => `@journeys/${_u()}/opened_ids`;
const KEY_SAVED_IDS      = () => `@journeys/${_u()}/saved_ids`;
const KEY_BUDGET_PREF    = () => `@journeys/${_u()}/budget_pref`;

// ── Free counter ────────────────────────────────────────────────────

export async function getFreeRemaining(): Promise<number> {
  const stored = await AsyncStorage.getItem(KEY_FREE_REMAINING());
  if (stored === null) return FREE_JOURNEY_LIMIT;
  const n = parseInt(stored, 10);
  return isNaN(n) ? FREE_JOURNEY_LIMIT : Math.max(0, n);
}

/**
 * Decrements the free counter only if this journey has never been opened before.
 * Returns the updated remaining count.
 */
export async function consumeFreeJourney(id: string): Promise<number> {
  const [remaining, openedRaw] = await Promise.all([
    getFreeRemaining(),
    AsyncStorage.getItem(KEY_OPENED_IDS()),
  ]);
  const opened: string[] = openedRaw ? JSON.parse(openedRaw) : [];

  if (opened.includes(id)) {
    // Already opened — don't decrement, just return current
    return remaining;
  }

  // First open of this journey
  const newOpened = [...opened, id];
  const newRemaining = Math.max(0, remaining - 1);

  await Promise.all([
    AsyncStorage.setItem(KEY_OPENED_IDS(), JSON.stringify(newOpened)),
    AsyncStorage.setItem(KEY_FREE_REMAINING(), String(newRemaining)),
  ]);

  return newRemaining;
}

// ── Saved journeys ──────────────────────────────────────────────────

export async function getSavedIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY_SAVED_IDS());
  return raw ? JSON.parse(raw) : [];
}

/**
 * Toggles saved state for a journey. Returns the new saved IDs list.
 */
export async function toggleSaved(id: string): Promise<string[]> {
  const saved = await getSavedIds();
  const wasSaved = saved.includes(id);
  const next = wasSaved
    ? saved.filter((s) => s !== id)
    : [...saved, id];
  await AsyncStorage.setItem(KEY_SAVED_IDS(), JSON.stringify(next));

  // Keep Firestore social-proof counter in sync, but never block UX on failures.
  syncJourneySavedCount(id, wasSaved ? -1 : 1).catch(() => {});

  return next;
}

// ── Budget preference ───────────────────────────────────────────────

export async function getBudgetPref(): Promise<BudgetLevel | null> {
  const raw = await AsyncStorage.getItem(KEY_BUDGET_PREF());
  return (raw as BudgetLevel) ?? null;
}

export async function setBudgetPref(budget: BudgetLevel | null): Promise<void> {
  if (budget === null) {
    await AsyncStorage.removeItem(KEY_BUDGET_PREF());
  } else {
    await AsyncStorage.setItem(KEY_BUDGET_PREF(), budget);
  }
}
