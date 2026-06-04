import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp, isFirebaseConfigured } from './firebase';
import { getStorage } from 'firebase/storage';

function normalizeFileExtension(uri: string): string {
  const clean = uri.split('?')[0] || '';
  const idx = clean.lastIndexOf('.');
  if (idx === -1) return 'jpg';
  const ext = clean.slice(idx + 1).toLowerCase();
  if (!ext || ext.length > 6) return 'jpg';
  return ext;
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read selected image.');
  }
  return await response.blob();
}

export async function uploadCoverImage(localUri: string, kind: 'journeys' | 'experiences'): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured.');
  }

  const auth = getAuth(getFirebaseApp());
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('You must be signed in to upload images.');
  }

  const storage = getStorage(getFirebaseApp());
  const ext = normalizeFileExtension(localUri);
  const fileName = `${Date.now()}.${ext}`;
  const objectPath = `creator-media/${uid}/${kind}/${fileName}`;
  const storageRef = ref(storage, objectPath);

  const blob = await uriToBlob(localUri);
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || `image/${ext}`,
  });

  return await getDownloadURL(storageRef);
}
