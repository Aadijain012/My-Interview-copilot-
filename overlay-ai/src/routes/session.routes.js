const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./upload.routes');

function getDatabase() {
  const candidates = [
    '../../../Kairos-Backend/db',
    '../../../../Kairos-Backend/db',
    '../../Kairos-Backend/db'
  ];
  for (const rel of candidates) {
    try {
      return require(rel);
    } catch (_) {}
  }
  return null;
}

function getSessionsFilePath() {
  return path.join(getDataDir(), 'interview_sessions.json');
}

function readLocalSessions() {
  const filePath = getSessionsFilePath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
    } catch (_) {
      return [];
    }
  }
  return [];
}

function writeLocalSessions(sessions) {
  const filePath = getSessionsFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2), 'utf8');
}

function registerSessionRoutes(ipcMain) {
  // Get Past Sessions (isolated per logged-in user)
  ipcMain.handle('get-past-sessions', async (event, userParam) => {
    try {
      let targetUserId = null;
      let targetEmail = null;

      if (userParam && typeof userParam === 'object') {
        targetUserId = userParam.id || userParam.userId || null;
        targetEmail = userParam.email || userParam.userEmail || null;
      } else if (typeof userParam === 'string' && userParam.trim()) {
        const str = userParam.trim();
        if (str.includes('@')) {
          targetEmail = str.toLowerCase();
        } else {
          targetUserId = str;
        }
      }

      const localList = readLocalSessions();
      let dbList = [];
      const db = getDatabase();
      if (db && db.getSessionsByUser && targetUserId && targetUserId !== 'default_user' && targetUserId !== 'local_user') {
        try {
          dbList = await db.getSessionsByUser(targetUserId);
        } catch (_) {}
      }

      const isUserMatch = (s) => {
        if (!targetUserId && !targetEmail) return true;
        const sUid = String(s.userId || s.payload?.userId || '').trim().toLowerCase();
        const sEmail = String(s.userEmail || s.payload?.userEmail || '').trim().toLowerCase();
        if (targetUserId && (sUid === String(targetUserId).toLowerCase() || sEmail === String(targetUserId).toLowerCase())) {
          return true;
        }
        if (targetEmail && (sEmail === targetEmail.toLowerCase() || sUid === targetEmail.toLowerCase())) {
          return true;
        }
        return false;
      };

      const filteredLocal = (targetUserId || targetEmail) ? localList.filter(isUserMatch) : localList;
      const filteredDb = (targetUserId || targetEmail) ? dbList.filter(isUserMatch) : dbList;

      // Merge and deduplicate by session id
      const map = new Map();
      [...filteredLocal, ...filteredDb].forEach(s => {
        if (s && s.id) map.set(String(s.id), s);
      });

      return { ok: true, sessions: Array.from(map.values()) };
    } catch (err) {
      console.error('[session.routes] get-past-sessions error:', err);
      return { ok: true, sessions: readLocalSessions() };
    }
  });

  // Save Past Session
  ipcMain.handle('save-past-session', async (event, sessionData) => {
    try {
      const sessionId = sessionData.id || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const uid = sessionData.userId || sessionData.payload?.userId || 'local_user';
      const uEmail = sessionData.userEmail || sessionData.payload?.userEmail || '';

      const payload = {
        ...(sessionData.payload || sessionData),
        userId: uid,
        userEmail: uEmail
      };

      const newSession = {
        id: String(sessionId),
        userId: uid,
        userEmail: uEmail,
        title: sessionData.title || sessionData.tech || 'Interview Session',
        tech: sessionData.tech || 'Interview',
        duration: sessionData.durationDisplay || sessionData.duration || '00:00:00',
        durationDisplay: sessionData.durationDisplay || sessionData.duration || '00:00:00',
        durationSeconds: sessionData.durationSeconds || 0,
        questionCount: sessionData.questionCount || 0,
        rating: sessionData.rating || 0,
        createdAt: new Date().toISOString(),
        payload
      };

      // 1. Save to local storage
      const sessions = readLocalSessions();
      const existingIdx = sessions.findIndex(s => String(s.id) === String(newSession.id));
      if (existingIdx !== -1) {
        sessions[existingIdx] = newSession;
      } else {
        sessions.unshift(newSession);
      }
      writeLocalSessions(sessions);

      // 2. Attempt optional DB sync if valid userId exists
      const db = getDatabase();
      if (db && db.createSession && uid && uid !== 'default_user' && uid !== 'local_user') {
        try {
          await db.createSession(newSession, uid);
        } catch (dbErr) {
          console.warn('[session.routes] DB sync skipped/failed:', dbErr.message);
        }
      }

      return { ok: true, session: newSession };
    } catch (err) {
      console.error('[session.routes] save-past-session error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Delete Past Session
  ipcMain.handle('delete-past-session', async (event, sessionId) => {
    try {
      const sid = String(sessionId);
      const sessions = readLocalSessions().filter(s => String(s.id) !== sid);
      writeLocalSessions(sessions);

      const db = getDatabase();
      if (db && db.deleteSession) {
        try {
          await db.deleteSession(sid);
        } catch (_) {}
      }
      return { ok: true };
    } catch (err) {
      console.error('[session.routes] delete-past-session error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Evaluate Interview Session
  ipcMain.handle('evaluate-interview-session', async (event, { sessionId, transcript, questionsHistory, role, tech, forceRefresh = false }) => {
    try {
      const { generatePostInterviewEvaluation } = require('../services/evaluation.service');
      const sessions = readLocalSessions();
      let targetSession = sessions.find(s => String(s.id) === String(sessionId));

      // Check if session already has evaluation cached
      if (targetSession?.payload?.evaluation && !forceRefresh) {
        return { ok: true, evaluation: targetSession.payload.evaluation, session: targetSession };
      }

      console.log(`[session.routes] Generating performance evaluation for session ${sessionId}...`);
      const evaluation = await generatePostInterviewEvaluation({
        transcript: transcript || targetSession?.payload?.transcript || targetSession?.payload?.liveTranscript || [],
        questionsHistory: questionsHistory || targetSession?.payload?.questionsHistory || targetSession?.payload?.questionsList || [],
        role: role || targetSession?.role || 'Software Engineer',
        tech: tech || targetSession?.tech || 'Full Stack'
      });

      // Attach evaluation directly to session payload and save
      if (targetSession) {
        if (!targetSession.payload) targetSession.payload = {};
        targetSession.payload.evaluation = evaluation;
        if (!targetSession.rating && evaluation.overallScore) {
          targetSession.rating = Math.round((evaluation.overallScore / 20) * 10) / 10;
        }
        writeLocalSessions(sessions);
      }

      return { ok: true, evaluation, session: targetSession };
    } catch (err) {
      console.error('[session.routes] evaluate-interview-session error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Get Interview Evaluation Report
  ipcMain.handle('get-interview-evaluation', async (event, sessionId) => {
    try {
      const sessions = readLocalSessions();
      const targetSession = sessions.find(s => String(s.id) === String(sessionId));
      if (targetSession?.payload?.evaluation) {
        return { ok: true, evaluation: targetSession.payload.evaluation };
      }
      return { ok: false, error: 'No evaluation generated yet for this session.' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}
module.exports = {
  registerSessionRoutes
};
