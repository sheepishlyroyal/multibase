/**
 * ImagesResize — downscale an image Blob in the browser before upload.
 *
 * Saves Firestore reads, writes, and storage. No server or Cloud Function
 * needed — everything happens on the canvas.
 */
export class ImagesResize {
  /**
   * Fit the image inside a `maxWidth` × `maxHeight` box, preserving aspect
   * ratio. Returns a new Blob; the input is untouched. If the original
   * is already smaller than the box, returns the original unchanged.
   *
   * @param {Blob} blob
   * @param {{ maxWidth?: number, maxHeight?: number, mimeType?: string, quality?: number }} options
   */
  async fit(blob, options = {}) {
    const {
      maxWidth = 1920,
      maxHeight = 1920,
      mimeType,
      quality = 0.85,
    } = options;

    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(
      maxWidth / bitmap.width,
      maxHeight / bitmap.height,
      1
    );
    if (scale >= 1) {
      bitmap.close();
      return blob;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outType = mimeType || blob.type || "image/jpeg";
    return new Promise((resolve) => {
      canvas.toBlob((out) => resolve(out), outType, quality);
    });
  }

  /** Shorthand: resize to fit within a square of `size` pixels. */
  async square(blob, size, options = {}) {
    return this.fit(blob, { ...options, maxWidth: size, maxHeight: size });
  }
}
