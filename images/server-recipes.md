# Server-side image recipes

Things the client library can't do — they need a Cloud Function or Storage
configuration. Snippets below; deployable code in
[`../cloud-functions/image-variants.example.js`](../cloud-functions/image-variants.example.js).

---

## WebP / AVIF conversion

On upload, a Cloud Function transcodes to WebP with `sharp` and writes the
variant beside the original. Serve the modern format based on the
browser's `Accept` header.

See the deployable example.

## Responsive variants

Generate `thumb` (200 px), `medium` (800 px), and `full` (original) on
upload. Return the set as Storage URLs or as variant ids stored on the
manifest doc. Same CF as above.

## Progressive JPEG

In the same sharp pipeline:

```js
sharp(buffer).jpeg({ progressive: true, quality: 85 }).toBuffer();
```

Progressive JPEGs render top-to-bottom as they download — perceived load
time drops significantly on slow networks.

## Long CDN cache headers

When writing to Firebase Storage, set:

```js
await uploadBytes(ref, blob, {
  cacheControl: "public, max-age=31536000, immutable",
  contentType: "image/webp",
});
```

Firebase Hosting / Cloud CDN honours this for a year. `immutable` is safe
because each variant URL is versioned by hash; a new image = a new URL.

## Storage rules scoping

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches("image/.*");
    }
  }
}
```

Tight `match` paths prevent unauthenticated listing of your bucket.
