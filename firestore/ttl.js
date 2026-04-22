/**
 * FirestoreTTL — document expiry via an `_expiresAt` timestamp field.
 *
 *   mb.firestore.ttl.set("sessions", null, { user: uid }, { ttlMs: 300_000 });
 *   const s = await mb.firestore.ttl.get("sessions", id);  // null if expired
 *   const live = await mb.firestore.ttl.list("sessions");  // filters expired
 *   await mb.firestore.ttl.purgeExpired("sessions");       // client-side cleanup
 *
 * Real scheduled purging should run server-side — see
 * [`../cloud-functions/ttl-cleanup.example.js`](../cloud-functions/ttl-cleanup.example.js).
 *
 * Native alternative: Firestore has a built-in TTL feature. In the console,
 * mark one timestamp field as TTL and Firestore deletes expired docs for
 * you within 24 hours. Use native TTL when you don't need minute-granular
 * precision.
 */

const META_EXPIRES_FIELD = "_expiresAt";

export class FirestoreTTL {
  constructor(multibase) {
    this.multibase = multibase;
  }

  /**
   * Write a doc that expires in `ttlMs` milliseconds (or at absolute
   * `expiresAt` ms-since-epoch).
   */
  async set(collectionName, docId, data, { ttlMs, expiresAt } = {}) {
    const expires =
      expiresAt ?? (ttlMs != null ? Date.now() + ttlMs : null);
    if (expires == null) {
      throw new Error("FirestoreTTL.set: pass ttlMs or expiresAt");
    }
    return this.multibase.set(collectionName, docId, {
      ...data,
      [META_EXPIRES_FIELD]: expires,
    });
  }

  /**
   * Read a doc, returning null if it has expired. Still costs one read;
   * if you want true zero-read for expired docs, set up a Cloud Function
   * to purge them.
   */
  async get(collectionName, docId) {
    const doc = await this.multibase.get(collectionName, docId);
    if (!doc) return null;
    if (doc[META_EXPIRES_FIELD] && doc[META_EXPIRES_FIELD] <= Date.now()) {
      return null;
    }
    return doc;
  }

  /** List only non-expired docs. */
  async list(collectionName, options = {}) {
    const all = await this.multibase.list(collectionName, options);
    const now = Date.now();
    return all.filter(
      (d) => !d[META_EXPIRES_FIELD] || d[META_EXPIRES_FIELD] > now
    );
  }

  /**
   * Fetch every doc with a past `_expiresAt` and delete them. Returns the
   * count deleted. Don't run from user code — schedule a Cloud Function
   * or run ad-hoc from an admin script.
   */
  async purgeExpired(collectionName) {
    const all = await this.multibase.list(collectionName);
    const now = Date.now();
    const expired = all.filter(
      (d) => d[META_EXPIRES_FIELD] && d[META_EXPIRES_FIELD] <= now
    );
    await Promise.all(
      expired.map((d) => this.multibase.delete(collectionName, d.id))
    );
    return expired.length;
  }
}
