/**
 * diagnose-duplicate-journeys.js
 *
 * Queries creatorExperiences for ALL docs belonging to the signed-in
 * creator and prints: docId, collection, title, creatorId, status.
 *
 * Usage:
 *   node scripts/diagnose-duplicate-journeys.js
 */

const path = require('path');
const admin = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
const serviceAccount = require('./serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();
db.settings({ preferRest: true });

async function main() {
  console.log('\n=== creatorExperiences — ALL documents ===');
  const expSnap = await db.collection('creatorExperiences').get();
  const expRows = expSnap.docs.map((d) => {
    const data = d.data();
    return {
      collection: 'creatorExperiences',
      id: d.id,
      title: data.title ?? '(no title)',
      creatorId: data.creatorId ?? '(none)',
      userId: data.userId ?? '(none)',
      uid: data.uid ?? '(none)',
      status: data.status ?? '(none)',
      published: data.published ?? '(none)',
    };
  });

  for (const row of expRows) {
    console.log(JSON.stringify(row));
  }

  console.log('\n=== creator_journeys — ALL documents ===');
  const jSnap = await db.collection('creator_journeys').get();
  const jRows = jSnap.docs.map((d) => {
    const data = d.data();
    return {
      collection: 'creator_journeys',
      id: d.id,
      title: data.title ?? '(no title)',
      creatorId: data.creatorId ?? '(none)',
      userId: data.userId ?? '(none)',
      uid: data.uid ?? '(none)',
      status: data.status ?? '(none)',
      published: data.published ?? '(none)',
    };
  });

  for (const row of jRows) {
    console.log(JSON.stringify(row));
  }

  // Highlight any title that appears more than once across both collections
  const all = [...expRows, ...jRows];
  const byTitle = {};
  for (const row of all) {
    const key = (row.title ?? '').trim().toLowerCase();
    if (!byTitle[key]) byTitle[key] = [];
    byTitle[key].push(row);
  }

  console.log('\n=== DUPLICATES (same title, multiple docs) ===');
  let found = false;
  for (const [title, rows] of Object.entries(byTitle)) {
    if (rows.length > 1) {
      found = true;
      console.log(`\nTitle: "${title}"`);
      for (const row of rows) {
        console.log('  ', JSON.stringify(row));
      }
    }
  }
  if (!found) console.log('No duplicate titles found across both collections.');

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
