# Firestore patterns (advice, not code)

Things that aren't imports — they're how you *shape* your data.

## Denormalisation

When you'd reach for a JOIN in SQL, denormalise instead. Embed read-heavy
fields (author name, thumbnail URL, cached counts) directly in the doc
you're reading. Writes have to update multiple places — batch them or use
a Cloud Function trigger to keep copies in sync.

**Rule of thumb:** optimise the read path. 100 writes serving 10 000 reads
is the right trade.

## Composite indexes

Any multi-field `where` or `where + orderBy` query needs a composite
index. The first time you run an unindexed query against production,
Firestore throws and prints a direct "create this index" URL — click
through, wait 1–5 minutes for it to build, re-run.

Don't rely on that in CI. Commit your `firestore.indexes.json`.

## Subcollection vs flat

- **Subcollections** (`/users/{uid}/orders/{orderId}`) when the parent's
  child list grows without bound. Keeps queries scoped and avoids hot
  docs.
- **Flat collections** when you'll query across users (global feeds,
  analytics dashboards).

If you need both access patterns, denormalise — keep a subcollection for
per-user queries and a flat copy for global ones.

## Security-rule caching

Each `get()` inside a rule is a billable read and blocks the request.
For rules like "user must own this doc", compare fields in-place
instead of looking up another doc:

```
// ❌ slow and billable
allow update: if get(/databases/$(db)/documents/members/$(request.auth.uid)).data.role == "admin";

// ✅ fast: trust a denormalised claim
allow update: if request.auth.token.role == "admin";
```

Store roles in **custom claims** (set server-side during onboarding or
role change), not in member docs you have to re-fetch on every request.

## Native TTL

If you don't need minute-level precision, skip `FirestoreTTL` entirely
and use Firestore's native TTL: mark a timestamp field as TTL in the
console, Firestore deletes expired docs for you within 24 hours. Zero
code, zero functions. Use our `FirestoreTTL` for tighter windows.
