/**
 * Audio capture logic - runs in the RENDERER process.
 * Uses getDisplayMedia with setDisplayMediaRequestHandler (audio: 'loopback')
 * to capture system audio. Extracts raw PCM (linear16) and streams to main process
 * for real-time Deepgram transcription.
 *
 * This module is loaded by the capture window's HTML.
 */

function sendToMain(channel, ...args) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.send(channel, ...args);
  }
}

let audioContext = null;
let sourceNode = null;
let processorNode = null;
let stream = null;

const BUFFER_SIZE = 4096;

/**
 * Convert Float32 audio samples to Int16 (linear16) PCM.
 * @param {Float32Array} float32 - Input samples (-1 to 1)
 * @returns {ArrayBuffer} - Int16 little-endian PCM
 */
function float32ToInt16(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

/**
 * Start capturing system audio and streaming PCM to main process.
 * Uses getDisplayMedia - the main process must set setDisplayMediaRequestHandler
 * with audio: 'loopback' for system audio.
 */
async function getMicrophoneStream() {
  // Try default first
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    if (!/device|not found|notfound/i.test(String(e.message || e.name))) {
      throw e;
    }
  }
  // Fallback 1: most permissive - any audio
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: {} });
  } catch (e2) {
    if (!/device|not found|notfound/i.test(String(e2.message || e2.name))) {
      throw e2;
    }
  }
  // Fallback 2: enumerate and use first available audio input
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInput = devices.find((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default');
  if (audioInput?.deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { ideal: audioInput.deviceId } },
      });
    } catch (e3) {
      // Fall through to final error
    }
  }
  throw new Error('No microphone found. Try "Start (system audio)" instead, or check Windows Settings → System → Sound → choose an input device.');
}

async function startCapture(useMicrophone = false) {
  try {
    let displayStream;
    if (useMicrophone) {
      displayStream = await getMicrophoneStream();
    } else {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });
      displayStream.getVideoTracks().forEach((t) => {
        t.stop();
        displayStream.removeTrack(t);
      });
    }

    stream = displayStream;
    const audioTrack = displayStream.getAudioTracks()[0];

    if (!audioTrack) {
      sendToMain('capture-error', 'No audio track. Try "Use microphone" instead.');
      return;
    }

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    } catch (_) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const actualRate = audioContext.sampleRate;

    const audioOnlyStream = new MediaStream([audioTrack]);
    sourceNode = audioContext.createMediaStreamSource(audioOnlyStream);

    processorNode = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
    processorNode.onaudioprocess = (e) => {
      try {
        const input = e.inputBuffer.getChannelData(0);
        const pcmBuffer = float32ToInt16(input);
        if (window.electronAPI?.sendAudioChunk) {
          window.electronAPI.sendAudioChunk(pcmBuffer);
        } else {
          sendToMain('audio-chunk', pcmBuffer);
        }
      } catch (err) {
        console.error('[audioCapture onaudioprocess] failed:', err);
      }
    };

    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    sourceNode.connect(processorNode);
    processorNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (displayStream.getVideoTracks) {
      displayStream.getVideoTracks().forEach((t) => t.stop());
    }

    sendToMain('capture-started', actualRate);
  } catch (err) {
    console.error('[audioCapture] Failed to start:', err);
    sendToMain('capture-error', err.message || 'Failed to capture system audio');
  }
}

/**
 * Stop capturing.
 */
function stopCapture() {
  if (processorNode) {
    try {
      processorNode.disconnect();
    } catch (_) {}
    processorNode.onaudioprocess = null;
    processorNode = null;
  }
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch (_) {}
    sourceNode = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  sendToMain('capture-stopped');
}

if (typeof window !== 'undefined') {
  window.audioCapture = { startCapture, stopCapture };
}
