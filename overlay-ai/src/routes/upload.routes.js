const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { transcribeAudioPipeline } = require('../services/audio-chunker.service');
const { convertVideoToAudio } = require('../services/video-processor.service');
const { translateTranscriptAndUtterances, resolveLanguageName } = require('../services/translation.service');

function getUploadsDir() {
  const custom = path.resolve(path.join(__dirname, '../../../uploads'));
  if (!fs.existsSync(custom)) {
    try { fs.mkdirSync(custom, { recursive: true }); } catch (_) {}
  }
  return custom;
}

function getDataDir() {
  const dir = path.resolve(path.join(__dirname, '../../../data'));
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
  return dir;
}

function getUploadHistoryPath() {
  return path.join(getDataDir(), 'uploads_history.json');
}

function getVideoHistoryPath() {
  return path.join(getDataDir(), 'video_history.json');
}

function readHistory() {
  const p = getUploadHistoryPath();
  try {
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, '[]');
      return [];
    }
    const data = fs.readFileSync(p, 'utf8');
    return JSON.parse(data || '[]');
  } catch (e) {
    console.error('[upload.routes] readHistory error:', e);
    return [];
  }
}

function writeHistory(history) {
  const p = getUploadHistoryPath();
  try {
    fs.writeFileSync(p, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.error('[upload.routes] writeHistory error:', e);
  }
}

function readVideoHistory() {
  const p = getVideoHistoryPath();
  try {
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, '[]');
      return [];
    }
    const data = fs.readFileSync(p, 'utf8');
    return JSON.parse(data || '[]');
  } catch (e) {
    console.error('[upload.routes] readVideoHistory error:', e);
    return [];
  }
}

function writeVideoHistory(history) {
  const p = getVideoHistoryPath();
  try {
    fs.writeFileSync(p, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.error('[upload.routes] writeVideoHistory error:', e);
  }
}

function migrateHistory() {
  try {
    const history = readHistory();
    const vHistory = readVideoHistory();
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.3gp', '.ts'];
    const remainingAudio = [];
    let changed = false;

    for (const item of history) {
      const ext = path.extname(item.fileName || item.filePath || '').toLowerCase();
      const isVid = item.isVideoSession || videoExts.includes(ext) || (ext === '.webm' && !String(item.fileName || '').toLowerCase().includes('audio'));
      if (isVid) {
        changed = true;
        item.isVideoSession = true;
        if (!item.videoFileName) item.videoFileName = item.fileName || item.title;
        if (!item.videoFileSize) item.videoFileSize = item.fileSize || 0;
        if (item.audioPath && !item.audioUrl) {
          item.audioUrl = `file://${item.audioPath.replace(/\\/g, '/')}`;
        }
        if (!vHistory.some(vh => vh.id === item.id)) {
          vHistory.push(item);
        }
      } else {
        remainingAudio.push(item);
      }
    }

    if (changed) {
      writeHistory(remainingAudio);
      writeVideoHistory(vHistory);
      console.log('[upload.routes] Migrated video sessions to video_history.json');
    }
  } catch (e) {
    console.error('[upload.routes] migrateHistory error:', e);
  }
}

function getAiClient() {
  const grokKey = process.env.GROK_UPLOAD_API_KEY || (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('xai-') ? process.env.GROQ_API_KEY : null);
  if (grokKey) {
    return {
      client: new OpenAI({ apiKey: grokKey, baseURL: 'https://api.x.ai/v1', timeout: 60000 }),
      model: 'grok-4.20-0309-non-reasoning'
    };
  }
  const groqKey = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_') ? process.env.GROQ_API_KEY : null;
  if (groqKey) {
    return {
      client: new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1', timeout: 60000 }),
      model: 'llama-3.3-70b-versatile'
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000 }),
      model: 'gpt-4o-mini'
    };
  }
  return null;
}

function registerUploadRoutes(ipcMain) {
  migrateHistory();

  // Save Audio / Video file
  ipcMain.handle('upload-save-file', async (event, { fileName, buffer, fileType, originalPath, userId, userEmail }) => {
    try {
      const uploadsDir = getUploadsDir();
      const ext = path.extname(fileName || originalPath || '');
      const uniqueName = `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const destPath = path.join(uploadsDir, uniqueName);

      if (buffer) {
        fs.writeFileSync(destPath, Buffer.from(buffer));
      } else if (originalPath && fs.existsSync(originalPath)) {
        fs.copyFileSync(originalPath, destPath);
      } else {
        throw new Error('No file buffer or path provided.');
      }

      const stats = fs.statSync(destPath);
      const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.3gp', '.ts'];
      const isVideo = videoExts.includes(ext.toLowerCase()) || 
                      (ext.toLowerCase() === '.webm' && !String(fileName || '').toLowerCase().includes('audio'));

      const uid = userId || 'local_user';
      const uEmail = userEmail || '';

      const session = {
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: uid,
        userEmail: uEmail,
        isVideoSession: isVideo,
        videoFileName: isVideo ? (fileName || path.basename(destPath)) : undefined,
        videoFileSize: isVideo ? stats.size : undefined,
        fileName: fileName || path.basename(destPath),
        filePath: destPath,
        fileUrl: `file://${destPath.replace(/\\/g, '/')}`,
        fileSize: stats.size,
        duration: '0:00',
        durationSeconds: 0,
        speakersCount: 1,
        transcript: '',
        utterances: [],
        translations: {},
        createdAt: new Date().toISOString(),
        title: (fileName || 'Uploaded Media').slice(0, 30),
        storageMode: 'local',
        messages: [{
          sender: 'ai',
          text: 'Media uploaded and ready for transcription.',
          audioUrl: `file://${destPath.replace(/\\/g, '/')}`
        }]
      };

      if (isVideo) {
        const vHistory = readVideoHistory();
        vHistory.push(session);
        writeVideoHistory(vHistory);
      } else {
        const history = readHistory();
        history.push(session);
        writeHistory(history);
      }

      return { ok: true, session };
    } catch (err) {
      console.error('[upload.routes] upload-save-file error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Transcribe Pipeline
  ipcMain.handle('upload-transcribe', async (event, { sessionId, language = 'auto', forceRetry = false }) => {
    try {
      const history = readHistory();
      const vHistory = readVideoHistory();
      let isVideo = false;
      let session = history.find(s => s.id === sessionId);
      if (!session) {
        session = vHistory.find(s => s.id === sessionId);
        if (session) isVideo = true;
      }

      if (!session) {
        throw new Error(`Session ${sessionId} not found.`);
      }

      if (session.transcript && session.transcript.trim() && !forceRetry) {
        return { ok: true, session, status: 'completed' };
      }

      let fileToTranscribe = session.audioPath || session.filePath;
      const ext = path.extname(fileToTranscribe || '').toLowerCase();
      const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.3gp', '.ts', '.webm'];
      const isVid = videoExts.includes(ext);

      if (isVid && !session.audioPath) {
        console.log(`[upload.routes] Extracting audio from video before transcription: ${fileToTranscribe}`);
        const { audioPath, audioFileName } = await convertVideoToAudio(fileToTranscribe, getUploadsDir());
        session.audioPath = audioPath;
        session.audioFileName = audioFileName;
        session.audioFileUrl = `file://${audioPath.replace(/\\/g, '/')}`;
        session.audioUrl = `file://${audioPath.replace(/\\/g, '/')}`;
        fileToTranscribe = audioPath;
      }

      let mimeType = 'audio/webm';
      const fileExt = path.extname(fileToTranscribe).toLowerCase();
      if (fileExt === '.m4a' || fileExt === '.mp4') mimeType = 'audio/mp4';
      else if (fileExt === '.wav') mimeType = 'audio/wav';
      else if (fileExt === '.mp3') mimeType = 'audio/mpeg';
      else if (fileExt === '.ogg' || fileExt === '.opus') mimeType = 'audio/ogg';

      console.log(`[upload.routes] Running transcribeAudioPipeline on ${fileToTranscribe} (language: ${language})...`);
      const result = await transcribeAudioPipeline(fileToTranscribe, mimeType, {
        language,
        fileName: session.fileName || path.basename(fileToTranscribe),
        sessionId: session.id
      });

      Object.assign(session, result);
      session.isTranscribing = false;

      if (isVideo) {
        const vIdx = vHistory.findIndex(s => s.id === session.id);
        if (vIdx !== -1) vHistory[vIdx] = session;
        writeVideoHistory(vHistory);
      } else {
        const uIdx = history.findIndex(s => s.id === session.id);
        if (uIdx !== -1) history[uIdx] = session;
        writeHistory(history);
      }

      return { ok: true, session, status: 'completed' };
    } catch (err) {
      console.error('[upload.routes] upload-transcribe error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Get All Sessions (isolated per logged-in user)
  ipcMain.handle('upload-get-sessions', async (event, userParam) => {
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

      const history = readHistory();
      const vHistory = readVideoHistory();

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

      const filteredHistory = (targetUserId || targetEmail) ? history.filter(isUserMatch) : history;
      const filteredVHistory = (targetUserId || targetEmail) ? vHistory.filter(isUserMatch) : vHistory;

      const sortedHistory = [...filteredHistory].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const sortedVHistory = [...filteredVHistory].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { ok: true, sessions: sortedHistory, videoSessions: sortedVHistory };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Get Single Session
  ipcMain.handle('upload-get-session', async (event, sessionId) => {
    try {
      const history = readHistory();
      const vHistory = readVideoHistory();
      const session = history.find(s => s.id === sessionId) || vHistory.find(s => s.id === sessionId);
      if (!session) return { ok: false, error: 'Session not found.' };
      return { ok: true, session };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Delete Session
  ipcMain.handle('upload-delete-session', async (event, sessionId) => {
    try {
      let history = readHistory();
      let vHistory = readVideoHistory();

      const session = history.find(s => s.id === sessionId) || vHistory.find(s => s.id === sessionId);
      if (session) {
        if (session.filePath && fs.existsSync(session.filePath)) {
          try { fs.unlinkSync(session.filePath); } catch (_) {}
        }
        if (session.audioPath && fs.existsSync(session.audioPath)) {
          try { fs.unlinkSync(session.audioPath); } catch (_) {}
        }
      }

      history = history.filter(s => s.id !== sessionId);
      vHistory = vHistory.filter(s => s.id !== sessionId);

      writeHistory(history);
      writeVideoHistory(vHistory);

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Chat Q&A
  ipcMain.handle('upload-chat', async (event, { sessionId, message, history: chatHistory }) => {
    try {
      const history = readHistory();
      const vHistory = readVideoHistory();
      const session = history.find(s => s.id === sessionId) || vHistory.find(s => s.id === sessionId);
      const transcript = session?.transcript || '';

      const ai = getAiClient();
      if (!ai) throw new Error('No AI provider API key configured.');

      const systemPrompt = `You are a helpful AI assistant analyzing an interview / audio transcript.\nTranscript:\n${transcript.slice(0, 15000)}\n\nAnswer the user query accurately based on the transcript context.`;
      const messages = [
        { role: 'system', content: systemPrompt },
        ...(chatHistory || []).map(h => ({ role: h.sender === 'user' ? 'user' : 'assistant', content: h.text })),
        { role: 'user', content: message }
      ];

      const completion = await ai.client.chat.completions.create({
        model: ai.model,
        messages,
        temperature: 0.3
      });

      const reply = completion.choices[0]?.message?.content || 'No response generated.';
      return { ok: true, reply };
    } catch (err) {
      console.error('[upload.routes] upload-chat error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Translate
  ipcMain.handle('upload-translate', async (event, { sessionId, targetLanguage }) => {
    try {
      const history = readHistory();
      const vHistory = readVideoHistory();
      let isVideo = false;
      let session = history.find(s => s.id === sessionId);
      if (!session) {
        session = vHistory.find(s => s.id === sessionId);
        if (session) isVideo = true;
      }

      if (!session || !session.transcript) {
        throw new Error('Session or transcript not found.');
      }

      const langName = resolveLanguageName(targetLanguage);
      const existing = session.translations ? session.translations[langName] : null;
      const hasValidText = existing && ((existing.translatedText && existing.translatedText.trim()) || (existing.transcript && existing.transcript.trim()));

      if (hasValidText) {
        return {
          ok: true,
          translation: existing,
          translatedText: existing.translatedText || existing.transcript || '',
          translatedUtterances: existing.translatedUtterances || existing.utterances || []
        };
      }

      const utterances = session.utterances || [];
      const res = await translateTranscriptAndUtterances({
        transcript: session.transcript,
        utterances,
        targetLanguage,
        targetLangName: langName
      });

      if (!session.translations) session.translations = {};
      session.translations[langName] = {
        transcript: res.translatedText,
        translatedText: res.translatedText,
        utterances: res.translatedUtterances,
        translatedUtterances: res.translatedUtterances,
        translatedAt: new Date().toISOString()
      };

      if (isVideo) {
        const vIdx = vHistory.findIndex(s => s.id === session.id);
        if (vIdx !== -1) vHistory[vIdx] = session;
        writeVideoHistory(vHistory);
      } else {
        const uIdx = history.findIndex(s => s.id === session.id);
        if (uIdx !== -1) history[uIdx] = session;
        writeHistory(history);
      }

      return {
        ok: true,
        translation: session.translations[langName],
        translatedText: res.translatedText,
        translatedUtterances: res.translatedUtterances
      };
    } catch (err) {
      console.error('[upload.routes] upload-translate error:', err);
      return { ok: false, error: err.message };
    }
  });
}

module.exports = {
  registerUploadRoutes,
  readHistory,
  writeHistory,
  readVideoHistory,
  writeVideoHistory,
  getUploadsDir,
  getDataDir
};
