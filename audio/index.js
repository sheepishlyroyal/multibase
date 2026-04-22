import { AudioStorage } from "./storage.js";
import { AudioFormat } from "./format.js";
import { AudioWaveform } from "./waveform.js";

/**
 * `mb.audio` — umbrella for audio helpers.
 */
export class AudioModule {
  constructor(multibase) {
    this.multibase = multibase;
    this._storage = new AudioStorage(multibase);
    this.format = new AudioFormat();
    this.waveform = new AudioWaveform();
  }

  upload(blob, metadata) { return this._storage.upload(blob, metadata); }
  download(id) { return this._storage.download(id); }
  downloadAsURL(id) { return this._storage.downloadAsObjectURL(id); }
  list(options) { return this._storage.list(options); }
  delete(id) { return this._storage.delete(id); }

  get storage() { return this._storage; }
}

export { AudioStorage, AudioFormat, AudioWaveform };
