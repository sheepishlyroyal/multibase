/**
 * FirestoreOffline — enable IndexedDB persistence across every shard, and
 * toggle network state for testing offline behaviour.
 *
 * After `enable()`, reads served from the local cache come back without
 * hitting the network at all — a huge win for repeat-session UIs. Writes
 * queue locally and flush on reconnect.
 *
 *   await mb.firestore.offline.enable();  // call ONCE at startup, BEFORE reads
 *   await mb.firestore.offline.goOffline();
 *   await mb.write("notes", { ... });     // queued locally
 *   await mb.firestore.offline.goOnline(); // writes flush
 */

import {
  enableIndexedDbPersistence,
  disableNetwork,
  enableNetwork,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

export class FirestoreOffline {
  constructor(multibase) {
    this.multibase = multibase;
  }

  /**
   * Enable IndexedDB persistence on every shard. Call exactly once per
   * tab, before any reads. Returns an array with one entry per shard so
   * you can see which shards succeeded (multiple tabs open or unsupported
   * browsers will fail cleanly).
   */
  async enable() {
    const results = [];
    for (const db of this.multibase.databases) {
      try {
        await enableIndexedDbPersistence(db);
        results.push({ ok: true });
      } catch (err) {
        results.push({
          ok: false,
          code: err.code,
          message: err.message,
        });
      }
    }
    return results;
  }

  /** Go offline on every shard. Writes queue; reads hit the cache. */
  async goOffline() {
    await Promise.all(
      this.multibase.databases.map((db) => disableNetwork(db))
    );
  }

  /** Reconnect every shard. Queued writes flush. */
  async goOnline() {
    await Promise.all(
      this.multibase.databases.map((db) => enableNetwork(db))
    );
  }
}
