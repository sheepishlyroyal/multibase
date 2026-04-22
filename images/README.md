# images/

Client-side image helpers, attached to `mb.images.*`.

| File | Exports | What it does |
|------|---------|--------------|
| [`storage.js`](storage.js) | `ImagesStorage` | Upload / download images through Multibase, chunked to fit Firestore's 1 MiB per-doc limit. |
| [`lazy.js`](lazy.js) | `ImagesLazy` | IntersectionObserver wrapper — replace `data-src` with `src` when each element scrolls into view. |
| [`blurhash.js`](blurhash.js) | `ImagesBlurhash` | Encode an image to a ~20-char hash; decode back to a blurred placeholder. |
| [`resize.js`](resize.js) | `ImagesResize` | Downscale an image in the browser (canvas API) before upload. |

Every feature has a sibling `*.demo.html` — open it via a static server to
try it out.

## Combined flow

```js
import { Multibase } from "../multibase.js";
import { FIREBASE_CONFIGS } from "../multibase.config.js";
const mb = new Multibase(FIREBASE_CONFIGS).init();

// Resize → encode blurhash → upload — all via `mb.images`
const resized = await mb.images.resize.fit(file, { maxWidth: 1600 });
const hash    = await mb.images.blurhash.encode(resized);
const id      = await mb.images.upload(resized, { blurhash: hash });

// Later, in a gallery:
img.src = mb.images.blurhash.decode(hash);                 // instant preview
img.setAttribute("data-src", await mb.images.downloadAsDataURL(id));
mb.images.lazy.observe(img);                               // swaps in the real one on scroll
```

## Server-side recipes

Things that need a Cloud Function — WebP/AVIF conversion, responsive
variants, progressive JPEG — live in
[`server-recipes.md`](server-recipes.md) with deployable source in
[`../cloud-functions/image-variants.example.js`](../cloud-functions/image-variants.example.js).
