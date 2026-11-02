const { getStoredProfile, saveStoredProfile } = require('./profile.routes');

function registerSubscriptionRoutes(ipcMain) {
  // 1. Get Subscription Status
  ipcMain.handle('get-subscription-status', async (event, userId) => {
    const profile = getStoredProfile();
    return {
      ok: true,
      subscription: {
        plan: profile.tier || 'pro',
        status: 'active',
        credits: profile.credits ?? 999999,
        active: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
        features: {
          aiCopilot: true,
          teleprompter: true,
          notetaker: true,
          voiceAgent: true,
          unlimitedSessions: true,
          customAiModels: true
        }
      }
    };
  });

  // 2. Get Plans List
  ipcMain.handle('get-subscription-plans', async () => {
    return {
      ok: true,
      plans: [
        {
          id: 'desktop_pro',
          name: 'Desktop Pro',
          price: 0,
          currency: 'USD',
          interval: 'lifetime',
          status: 'active',
          features: [
            'Unlimited AI Copilot Interviews',
            'Floating Invisible Teleprompter',
            'Real-Time Speech & System Audio Capture',
            'Full Notetaker & Notes Generation',
            'Local Resume Parsing & OCR'
          ]
        }
      ]
    };
  });

  // 3. Get Subscription Limits
  ipcMain.handle('get-subscription-limits', async () => {
    return {
      ok: true,
      limits: {
        maxMonthlySessions: 99999,
        maxMinutesPerSession: 99999,
        unlimited: true,
        canExportPdf: true,
        canUseTeleprompter: true
      }
    };
  });

  // 4. Upgrade / Activate License
  ipcMain.handle('upgrade-subscription', async (event, { licenseKey, planId }) => {
    const profile = getStoredProfile();
    saveStoredProfile({ ...profile, tier: 'PRO', credits: 999999 });
    return { ok: true, message: 'Plan active (Desktop Pro)' };
  });
}

module.exports = {
  registerSubscriptionRoutes
};
