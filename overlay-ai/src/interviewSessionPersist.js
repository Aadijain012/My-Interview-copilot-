/**
 * Persist live interview sessions directly via Prisma DB and local JSON storage.
 * Completely standalone in Electron main process, eliminating localhost fetch dependencies.
 */

const fs = require('fs');
const path = require('path');

function secondsToHMS(totalSecs) {
  const s = Math.max(0, Math.floor(Number(totalSecs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

function getUserIdFromToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      return payload.id || payload.userId || null;
    }
  } catch (_) {}
  return null;
}

function getDataDir() {
  const dir = path.resolve(path.join(__dirname, '../../data'));
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
  return dir;
}

function getUploadsDir() {
  const dir = path.resolve(path.join(__dirname, '../../uploads'));
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
  return dir;
}

function getDatabase() {
  const candidates = [
    '../../Kairos-Backend/db',
    '../../../Kairos-Backend/db',
    '../../../../Kairos-Backend/db'
  ];
  for (const rel of candidates) {
    try {
      return require(rel);
    } catch (_) {}
  }
  return null;
}

/**
 * @param {object} opts
 * @param {string} [opts.baseUrl]
 * @param {string} [opts.token] - JWT
 * @param {string} opts.tech
 * @param {string} [opts.title]
 * @param {number} opts.durationSeconds
 * @param {number} opts.questionCount
 * @param {number} [opts.rating]
 * @param {object} opts.payload - date, time, version, name, questions, transcript
 * @param {Buffer|null} [opts.audioBuffer]
 * @param {string} [opts.audioFileName]
 */
async function persistInterviewSession(opts) {
  const {
    token,
    tech = 'Interview',
    title,
    durationSeconds = 0,
    questionCount = 0,
    rating = 0,
    payload,
    audioBuffer,
    audioFileName = 'session.webm',
  } = opts;

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const userId = getUserIdFromToken(token) || 'default_user';
  const durationDisplay = secondsToHMS(durationSeconds);

  // 1. If audioBuffer exists, write it directly to uploads directory
  let audioFilePath = null;
  if (audioBuffer && Buffer.isBuffer(audioBuffer) && audioBuffer.length > 0) {
    try {
      const uploadsDir = getUploadsDir();
      const savedAudioName = `audio_${sessionId}_${Date.now()}_${audioFileName}`;
      const fullAudioPath = path.join(uploadsDir, savedAudioName);
      fs.writeFileSync(fullAudioPath, audioBuffer);
      audioFilePath = fullAudioPath;
      console.log(`[interview-persist] Audio recording saved to disk: ${audioFilePath}`);
    } catch (audioErr) {
      console.warn('[interview-persist] Failed to write audio buffer to disk:', audioErr.message);
    }
  }

  // 2. Try persisting directly to PostgreSQL via Prisma
  let dbPersisted = false;
  try {
    const db = getDatabase();
    if (db && db.createSession) {
      const created = await db.createSession({
        id: sessionId,
        tech,
        title: title || `${tech} Interview`,
        durationDisplay,
        durationSeconds: Math.max(0, Math.floor(durationSeconds)),
        questionCount: Math.max(0, Math.floor(questionCount)),
        rating,
        payload
      }, userId);

      if (audioFilePath && db.updateSessionAudio) {
        await db.updateSessionAudio(sessionId, audioFilePath, userId).catch(() => {});
      }
      dbPersisted = true;
      console.log(`[interview-persist] Session successfully saved to PostgreSQL via Prisma: ${sessionId}`);
    }
  } catch (dbErr) {
    console.warn('[interview-persist] Prisma DB persist failed, falling back to local JSON:', dbErr.message);
  }

  // 3. Always save a copy to local JSON data store (resilience & offline mode)
  try {
    const jsonPath = path.join(getDataDir(), 'notetaker_sessions.json');
    let sessions = [];
    if (fs.existsSync(jsonPath)) {
      try {
        sessions = JSON.parse(fs.readFileSync(jsonPath, 'utf8') || '[]');
      } catch (_) {
        sessions = [];
      }
    }

    const sessionRecord = {
      id: sessionId,
      userId,
      tech,
      title: title || `${tech} Interview`,
      duration: durationDisplay,
      durationDisplay,
      durationSeconds: Math.max(0, Math.floor(durationSeconds)),
      questionCount: Math.max(0, Math.floor(questionCount)),
      rating,
      payload,
      audioFilePath,
      createdAt: new Date().toISOString()
    };

    // Keep unique entries
    sessions = sessions.filter(s => s.id !== sessionId);
    sessions.unshift(sessionRecord);
    fs.writeFileSync(jsonPath, JSON.stringify(sessions, null, 2), 'utf8');
    console.log(`[interview-persist] Session saved to local JSON store: ${sessionId}`);
  } catch (jsonErr) {
    console.error('[interview-persist] Local JSON write error:', jsonErr.message);
  }

  return { sessionId };
}

module.exports = {
  secondsToHMS,
  persistInterviewSession,
};
