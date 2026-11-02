/**
 * Central IPC Router Index
 * Imports and registers all modular routes matching backend file and folder structure.
 */

const { registerAuthRoutes } = require('./routes/auth.routes');
const { registerUploadRoutes } = require('./routes/upload.routes');
const { registerVideoRoutes } = require('./routes/video.routes');
const { registerInterviewPanelRoutes } = require('./routes/interview-panel.routes');
const { registerSessionRoutes } = require('./routes/session.routes');
const { registerAiRoutes } = require('./routes/ai.routes');
const { registerProfileRoutes } = require('./routes/profile.routes');
const { registerSubscriptionRoutes } = require('./routes/subscription.routes');
const { registerReferralRoutes } = require('./routes/referral.routes');
const { registerVoiceAgentRoutes } = require('./routes/voice-agent.routes');
const { registerIssueRoutes } = require('./routes/issue.routes');

function setupEmbeddedBackendIpcHandlers(ipcMain) {
  registerAuthRoutes(ipcMain);
  registerUploadRoutes(ipcMain);
  registerVideoRoutes(ipcMain);
  registerInterviewPanelRoutes(ipcMain);
  registerSessionRoutes(ipcMain);
  registerAiRoutes(ipcMain);
  registerProfileRoutes(ipcMain);
  registerSubscriptionRoutes(ipcMain);
  registerReferralRoutes(ipcMain);
  registerVoiceAgentRoutes(ipcMain);
  registerIssueRoutes(ipcMain);

  console.log('[ipcIndex] All modular backend routes and IPC handlers registered successfully.');
}

module.exports = {
  setupEmbeddedBackendIpcHandlers
};
