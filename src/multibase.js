/**
 * Multibase — shard a single logical database across multiple Firebase
 * projects to multiply free-tier storage and read/write quotas.
 *
 * Docs are routed to one shard by a stable hash of the document id, so single-doc
 * reads/writes hit exactly one project. List and query operations fan out to every
 * shard in parallel and merge the results client-side.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query as firestoreQuery,
  where,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const AUTO_ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const AUTO_ID_LENGTH = 20;
const META_SHARD_FIELD = "_shardIndex";
const META_UPDATED_FIELD = "_updatedAt";

export class Multibase {
  /**
   * @param {Array<object>} firebaseConfigs Array of Firebase web app configs.
   *   Each config becomes one shard. More shards = more combined storage + quota.
   */
  constructor(firebaseConfigs) {
    if (!Array.isArray(firebaseConfigs) || firebaseConfigs.length === 0) {
      throw new Error(
        "Multibase: firebaseConfigs must be a non-empty array"
      );
    }
    firebaseConfigs.forEach((config, i) => {
      if (!config || typeof config.projectId !== "string") {
        throw new Error(
          `Multibase: config at index ${i} is missing projectId`
        );
      }
    });
    this.firebaseConfigs = firebaseConfigs;
    this.shardCount = firebaseConfigs.length;
    this.apps = [];
    this.databases = [];
    this.initialized = false;
  }

  /** Initialize every underlying Firebase app. Safe to call once. */
  init() {
    if (this.initialized) return this;
    this.apps = this.firebaseConfigs.map((config, i) =>
      initializeApp(config, `multibase-shard-${i}`)
    );
    this.databases = this.apps.map((app) => getFirestore(app));
    this.initialized = true;
    return this;
  }

  /** Write or overwrite a document. Pass `null` as docId to auto-generate one. */
  async set(collectionName, docId, data) {
    this._ensureInitialized();
    const id = docId || this.generateId();
    const shardIndex = this._getShardIndex(id);
    const database = this.databases[shardIndex];
    const payload = {
      ...data,
      [META_SHARD_FIELD]: shardIndex,
      [META_UPDATED_FIELD]: Date.now(),
    };
    await setDoc(doc(database, collectionName, id), payload);
    return { id, shardIndex };
  }

  /** Read a document by id. Returns null when not found. */
  async get(collectionName, docId) {
    this._ensureInitialized();
    const shardIndex = this._getShardIndex(docId);
    const snapshot = await getDoc(
      doc(this.databases[shardIndex], collectionName, docId)
    );
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }

  /** Partial update. Only provided fields are overwritten. */
  async update(collectionName, docId, data) {
    this._ensureInitialized();
    const shardIndex = this._getShardIndex(docId);
    await updateDoc(doc(this.databases[shardIndex], collectionName, docId), {
      ...data,
      [META_UPDATED_FIELD]: Date.now(),
    });
    return { id: docId, shardIndex };
  }

  /** Delete a document by id. */
  async delete(collectionName, docId) {
    this._ensureInitialized();
    const shardIndex = this._getShardIndex(docId);
    await deleteDoc(doc(this.databases[shardIndex], collectionName, docId));
    return { id: docId, shardIndex };
  }

  /** List documents in a collection across all shards. */
  async list(collectionName, options = {}) {
    return this.query(collectionName, [], options);
  }

  /**
   * Query documents across every shard and merge results.
   * @param {Array<{field: string, op: string, value: any}>} filters Firestore where-clauses
   * @param {{ orderBy?: string, orderDir?: "asc"|"desc", limit?: number }} options
   *
   * Note: orderBy/limit are applied *inside* each shard AND again after merge. Cross-shard
   * ordering is only consistent on fields present in every matching document.
   */
  async query(collectionName, filters = [], options = {}) {
    this._ensureInitialized();
    const { orderBy, orderDir = "desc", limit } = options;

    const perShardPromises = this.databases.map(async (database, shardIndex) => {
      const collectionRef = collection(database, collectionName);
      const constraints = filters.map((filter) =>
        where(filter.field, filter.op, filter.value)
      );
      if (orderBy) constraints.push(firestoreOrderBy(orderBy, orderDir));
      if (limit) constraints.push(firestoreLimit(limit));
      const builtQuery =
        constraints.length > 0
          ? firestoreQuery(collectionRef, ...constraints)
          : collectionRef;
      const snapshot = await getDocs(builtQuery);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        [META_SHARD_FIELD]: shardIndex,
        ...docSnap.data(),
      }));
    });

    const settled = await Promise.allSettled(perShardPromises);
    const errors = [];
    const merged = [];
    settled.forEach((result, shardIndex) => {
      if (result.status === "fulfilled") {
        merged.push(...result.value);
      } else {
        errors.push({ shardIndex, reason: result.reason });
      }
    });
    if (errors.length === this.shardCount) {
      throw new Error(
        `Multibase.query: all ${this.shardCount} shards failed — ${errors[0].reason}`
      );
    }
    if (errors.length > 0) {
      console.warn("Multibase.query: partial shard failure", errors);
    }

    return this._mergeAndTrim(merged, { orderBy, orderDir, limit });
  }

  /** Document count per shard and total across all shards. */
  async count(collectionName) {
    this._ensureInitialized();
    const perShardPromises = this.databases.map(async (database, shardIndex) => {
      const snapshot = await getDocs(collection(database, collectionName));
      return { shardIndex, count: snapshot.size };
    });
    const perShard = await Promise.all(perShardPromises);
    const total = perShard.reduce((sum, entry) => sum + entry.count, 0);
    return { total, perShard };
  }

  /** Returns `{ index, projectId }` for each configured shard. */
  getShardInfo() {
    return this.firebaseConfigs.map((config, index) => ({
      index,
      projectId: config.projectId,
    }));
  }

  /** Escape hatch: access a raw Firestore instance for a given shard. */
  getShardDatabase(shardIndex) {
    this._ensureInitialized();
    if (shardIndex < 0 || shardIndex >= this.shardCount) {
      throw new Error(`Multibase: shardIndex ${shardIndex} out of range`);
    }
    return this.databases[shardIndex];
  }

  /** Generate a 20-char URL-safe id, matching Firestore's native auto-id shape. */
  generateId() {
    const bytes = new Uint8Array(AUTO_ID_LENGTH);
    crypto.getRandomValues(bytes);
    let id = "";
    for (let i = 0; i < AUTO_ID_LENGTH; i++) {
      id += AUTO_ID_ALPHABET[bytes[i] % AUTO_ID_ALPHABET.length];
    }
    return id;
  }

  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error("Multibase: call init() before using the instance");
    }
  }

  _getShardIndex(key) {
    return this._hashKey(key) % this.shardCount;
  }

  // FNV-1a 32-bit. Fast, deterministic across runs, and evenly distributed for
  // short keys like document ids — which is all we hash here.
  _hashKey(key) {
    const str = String(key);
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  _mergeAndTrim(results, { orderBy, orderDir, limit }) {
    if (orderBy) {
      const direction = orderDir === "asc" ? 1 : -1;
      results.sort((a, b) => {
        const av = a[orderBy];
        const bv = b[orderBy];
        if (av === bv) return 0;
        if (av === undefined) return 1;
        if (bv === undefined) return -1;
        return av < bv ? -direction : direction;
      });
    }
    if (limit) return results.slice(0, limit);
    return results;
  }
}
