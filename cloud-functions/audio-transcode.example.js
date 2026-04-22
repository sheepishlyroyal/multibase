/**
 * cloud-functions/audio-transcode.example.js
 *
 * On Storage upload to `audio/**`, transcode to Opus in WebM (30–50 %
 * smaller than MP3, every modern browser plays it) with ffmpeg-static.
 * Write the variant beside the original.
 *
 * Deploy:
 *   cp audio-transcode.example.js ~/multibase-functions/functions/index.js
 *   cd ~/multibase-functions/functions && npm install fluent-ffmpeg ffmpeg-static
 *   firebase deploy --only functions:transcodeAudio
 */

const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { getStorage } = require("firebase-admin/storage");
const { initializeApp } = require("firebase-admin/app");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const os = require("os");
const path = require("path");
const fs = require("fs/promises");

ffmpeg.setFfmpegPath(ffmpegPath);
initializeApp();

exports.transcodeAudio = onObjectFinalized(
  {
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    const object = event.data;
    const filePath = object.name;

    if (!filePath.startsWith("audio/")) return;
    if (filePath.endsWith(".opus.webm")) return; // already transcoded
    if (!/\.(mp3|wav|m4a|flac)$/i.test(filePath)) return;

    const bucket = getStorage().bucket(object.bucket);
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));

    const tmpIn = path.join(
      os.tmpdir(),
      `in-${Date.now()}${path.extname(filePath)}`
    );
    const tmpOut = path.join(os.tmpdir(), `out-${Date.now()}.opus.webm`);

    await bucket.file(filePath).download({ destination: tmpIn });

    await new Promise((resolve, reject) => {
      ffmpeg(tmpIn)
        .audioCodec("libopus")
        .audioBitrate("64k")
        .format("webm")
        .on("end", resolve)
        .on("error", reject)
        .save(tmpOut);
    });

    await bucket.upload(tmpOut, {
      destination: `${dir}/${base}.opus.webm`,
      metadata: {
        contentType: "audio/webm",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    await fs.unlink(tmpIn).catch(() => {});
    await fs.unlink(tmpOut).catch(() => {});

    console.log(`transcoded ${filePath} → ${base}.opus.webm`);
  }
);
