/**
 * cloud-functions/image-variants.example.js
 *
 * On Storage upload to `images/**`, generate WebP thumbnail + medium +
 * full variants with `sharp` and write them beside the original. Long
 * cache headers so CDNs / Cloud CDN hold on to them for a year.
 *
 * Deploy (see ./deploy.md for the full walkthrough):
 *   cp image-variants.example.js ~/multibase-functions/functions/index.js
 *   cd ~/multibase-functions/functions && npm install sharp
 *   firebase deploy --only functions:generateImageVariants
 */

const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { getStorage } = require("firebase-admin/storage");
const { initializeApp } = require("firebase-admin/app");
const sharp = require("sharp");
const path = require("path");

initializeApp();

exports.generateImageVariants = onObjectFinalized(
  {
    memory: "512MiB",
    timeoutSeconds: 120,
    concurrency: 5,
  },
  async (event) => {
    const object = event.data;
    const filePath = object.name;

    if (!filePath.startsWith("images/")) return;
    if (!/\.(jpe?g|png)$/i.test(filePath)) return;
    if (filePath.includes("/variants/")) return; // already processed

    const bucket = getStorage().bucket(object.bucket);
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));

    const [buffer] = await bucket.file(filePath).download();

    const variants = [
      { suffix: "thumb",  size: 200, quality: 70 },
      { suffix: "medium", size: 800, quality: 80 },
      { suffix: "full",   size: null, quality: 85 },
    ];

    await Promise.all(
      variants.map(async (v) => {
        let pipeline = sharp(buffer);
        if (v.size) pipeline = pipeline.resize(v.size, v.size, { fit: "inside" });
        const out = await pipeline
          .webp({ quality: v.quality })
          .toBuffer();

        const outPath = `${dir}/variants/${base}.${v.suffix}.webp`;
        await bucket.file(outPath).save(out, {
          metadata: {
            contentType: "image/webp",
            cacheControl: "public, max-age=31536000, immutable",
          },
        });
      })
    );

    console.log(`generated ${variants.length} variants for ${filePath}`);
  }
);
