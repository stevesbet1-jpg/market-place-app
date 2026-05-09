import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  DocumentData,
  WithFieldValue,
  UpdateData,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './firebase';

// ─── Guards ────────────────────────────────────────────────────────

function ensureConfigured(): void {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Check your .env variables.');
  }
}

// ─── Create / Set ──────────────────────────────────────────────────

export async function createDocument<T extends DocumentData>(
  collectionPath: string,
  documentId: string,
  data: WithFieldValue<T>
): Promise<void> {
  ensureConfigured();
  const db = getFirestoreDb();
  await setDoc(doc(db, collectionPath, documentId), data);
}

/** Creates a document with auto-generated server timestamp. */
export async function createDocumentWithTimestamp<T extends DocumentData>(
  collectionPath: string,
  documentId: string,
  data: WithFieldValue<T>
): Promise<void> {
  ensureConfigured();
  const db = getFirestoreDb();
  await setDoc(doc(db, collectionPath, documentId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─── Read ──────────────────────────────────────────────────────────

export async function readDocument<T = DocumentData>(
  collectionPath: string,
  documentId: string
): Promise<T | null> {
  ensureConfigured();
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, collectionPath, documentId));
  return snap.exists() ? (snap.data() as T) : null;
}

// ─── Update ────────────────────────────────────────────────────────

export async function updateDocument<T extends DocumentData>(
  collectionPath: string,
  documentId: string,
  data: UpdateData<T>
): Promise<void> {
  ensureConfigured();
  const db = getFirestoreDb();
  await updateDoc(doc(db, collectionPath, documentId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ─── Delete ────────────────────────────────────────────────────────

export async function deleteDocument(
  collectionPath: string,
  documentId: string
): Promise<void> {
  ensureConfigured();
  const db = getFirestoreDb();
  await deleteDoc(doc(db, collectionPath, documentId));
}

// ─── Realtime Listener ─────────────────────────────────────────────

export function subscribeToDocument<T = DocumentData>(
  collectionPath: string,
  documentId: string,
  onData: (data: T | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  ensureConfigured();
  const db = getFirestoreDb();
  return onSnapshot(
    doc(db, collectionPath, documentId),
    (snap) => onData(snap.exists() ? (snap.data() as T) : null),
    (err) => onError?.(err)
  );
}

// ─── Test Helpers ──────────────────────────────────────────────────

export interface TestDocument {
  message: string;
  platform: string;
  timestamp: ReturnType<typeof serverTimestamp>;
  status: 'ok' | 'error';
}

/** Safe test: writes a document to the `test` collection and logs the result. */
export async function runFirestoreTest(): Promise<boolean> {
  try {
    if (!isFirebaseConfigured()) {
      console.warn('[FirestoreTest] Firebase not configured — skipping.');
      return false;
    }

    const testId = `test_${Date.now()}`;
    await createDocumentWithTimestamp('test', testId, {
      message: 'Firestore connected from Expo React Native',
      platform: 'Expo JS SDK',
      status: 'ok',
    });

    const result = await readDocument('test', testId);
    console.log('[FirestoreTest] Document written and read successfully:', result);
    return true;
  } catch (error: any) {
    console.error('[FirestoreTest] Failed:', error.message);
    return false;
  }
}
