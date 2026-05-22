import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  FieldValue,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';

// ─── Types ─────────────────────────────────────────────────────────

export interface Product {
  id?: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  ownerId: string;
  ownerName: string | null;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Write ─────────────────────────────────────────────────────────

/**
 * Adds a new product to the "products" collection.
 * Returns the auto-generated document ID.
 */
export async function addProduct(data: ProductInput): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, 'products'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Read ──────────────────────────────────────────────────────────

/**
 * Fetches the most recently listed products, ordered by createdAt desc.
 */
export async function getLatestProducts(limitCount = 20): Promise<Product[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
  } catch (e: any) {
    console.warn('[Products] getLatestProducts failed:', e.message);
    return [];
  }
}
