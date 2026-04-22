# multibase

A small, dependency-free JavaScript library that pools **N Firebase
projects into one logical database** *and* bundles a set of
batteries-included helpers for images, audio, and Firestore — each in its
own folder, each with its own demo.

```
multibase/
├── multibase.js                      # core + wires up the helper modules
├── multibase.config.example.js       # → copy to multibase.config.js; paste your configs
│
├── images/                 lazy-loading, blurhash, resize, chunked storage (+ demos)
├── audio/                  format detection, waveform peaks, chunked storage (+ demos)
├── firestore/              cursor pagination, TTL helpers, offline persistence (+ demos)
├── cloud-functions/        deployable CF source for WebP, TTL cleanup, Opus transcode
│
├── README.md               (you're here)
├── LICENSE                 MIT
└── .gitignore              ignores multibase.config.js
```

---

## TL;DR — hello world

```bash
# one-time setup
cp multibase.config.example.js multibase.config.js
# …then paste each Firebase project's firebaseConfig into that file.
```

```js
import { Multibase } from "./multibase.js";
import { FIREBASE_CONFIGS } from "./multibase.config.js";

const mb = new Multibase(FIREBASE_CONFIGS).init();

// Core
await mb.write("notes", { title: "hi" });          // auto id
await mb.write("notes", "my-id", { title: "hi" }); // explicit id
const note = await mb.read("notes", "my-id");
const page = await mb.list("notes", { limit: 20 });

// Images
const imageId = await mb.images.upload(blob);
const hash    = await mb.images.blurhash.encode(blob);
const resized = await mb.images.resize.fit(blob, { maxWidth: 1600 });
mb.images.lazy.observe(imgEls);

// Audio
const audioId = await mb.audio.upload(audioBlob);
const peaks   = await mb.audio.waveform.compute(audioBlob, { samples: 200 });
const pick    = mb.audio.format.pickBest(["opus", "mp3"]);

// Firestore helpers
const { items, cursor, done } = await mb.firestore.paginate.page("notes", { pageSize: 20 });
await mb.firestore.ttl.set("sessions", null, { user: uid }, { ttlMs: 300_000 });
await mb.firestore.offline.enable();
```

---

## Why

Every Firebase project on the **Spark (free) plan** gives you roughly:

- 1 GiB Firestore storage
- 50 000 reads / day
- 20 000 writes / day

With 5 projects, that's 5 GiB, 250 000 reads, and 100 000 writes —
**for free**. Multibase hashes each document id and routes it to one
project; list and query operations fan out to every project in parallel
and merge results client-side.

---

## Setup

1. **Create two or more Firebase projects** at
   [console.firebase.google.com](https://console.firebase.google.com).
2. **For each project:**
   - Enable Firestore: `Build → Firestore Database → Create database`.
   - Register a Web app: `⚙ → Project settings → Your apps → </>`.
     Copy the `firebaseConfig` object.
3. **Apply Firestore rules** on every project. Starter ruleset (replace
   before shipping):

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

4. **Create your config file:**

   ```bash
   cp multibase.config.example.js multibase.config.js
   ```

   Paste each project's `firebaseConfig` into the `FIREBASE_CONFIGS`
   array. `multibase.config.js` is gitignored — real keys never touch
   the repo.

5. **Serve the folder** (Firebase blocks `file://`):

   ```bash
   npx serve .
   # or
   python3 -m http.server 8000
   ```

6. **Open any demo** at
   `http://localhost:3000/images/storage.demo.html` (or any other
   `*.demo.html` under the category folders).

---

## What's in each folder

### [`images/`](images/)

| File | What it does |
|------|--------------|
| [`storage.js`](images/storage.js) | Upload/download images through Multibase — base64 + chunked so they fit Firestore's 1 MiB per-doc limit. |
| [`lazy.js`](images/lazy.js) | Lazy-load via IntersectionObserver (swap `data-src` → `src` on scroll). |
| [`blurhash.js`](images/blurhash.js) | Encode a short hash that decodes to a blurred placeholder. |
| [`resize.js`](images/resize.js) | Downscale an image in the browser (canvas). |

Server-side recipes (WebP/AVIF conversion, responsive variants, progressive JPEG, Storage rules) live in
[`images/server-recipes.md`](images/server-recipes.md), with a deployable
Cloud Function in
[`cloud-functions/image-variants.example.js`](cloud-functions/image-variants.example.js).

### [`audio/`](audio/)

| File | What it does |
|------|--------------|
| [`storage.js`](audio/storage.js) | Chunked audio upload/download, same mechanism as images. |
| [`format.js`](audio/format.js) | Wrap `canPlayType` — pick the best codec this browser plays. |
| [`waveform.js`](audio/waveform.js) | Pre-compute peaks with WebAudio so the waveform renders without streaming the audio. |

Server-side (Opus transcoding, silence trim, pre-signed URLs):
[`audio/server-recipes.md`](audio/server-recipes.md) +
[`cloud-functions/audio-transcode.example.js`](cloud-functions/audio-transcode.example.js).

### [`firestore/`](firestore/)

| File | What it does |
|------|--------------|
| [`paginate.js`](firestore/paginate.js) | Cursor-based pagination across shards — never `limit(1000)` again. |
| [`ttl.js`](firestore/ttl.js) | `_expiresAt` field + client-side filtering. Scheduled purge is a Cloud Function. |
| [`offline.js`](firestore/offline.js) | Enable IndexedDB persistence across every shard. |

Non-code patterns (denormalisation, composite indexes, subcollection vs
flat, security-rule caching): [`firestore/patterns.md`](firestore/patterns.md).

### [`cloud-functions/`](cloud-functions/)

Deployable server-side source that the client library can't do alone:

| File | What it does |
|------|--------------|
| [`image-variants.example.js`](cloud-functions/image-variants.example.js) | Generate WebP thumbnail/medium/full on image upload. |
| [`ttl-cleanup.example.js`](cloud-functions/ttl-cleanup.example.js) | Scheduled deletion of expired TTL docs across all shards. |
| [`audio-transcode.example.js`](cloud-functions/audio-transcode.example.js) | Transcode uploaded audio to Opus/WebM with ffmpeg. |

Walkthrough: [`cloud-functions/deploy.md`](cloud-functions/deploy.md).

---

## API reference

### Core

```js
mb.write(collection, data)                     // auto id
mb.write(collection, id, data)                 // explicit id
mb.read(collection, id)                        // → doc or null
mb.set / mb.get / mb.update / mb.delete        // original Firestore-flavoured names
mb.list(collection, { orderBy, orderDir, limit })
mb.query(collection, filters, options)         // filters = [{ field, op, value }]
mb.count(collection)                           // { total, perShard }
mb.getShardInfo() / mb.getShardDatabase(i) / mb.generateId()
```

### Images (`mb.images`)

```js
mb.images.upload(blob, metadata)       // → imageId
mb.images.download(id)                 // → Blob
mb.images.downloadAsDataURL(id)        // → "data:image/..;base64,.."
mb.images.downloadAsBase64(id)         // → raw base64
mb.images.list(options) / delete(id)

mb.images.lazy.observe(el | NodeList)
mb.images.lazy.disconnect()

mb.images.blurhash.encode(blob)        // → "LEHV6..."
mb.images.blurhash.decode(hash)        // → "data:image/png;base64,..."

mb.images.resize.fit(blob, { maxWidth, maxHeight, quality })
mb.images.resize.square(blob, size)
```

### Audio (`mb.audio`)

```js
mb.audio.upload(blob, metadata)        // → audioId
mb.audio.download(id)                  // → Blob
mb.audio.downloadAsURL(id)             // → "blob:..." for <audio src>
mb.audio.list(options) / delete(id)

mb.audio.format.canPlay("opus")        // "probably" | "maybe" | ""
mb.audio.format.pickBest(["opus","mp3"])

mb.audio.waveform.compute(blob, { samples, channel }) // → Float32Array
mb.audio.waveform.render(canvas, peaks, options)
```

### Firestore (`mb.firestore`)

```js
mb.firestore.paginate.page(collection, { pageSize, cursor, orderBy, orderDir, filters })
// → { items, cursor, done }

mb.firestore.ttl.set(collection, id, data, { ttlMs })
mb.firestore.ttl.get(collection, id)    // null if expired
mb.firestore.ttl.list(collection)       // excludes expired
mb.firestore.ttl.purgeExpired(collection) // admin-side only

mb.firestore.offline.enable()           // once per tab, BEFORE reads
mb.firestore.offline.goOffline() / goOnline()
```

---

## Metadata fields

Every doc written through Multibase gets two reserved fields:

| Field         | Purpose                                             |
|---------------|-----------------------------------------------------|
| `_shardIndex` | Which shard the doc lives on. Useful for debugging. |
| `_updatedAt`  | Millisecond timestamp of the last write.            |

`FirestoreTTL` adds one more:

| Field         | Purpose                                              |
|---------------|------------------------------------------------------|
| `_expiresAt`  | ms-since-epoch. After that, `get` and `list` ignore the doc until purged. |

---

## Trade-offs (read this before you ship)

- **Cross-shard reads cost N×.** `list()` across 4 shards spends 4× the
  reads of a plain Firestore query. Per-shard filters + `limit` help; the
  multiplier is real.
- **No cross-shard transactions.** Firestore transactions scope to one
  project. Colocate related docs by sharing an id prefix + hashing on
  that prefix.
- **Shard count is baked in.** Changing `FIREBASE_CONFIGS.length`
  reshuffles every hash and orphans existing data. Pick a count you can
  live with.
- **Blobs are expensive.** Each image/audio costs 1 manifest write + N
  chunk writes. For real media-heavy workloads use Firebase Storage;
  this module exists so you can prototype on the free tier.
- **Cross-shard orderBy** only works on fields present in every doc.
  Missing values sort to the end.

---

## Contributing

Issues and PRs welcome. The core library (`multibase.js` + its direct
module wiring) is deliberately tiny — keep it that way. Folder-specific
helpers can grow as long as each file stays focused on one concern and
ships with a working `*.demo.html`.

## License

MIT — see [LICENSE](LICENSE).
