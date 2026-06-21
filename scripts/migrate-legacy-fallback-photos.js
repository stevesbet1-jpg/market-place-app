/*
  One-time migration for legacy tripData.photos classifications.

  What it does:
  - Scans published creatorExperiences documents.
  - Finds photos classified as places via fallback source.
  - In apply mode, rewrites those photos to needs_review + uncategorized.

  Why:
  - Legacy records may have been force-defaulted to places and stored that way.
  - These should be flagged for manual review instead of treated as true places.

  Usage:
    node scripts/migrate-legacy-fallback-photos.js
    node scripts/migrate-legacy-fallback-photos.js --apply
    node scripts/migrate-legacy-fallback-photos.js --maxDocs=500
*/

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  writeBatch,
  doc,
  documentId,
} = require('firebase/firestore');

function readArg(name, fallback) {
  const exact = process.argv.find((arg) => arg === `--${name}`);
  if (exact) return true;
  const prefixed = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!prefixed) return fallback;
  return prefixed.split('=')[1];
}

const APPLY = Boolean(readArg('apply', false));
const MAX_DOCS = Number(readArg('maxDocs', '200')) || 200;
const PAGE_SIZE = 50;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyC-qVQofrZ3m2jLhN8YB8b1aVQ2dFM1A0Q',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'marketplace-app-3b3f7.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'marketplace-app-3b3f7',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'marketplace-app-3b3f7.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '601263564942',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:601263564942:web:7f538bc8547f88bd2e4e37',
};

function normalizeCategory(value) {
  if (value === 'food' || value === 'activities' || value === 'places') return value;
  return 'uncategorized';
}

function isLegacyFallbackPlace(photo) {
  const category = normalizeCategory(photo?.category);
  const source = String(photo?.categorySource || photo?.source || '').toLowerCase();
  return category === 'places' && source === 'fallback';
}

function summarizeCounts(rows) {
  const categoryCounts = {};
  const sourceCounts = {};
  for (const r of rows) {
    const c = String(r.category ?? 'null');
    const s = String(r.source ?? 'null');
    categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }
  return { categoryCounts, sourceCounts };
}

async function loadDocs(db) {
  const results = [];
  let cursor = null;

  while (results.length < MAX_DOCS) {
    let q = query(
      collection(db, 'creatorExperiences'),
      where('published', '==', true),
      orderBy(documentId()),
      limit(Math.min(PAGE_SIZE, MAX_DOCS - results.length))
    );

    if (cursor) {
      q = query(
        collection(db, 'creatorExperiences'),
        where('published', '==', true),
        orderBy(documentId()),
        startAfter(cursor),
        limit(Math.min(PAGE_SIZE, MAX_DOCS - results.length))
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) break;

    snap.docs.forEach((d) => results.push(d));
    cursor = snap.docs[snap.docs.length - 1].id;
  }

  return results;
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const docs = await loadDocs(db);
  const allRows = [];
  const changes = [];

  for (const d of docs) {
    const data = d.data() || {};
    const tripData = data.tripData || {};
    const photos = Array.isArray(tripData.photos) ? tripData.photos : [];

    if (!photos.length) continue;

    const nextPhotos = photos.map((photo) => {
      const row = {
        experienceId: d.id,
        photoId: photo?.id ?? null,
        uri: photo?.uri ?? null,
        category: photo?.category ?? null,
        source: photo?.categorySource ?? photo?.source ?? null,
      };
      allRows.push(row);

      if (!isLegacyFallbackPlace(photo)) return photo;

      return {
        ...photo,
        category: 'uncategorized',
        categorySource: 'needs_review',
        classificationStatus: 'pending',
        classificationReason: 'legacy fallback migration',
        updatedAt: Date.now(),
      };
    });

    const mutated = nextPhotos.some((p, idx) => p !== photos[idx]);
    if (mutated) {
      changes.push({
        id: d.id,
        beforePhotos: photos,
        afterPhotos: nextPhotos,
      });
    }
  }

  const before = summarizeCounts(allRows);

  let migratedPhotos = 0;
  for (const c of changes) {
    c.beforePhotos.forEach((p) => {
      if (isLegacyFallbackPlace(p)) migratedPhotos += 1;
    });
  }

  const summary = {
    applyMode: APPLY,
    scannedDocs: docs.length,
    docsWithPhotos: new Set(allRows.map((r) => r.experienceId)).size,
    totalPhotos: allRows.length,
    docsToUpdate: changes.length,
    photosToMigrate: migratedPhotos,
    before,
    sampleTargets: allRows.filter((r) => r.category === 'places' && String(r.source) === 'fallback').slice(0, 10),
  };

  if (!APPLY) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (!changes.length) {
    console.log(JSON.stringify({ ...summary, writeResult: 'no-op' }, null, 2));
    return;
  }

  const batch = writeBatch(db);
  for (const c of changes) {
    batch.update(doc(db, 'creatorExperiences', c.id), {
      'tripData.photos': c.afterPhotos,
      updatedAt: new Date(),
    });
  }

  await batch.commit();

  console.log(
    JSON.stringify(
      {
        ...summary,
        writeResult: 'committed',
        updatedDocs: changes.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('MIGRATION_ERROR', error?.message || String(error));
  process.exit(1);
});
