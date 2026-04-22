# audio/

Client-side audio helpers, attached to `mb.audio.*`.

| File | Exports | What it does |
|------|---------|--------------|
| [`storage.js`](storage.js) | `AudioStorage` | Upload/download audio blobs — chunked the same way images are. |
| [`format.js`](format.js) | `AudioFormat` | Detect which codecs this browser plays (wraps `canPlayType`). |
| [`waveform.js`](waveform.js) | `AudioWaveform` | Pre-compute waveform peaks so the player renders instantly without the audio. |

Each feature has a sibling `*.demo.html`.

## Typical flow

```js
// On upload: compute peaks, store them on the manifest, then upload the audio.
const peaks = await mb.audio.waveform.compute(file, { samples: 200 });
const id    = await mb.audio.upload(file, {
  name: file.name,
  peaks: Array.from(peaks),          // Firestore doesn't take Float32Array
  durationSec: null,                 // fill in if you decoded the duration
});

// Later, in a list view: render the waveform without streaming any audio.
const meta = await mb.read("audio", id);
mb.audio.waveform.render(canvas, new Float32Array(meta.peaks));

// Then only pull the real audio when the user clicks play:
audioEl.src = await mb.audio.downloadAsURL(id);
```

## Format negotiation

If you transcode to Opus server-side (see
[`../cloud-functions/audio-transcode.example.js`](../cloud-functions/audio-transcode.example.js)),
pick the best variant at runtime:

```js
const variant = mb.audio.format.pickBest(["opus", "mp3"]);
// → "opus" on Chrome/Firefox, "mp3" on Safari
```

## Server-side recipes

Transcoding, silence trimming, pre-signed streaming URLs — all need a
Cloud Function. See [`server-recipes.md`](server-recipes.md).
