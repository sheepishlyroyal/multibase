# multibase

A tiny, dependency-free JavaScript library that makes **N Firebase projects
behave like one unified Firestore database**. Shard documents across projects
to multiply your free-tier storage, read quota, and write quota linearly with
the number of projects you add.

> Every Firebase project on the **Spark (free) plan** gives you roughly
> 1 GiB Firestore storage, 50 000 reads/day, 20 000 writes/day, and
> 20 000 deletes/day. With 5 projects you get ~5 GiB storage,
> 250 000 reads/day, and 100 000 writes/day — for free.

---

## Project structure

```
multibase/
├── src/
│   └── multibase.js          # the library — no dependencies
├── demo/
│   ├── index.html                 # demo app (notes CRUD + shard stats)
│   └── firebase-config.example.js # config template — copy to firebase-config.js
├── README.md
├── LICENSE                        # MIT
└── .gitignore                     # ignores demo/firebase-config.js
```

Three things to know:

- **`src/`** is the library. Drop `multibase.js` into your own app to use it.
- **`demo/`** is a self-contained demonstration. It's the only part of the repo
  that needs your Firebase configs.
- **`demo/firebase-config.js`** is gitignored on purpose — your local copy holds
  real project ids and API keys, so it never touches the repo.

---

## How it works

```
                      ┌────────────────────────┐
 set("notes", "abc")  │                        │
 ─────────────────────► hash("abc") % 3 = 1    │
                      │                        │
                      │  ┌─────────┐           │
                      │  │ shard 0 │  project-a│
                      │  ├─────────┤           │
                      │  │ shard 1 │◄── write  │
                      │  ├─────────┤  project-b│
                      │  │ shard 2 │           │
                      │  └─────────┘  project-c│
                      └────────────────────────┘
```

- Each document id is run through an FNV-1a hash and mapped to one shard.
- `set`, `get`, `update`, `delete` hit **exactly one** shard.
- `list`, `query`, `count` **fan out to every shard in parallel** and merge the
  results client-side.
- Document ids don't encode the shard — the same hash is used to find them
  again, so anyone who knows the id (and the shard count) can locate the doc.

---

## Testing the demo

### Prerequisites

- A web browser (any modern one).
- Node.js **or** Python 3 — just to run a static file server locally. Firebase
  refuses `file://` origins, so you can't double-click `index.html`.
- Two or more Firebase projects (free Spark plan is fine).

### Step-by-step

1. **Clone the repo.**

   ```bash
   git clone https://github.com/YOUR-USERNAME/multibase.git
   cd multibase
   ```

2. **Create two or more Firebase projects** at
   [console.firebase.google.com](https://console.firebase.google.com). Two is
   the minimum; more = more capacity.

3. **On each project, set up Firestore and a web app.**
   - `Build → Firestore Database → Create database` (start in test mode).
   - `⚙ → Project settings → Your apps → </>` to register a web app. Copy the
     `firebaseConfig` object it gives you.

4. **Apply Firestore rules on every project.** For local testing, a permissive
   starter — replace before shipping anything real:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

5. **Create your local config.**

   ```bash
   cp demo/firebase-config.example.js demo/firebase-config.js
   ```

   Open `demo/firebase-config.js` and paste each project's `firebaseConfig`
   into the `FIREBASE_CONFIGS` array. One entry per shard.

   > Firebase web API keys aren't secrets — they only identify the project.
   > Security is enforced by Firestore rules. But `demo/firebase-config.js` is
   > gitignored anyway, so you won't accidentally push it.

6. **Start a static server from the repo root.**

   ```bash
   npx serve .
   # or
   python3 -m http.server 8000
   ```

7. **Open the demo** at `http://localhost:3000/demo/` (or whatever port your
   server used, `/demo/` at the end).

### Testing checklist

Run through these to confirm everything's wired up:

- [ ] **The page loads** with no red error banner. If you see
  `Failed to initialize Multibase`, your `firebase-config.js` is missing
  or still has placeholders.
- [ ] **Add a note** — type a title, click *Add note*. It should appear below
  with an `id` and a `shard N` tag.
- [ ] **Shard distribution** — add ~10 notes. The *Shard distribution* panel
  should show counts roughly balanced across all shards (±2 for small N is
  normal; it's a hash, not a round-robin).
- [ ] **Reload the page.** All notes should come back — proves they actually
  persisted to Firestore, not just to memory.
- [ ] **Delete a note.** It disappears and the total count drops.
- [ ] **Verify in the Firebase console.** Open each project → Firestore → the
  `notes` collection. The docs you see on each project should match the
  per-shard counts in the UI.
- [ ] **Use the library from devtools.** Open the browser console on the demo
  page and try the API directly:

  ```javascript
  // mfb is not exposed globally by default — run this once to grab it:
  const mfb = (await import("../src/multibase.js")).Multibase;
  // or just re-run operations via the visible UI
  ```

### Common gotchas

| Symptom                                           | Cause                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Failed to fetch ./firebase-config.js`            | You didn't `cp` the example file to `firebase-config.js`.                    |
| `PERMISSION_DENIED: Missing or insufficient permissions` | Firestore rules on one of the shards still block writes.                    |
| Notes only appear on one shard                    | `FIREBASE_CONFIGS` has only one entry, or all entries point to the same project. |
| CORS / `file://` errors in console                | You opened `index.html` directly. Serve it via `npx serve .` instead.         |
| One shard empty, others full                      | Expected for small N — FNV-1a distributes well but not perfectly for <20 docs. |

---

## Using the library in your own project

Copy `src/multibase.js` into your app. It has no build step and no npm
dependencies — it pulls Firebase straight from the gstatic CDN.

```javascript
import { Multibase } from "./path/to/multibase.js";

const db = new Multibase([
  { apiKey: "...", projectId: "my-app-shard-1", /* ... */ },
  { apiKey: "...", projectId: "my-app-shard-2", /* ... */ },
]).init();
```

### Single-document operations

```javascript
// Create (auto id)
const { id, shardIndex } = await db.set("notes", null, {
  title: "hello",
  body: "world",
});

// Create (explicit id)
await db.set("notes", "custom-id", { title: "hi" });

// Read
const note = await db.get("notes", id); // → { id, title, body, ... } or null

// Update (merge semantics)
await db.update("notes", id, { title: "updated" });

// Delete
await db.delete("notes", id);
```

### Cross-shard operations

```javascript
// List all docs in a collection, newest first
const recent = await db.list("notes", {
  orderBy: "_updatedAt",
  orderDir: "desc",
  limit: 50,
});

// Query with where-clauses
const mine = await db.query(
  "notes",
  [{ field: "userId", op: "==", value: "u_123" }],
  { orderBy: "createdAt", orderDir: "desc", limit: 20 }
);

// Count across every shard
const { total, perShard } = await db.count("notes");
// total:   42
// perShard: [ { shardIndex: 0, count: 14 }, { shardIndex: 1, count: 15 }, ... ]
```

### Introspection & escape hatches

```javascript
db.getShardInfo();      // [{ index, projectId }, ...]
db.getShardDatabase(0); // raw Firestore instance for shard 0 — drop to native API
db.generateId();        // 20-char auto id (same shape as Firestore's)
```

---

## Metadata fields

Every written document gets two reserved fields automatically:

| Field         | Purpose                                             |
| ------------- | --------------------------------------------------- |
| `_shardIndex` | Which shard the doc lives on. Useful for debugging. |
| `_updatedAt`  | Millisecond timestamp of the last write.            |

Don't write to these yourself.

---

## Trade-offs (read this before you ship)

- **Cross-shard reads cost N× more.** A `list()` across 4 shards spends 4× the
  reads of a plain Firestore query. Per-shard filters + `limit` help, but the
  multiplier is real.
- **No cross-shard transactions.** Firestore transactions are scoped to one
  project. If you need atomic updates across multiple docs, colocate them on
  the same shard by giving them related ids (e.g. share a prefix and hash on
  that prefix).
- **No cross-shard joins.** Same story — denormalize, or put related docs on
  the same shard.
- **Shard count is baked in.** Changing `FIREBASE_CONFIGS.length` reshuffles
  every hash and orphans existing data. Pick a count you can live with, or
  write a migration that re-hashes and moves each doc.
- **OrderBy on merged results only works on fields present in every doc.**
  Missing values sort to the end.

---

## Contributing

Issues and PRs welcome. The library is deliberately small — if you're adding
surface area, keep the "zero dependencies, single file" constraint in mind.

---

## License

MIT — see [LICENSE](LICENSE).
