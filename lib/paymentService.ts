import { getAuth } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFirebaseApp, getFirestoreDb } from './firebase';

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
  status: 'paid' | 'processing';
}

function getApiBase(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_PAYMENT_API_URL;
  if (!configuredUrl) {
    throw new Error('Payment API URL is not configured. Set EXPO_PUBLIC_PAYMENT_API_URL to your backend base URL.');
  }
  return configuredUrl.replace(/\/$/, '');
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

export async function listPurchasedExperienceIds(): Promise<string[]> {
  const user = getAuth(getFirebaseApp()).currentUser;
  if (!user) return [];

  const purchasesCollectionPath = 'purchases';
  try {
    const purchasesQuery = query(
      collection(getFirestoreDb(), purchasesCollectionPath),
      where('uid', '==', user.uid),
    );
    const snapshot = await getDocs(purchasesQuery);
    return snapshot.docs
      .map((docSnap) => docSnap.data() as { experienceId?: unknown; paid?: unknown; status?: unknown })
      .filter((purchase) => purchase.paid === true || purchase.status === 'paid' || purchase.status === 'succeeded')
      .map((purchase) => purchase.experienceId)
      .filter((experienceId): experienceId is string => typeof experienceId === 'string' && experienceId.length > 0);
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[Payments] Firestore permission denied while reading collection:', purchasesCollectionPath);
      return [];
    }
    throw error;
  }
}
