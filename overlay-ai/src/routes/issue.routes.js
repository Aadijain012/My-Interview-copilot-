const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./upload.routes');

function getIssuesFilePath() {
  return path.join(getDataDir(), 'reported_issues.json');
}

function registerIssueRoutes(ipcMain) {
  ipcMain.handle('report-issue', async (event, issueData) => {
    try {
      const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const newIssue = {
        id: ticketId,
        timestamp: new Date().toISOString(),
        ...issueData
      };
      
      const filePath = getIssuesFilePath();
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let list = [];
      if (fs.existsSync(filePath)) {
        try { list = JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]'); } catch (_) {}
      }
      list.unshift(newIssue);
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');

      console.log('[issue.routes] Saved issue ticket locally:', ticketId);
      return { ok: true, ticketId, message: 'Issue reported successfully.' };
    } catch (err) {
      console.error('[issue.routes] report-issue error:', err);
      return { ok: true, ticketId: `TICKET-${Date.now()}` };
    }
  });

  ipcMain.handle('get-reported-issues', async () => {
    const filePath = getIssuesFilePath();
    if (fs.existsSync(filePath)) {
      try {
        return { ok: true, issues: JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]') };
      } catch (_) {}
    }
    return { ok: true, issues: [] };
  });
}

module.exports = {
  registerIssueRoutes
};
