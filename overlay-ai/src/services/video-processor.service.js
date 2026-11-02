'use strict';

const path = require('path');
const fs = require('fs');

let ffmpeg = null;
try {
  ffmpeg = require('fluent-ffmpeg');
} catch (_) {
  try {
    const fallbackPath = path.resolve(__dirname, '../../../Kairos-Backend/node_modules/fluent-ffmpeg');
    if (fs.existsSync(fallbackPath)) {
      ffmpeg = require(fallbackPath);
    }
  } catch (e) {
    console.warn('[video-processor] fluent-ffmpeg module not found:', e.message);
  }
}

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

/**
 * Detects the first audio stream codec name using ffprobe.
 */
async function getAudioCodec(videoPath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);
    return (stdout || '').trim().toLowerCase();
  } catch (err) {
    console.warn('[video-processor] ffprobe audio stream check failed:', err.message);
    return null;
  }
}

/**
 * Converts or extracts audio from a video file using FFmpeg.
 * Tier 1: If audio codec is already browser-compatible (AAC, MP3, Opus, Vorbis, FLAC),
 *         uses stream-copy (-c:a copy) for sub-second, lossless extraction.
 * Tier 2: If audio is non-compatible (AC-3, E-AC-3, DTS) or copy fails,
 *         uses ultra-fast LAME MP3 encoding (-compression_level 9, -threads 0)
 *         and reports live progress percentages.
 *
 * @param {string} videoPath - Absolute path to the source video file.
 * @param {string} outputDir - Absolute path to the directory for the output audio file.
 * @param {Function} [onProgress] - Optional progress callback (percent: number)
 * @returns {Promise<{ audioPath: string, audioFileName: string }>}
 */
async function convertVideoToAudio(videoPath, outputDir, onProgress) {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Source video file not found: ${videoPath}`);
  }

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const baseName = path.basename(videoPath, path.extname(videoPath));
  const detectedCodec = await getAudioCodec(videoPath);
  console.log(`[video-processor] Source file ${path.basename(videoPath)} audio codec: "${detectedCodec || 'none'}"`);

  if (!detectedCodec) {
    throw new Error('This file contains no usable audio. Please upload a different file.');
  }

  // Map stream-copiable codecs to browser-friendly audio containers
  const STREAM_COPY_MAP = {
    aac: '.m4a',
    mp3: '.mp3',
    opus: '.opus',
    vorbis: '.ogg',
    flac: '.flac',
    pcm_s16le: '.wav',
    pcm_s24le: '.wav'
  };

  // Tier 1: Attempt Instant Stream Copy (< 1s execution)
  if (detectedCodec && STREAM_COPY_MAP[detectedCodec]) {
    const ext = STREAM_COPY_MAP[detectedCodec];
    const audioFileName = `${baseName}_audio_${Date.now()}${ext}`;
    const audioPath = path.join(outputDir, audioFileName);

    try {
      console.log(`[video-processor] Codec "${detectedCodec}" supports instant stream copy. Extracting directly to ${ext}...`);
      if (typeof onProgress === 'function') onProgress(25);
      const copyStart = Date.now();

      await execFileAsync('ffmpeg', [
        '-v', 'error',
        '-y',
        '-i', videoPath,
        '-vn',
        '-c:a', 'copy',
        audioPath
      ]);

      const elapsedMs = Date.now() - copyStart;
      if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
        console.log(`[video-processor] Stream copy extraction succeeded in ${elapsedMs}ms: ${audioFileName}`);
        if (typeof onProgress === 'function') onProgress(100);
        return { audioPath, audioFileName };
      }
      throw new Error('Extracted stream copy audio is empty.');
    } catch (copyErr) {
      console.warn(`[video-processor] Stream copy failed (${copyErr.message}). Falling back to fast re-encode...`);
      try {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      } catch (_) {}
    }
  }

  // Tier 2: Fast re-encode to MP3 using multi-threading and fast LAME compression
  return new Promise((resolve, reject) => {
    const audioFileName = `${baseName}_audio_${Date.now()}.mp3`;
    const audioPath = path.join(outputDir, audioFileName);

    console.log(`[video-processor] Starting fast multi-threaded MP3 encoding: ${audioFileName}`);
    if (typeof onProgress === 'function') onProgress(5);

    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .outputOptions([
        '-compression_level 9',
        '-b:a 128k',
        '-threads 0'
      ])
      .output(audioPath)
      .on('start', (cmd) => {
        console.log(`[video-processor] FFmpeg command: ${cmd}`);
      })
      .on('progress', (progress) => {
        if (progress.percent && typeof onProgress === 'function') {
          const pct = Math.min(99, Math.max(1, Math.round(progress.percent)));
          onProgress(pct);
        }
      })
      .on('end', () => {
        if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size === 0) {
          try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (_) {}
          return reject(new Error('This file contains no usable audio. Please upload a different file.'));
        }
        console.log(`[video-processor] Fast MP3 conversion complete: ${audioFileName}`);
        if (typeof onProgress === 'function') onProgress(100);
        resolve({ audioPath, audioFileName });
      })
      .on('error', (err) => {
        console.error(`[video-processor] FFmpeg error:`, err.message);
        try {
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        } catch (_) {}
        if (/does not contain any stream|no audio stream/i.test(err.message)) {
          reject(new Error('This file contains no usable audio. Please upload a different file.'));
        } else {
          reject(new Error('The file appears to be corrupted or unsupported. Please try another file.'));
        }
      })
      .run();
  });
}

module.exports = { convertVideoToAudio, getAudioCodec };
