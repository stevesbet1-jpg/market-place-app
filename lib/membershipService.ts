/**
 * membershipService.ts
 *
 * Reads and evaluates user membership status from Firestore.
 *
 * The `users/{uid}` document may contain a `membership` sub-object:
 * {
 *   status:      'active' | 'inactive'
 *   plan:        'monthly' | 'annual'
 *   activatedAt: Timestamp
 *   expiresAt:   Timestamp | null   — null means the plan auto-renews (no hard expiry)
 *   stripeCustomerId?: string       — populated by Stripe webhook (Phase 4)
 *   stripeSubscriptionId?: string   — populated by Stripe webhook (Phase 4)
 * }
 *
 * A membership is considered ACTIVE when:
 *   - status === 'active'
 *   - expiresAt is null (unlimited / auto-renewing) OR expiresAt is in the future
 *
 * This structure is forward-compatible with Stripe webhooks: the webhook handler
 * simply writes/updates this sub-object on subscription events.
 */

import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MembershipRecord {
  status: 'active' | 'inactive';
  plan: 'monthly' | 'annual';
  activatedAt: Timestamp;
  /** null = auto-renewing, no hard expiry date */
  expiresAt: Timestamp | null;
  /** Populated after Stripe integration (Phase 4) */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

// ─── Core check ────────────────────────────────────────────────────────────

/**
 * Returns true if the given user currently has an active membership.
 *
 * Rules:
 *  - status must be 'active'
 *  - expiresAt must be null (auto-renew) OR in the future
 *
 * Returns false on any error, missing record, or lapsed subscription.
 * This is intentionally fail-closed (no membership assumed on error).
 */
export async function checkMembership(uid: string): Promise<boolean> {
  if (!uid || !isFirebaseConfigured()) return false;
  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return false;

    const membership = snap.data()?.membership as MembershipRecord | undefined;
    if (!membership || membership.status !== 'active') return false;

    if (membership.expiresAt) {
      const nowMs = Timestamp.now().toMillis();
      if (membership.expiresAt.toMillis() < nowMs) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the full membership record for display purposes (plan name, expiry, etc.).
 * Returns null if the user has no membership or on any error.
 */
export async function getMembershipRecord(uid: string): Promise<MembershipRecord | null> {
  if (!uid || !isFirebaseConfigured()) return null;
  try {
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return (snap.data()?.membership as MembershipRecord | undefined) ?? null;
  } catch {
    return null;
  }
}
