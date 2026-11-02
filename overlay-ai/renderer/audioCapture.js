/**
 * Audio capture - runs in RENDERER process.
 * Uses getDisplayMedia with setDisplayMediaRequestHandler (audio: 'loopback')
 * to capture system audio on Windows. Converts to raw PCM (linear16) and
 * sends chunks to main process via IPC for Deepgram streaming.
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
 */
async function startCapture(useMicrophone = false) {
  console.log('[audioCapture] startCapture, useMicrophone=', useMicrophone);

  try {
    let displayStream;
    if (useMicrophone) {
      console.log('[audioCapture] Requesting microphone...');
      displayStream = await getMicrophoneStream();
      console.log('[audioCapture] Microphone stream obtained');
    } else {
      console.log('[audioCapture] Requesting getDisplayMedia (select screen/window for system audio)...');
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });
      displayStream.getVideoTracks().forEach((t) => {
        t.stop();
        displayStream.removeTrack(t);
      });
      console.log('[audioCapture] Display media stream obtained');
    }

    stream = displayStream;
    const audioTrack = displayStream.getAudioTracks()[0];

    if (!audioTrack) {
      console.error('[audioCapture] No audio track');
      sendToMain('capture-error', 'No audio track. Try "Use microphone" instead.');
      return;
    }

    console.log('[audioCapture] Audio track:', audioTrack.label);

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    } catch (_) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const actualRate = audioContext.sampleRate;
    console.log('[audioCapture] AudioContext sample rate:', actualRate);

    const audioOnlyStream = new MediaStream([audioTrack]);
    sourceNode = audioContext.createMediaStreamSource(audioOnlyStream);

    let chunkCount = 0;
    processorNode = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
    processorNode.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const pcmBuffer = float32ToInt16(input);
      chunkCount++;
      if (chunkCount <= 3 || chunkCount % 100 === 0) {
        console.log('[audioCapture] Producing chunk #' + chunkCount, pcmBuffer.byteLength, 'bytes');
      }
      if (window.electronAPI?.sendAudioChunk) {
        window.electronAPI.sendAudioChunk(pcmBuffer);
      } else {
        sendToMain('audio-chunk', pcmBuffer);
      }
    };

    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    sourceNode.connect(processorNode);
    processorNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    console.log('[audioCapture] Capture started, sending PCM to main process');
    sendToMain('capture-started', actualRate);
  } catch (err) {
    console.error('[audioCapture] Failed to start:', err);
    sendToMain('capture-error', err.message || 'Failed to capture system audio');
  }
}

async function getMicrophoneStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    if (!/device|not found|notfound/i.test(String(e.message || e.name))) {
      throw e;
    }
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: {} });
  } catch (e2) {
    if (!/device|not found|notfound/i.test(String(e2.message || e2.name))) {
      throw e2;
    }
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInput = devices.find(
    (d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default'
  );
  if (audioInput?.deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { ideal: audioInput.deviceId } },
      });
    } catch (e3) {}
  }
  throw new Error(
    'No microphone found. Try "Start (system audio)" instead, or check Windows Settings.'
  );
}

/**
 * Stop capturing.
 */
function stopCapture() {
  console.log('[audioCapture] stopCapture');
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
