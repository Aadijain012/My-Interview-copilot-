/**
 * Speech-to-text using OpenAI Whisper API.
 * Receives audio buffers (webm) and returns transcribed text.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const OpenAI = require('openai');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Transcribe audio buffer to text using OpenAI Whisper API.
 * @param {Buffer} audioBuffer - Audio data (webm format from MediaRecorder)
 * @param {string} filename - Temp filename for format detection
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioBuffer, filename = 'audio.webm') {
  if (!openai) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `whisper-${Date.now()}-${filename}`);

  try {
    fs.writeFileSync(tempPath, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
    });

    return transcription.text?.trim() || '';
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (_) {}
  }
}

module.exports = { transcribeAudio };
