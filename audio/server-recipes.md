# Server-side audio recipes

Things that need a Cloud Function, not a client library.

## Transcode to Opus on upload

Opus in WebM is 30–50 % smaller than MP3 at equivalent quality. Every
modern browser plays it. A Cloud Function with `ffmpeg-static` transcodes
on upload; your client calls
`mb.audio.format.pickBest(["opus", "mp3"])` to decide which variant to
fetch.

Deployable source:
[`../cloud-functions/audio-transcode.example.js`](../cloud-functions/audio-transcode.example.js).

## Silence trimming

Strip leading/trailing silence in the same CF:

```
ffmpeg -i in.mp3 -af silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:stop_periods=-1:stop_duration=0.2:stop_threshold=-50dB out.mp3
```

Shaves ~0.2–2 s off most voice recordings.

## Pre-signed streaming URLs

Don't expose Firebase Storage URLs directly. A callable Cloud Function
mints a short-lived signed URL so the client fetches the audio without
lifelong read access:

```js
// in functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getStorage } = require("firebase-admin/storage");

exports.getAudioUrl = onCall(async ({ data, auth }) => {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in first");
  const [url] = await getStorage().bucket()
    .file(`audio/${data.audioId}`)
    .getSignedUrl({ action: "read", expires: Date.now() + 5 * 60_000 });
  return { url };
});
```

## Chunked streaming (HTTP range requests)

Firebase Storage handles `Range` headers natively. Point an `<audio>` /
`<video>` element at a signed URL and the browser streams by chunks
automatically — no extra code needed. `mb.audio.downloadAsURL()` works
for the Multibase-chunked path but pulls the whole blob; for long audio,
prefer Storage + signed URLs.
