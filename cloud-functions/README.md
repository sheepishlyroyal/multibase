# cloud-functions/

Source for Cloud Functions that implement the server-side half of
Multibase. **These files are NOT imported by the client library** — they
are templates you deploy to your Firebase project.

| File | What it does |
|------|--------------|
| [`image-variants.example.js`](image-variants.example.js) | On image upload: generate WebP + thumbnail + medium variants with `sharp`. |
| [`ttl-cleanup.example.js`](ttl-cleanup.example.js) | Scheduled every 15 min: delete docs whose `_expiresAt` is in the past, across every shard. |
| [`audio-transcode.example.js`](audio-transcode.example.js) | On audio upload: transcode to Opus (WebM) with `ffmpeg-static`. |

Deployment walkthrough: [`deploy.md`](deploy.md).

## Why these live separately

The client library is pure browser JavaScript. It has no access to:

- heavy native tools (`sharp`, `ffmpeg`)
- the Firebase Admin SDK
- a writable filesystem
- scheduled triggers

Those things run on Google's servers. Each invocation costs a fraction
of a cent but unlocks real optimizations the browser can't do alone.

## Config-only optimizations (not functions)

A few of the "Cloud Functions" ideas are really just config knobs on
existing functions. They go on the definition, not in a separate file:

```js
exports.myFn = onRequest(
  {
    minInstances: 1,         // warm instance — kills cold starts
    memory: "256MiB",        // right-size; don't overpay
    concurrency: 80,         // gen-2: one instance handles many requests
    timeoutSeconds: 60,
  },
  async (req, res) => { /* ... */ }
);
```

Also:

- Tree-shake imports: `const { getFirestore } = require("firebase-admin/firestore")`, not `require("firebase-admin")`.
- Avoid chained triggers (function writes a doc → another function
  fires → writes another doc → …). Fan-out is easy to get wrong. Be
  explicit about which operations trigger which function.
