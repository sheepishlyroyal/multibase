/**
 * FirestorePaginate — cursor-based pagination across shards.
 *
 * Never `limit(1000)`. Each call returns `{ items, cursor, done }`; pass
 * `cursor` back in to fetch the next page. Because data is sharded, we
 * track one cursor per shard and merge pages client-side.
 *
 *   let cursor = null, done = false;
 *   while (!done) {
 *     const page = await mb.firestore.paginate.page("notes", { pageSize: 20, cursor });
 *     render(page.items);
 *     ({ cursor, done } = page);
 *   }
 */

import {
  collection,
  getDocs,
  query as firestoreQuery,
  where,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

export class FirestorePaginate {
  constructor(multibase) {
    this.multibase = multibase;
  }

  /**
   * Fetch the next page.
   *
   * @param {string} collectionName
   * @param {{
   *   pageSize?: number,
   *   orderBy?: string,
   *   orderDir?: "asc"|"desc",
   *   cursor?: object|null,
   *   filters?: Array<{field: string, op: string, value: any}>
   * }} options
   */
  async page(collectionName, options = {}) {
    const {
      pageSize = 20,
      orderBy = "_updatedAt",
      orderDir = "desc",
      cursor = null,
      filters = [],
    } = options;
    const cursors = cursor || {};
    const compareOp = orderDir === "asc" ? ">" : "<";

    const perShard = await Promise.all(
      this.multibase.databases.map(async (db, shardIndex) => {
        const scoped = [...filters];
        if (cursors[shardIndex] !== undefined) {
          scoped.push({ field: orderBy, op: compareOp, value: cursors[shardIndex] });
        }
        const colRef = collection(db, collectionName);
        const constraints = scoped.map((f) => where(f.field, f.op, f.value));
        constraints.push(firestoreOrderBy(orderBy, orderDir));
        constraints.push(firestoreLimit(pageSize));
        const snap = await getDocs(firestoreQuery(colRef, ...constraints));
        return snap.docs.map((d) => ({
          id: d.id,
          _shardIndex: shardIndex,
          ...d.data(),
        }));
      })
    );

    const merged = perShard.flat();
    const direction = orderDir === "asc" ? 1 : -1;
    merged.sort((a, b) => {
      const av = a[orderBy];
      const bv = b[orderBy];
      if (av === bv) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return av < bv ? -direction : direction;
    });
    const items = merged.slice(0, pageSize);

    const nextCursor = { ...cursors };
    for (let s = 0; s < this.multibase.shardCount; s++) {
      const mine = items.filter((i) => i._shardIndex === s);
      if (mine.length > 0) {
        nextCursor[s] = mine[mine.length - 1][orderBy];
      }
    }

    const done = perShard.every((page) => page.length < pageSize);
    return { items, cursor: nextCursor, done };
  }
}
