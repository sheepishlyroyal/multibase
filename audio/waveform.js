/**
 * AudioWaveform — compute waveform peaks from an audio Blob/File.
 *
 * Store the peaks array on the audio's manifest doc (Firestore can't
 * store Float32Array directly — convert via `Array.from(peaks)`). Later,
 * render the waveform instantly without downloading the full audio.
 *
 * Uses WebAudio's `decodeAudioData` — works in every modern browser.
 */
export class AudioWaveform {
  /**
   * Extract `samples` peaks from `blob`. Each peak is the max absolute
   * amplitude within that sample's block, in the range [0, 1].
   *
   * @param {Blob} blob
   * @param {{ samples?: number, channel?: number }} options
   * @returns {Promise<Float32Array>}
   */
  async compute(blob, { samples = 200, channel = 0 } = {}) {
    const arrayBuffer = await blob.arrayBuffer();
    const Ctor = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctor();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    await ctx.close();

    const raw = audioBuffer.getChannelData(channel);
    const blockSize = Math.floor(raw.length / samples);
    const peaks = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(raw[start + j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  }

  /**
   * Render pre-computed peaks into a canvas. Keep the drawing code out of
   * your app-level files.
   */
  render(canvas, peaks, { color = "#2563eb", background = "transparent" } = {}) {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    if (background !== "transparent") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    const midY = height / 2;
    const barWidth = width / peaks.length;
    ctx.fillStyle = color;
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(1, peaks[i] * height);
      ctx.fillRect(i * barWidth, midY - h / 2, barWidth * 0.8, h);
    }
  }
}
