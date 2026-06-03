/**
 * stripeService.ts
 *
 * Client-side Stripe integration for membership purchases.
 *
 * Flow:
 *  1. App calls createPaymentIntent(plan) → POST /api/stripe/create-payment-intent
 *  2. Server creates a Stripe PaymentIntent and returns { clientSecret }
 *  3. App calls initPaymentSheet(clientSecret) then presentPaymentSheet()
 *  4. On payment success, server Stripe webhook fires → writes membership record to Firestore
 *  5. App calls checkMembership() to confirm and update UI
 *
 * Requirements:
 *  - EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env
 *  - EXPO_PUBLIC_RESET_API_URL pointing at the Render backend
 *  - StripeProvider wrapping the app root (see app/layout.tsx)
 */

import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';

// ─── Types ─────────────────────────────────────────────────────────────────

export type MembershipPlan = 'monthly' | 'annual';

/** Prices in USD cents */
export const PLAN_PRICES: Record<MembershipPlan, number> = {
  monthly: 1199, // $11.99
  annual:  7900, // $79.00
};

export const PLAN_LABELS: Record<MembershipPlan, string> = {
  monthly: 'Monthly Membership — $11.99/month',
  annual:  'Annual Membership — $79/year',
};

export type StripePaymentResult =
  | { success: true }
  | { success: false; cancelled: boolean; error?: string };

// ─── Server base URL ────────────────────────────────────────────────────────

function getApiBase(): string {
  return (
    (process.env.EXPO_PUBLIC_RESET_API_URL ?? '').replace(/\/$/, '') ||
    'http://localhost:3001'
  );
}

// ─── Step 1: Request a PaymentIntent from server ────────────────────────────

async function createPaymentIntent(
  plan: MembershipPlan,
  uid: string,
  email: string,
): Promise<string> {
  const response = await fetch(`${getApiBase()}/api/stripe/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, uid, email }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Server error ${response.status}`);
  }

  const data: { clientSecret: string } = await response.json();
  if (!data.clientSecret) throw new Error('No clientSecret returned from server');
  return data.clientSecret;
}

// ─── Step 2: Init + present Stripe Payment Sheet ────────────────────────────

/**
 * Full purchase flow: creates a PaymentIntent, initialises the payment sheet,
 * and presents the native Stripe UI to the user.
 *
 * Returns { success: true } if payment completed.
 * Returns { success: false, cancelled: true } if user dismissed the sheet.
 * Returns { success: false, cancelled: false, error } on failure.
 */
export async function purchaseMembership(
  plan: MembershipPlan,
  uid: string,
  email: string,
): Promise<StripePaymentResult> {
  try {
    const clientSecret = await createPaymentIntent(plan, uid, email);

    const initResult = await initPaymentSheet({
      merchantDisplayName: 'Marketplace Travel',
      paymentIntentClientSecret: clientSecret,
      defaultBillingDetails: { email },
      style: 'alwaysDark',
      primaryButtonLabel: `Pay ${plan === 'annual' ? '$79.00' : '$11.99'}`,
    });

    if (initResult.error) {
      return { success: false, cancelled: false, error: initResult.error.message };
    }

    const presentResult = await presentPaymentSheet();

    if (presentResult.error) {
      const cancelled = presentResult.error.code === 'Canceled';
      return {
        success: false,
        cancelled,
        error: cancelled ? undefined : presentResult.error.message,
      };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, cancelled: false, error: err.message ?? 'Unknown error' };
  }
}
