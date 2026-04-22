/**
 * AudioFormat — detect which audio codecs the current browser can play.
 *
 * If you stored multiple encodings of the same clip server-side (e.g. both
 * Opus and MP3, via `../cloud-functions/audio-transcode.example.js`), use
 * `pickBest(["opus", "mp3"])` to pick the smallest one the browser accepts.
 */
export class AudioFormat {
  constructor() {
    this._probe = document.createElement("audio");
    this._mimeByFormat = {
      opus: 'audio/webm; codecs="opus"',
      oggopus: 'audio/ogg; codecs="opus"',
      webm: "audio/webm",
      mp3: "audio/mpeg",
      m4a: 'audio/mp4; codecs="mp4a.40.2"',
      aac: "audio/aac",
      wav: "audio/wav",
      flac: "audio/flac",
    };
  }

  /** Raw `canPlayType()` output: `"probably"`, `"maybe"`, or `""`. */
  canPlay(format) {
    const mime = this._mimeByFormat[format] || format;
    return this._probe.canPlayType(mime);
  }

  /** `true` iff the browser gave a definite `"probably"` for this format. */
  supports(format) {
    return this.canPlay(format) === "probably";
  }

  /**
   * Given candidate formats in priority order, return the first one the
   * browser reports at least `"maybe"` support for. Returns `null` if none
   * match.
   *
   *   format.pickBest(["opus", "mp3"])
   *   // → "opus" on Chrome/Firefox/Edge
   *   // → "mp3"  on older Safari
   */
  pickBest(candidates) {
    for (const c of candidates) {
      const v = this.canPlay(c);
      if (v === "probably" || v === "maybe") return c;
    }
    return null;
  }
}
