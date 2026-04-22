/**
 * cloud-functions/ttl-cleanup.example.js
 *
 * Every 15 minutes, walk each shard's target collections and delete every
 * doc whose `_expiresAt` is in the past. Batched to 500 per sweep per
 * shard per collection.
 *
 * Deploy:
 *   cp ttl-cleanup.example.js ~/multibase-functions/functions/index.js
 *   firebase deploy --only functions:cleanupExpiredDocs
 *
 * Deploy this to ONE shard only — the same function talks to every
 * shard via the Admin SDK, so duplicating it just burns quota.
 *
 * Paste your shard project ids from multibase.config.js into
 * SHARD_PROJECT_IDS below.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// -----------------------------------------------------------------------
// EDIT THESE TWO LISTS for your own deployment.
// -----------------------------------------------------------------------
const SHARD_PROJECT_IDS = [
  "your-project-1",
  "your-project-2",
  // add every shard project id from multibase.config.js
];

const TARGET_COLLECTIONS = ["ephemeral", "sessions"];
// -----------------------------------------------------------------------

const apps = SHARD_PROJECT_IDS.map((projectId) =>
  initializeApp({ projectId }, `shard-${projectId}`)
);

exports.cleanupExpiredDocs = onSchedule(
  { schedule: "every 15 minutes", memory: "256MiB" },
  async () => {
    const now = Date.now();
    let totalDeleted = 0;

    for (const app of apps) {
      const db = getFirestore(app);
      for (const col of TARGET_COLLECTIONS) {
        const snap = await db
          .collection(col)
          .where("_expiresAt", "<=", now)
          .limit(500)
          .get();

        if (snap.empty) continue;

        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += snap.size;
      }
    }

    console.log(
      `Deleted ${totalDeleted} expired doc(s) across ${apps.length} shard(s)`
    );
  }
);
