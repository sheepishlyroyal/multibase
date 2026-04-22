/**
 * ImagesBlurhash — compact ~20-char hash that decodes back to a blurred
 * placeholder. Store it alongside your image's manifest doc; render the
 * blurred preview instantly while the real image downloads.
 *
 * Powered by the `blurhash` npm package via esm.sh — no build step needed.
 */

import {
  encode as bhEncode,
  decode as bhDecode,
} from "https://esm.sh/blurhash@2.0.5";

export class ImagesBlurhash {
  /**
   * Encode a Blob/File to a blurhash string.
   *
   * Downsamples the image to `maxSize` px before encoding — blurhash is
   * slow on large images and ~32 px is enough for a nice preview.
   */
  async encode(blob, { componentX = 4, componentY = 4, maxSize = 32 } = {}) {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    bitmap.close();

    return bhEncode(data, width, height, componentX, componentY);
  }

  /**
   * Decode a hash into a data URL, ready for `<img src="...">`.
   *
   * Pick a small render size (32 × 32 is usually plenty) and scale the
   * element up with CSS — the browser interpolates for free.
   */
  decode(hash, { width = 32, height = 32, punch = 1 } = {}) {
    const pixels = bhDecode(hash, width, height, punch);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }
}
