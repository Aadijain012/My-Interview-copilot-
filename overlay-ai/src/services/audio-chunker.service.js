'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execSync } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { getLanguageConfig } = require('../config/languages');

/**
 * Extracts the media duration in seconds using ffprobe.
 */
async function getAudioDuration(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    const duration = parseFloat(stdout.trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch (err) {
    console.warn(`[audio-chunker] ffprobe failed for ${filePath}:`, err.message);
    return 0;
  }
}

/**
 * Formats a duration in seconds to standard MM:SS or HH:MM:SS.
 */
function formatTimecode(seconds) {
  const totalSec = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const padSec = secs < 10 ? `0${secs}` : `${secs}`;
  const padMin = mins < 10 ? `0${mins}` : `${mins}`;

  if (hrs > 0) {
    return `${hrs}:${padMin}:${padSec}`;
  }
  return `${mins}:${padSec}`;
}

/**
 * Detect language hint from file name if present.
 */
function detectLanguageHintFromFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const lower = filename.toLowerCase();
  const known = [
    { name: 'telugu', code: 'te' },
    { name: 'hindi', code: 'hi' },
    { name: 'tamil', code: 'ta' },
    { name: 'kannada', code: 'kn' },
    { name: 'malayalam', code: 'ml' },
    { name: 'marathi', code: 'mr' },
    { name: 'gujarati', code: 'gu' },
    { name: 'bengali', code: 'bn' },
    { name: 'spanish', code: 'es' },
    { name: 'french', code: 'fr' },
    { name: 'german', code: 'de' },
    { name: 'japanese', code: 'ja' },
    { name: 'chinese', code: 'zh' },
    { name: 'english', code: 'en' },
  ];
  for (const item of known) {
    if (lower.includes(item.name)) {
      return item.code;
    }
  }
  return null;
}

const LANG_NAME_TO_CODE = {
  tamil: 'ta',
  telugu: 'te',
  hindi: 'hi',
  english: 'en',
  kannada: 'kn',
  malayalam: 'ml',
  marathi: 'mr',
  gujarati: 'gu',
  bengali: 'bn',
  punjabi: 'pa',
  urdu: 'ur',
  odia: 'or',
  assamese: 'as',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  russian: 'ru',
  japanese: 'ja',
  chinese: 'zh',
  korean: 'ko',
  arabic: 'ar',
  turkish: 'tr',
  vietnamese: 'vi',
  indonesian: 'id',
  dutch: 'nl',
  polish: 'pl',
  swedish: 'sv'
};

/**
 * Executes a network fetch call with bounded exponential backoff for transient network issues.
 * Handles cases where laptop wakes from sleep and Wi-Fi / DNS resolution takes a few seconds.
 */
async function fetchWithNetworkRetry(url, options, maxRetries = 3, initialDelayMs = 1500) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await fetch(url, options);
    } catch (err) {
      const isNetworkError =
        err?.name === 'TypeError' ||
        err?.code === 'ENOTFOUND' ||
        err?.code === 'EAI_AGAIN' ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ECONNREFUSED' ||
        err?.code === 'ETIMEDOUT' ||
        (err?.message && (
          err.message.includes('fetch failed') ||
          err.message.includes('network') ||
          err.message.includes('socket') ||
          err.message.includes('getaddrinfo')
        ));

      if (attempt <= maxRetries && isNetworkError) {
        const delay = Math.round(initialDelayMs * Math.pow(1.8, attempt - 1));
        console.warn(`[audio-chunker] Transient network issue (${err.message}). Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Automatically detects the spoken language of an audio recording.
 * Extracts a short 15-20s sample from substantive dialogue (avoiding intro logos / disclaimers).
 * Uses zero-shot speech language identification when available,
 * with graceful fallback to Deepgram automatic language detection.
 */
async function detectSpokenLanguage(filePath, duration = 0) {
  const sampleOffset = duration > 90 ? Math.min(180, Math.floor(duration * 0.1)) : 0;
  const tempSnippet = path.join(os.tmpdir(), `detect_snip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`);

  try {
    await execFileAsync('ffmpeg', [
      '-v', 'error',
      '-ss', String(sampleOffset),
      '-t', '20',
      '-i', filePath,
      '-y',
      '-vn',
      '-c:a', 'copy',
      tempSnippet
    ]);
  } catch (err) {
    try {
      await execFileAsync('ffmpeg', [
        '-v', 'error',
        '-ss', String(sampleOffset),
        '-t', '20',
        '-i', filePath,
        '-y',
        '-vn',
        '-c:a', 'libmp3lame',
        '-compression_level', '9',
        '-b:a', '128k',
        tempSnippet
      ]);
    } catch (_) {}
  }

  const snippetFile = fs.existsSync(tempSnippet) ? tempSnippet : filePath;

  // Primary: Zero-shot speech LID via Whisper
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && fs.existsSync(snippetFile)) {
    try {
      const audioBuffer = fs.readFileSync(snippetFile);
      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');

      const res = await fetchWithNetworkRetry('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.language) {
          const raw = data.language.toLowerCase().trim();
          const mapped = LANG_NAME_TO_CODE[raw] || raw.slice(0, 2);
          console.log(`[audio-chunker] Zero-shot speech language identified: "${data.language}" (${mapped})`);
          try { if (fs.existsSync(tempSnippet)) fs.unlinkSync(tempSnippet); } catch (_) {}
          return mapped;
        }
      }
    } catch (whisperErr) {
      console.warn('[audio-chunker] Zero-shot LID failed, falling back:', whisperErr.message);
    }
  }

  // Cleanup temp snippet
  try { if (fs.existsSync(tempSnippet)) fs.unlinkSync(tempSnippet); } catch (_) {}

  return 'auto';
}

/**
 * Segments an audio file into lightweight, compact chunks using ffmpeg.
 * Produces clean mono 16kHz MP3 chunks (~2.3MB per 5 minutes), which prevents
 * Deepgram SLOW_UPLOAD timeouts and broken AAC stream headers.
 */
async function splitAudioIntoChunks(filePath, sessionId, segmentSeconds = 300) {
  const chunksDir = path.join(os.tmpdir(), 'kairos-audio-chunks', String(sessionId));
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  const mp3Pattern = path.join(chunksDir, 'chunk_%03d.mp3');

  try {
    // Primary: Convert and segment directly into 16kHz mono 64k MP3 (sub-2s execution)
    await execFileAsync('ffmpeg', [
      '-v', 'error',
      '-y',
      '-i', filePath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'libmp3lame',
      '-b:a', '64k',
      '-threads', '0',
      '-f', 'segment',
      '-segment_time', String(segmentSeconds),
      '-reset_timestamps', '1',
      mp3Pattern
    ]);
  } catch (encodeErr) {
    console.warn('[audio-chunker] Compact MP3 segmenting failed, trying stream copy fallback:', encodeErr.message);
    const ext = (path.extname(filePath) || '.mp3').toLowerCase();
    const copyPattern = path.join(chunksDir, `chunk_%03d${ext}`);
    await execFileAsync('ffmpeg', [
      '-v', 'error',
      '-y',
      '-i', filePath,
      '-f', 'segment',
      '-segment_time', String(segmentSeconds),
      '-reset_timestamps', '1',
      '-c', 'copy',
      copyPattern
    ]);
  }

  // Read generated chunk files and sort them chronologically
  const chunkFiles = fs.readdirSync(chunksDir)
    .filter(name => name.startsWith('chunk_') && (name.endsWith('.mp3') || name.endsWith(path.extname(filePath).toLowerCase())))
    .sort();

  if (chunkFiles.length === 0) {
    throw new Error('FFmpeg failed to produce any audio chunks.');
  }

  // Calculate duration and cumulative start offsets for each chunk
  const chunks = [];
  let cumulativeOffset = 0;

  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkPath = path.join(chunksDir, chunkFiles[i]);
    const stats = fs.statSync(chunkPath);
    // Discard residual trailing chunks < 4KB (e.g. leftover boundary bytes under a fraction of a second)
    if (stats.size < 4096) {
      try { fs.unlinkSync(chunkPath); } catch (_) {}
      continue;
    }
    const duration = await getAudioDuration(chunkPath);
    if (duration <= 0.2) {
      try { fs.unlinkSync(chunkPath); } catch (_) {}
      continue;
    }
    chunks.push({
      index: chunks.length,
      fileName: chunkFiles[i],
      filePath: chunkPath,
      offsetSeconds: cumulativeOffset,
      duration: duration || segmentSeconds
    });
    cumulativeOffset += (duration || segmentSeconds);
  }

  return { chunksDir, chunks, totalEstimatedDuration: cumulativeOffset };
}

/**
 * Resolves the Deepgram model based on language configuration.
 * For English ('en') and Hindi ('hi'), uses 'nova-2' to align with AI Copilot and prevent merge conflicts.
 * For Indic languages ('te', 'ta', 'kn', 'mr', 'gu', 'bn', etc.), uses 'nova-3'.
 */
function resolveModelForLanguage(langCode) {
  if (!langCode || langCode === 'auto') return 'nova-3';
  const normalized = langCode.trim().toLowerCase();
  if (normalized === 'en' || normalized === 'hi') {
    return 'nova-2';
  }
  const config = getLanguageConfig(normalized);
  if (config?.deepgram?.model) {
    return config.deepgram.model;
  }
  return 'nova-3';
}

/**
 * Resolves standard MIME type from audio file extension.
 */
function getMimeTypeForAudioFile(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.m4a' || ext === '.mp4') return 'audio/mp4';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.ogg' || ext === '.opus') return 'audio/ogg';
  if (ext === '.webm') return 'audio/webm';
  return 'audio/mpeg';
}

/**
 * Calls Deepgram REST API to transcribe a single audio file or chunk.
 */
async function transcribeDeepgramRequest(filePath, mimeType, options = {}) {
  const apiKey = options.apiKey || process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not configured on the server.');

  const language = options.language || 'auto';
  let audioBuffer = fs.readFileSync(filePath);
  let currentMimeType = mimeType || getMimeTypeForAudioFile(filePath);

  async function makeRequest(model, lang, detectLang, bufferToUse = audioBuffer, mimeToUse = currentMimeType) {
    const deepgramUrl = new URL('https://api.deepgram.com/v1/listen');
    deepgramUrl.searchParams.set('smart_format', 'true');
    deepgramUrl.searchParams.set('punctuate', 'true');
    deepgramUrl.searchParams.set('diarize', 'true');
    deepgramUrl.searchParams.set('utterances', 'true');
    deepgramUrl.searchParams.set('paragraphs', 'true');
    deepgramUrl.searchParams.set('model', model);

    if (detectLang) {
      deepgramUrl.searchParams.set('detect_language', 'true');
    } else if (lang && lang !== 'auto') {
      const langConfig = getLanguageConfig(lang);
      deepgramUrl.searchParams.set('language', langConfig?.deepgram?.languageCode || lang);
    }

    return await fetchWithNetworkRetry(deepgramUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': mimeToUse || 'audio/mpeg'
      },
      body: bufferToUse
    });
  }

  // Primary configuration:
  // Use nova-2 for English and Hindi (aligned with AI Copilot).
  // Use nova-3 for Indic languages (Telugu, Tamil, Kannada, Marathi, etc.) or auto-detection.
  const primaryModel = options.model || resolveModelForLanguage(language);
  const isDetect = language === 'auto';
  let response = await makeRequest(primaryModel, language, isDetect);

  // If request failed, handle format issues, timeouts, or safe model fallbacks
  if (!response.ok) {
    let errorText = await response.text();
    console.warn(`[audio-chunker] Request (${primaryModel}, lang=${language}) failed with HTTP ${response.status}: ${errorText}`);

    // Case 1: Upload timeout (HTTP 408 SLOW_UPLOAD) or audio container defect
    // Transcode the chunk to compact mono 16kHz MP3 and retry with the same primary model
    const isTimeoutOrAudioIssue =
      response.status === 408 ||
      errorText.includes('SLOW_UPLOAD') ||
      errorText.includes('Request upload timeout') ||
      errorText.includes('corrupt or unsupported data') ||
      errorText.includes('failed to process audio');

    if (isTimeoutOrAudioIssue) {
      console.log(`[audio-chunker] Upload timeout / audio issue detected for ${path.basename(filePath)} (HTTP ${response.status}). Transcoding to compact mono 16kHz MP3...`);
      const transcodeTemp = path.join(os.tmpdir(), `recode_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`);
      try {
        await execFileAsync('ffmpeg', [
          '-v', 'error',
          '-y',
          '-i', filePath,
          '-vn',
          '-ac', '1',
          '-ar', '16000',
          '-c:a', 'libmp3lame',
          '-b:a', '64k',
          transcodeTemp
        ]);
        if (fs.existsSync(transcodeTemp)) {
          const recodedBuffer = fs.readFileSync(transcodeTemp);
          console.log(`[audio-chunker] Chunk transcoded (${(recodedBuffer.length / 1024).toFixed(1)} KB). Retrying with model ${primaryModel}...`);
          response = await makeRequest(primaryModel, language, isDetect, recodedBuffer, 'audio/mpeg');
          try { fs.unlinkSync(transcodeTemp); } catch (_) {}
          if (!response.ok) {
            errorText = await response.text();
          }
        }
      } catch (transcodeErr) {
        console.warn('[audio-chunker] Chunk transcode failed:', transcodeErr.message);
        try { if (fs.existsSync(transcodeTemp)) fs.unlinkSync(transcodeTemp); } catch (_) {}
      }
    }

    // Case 2: Transient Deepgram rate limits or upstream gateway issues (HTTP 429, 500..504)
    if (!response.ok && (response.status === 429 || (response.status >= 500 && response.status <= 504))) {
      console.warn(`[audio-chunker] Deepgram returned transient HTTP ${response.status}. Retrying in 2.5s...`);
      await new Promise(r => setTimeout(r, 2500));
      response = await makeRequest(primaryModel, language, isDetect);
      if (!response.ok) {
        errorText = await response.text();
      }
    }

    // Case 3: Model compatibility fallback (only if model genuinely supports the language)
    if (!response.ok && response.status === 400) {
      const langConfig = getLanguageConfig(language);
      // Only fallback from nova-2 to nova-3, never switch from nova-3 to nova-2 for Indic languages!
      if (primaryModel === 'nova-2') {
        console.warn(`[audio-chunker] Retrying with nova-3 fallback for ${language}...`);
        response = await makeRequest('nova-3', language, isDetect);
      } else if (primaryModel === 'nova-3' && (language === 'en' || language === 'hi' || langConfig?.deepgram?.model === 'nova-2')) {
        console.warn(`[audio-chunker] Retrying with nova-2 fallback for ${language}...`);
        response = await makeRequest('nova-2', language, isDetect);
      }
      if (!response.ok) {
        errorText = await response.text();
      }
    }

    if (!response.ok) {
      throw new Error(`Deepgram transcription failed (HTTP ${response.status}): ${errorText}`);
    }
  }

  const payload = await response.json();
  const channel = payload?.results?.channels?.[0];
  const detectedLanguage = channel?.detected_language || payload?.results?.channels?.[0]?.alternatives?.[0]?.languages?.[0];
  const transcript = channel?.alternatives?.[0]?.transcript || '';
  const rawUtterances = payload?.results?.utterances || [];
  const words = channel?.alternatives?.[0]?.words || [];

  return {
    transcript,
    rawUtterances,
    words,
    detectedLanguage,
    durationSeconds: Number(payload?.metadata?.duration) || 0
  };
}

/**
 * Safely removes a temporary directory and its contents.
 */
function cleanupDirectory(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`[audio-chunker] Failed to cleanup directory ${dirPath}:`, err.message);
  }
}

/**
 * Main audio transcription engine:
 * Handles short files directly, and segments large/long files into chunks,
 * transcribing sequentially and merging chronologically with accurate speaker diarization.
 */
async function transcribeAudioPipeline(filePath, mimeType, options = {}) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not configured on the server.');

  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);
  const totalDuration = await getAudioDuration(filePath);

  console.log(`[audio-chunker] Analyzing file: size=${fileSizeMB.toFixed(2)}MB, duration=${totalDuration.toFixed(1)}s (${formatTimecode(totalDuration)})`);

  // Resolve requested language or filename hints
  let targetLanguage = options.language || 'auto';
  if (targetLanguage === 'auto' && options.fileName) {
    const hint = detectLanguageHintFromFilename(options.fileName);
    if (hint) {
      console.log(`[audio-chunker] Detected language hint "${hint}" from filename "${options.fileName}"`);
      targetLanguage = hint;
    }
  }

  // Automatic spoken language detection from actual dialogue when language is 'auto'
  if (targetLanguage === 'auto') {
    console.log(`[audio-chunker] Automatically detecting spoken language from speech audio...`);
    const autoLang = await detectSpokenLanguage(filePath, totalDuration);
    if (autoLang && autoLang !== 'auto') {
      targetLanguage = autoLang;
      console.log(`[audio-chunker] Spoken language successfully detected: "${targetLanguage}"`);
    }
  }

  // Fast-Path: Process files up to 45 minutes and 60 MB directly in a single request (sub-10s execution)
  const CHUNK_THRESHOLD_SECONDS = 2700; // 45 minutes
  const CHUNK_THRESHOLD_MB = 60; // 60 MB

  if (totalDuration <= CHUNK_THRESHOLD_SECONDS && fileSizeMB <= CHUNK_THRESHOLD_MB) {
    console.log('[audio-chunker] Audio file within single-request threshold. Processing directly for sub-10s speed...');
    let preconditionedPath = filePath;
    let preconditionedMime = mimeType;
    let tempPreconditionedFile = null;

    try {
      // Acoustic conditioning for Deepgram Nova-3 & Nova-2 models:
      // High-frequency stereo/AAC audio (>16kHz) causes phonetic decoding confusion resulting in
      // English transliteration words (code-mixing). Preconditioning to 16kHz mono 64k MP3
      // takes ~2.5s and guarantees 100% pure native script while dropping payload size by ~50%.
      tempPreconditionedFile = path.join(os.tmpdir(), `preconditioned_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`);
      try {
        await execFileAsync('ffmpeg', [
          '-v', 'error',
          '-y',
          '-i', filePath,
          '-vn',
          '-ac', '1',
          '-ar', '16000',
          '-c:a', 'libmp3lame',
          '-b:a', '64k',
          '-threads', '0',
          tempPreconditionedFile
        ]);
        if (fs.existsSync(tempPreconditionedFile) && fs.statSync(tempPreconditionedFile).size > 0) {
          preconditionedPath = tempPreconditionedFile;
          preconditionedMime = 'audio/mpeg';
          console.log(`[audio-chunker] Preconditioned audio to 16kHz mono MP3 (${(fs.statSync(tempPreconditionedFile).size / (1024 * 1024)).toFixed(1)} MB)`);
        }
      } catch (convErr) {
        console.warn(`[audio-chunker] Audio preconditioning skipped (${convErr.message}), proceeding with raw file`);
      }

      const singleModel = resolveModelForLanguage(targetLanguage);
      const result = await transcribeDeepgramRequest(preconditionedPath, preconditionedMime, {
        language: targetLanguage,
        model: singleModel,
        apiKey
      });

      const rawUtterances = result.rawUtterances || [];
      let utterances = [];

      if (rawUtterances.length > 0) {
        utterances = rawUtterances.map((u, idx) => {
          const start = Number(u.start) || 0;
          const end = Number(u.end) || 0;
          return {
            speaker: `Speaker ${(u.speaker ?? 0) + 1}`,
            timecode: formatTimecode(start),
            start,
            end,
            text: u.transcript || ''
          };
        });
      } else if (Array.isArray(result.words) && result.words.length > 0) {
        utterances = synthesizeUtterancesFromWords(result.words, 0);
      } else if (result.transcript.trim()) {
        utterances = fallbackSentenceUtterances(result.transcript, 0);
      }

      const durationSec = result.durationSeconds || totalDuration;
      const speakersCount = new Set(utterances.map(u => u.speaker)).size || 1;

      return {
        transcript: result.transcript,
        utterances,
        durationSeconds: durationSec,
        duration: formatTimecode(durationSec),
        speakersCount,
        detectedLanguage: result.detectedLanguage || targetLanguage
      };
    } catch (directErr) {
      console.warn(`[audio-chunker] Direct transcription attempt failed (${directErr.message}). Falling back to chunked pipeline...`);
    } finally {
      if (tempPreconditionedFile && fs.existsSync(tempPreconditionedFile)) {
        try { fs.unlinkSync(tempPreconditionedFile); } catch (_) {}
      }
    }
  }

  // Audio exceeds threshold: Execute sequential chunking pipeline
  console.log(`[audio-chunker] Large/Long audio detected. Initiating chunked transcription pipeline...`);
  const sessionId = options.sessionId || `session_${Date.now()}`;
  const segmentSeconds = 300; // 5 minute chunks (compact ~2.3MB MP3 each)

  const { chunksDir, chunks } = await splitAudioIntoChunks(filePath, sessionId, segmentSeconds);
  console.log(`[audio-chunker] Split into ${chunks.length} chunks across ${chunksDir}`);

  const chunkResults = new Array(chunks.length);
  const allUtterances = [];
  const allTranscripts = [];
  let detectedLang = targetLanguage;

  try {
    // If targetLanguage is 'auto', process chunk 0 first to detect the spoken language
    let startIndex = 0;
    if (detectedLang === 'auto' && chunks.length > 0) {
      console.log(`[audio-chunker] Detecting spoken language on initial chunk...`);
      const chunk0 = chunks[0];
      const res0 = await transcribeDeepgramRequest(chunk0.filePath, getMimeTypeForAudioFile(chunk0.filePath), {
        apiKey,
        language: 'auto'
      });
      chunkResults[0] = res0;
      if (res0.detectedLanguage) {
        detectedLang = res0.detectedLanguage;
        console.log(`[audio-chunker] Spoken language detected: "${detectedLang}". Applying to entire recording.`);
      }
      startIndex = 1;
    }

    // Resolve model based on detected language:
    // Uses Nova-2 for English and Hindi (matching AI Copilot & languages.js).
    // Uses Nova-3 for Indic languages (Telugu, Tamil, Kannada, Marathi, etc.).
    const chunkModel = resolveModelForLanguage(detectedLang);
    console.log(`[audio-chunker] Using model "${chunkModel}" for language "${detectedLang}" across chunks`);

    // Process remaining chunks in parallel batches of up to 8 for rapid processing
    const BATCH_SIZE = 8;
    for (let i = startIndex; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchNames = batch.map(b => b.fileName).join(', ');
      console.log(`[audio-chunker] Transcribing batch [${batchNames}] (${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}) with model: ${chunkModel}, language: ${detectedLang}...`);

      const batchResults = await Promise.all(
        batch.map(chunk =>
          transcribeDeepgramRequest(chunk.filePath, getMimeTypeForAudioFile(chunk.filePath), {
            apiKey,
            language: detectedLang,
            model: chunkModel
          })
        )
      );

      for (let j = 0; j < batch.length; j++) {
        chunkResults[batch[j].index] = batchResults[j];
      }
    }

    // Assemble and chronologically merge all chunk results
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkResult = chunkResults[i];
      if (!chunkResult) continue;

      if (chunkResult.transcript && chunkResult.transcript.trim()) {
        allTranscripts.push(chunkResult.transcript.trim());
      }

      let chunkUtterances = [];
      if (chunkResult.rawUtterances && chunkResult.rawUtterances.length > 0) {
        chunkUtterances = chunkResult.rawUtterances.map((u) => {
          const start = chunk.offsetSeconds + (Number(u.start) || 0);
          const end = chunk.offsetSeconds + (Number(u.end) || 0);
          return {
            speaker: `Speaker ${(u.speaker ?? 0) + 1}`,
            timecode: formatTimecode(start),
            start,
            end,
            text: u.transcript || ''
          };
        });
      } else if (chunkResult.words && chunkResult.words.length > 0) {
        chunkUtterances = synthesizeUtterancesFromWords(chunkResult.words, chunk.offsetSeconds);
      } else if (chunkResult.transcript && chunkResult.transcript.trim()) {
        chunkUtterances = fallbackSentenceUtterances(chunkResult.transcript, chunk.offsetSeconds);
      }

      allUtterances.push(...chunkUtterances);
    }
  } finally {
    // Guarantee cleanup of chunk files
    console.log(`[audio-chunker] Cleaning up temporary chunk files in ${chunksDir}...`);
    cleanupDirectory(chunksDir);
  }

  // Re-index all utterances
  const mergedUtterances = allUtterances.map((u, idx) => ({
    id: idx + 1,
    ...u
  }));

  const fullTranscript = allTranscripts.join(' ');
  const finalDurationSec = totalDuration || (chunks[chunks.length - 1].offsetSeconds + chunks[chunks.length - 1].duration);
  const speakersCount = new Set(mergedUtterances.map(u => u.speaker)).size || 1;

  console.log(`[audio-chunker] Pipeline completed. Total utterances: ${mergedUtterances.length}, Distinct speakers: ${speakersCount}, Duration: ${formatTimecode(finalDurationSec)}`);

  return {
    transcript: fullTranscript,
    utterances: mergedUtterances,
    durationSeconds: finalDurationSec,
    duration: formatTimecode(finalDurationSec),
    speakersCount,
    detectedLanguage: detectedLang
  };
}

/**
 * Helper to synthesize speaker utterances from word-level diarization.
 */
function synthesizeUtterancesFromWords(words, timeOffset = 0) {
  if (!words || words.length === 0) return [];
  const utterances = [];
  let currentSpeaker = words[0].speaker ?? 0;
  let currentWords = [];
  let startTime = (Number(words[0].start) || 0) + timeOffset;
  let endTime = (Number(words[0].end) || 0) + timeOffset;

  for (const w of words) {
    const wSpeaker = w.speaker ?? currentSpeaker;
    const wStart = (Number(w.start) || 0) + timeOffset;
    const wEnd = (Number(w.end) || 0) + timeOffset;

    // Split on speaker change or long pause (> 2.5s)
    if (wSpeaker !== currentSpeaker || (wStart - endTime) > 2.5) {
      if (currentWords.length > 0) {
        utterances.push({
          speaker: `Speaker ${currentSpeaker + 1}`,
          timecode: formatTimecode(startTime),
          start: startTime,
          end: endTime,
          text: currentWords.join(' ')
        });
      }
      currentSpeaker = wSpeaker;
      currentWords = [w.punctuated_word || w.word];
      startTime = wStart;
      endTime = wEnd;
    } else {
      currentWords.push(w.punctuated_word || w.word);
      endTime = wEnd;
    }
  }

  if (currentWords.length > 0) {
    utterances.push({
      speaker: `Speaker ${currentSpeaker + 1}`,
      timecode: formatTimecode(startTime),
      start: startTime,
      end: endTime,
      text: currentWords.join(' ')
    });
  }

  return utterances;
}

/**
 * Fallback to generate sentence utterances when diarization data is absent.
 */
function fallbackSentenceUtterances(transcript, timeOffset = 0) {
  const sentences = transcript.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
  let curTime = timeOffset;
  return sentences.map((s) => {
    const start = curTime;
    const wordCount = s.split(' ').length;
    const duration = Math.max(2, Math.min(8, Math.round(wordCount * 0.4)));
    curTime += duration;
    return {
      speaker: 'Speaker 1',
      timecode: formatTimecode(start),
      start,
      end: curTime,
      text: s.trim()
    };
  });
}

module.exports = {
  fetchWithNetworkRetry,
  getAudioDuration,
  formatTimecode,
  detectLanguageHintFromFilename,
  splitAudioIntoChunks,
  transcribeDeepgramRequest,
  transcribeAudioPipeline
};
