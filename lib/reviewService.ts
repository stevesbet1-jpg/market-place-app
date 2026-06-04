import {
  Timestamp,
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp, getFirestoreDb } from './firebase';

export interface JourneyReview {
  id: string;
  journeyId: string;
  uid: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAtMs: number;
}

interface FirestoreReview {
  journeyId: string;
  uid: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt?: Timestamp;
}

export async function getJourneyReviews(journeyId: string, max = 20): Promise<JourneyReview[]> {
  if (!journeyId) return [];

  const db = getFirestoreDb();
  const reviewsRef = collection(db, 'reviews');
  const q = query(
    reviewsRef,
    where('journeyId', '==', journeyId),
    orderBy('createdAt', 'desc'),
    limit(max),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as FirestoreReview;
    return {
      id: d.id,
      journeyId: raw.journeyId,
      uid: raw.uid,
      authorName: raw.authorName || 'Traveler',
      rating: Math.max(1, Math.min(5, Number(raw.rating) || 0)),
      comment: raw.comment || '',
      createdAtMs: raw.createdAt?.toMillis?.() ?? 0,
    };
  });
}

export async function submitJourneyReview(input: {
  journeyId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const auth = getAuth(getFirebaseApp());
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to leave a review.');
  }

  const rating = Math.round(input.rating);
  if (!input.journeyId) {
    throw new Error('Missing journey id');
  }
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const comment = input.comment.trim();
  if (comment.length < 6) {
    throw new Error('Review comment is too short');
  }

  const db = getFirestoreDb();
  await addDoc(collection(db, 'reviews'), {
    journeyId: input.journeyId,
    uid: user.uid,
    authorName: user.displayName || user.email || 'Traveler',
    rating,
    comment,
    createdAt: serverTimestamp(),
  });
}
