const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./upload.routes');
const { getStoredAuth, saveStoredAuth, getDefaultUser } = require('./auth.routes');

function getProfileFilePath() {
  return path.join(getDataDir(), 'user_profile.json');
}

function getStoredProfile() {
  const filePath = getProfileFilePath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');
    } catch (_) {}
  }
  const auth = getStoredAuth();
  return auth.user || getDefaultUser();
}

function saveStoredProfile(profile) {
  const filePath = getProfileFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf8');

  // Also sync to auth_user.json
  const auth = getStoredAuth();
  saveStoredAuth({ ...auth, user: { ...(auth.user || {}), ...profile } });
}

function registerProfileRoutes(ipcMain) {
  // 1. Get User Profile
  ipcMain.handle('get-user-profile', async (event, userId) => {
    try {
      const profile = getStoredProfile();
      return {
        ok: true,
        profile: {
          id: profile.id || userId || 'local_user',
          name: profile.name || 'Desktop User',
          email: profile.email || 'user@desktop.local',
          role: profile.role || 'Fullstack Engineer',
          tier: profile.tier || 'PRO',
          credits: profile.credits ?? 999999,
          createdAt: profile.createdAt || new Date().toISOString()
        }
      };
    } catch (err) {
      console.error('[profile.routes] get-user-profile error:', err);
      return { ok: true, profile: getDefaultUser() };
    }
  });

  // 2. Update User Profile
  ipcMain.handle('update-user-profile', async (event, updates) => {
    try {
      const current = getStoredProfile();
      const updated = { ...current, ...(updates || {}) };
      saveStoredProfile(updated);
      return { ok: true, profile: updated };
    } catch (err) {
      console.error('[profile.routes] update-user-profile error:', err);
      return { ok: false, error: err.message };
    }
  });

  // 3. Get Wallet Balance
  ipcMain.handle('get-wallet-balance', async () => {
    try {
      const profile = getStoredProfile();
      return {
        ok: true,
        wallet: {
          balance: profile.credits ?? 999999,
          currency: 'USD',
          tier: profile.tier || 'PRO',
          unlimited: true,
          sessionsRemaining: 9999,
          tokensRemaining: 9999999
        }
      };
    } catch (err) {
      return {
        ok: true,
        wallet: {
          balance: 999999,
          currency: 'USD',
          tier: 'PRO',
          unlimited: true
        }
      };
    }
  });

  // 4. Get User Settings
  ipcMain.handle('get-user-settings', async () => {
    const settingsPath = path.join(getDataDir(), 'app_settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        return { ok: true, settings: JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
      } catch (_) {}
    }
    return {
      ok: true,
      settings: {
        darkMode: true,
        fontSize: 'medium',
        language: 'en',
        aiModel: 'auto',
        saveRecordingsLocally: true
      }
    };
  });

  // 5. Save User Settings
  ipcMain.handle('save-user-settings', async (event, newSettings) => {
    try {
      const settingsPath = path.join(getDataDir(), 'app_settings.json');
      const dir = path.dirname(settingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(newSettings || {}, null, 2), 'utf8');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = {
  registerProfileRoutes,
  getStoredProfile,
  saveStoredProfile
};
