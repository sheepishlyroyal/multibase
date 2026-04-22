/**
 * ImagesStorage — upload and download binary blobs via base64 + chunking.
 *
 * Firestore caps each document at 1 MiB. A 2 MB image base64-encodes to
 * ~2.7 MB of text, so we split it into chunks of `chunkSize` characters
 * (default 750 KB) and write one manifest + N chunk docs. Chunk ids are
 * deterministic (`<imageId>_<N>`) so Multibase's hash-sharding distributes
 * them naturally across Firebase projects for parallel I/O.
 *
 * Reused by audio/storage.js — they differ only in collection names.
 */

const DEFAULT_CHUNK_SIZE = 750 * 1024;
const DEFAULT_MANIFEST_COLLECTION = "images";
const DEFAULT_CHUNK_COLLECTION = "imageChunks";

export class ImagesStorage {
  constructor(multibase, options = {}) {
    if (!multibase || typeof multibase.set !== "function") {
      throw new Error("ImagesStorage: first argument must be a Multibase instance");
    }
    this.multibase = multibase;
    this.manifestCollection =
      options.manifestCollection || DEFAULT_MANIFEST_COLLECTION;
    this.chunkCollection = options.chunkCollection || DEFAULT_CHUNK_COLLECTION;
    this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  }

  async upload(blob, metadata = {}) {
    if (!(blob instanceof Blob)) {
      throw new Error("ImagesStorage.upload: expected a Blob or File");
    }
    const base64 = await ImagesStorage.blobToBase64(blob);
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

  async download(imageId) {
    const { manifest, base64 } = await this._fetchManifestAndData(imageId);
    return ImagesStorage.base64ToBlob(base64, manifest.mimeType);
  }

  async downloadAsDataURL(imageId) {
    const { manifest, base64 } = await this._fetchManifestAndData(imageId);
    return `data:${manifest.mimeType};base64,${base64}`;
  }

  async downloadAsBase64(imageId) {
    const { base64 } = await this._fetchManifestAndData(imageId);
    return base64;
  }

  async getManifest(imageId) {
    return this.multibase.get(this.manifestCollection, imageId);
  }

  async list(options) {
    return this.multibase.list(this.manifestCollection, options);
  }

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

  static blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        const commaIndex = result.indexOf(",");
        resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  static base64ToBlob(base64, mimeType = "application/octet-stream") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }

  async _fetchManifestAndData(imageId) {
    const manifest = await this.getManifest(imageId);
    if (!manifest) {
      throw new Error(`ImagesStorage: no image with id "${imageId}"`);
    }
    const chunkDocs = await Promise.all(
      Array.from({ length: manifest.chunkCount }, (_, i) =>
        this.multibase.get(this.chunkCollection, `${imageId}_${i}`)
      )
    );
    for (let i = 0; i < chunkDocs.length; i++) {
      if (!chunkDocs[i]) {
        throw new Error(
          `ImagesStorage: chunk ${i} of image "${imageId}" is missing`
        );
      }
    }
    const base64 = chunkDocs
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map((c) => c.data)
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
