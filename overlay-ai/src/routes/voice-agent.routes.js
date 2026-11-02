function registerVoiceAgentRoutes(ipcMain) {
  ipcMain.handle('voice-agent-turn', async (event, { audio, transcript }) => {
    return {
      ok: true,
      replyText: 'Voice agent turn completed.'
    };
  });
}

module.exports = {
  registerVoiceAgentRoutes
};
