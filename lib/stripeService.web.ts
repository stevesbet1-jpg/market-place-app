/**
 * Web-safe Stripe service shim.
 * Membership checkout remains native-only and is unavailable on web.
 */

export type MembershipPlan = 'monthly' | 'annual';

export const PLAN_PRICES: Record<MembershipPlan, number> = {
  monthly: 1199,
  annual: 7900,
};

export const PLAN_LABELS: Record<MembershipPlan, string> = {
  monthly: 'Monthly Membership - $11.99/month',
  annual: 'Annual Membership - $79/year',
};

export type StripePaymentResult =
  | { success: true }
  | { success: false; cancelled: boolean; error?: string };

export async function purchaseMembership(): Promise<StripePaymentResult> {
  return {
    success: false,
    cancelled: false,
    error: 'Membership checkout is available on iOS and Android only.',
  };
}
