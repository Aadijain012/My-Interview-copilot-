/**
 * Deepgram prerecorded transcription - buffers audio and transcribes every 3 seconds.
 * Uses REST API directly with correct Content-Type for raw PCM (audio/l16).
 */

const SAMPLE_RATE = 44100;
const BUFFER_DURATION_MS = 3000;
const BYTES_PER_SAMPLE = 2;
const DEBUG = process.env.DEBUG_AUDIO === '1';

let audioBuffer = [];
let bufferSize = 0;
let onTranscriptCallback = null;
let onErrorCallback = null;
let intervalId = null;
let chunkCount = 0;

async function transcribeBuffer() {
  if (bufferSize < 8000) {
    if (DEBUG && bufferSize > 0) console.log('[deepgram] buffer too small:', bufferSize);
    return;
  }

  const chunks = audioBuffer.splice(0, audioBuffer.length);
  bufferSize = 0;

  const combined = Buffer.concat(chunks);
  if (combined.length < 8000) return;

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return;

  if (DEBUG) console.log('[deepgram] transcribing', combined.length, 'bytes (~' + (combined.length / (SAMPLE_RATE * BYTES_PER_SAMPLE)).toFixed(2) + 's)');

  try {
    const url = new URL('https://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-2');
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('encoding', 'linear16');
    url.searchParams.set('sample_rate', String(SAMPLE_RATE));

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': `audio/l16;rate=${SAMPLE_RATE}`,
      },
      body: combined,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Deepgram API ${res.status}: ${errText}`);
    }

    const json = await res.json();
    const text = json?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
    if (DEBUG) console.log('[deepgram] result:', text || '(empty)');
    if (text && onTranscriptCallback) {
      onTranscriptCallback(text, true);
    }
  } catch (err) {
    console.error('[deepgram] transcribe error:', err.message);
    if (onErrorCallback) onErrorCallback(err);
  }
}

function addAudioChunk(data) {
  let buffer;
  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (data instanceof ArrayBuffer) {
    buffer = Buffer.from(new Uint8Array(data));
  } else if (data && typeof data.buffer === 'object' && data.byteLength !== undefined) {
    buffer = Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  } else {
    buffer = Buffer.from(data);
  }
  if (buffer.length > 0) {
    audioBuffer.push(buffer);
    bufferSize += buffer.length;
    if (DEBUG && ++chunkCount % 100 === 0) {
      console.log('[deepgram] chunks:', chunkCount, 'buffer:', bufferSize, 'bytes');
    }
  }
}

function start(onTranscript, onError) {
  onTranscriptCallback = onTranscript;
  onErrorCallback = onError;
  audioBuffer = [];
  bufferSize = 0;

  intervalId = setInterval(transcribeBuffer, BUFFER_DURATION_MS);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  audioBuffer = [];
  bufferSize = 0;
  onTranscriptCallback = null;
  onErrorCallback = null;
}

module.exports = {
  addAudioChunk,
  start,
  stop,
};
