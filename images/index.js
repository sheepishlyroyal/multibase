import { ImagesStorage } from "./storage.js";
import { ImagesLazy } from "./lazy.js";
import { ImagesBlurhash } from "./blurhash.js";
import { ImagesResize } from "./resize.js";

/**
 * `mb.images` — umbrella for image helpers.
 *
 * Exposes `storage` (upload / download / chunking), `lazy` (IntersectionObserver),
 * `blurhash` (placeholder encode+decode), and `resize` (canvas downscale) as
 * sub-objects. The most common storage calls are also forwarded directly off
 * `mb.images.*` for convenience.
 */
export class ImagesModule {
  constructor(multibase) {
    this.multibase = multibase;
    this._storage = new ImagesStorage(multibase);
    this.lazy = new ImagesLazy();
    this.blurhash = new ImagesBlurhash();
    this.resize = new ImagesResize();
  }

  upload(blob, metadata) { return this._storage.upload(blob, metadata); }
  download(id) { return this._storage.download(id); }
  downloadAsDataURL(id) { return this._storage.downloadAsDataURL(id); }
  downloadAsBase64(id) { return this._storage.downloadAsBase64(id); }
  list(options) { return this._storage.list(options); }
  delete(id) { return this._storage.delete(id); }

  get storage() { return this._storage; }
}

export { ImagesStorage, ImagesLazy, ImagesBlurhash, ImagesResize };
