const fs = require('fs');
const path = require('path');
const { convertVideoToAudio } = require('../services/video-processor.service');
const { readHistory, writeHistory, readVideoHistory, writeVideoHistory, getUploadsDir } = require('./upload.routes');

function registerVideoRoutes(ipcMain) {
  // Video Conversion
  ipcMain.handle('upload-process-video', async (event, { sessionId, filePath }) => {
    try {
      const history = readHistory();
      const vHistory = readVideoHistory();
      let session = vHistory.find(s => s.id === sessionId);
      let isVideo = true;
      if (!session) {
        session = history.find(s => s.id === sessionId);
        isVideo = false;
      }
      const targetPath = filePath || session?.filePath;

      if (!targetPath || !fs.existsSync(targetPath)) {
        throw new Error(`Video file not found at: ${targetPath}`);
      }

      const uploadsDir = getUploadsDir();
      const { audioPath, audioFileName } = await convertVideoToAudio(targetPath, uploadsDir);

      if (session) {
        session.audioPath = audioPath;
        session.audioFileName = audioFileName;
        session.audioUrl = `file://${audioPath.replace(/\\/g, '/')}`;
        session.fileUrl = `file://${audioPath.replace(/\\/g, '/')}`;
        session.audioFileUrl = `file://${audioPath.replace(/\\/g, '/')}`;
        session.messages = [{
          sender: 'ai',
          text: 'Video converted to audio and ready for transcription.',
          audioUrl: `file://${audioPath.replace(/\\/g, '/')}`
        }];

        if (isVideo) {
          const vIdx = vHistory.findIndex(s => s.id === session.id);
          if (vIdx !== -1) vHistory[vIdx] = session;
          writeVideoHistory(vHistory);
        } else {
          const uIdx = history.findIndex(s => s.id === session.id);
          if (uIdx !== -1) history[uIdx] = session;
          writeHistory(history);
        }
      }

      return { ok: true, audioPath, audioFileName, audioUrl: `file://${audioPath.replace(/\\/g, '/')}` };
    } catch (err) {
      console.error('[video.routes] upload-process-video error:', err);
      return { ok: false, error: err.message };
    }
  });
}

module.exports = {
  registerVideoRoutes
};
