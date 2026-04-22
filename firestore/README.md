# firestore/

Optimizations for Multibase's own Firestore reads and writes.

| File | Exports | What it does |
|------|---------|--------------|
| [`paginate.js`](paginate.js) | `FirestorePaginate` | Cursor-based pagination across shards — never `limit(1000)` again. |
| [`ttl.js`](ttl.js) | `FirestoreTTL` | Stamp `_expiresAt` on docs; expired docs filter out on read. Client-side purge included. |
| [`offline.js`](offline.js) | `FirestoreOffline` | Enable IndexedDB persistence across all shards so repeat reads hit the cache. |

Each has a `*.demo.html`. See [`patterns.md`](patterns.md) for
non-code optimizations — denormalisation, composite indexes, subcollection
shape, security-rule caching.

## Cheat sheet

```js
// Pagination
let cursor = null, done = false;
while (!done) {
  const page = await mb.firestore.paginate.page("notes", { pageSize: 20, cursor });
  render(page.items);
  ({ cursor, done } = page);
}

// Expiring docs
await mb.firestore.ttl.set("sessions", null, { user: uid }, { ttlMs: 5 * 60_000 });
const s = await mb.firestore.ttl.get("sessions", id);  // null if expired

// Offline persistence — call ONCE at startup, BEFORE any reads.
await mb.firestore.offline.enable();
```

## Server-side piece

Scheduled cleanup of expired TTL docs lives in
[`../cloud-functions/ttl-cleanup.example.js`](../cloud-functions/ttl-cleanup.example.js).
The client-side `purgeExpired()` is only useful for admin scripts —
don't run it from user code.
