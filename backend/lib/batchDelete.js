import { db } from "../shared/firebase.js";

// Firestore allows at most 500 writes per commit.
const BATCH_LIMIT = 500;

/**
 * Deletes every document the query matches, in commits of up to `batchSize`, until none remain.
 * Resolves to the number of documents deleted.
 */
export async function deleteQueryInBatches(query, batchSize = BATCH_LIMIT) {
  let deleted = 0;
  let snapshot = await query.limit(batchSize).get();

  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    deleted += snapshot.size;
    snapshot = await query.limit(batchSize).get();
  }

  return deleted;
}
