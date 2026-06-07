import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from './firebase';

const DEFAULT_API_BASE_URL = 'https://market-place-app-1.onrender.com';

export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface SetupIntentResponse {
  clientSecret: string;
}

export interface PurchaseIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  paymentMethodId: string;
  amount: number;
  currency: string;
  alreadyPurchased?: boolean;
}

export interface PurchaseRecordResponse {
  purchaseId: string;
  status: 'succeeded' | 'processing';
}

function getApiBase(): string {
  return (
    process.env.EXPO_PUBLIC_PAYMENT_API_URL ||
    process.env.EXPO_PUBLIC_RESET_API_URL ||
    DEFAULT_API_BASE_URL
  ).replace(/\/$/, '');
}

async function getIdToken(): Promise<string> {
  const user = getAuth(getFirebaseApp()).currentUser;
  if (!user) throw new Error('Please sign in to manage payments.');
  return user.getIdToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Payment request failed.';
    throw new Error(message);
  }

  return payload as T;
}

export async function createSetupIntent(): Promise<SetupIntentResponse> {
  return request<SetupIntentResponse>('/api/stripe/setup-intent', { method: 'POST' });
}

export async function listPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const payload = await request<{ paymentMethods: SavedPaymentMethod[] }>('/api/stripe/payment-methods');
  return payload.paymentMethods;
}

export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
  await request('/api/stripe/payment-methods/default', {
    method: 'POST',
    body: JSON.stringify({ paymentMethodId }),
  });
}

export async function removePaymentMethod(paymentMethodId: string): Promise<void> {
  await request(`/api/stripe/payment-methods/${encodeURIComponent(paymentMethodId)}`, {
    method: 'DELETE',
  });
}

export async function createExperiencePurchaseIntent(
  experienceId: string,
  paymentMethodId?: string,
): Promise<PurchaseIntentResponse> {
  return request<PurchaseIntentResponse>('/api/stripe/purchases/create-payment-intent', {
    method: 'POST',
    body: JSON.stringify({ experienceId, paymentMethodId }),
  });
}

export async function confirmExperiencePurchase(paymentIntentId: string): Promise<PurchaseRecordResponse> {
  return request<PurchaseRecordResponse>('/api/stripe/purchases/confirm', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId }),
  });
}

export async function hasPurchasedExperience(experienceId: string): Promise<boolean> {
  const payload = await request<{ purchased: boolean }>(
    `/api/stripe/purchases/${encodeURIComponent(experienceId)}`,
  );
  return payload.purchased;
}
