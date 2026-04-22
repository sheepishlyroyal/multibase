/**
 * MultibaseImages — store binary blobs (images, files, PDFs, audio) across
 * multiple Firebase projects by routing them through a Multibase instance.
 *
 * Firestore rejects documents larger than ~1 MiB. Base64 encoding inflates
 * binary by ~33%, so even a 750 KB image won't fit in a single doc. This
 * helper splits the base64 text into manageable chunks and writes one
 * "manifest" doc + N "chunk" docs. Because each chunk gets its own id,
 * Multibase's hash-sharding distributes them across your Firebase projects
 * for parallel reads and writes.
 *
 * Minimal usage:
 *   const db = new Multibase(configs).init();
 *   const images = new MultibaseImages(db);
 *
 *   const imageId = await images.upload(blob);          // File / Blob / paste event
 *   const dataUrl = await images.downloadAsDataURL(id); // drop into <img src="...">
 *   await images.delete(imageId);
 */

const DEFAULT_CHUNK_SIZE = 750 * 1024;
const DEFAULT_MANIFEST_COLLECTION = "images";
const DEFAULT_CHUNK_COLLECTION = "imageChunks";

export class MultibaseImages {
  /**
   * @param {object} multibase A ready, `.init()`-ed Multibase instance.
   * @param {{manifestCollection?: string, chunkCollection?: string, chunkSize?: number}} [options]
   */
  constructor(multibase, options = {}) {
    if (!multibase || typeof multibase.set !== "function") {
      throw new Error(
        "MultibaseImages: first argument must be an initialized Multibase instance"
      );
    }
    this.multibase = multibase;
    this.manifestCollection =
      options.manifestCollection || DEFAULT_MANIFEST_COLLECTION;
    this.chunkCollection = options.chunkCollection || DEFAULT_CHUNK_COLLECTION;
    this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  }

  /**
   * Upload a Blob or File. Returns the manifest document's id.
   *
   * @param {Blob|File} blob
   * @param {object} [metadata] Extra fields merged into the manifest doc.
   * @returns {Promise<string>} imageId
   */
  async upload(blob, metadata = {}) {
    if (!(blob instanceof Blob)) {
      throw new Error("MultibaseImages.upload: expected a Blob or File");
    }

    const base64 = await MultibaseImages.blobToBase64(blob);
    const chunks = this._splitIntoChunks(base64, this.chunkSize);
    const mimeType = blob.type || "application/octet-stream";

    const { id: imageId } = await this.multibase.set(
      this.manifestCollection,
      null,
      {
        mimeType,
        byteSize: blob.size,
        chunkCount: chunks.length,
        chunkSize: this.chunkSize,
        ...metadata,
      }
    );

    // Chunk ids are deterministic — imageId_0, imageId_1, … — so the manifest
    // doesn't need to store them. Because each id hashes independently, the
    // chunks naturally spread across shards.
    await Promise.all(
      chunks.map((data, chunkIndex) =>
        this.multibase.set(this.chunkCollection, `${imageId}_${chunkIndex}`, {
          imageId,
          chunkIndex,
          data,
        })
      )
    );

    return imageId;
  }

  /** Download and return a Blob. */
  async download(imageId) {
    const { manifest, base64 } = await this._fetchManifestAndData(imageId);
    return MultibaseImages.base64ToBlob(base64, manifest.mimeType);
  }

  /** Download as a `data:` URL — ready for `<img src="...">`. */
  async downloadAsDataURL(imageId) {
    const { manifest, base64 } = await this._fetchManifestAndData(imageId);
    return `data:${manifest.mimeType};base64,${base64}`;
  }

  /** Download and return just the raw base64 string (no `data:` prefix). */
  async downloadAsBase64(imageId) {
    const { base64 } = await this._fetchManifestAndData(imageId);
    return base64;
  }

  /** Fetch just the manifest (one read). Returns null if the image doesn't exist. */
  async getManifest(imageId) {
    return this.multibase.get(this.manifestCollection, imageId);
  }

  /** List manifests only. Same options as `multibase.list`. */
  async list(options) {
    return this.multibase.list(this.manifestCollection, options);
  }

  /** Delete the manifest and every chunk. No-op if the image doesn't exist. */
  async delete(imageId) {
    const manifest = await this.getManifest(imageId);
    if (!manifest) return;
    const chunkDeletes = Array.from({ length: manifest.chunkCount }, (_, i) =>
      this.multibase.delete(this.chunkCollection, `${imageId}_${i}`)
    );
    await Promise.all([
      ...chunkDeletes,
      this.multibase.delete(this.manifestCollection, imageId),
    ]);
  }

  /** Convert a Blob/File to a base64 string (no `data:` prefix). */
  static blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // FileReader.readAsDataURL yields "data:<mime>;base64,<data>".
        // Strip everything up to and including the first comma.
        const result = String(reader.result);
        const commaIndex = result.indexOf(",");
        resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  /** Reverse of blobToBase64. */
  static base64ToBlob(base64, mimeType = "application/octet-stream") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  async _fetchManifestAndData(imageId) {
    const manifest = await this.getManifest(imageId);
    if (!manifest) {
      throw new Error(`MultibaseImages: no image with id "${imageId}"`);
    }
    const chunkDocs = await Promise.all(
      Array.from({ length: manifest.chunkCount }, (_, i) =>
        this.multibase.get(this.chunkCollection, `${imageId}_${i}`)
      )
    );
    for (let i = 0; i < chunkDocs.length; i++) {
      if (!chunkDocs[i]) {
        throw new Error(
          `MultibaseImages: chunk ${i} of image "${imageId}" is missing`
        );
      }
    }
    // Parallel fetches across shards can resolve out of order.
    const base64 = chunkDocs
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map((chunk) => chunk.data)
      .join("");
    return { manifest, base64 };
  }

  _splitIntoChunks(str, size) {
    if (str.length <= size) return [str];
    const chunks = [];
    for (let i = 0; i < str.length; i += size) {
      chunks.push(str.slice(i, i + size));
    }
    return chunks;
  }
}
