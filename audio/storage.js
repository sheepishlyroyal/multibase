/**
 * AudioStorage — identical chunked upload/download as ImagesStorage but with
 * audio-friendly default collections (`audio` / `audioChunks`).
 *
 * Exposes an extra `downloadAsObjectURL()` that hands back a `blob:` URL
 * you can plug straight into `<audio src="...">`.
 */

import { ImagesStorage } from "../images/storage.js";

export class AudioStorage extends ImagesStorage {
  constructor(multibase, options = {}) {
    super(multibase, {
      manifestCollection: options.manifestCollection || "audio",
      chunkCollection: options.chunkCollection || "audioChunks",
      chunkSize: options.chunkSize || 750 * 1024,
      ...options,
    });
  }

  /** Download and hand back a `blob:` URL. Good for `<audio src="...">`. */
  async downloadAsObjectURL(audioId) {
    const blob = await this.download(audioId);
    return URL.createObjectURL(blob);
  }
}
