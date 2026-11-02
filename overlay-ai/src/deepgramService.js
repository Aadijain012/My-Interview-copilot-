/**
 * Deepgram WebSocket streaming transcription service.
 * Supports multiple connections (e.g. interviewer + candidate).
 */

const { createClient } = require('@deepgram/sdk');
const speech = require('@google-cloud/speech');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const ENCODING = 'linear16';
const KEEP_ALIVE_INTERVAL_MS = 5000;

const connections = new Map();
const activeConnectionsToReconnect = new Set();

/**
 * Create a Deepgram live transcription connection.
 * @param {string} id - Unique connection ID (e.g. 'interviewer', 'candidate')
 * @param {number} sampleRate - Audio sample rate (e.g. 44100)
 * @param {Function} onTranscript - Called with (text, isFinal) when transcript is received
 * @param {Function} onError - Called with (error) on errors
 * @returns {Promise<{send: Function, stop: Function}>} - Connection handle
 */
async function createConnection(id, sampleRate, onTranscript, onError, language = 'en-US') {
  activeConnectionsToReconnect.add(id);
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    const err = new Error('DEEPGRAM_API_KEY environment variable is not set');
    if (onError) onError(err);
    return null;
  }

  const rate = sampleRate || 44100;
  const MAX_CONNECT_ATTEMPTS = 3;
  const CONNECT_RETRY_DELAY_MS = 3000;

  // Map standard 2-letter codes to region tags for Deepgram stability
  let dgLanguage = language || 'en-US';
  if (dgLanguage === 'en') dgLanguage = 'en-US';
  if (dgLanguage === 'zh') dgLanguage = 'zh-CN';
  if (dgLanguage === 'pt') dgLanguage = 'pt-BR';

  // Nova-3 supports Indian languages: Telugu (te), Tamil (ta), Marathi (mr), Gujarati (gu), Kannada (kn)
  const cleanLang = dgLanguage.split('-')[0].toLowerCase();
  const isNova3Language = ['te', 'ta', 'mr', 'gu', 'kn'].includes(cleanLang);
  const dgModel = isNova3Language ? 'nova-3' : 'nova-2';

  console.log('[deepgram] Starting connection', id, 'sample_rate=' + rate, 'language=' + dgLanguage, 'model=' + dgModel);

  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
  try {
    const deepgram = createClient(apiKey);
    const connection = deepgram.listen.live({
      model: dgModel,
      language: dgLanguage,
      smart_format: true,
      interim_results: true,
      endpointing: 300,
      utterance_end_ms: 1000,
      encoding: ENCODING,
      sample_rate: rate,
      diarize: id !== 'interviewer' && id !== 'candidate'
    });

    let keepAliveInterval = null;
    let lastSpeakerId = 0;

    connection.on('open', () => {
      console.log('[deepgram]', id, 'connected');
      keepAliveInterval = setInterval(() => {
        if (connection?.keepAlive) {
          try { connection.keepAlive(); } catch (_) {}
        }
      }, KEEP_ALIVE_INTERVAL_MS);
    });

    connection.on('Results', (data) => {
      // Log the raw Deepgram results to help debug diarization speaker tags
      try {
        const logPath = path.join(__dirname, '../renderer_error.log');
        const transcriptText = data.channel?.alternatives?.[0]?.transcript;
        if (transcriptText && (data.is_final || data.speech_final)) {
          const wordsList = data.channel.alternatives[0].words || [];
          const speakerInfo = wordsList.map(w => `${w.word}(sp:${w.speaker})`).join(' ');
          fs.appendFileSync(logPath, `[${new Date().toISOString()}] [deepgram-debug] isFinal: ${data.is_final}, speechFinal: ${data.speech_final}, words: ${speakerInfo}\n`, 'utf8');
        }
      } catch (err) {
        console.error('[deepgram-debug-log] failed:', err);
      }

      if (data.channel?.alternatives?.[0]) {
        const transcript = data.channel.alternatives[0].transcript?.trim();
        if (transcript) {
          const isFinal = data.is_final === true || data.speech_final === true;
          let speaker = lastSpeakerId;
          const words = data.channel.alternatives[0].words;
          if (words && words.length > 0) {
            const counts = {};
            let hasSpeakerTags = false;
            for (const w of words) {
              if (w.speaker !== undefined && w.speaker !== null) {
                counts[w.speaker] = (counts[w.speaker] || 0) + 1;
                hasSpeakerTags = true;
              }
            }
            if (hasSpeakerTags) {
              let maxCount = -1;
              for (const sp in counts) {
                if (counts[sp] > maxCount) {
                  maxCount = counts[sp];
                  speaker = Number(sp);
                }
              }
              lastSpeakerId = speaker;
            }
          }
          let options = {};
          if (words && words.length > 0) {
            options.start = words[0].start;
            options.end = words[words.length - 1].end;
          }
          if (onTranscript) onTranscript(transcript, isFinal, speaker, options);
        }
      }
    });

    connection.on('error', (err) => {
      console.error('[deepgram]', id, 'error:', err);
      if (onError) onError(err);
    });

    connection.on('close', () => {
      console.warn(`[deepgram] Connection CLOSED for ID: ${id}`);
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
      connections.delete(id);

      // Auto-reconnect if it was closed by the server/timeout and NOT stopped manually
      if (activeConnectionsToReconnect.has(id)) {
        console.log(`[deepgram] Connection ID "${id}" was closed by server/timeout. Reconnecting in 2s...`);
        const attemptReconnect = async () => {
          if (!activeConnectionsToReconnect.has(id)) return;
          try {
            const reconnected = await createConnection(id, sampleRate, onTranscript, onError, language);
            if (reconnected) {
              console.log(`[deepgram] Connection ID "${id}" auto-reconnected successfully.`);
            } else {
              throw new Error('Connection wrapper is null');
            }
          } catch (err) {
            console.error(`[deepgram] Failed to auto-reconnect connection ID "${id}":`, err);
            // Retry again in 3 seconds
            if (activeConnectionsToReconnect.has(id)) {
              setTimeout(attemptReconnect, 3000);
            }
          }
        };
        setTimeout(attemptReconnect, 2000);
      }
    });

    connections.set(id, { connection, keepAliveInterval: () => keepAliveInterval });

    return {
      send: (audioData) => {
        try {
          const wrapper = connections.get(id);
          if (!wrapper || !wrapper.connection) {
            // Not connected yet; drop chunk to avoid crashing
            return;
          }
          const buffer = Buffer.isBuffer(audioData)
            ? audioData
            : Buffer.from(audioData instanceof ArrayBuffer ? new Uint8Array(audioData) : audioData);
          if (buffer.length > 0) {
            if (Math.random() < 0.05) {
              console.log(`[deepgram-debug] sending buffer to Deepgram connection (${id}), size:`, buffer.length);
            }
            wrapper.connection.send(buffer);
          }
        } catch (err) {
          if (onError) onError(err);
        }
      },
      stop: async () => {
        activeConnectionsToReconnect.delete(id);
        const wrapper = connections.get(id);
        if (wrapper && wrapper.connection) {
          if (wrapper.keepAliveInterval) {
            try { clearInterval(wrapper.keepAliveInterval()); } catch (_) {}
          }
          try {
            wrapper.connection.removeAllListeners?.();
          } catch (_) {}
          try {
            if (wrapper.connection.finish) {
              wrapper.connection.finish();
            } else if (wrapper.connection.requestClose) {
              wrapper.connection.requestClose();
            }
          } catch (_) {}
        }
        connections.delete(id);
      },
    };
  } catch (err) {
    console.error('[deepgram] Failed to start', id, 'attempt', attempt, err);
    if (attempt < MAX_CONNECT_ATTEMPTS && /timeout|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network/i.test(String(err.message || err))) {
      await new Promise((r) => setTimeout(r, CONNECT_RETRY_DELAY_MS));
    } else {
      if (onError) onError(err);
      return null;
    }
  }
  }
  return null;
}

/**
 * Legacy single-connection API (for non-both modes).
 */
async function startDeepgramConnection(sampleRate, onTranscript, onError, onStatus, language) {
  const conn = await createConnection('default', sampleRate, onTranscript, onError, language);
  if (!conn) return false;
  connections.set('default', conn);
  return true;
}

function sendAudioChunk(audioData) {
  const conn = connections.get('default');
  if (conn) {
    if (conn.send) {
      conn.send(audioData);
    } else {
      console.warn('[deepgram-debug] connections.get("default") has no send method! Keys:', Object.keys(conn));
    }
  } else {
    console.warn('[deepgram-debug] connections.get("default") is undefined!');
  }
}

async function stopDeepgramConnection() {
  const conn = connections.get('default');
  if (conn?.stop) await conn.stop();
  connections.delete('default');
}

async function createGoogleConnection(id, sampleRate, onTranscript, onError, language = 'en-US') {
  const apiKey = process.env.GOOGLE_SPEECH_KEY || 'AIzaSyBi_WkE1JBkfuMzkqgMyUuqvFTTXh0WzzY';
  const rate = sampleRate || 16000;

  // Map standard 2-letter codes to region tags for Google Speech stability
  let googleLanguage = language || 'en-US';
  if (googleLanguage === 'en') googleLanguage = 'en-US';
  else if (googleLanguage === 'te') googleLanguage = 'te-IN';
  else if (googleLanguage === 'ta') googleLanguage = 'ta-IN';
  else if (googleLanguage === 'mr') googleLanguage = 'mr-IN';
  else if (googleLanguage === 'gu') googleLanguage = 'gu-IN';
  else if (googleLanguage === 'kn') googleLanguage = 'kn-IN';
  else if (googleLanguage === 'ml') googleLanguage = 'ml-IN';
  else if (googleLanguage === 'pa') googleLanguage = 'pa-IN';
  else if (googleLanguage === 'bn') googleLanguage = 'bn-IN';
  else if (googleLanguage === 'es') googleLanguage = 'es-ES';
  else if (googleLanguage === 'fr') googleLanguage = 'fr-FR';
  else if (googleLanguage === 'de') googleLanguage = 'de-DE';
  else if (googleLanguage === 'it') googleLanguage = 'it-IT';
  else if (googleLanguage === 'pt') googleLanguage = 'pt-PT';
  else if (googleLanguage === 'hi') googleLanguage = 'hi-IN';
  else if (googleLanguage === 'ja') googleLanguage = 'ja-JP';
  else if (googleLanguage === 'ko') googleLanguage = 'ko-KR';
  else if (googleLanguage === 'zh') googleLanguage = 'zh-CN';
  else if (googleLanguage === 'ru') googleLanguage = 'ru-RU';
  else if (googleLanguage === 'tr') googleLanguage = 'tr-TR';
  else if (googleLanguage === 'nl') googleLanguage = 'nl-NL';
  else if (googleLanguage === 'ar') googleLanguage = 'ar-SA';

  try {
    const client = new speech.SpeechClient({
      apiKey: apiKey
    });

    const request = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: rate,
        languageCode: googleLanguage,
      },
      interimResults: true,
    };

    const stream = client.streamingRecognize(request);
    
    stream.on('error', (err) => {
      console.error(`[google] ${id} error:`, err);
      if (onError) onError(err);
    });

    stream.on('data', (data) => {
      if (data.results && data.results[0]) {
        const result = data.results[0];
        const isFinal = result.isFinal;
        const transcript = result.alternatives[0]?.transcript?.trim();
        if (transcript) {
          const speaker = (id === 'candidate') ? 1 : 0;
          if (onTranscript) onTranscript(transcript, isFinal, speaker);
        }
      }
    });

    return {
      send: (audioData) => {
        try {
          const buffer = Buffer.isBuffer(audioData)
            ? audioData
            : Buffer.from(audioData instanceof ArrayBuffer ? new Uint8Array(audioData) : audioData);
          if (buffer.length > 0) {
            stream.write(buffer);
          }
        } catch (err) {
          if (onError) onError(err);
        }
      },
      stop: async () => {
        try {
          stream.end();
        } catch (_) {}
      }
    };
  } catch (err) {
    console.error(`[google] Failed to start ${id}`, err);
    if (onError) onError(err);
    return null;
  }
}

async function startGoogleConnection(sampleRate, onTranscript, onError, onStatus, language) {
  const conn = await createGoogleConnection('default', sampleRate, onTranscript, onError, language);
  if (!conn) return false;
  connections.set('default', conn);
  return true;
}

function getSarvamSttLanguageCode(language) {
  if (!language) return 'en-IN';
  const clean = language.split('-')[0].toLowerCase();
  if (['hi', 'te', 'ta', 'mr', 'gu', 'kn', 'ml', 'pa', 'bn', 'or', 'as', 'en'].includes(clean)) {
    return `${clean}-IN`;
  }
  return 'en-IN';
}

async function createSarvamConnection(id, sampleRate, onTranscript, onError, language = 'en-US') {
  const apiKey = process.env.SARVAM_API_KEY || 'sk_9y0xx8c7_f48eRnJp5MD5laaQOVJWb1Yy';
  const rate = sampleRate || 16000;
  const langCode = getSarvamSttLanguageCode(language);

  try {
    const wsUrl = `wss://api.sarvam.ai/speech-to-text/ws?language-code=${langCode}`;
    console.log('[sarvam] Connecting to', wsUrl);
    
    const ws = new WebSocket(wsUrl, {
      headers: {
        'api-subscription-key': apiKey
      }
    });

    ws.on('open', () => {
      console.log('[sarvam]', id, 'connected');
    });

    ws.on('error', (err) => {
      console.error(`[sarvam] ${id} error:`, err);
      if (onError) onError(err);
    });

    ws.on('message', (messageData) => {
      try {
        const json = JSON.parse(messageData.toString());
        if (json.type === 'data' && json.data && json.data.transcript) {
          const transcript = json.data.transcript.trim();
          if (transcript) {
            const speaker = (id === 'candidate') ? 1 : 0;
            if (onTranscript) onTranscript(transcript, true, speaker);
          }
        }
      } catch (err) {
        console.error('[sarvam] failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      console.log('[sarvam]', id, 'connection closed');
    });

    return {
      send: (audioData) => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            const buffer = Buffer.isBuffer(audioData)
              ? audioData
              : Buffer.from(audioData instanceof ArrayBuffer ? new Uint8Array(audioData) : audioData);
            
            if (buffer.length > 0) {
              const base64Audio = buffer.toString('base64');
              ws.send(JSON.stringify({
                audio: {
                  data: base64Audio,
                  sample_rate: String(rate),
                  encoding: 'pcm_s16le'
                }
              }));
            }
          }
        } catch (err) {
          if (onError) onError(err);
        }
      },
      stop: async () => {
        try {
          ws.close();
        } catch (_) {}
      }
    };
  } catch (err) {
    console.error(`[sarvam] Failed to start ${id}`, err);
    if (onError) onError(err);
    return null;
  }
}

async function startSarvamConnection(sampleRate, onTranscript, onError, onStatus, language) {
  const conn = await createSarvamConnection('default', sampleRate, onTranscript, onError, language);
  if (!conn) return false;
  connections.set('default', conn);
  return true;
}

module.exports = {
  createConnection,
  startDeepgramConnection,
  sendAudioChunk,
  stopDeepgramConnection,
  createGoogleConnection,
  startGoogleConnection,
  createSarvamConnection,
  startSarvamConnection
};
