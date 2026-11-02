const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./upload.routes');

function getAuthFilePath() {
  return path.join(getDataDir(), 'auth_user.json');
}

function getStoredAuth() {
  const filePath = getAuthFilePath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');
    } catch (_) {
      return {};
    }
  }
  return {};
}

function saveStoredAuth(authData) {
  const filePath = getAuthFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(authData, null, 2), 'utf8');
}

function getDefaultUser() {
  return {
    id: 'local_desktop_user',
    name: 'Desktop User',
    email: 'user@desktop.local',
    role: 'USER',
    tier: 'PRO',
    credits: 999999,
    createdAt: new Date().toISOString()
  };
}

function registerAuthRoutes(ipcMain) {
  // 1. Get Current Active User / Session
  ipcMain.handle('auth-get-current-user', async () => {
    try {
      const auth = getStoredAuth();
      if (auth && auth.user && auth.token) {
        return { ok: true, user: auth.user, token: auth.token };
      }
      // Return default desktop user profile
      const defaultUser = getDefaultUser();
      const defaultToken = 'desktop_local_jwt_' + Date.now();
      saveStoredAuth({ user: defaultUser, token: defaultToken });
      return { ok: true, user: defaultUser, token: defaultToken };
    } catch (err) {
      console.error('[auth.routes] auth-get-current-user error:', err);
      const defaultUser = getDefaultUser();
      return { ok: true, user: defaultUser, token: 'desktop_local_jwt' };
    }
  });

  // 2. Local Login
  ipcMain.handle('auth-login', async (event, { email, password }) => {
    try {
      const stored = getStoredAuth();
      const user = stored.user || {
        ...getDefaultUser(),
        email: email || 'user@desktop.local',
        name: (email || 'User').split('@')[0]
      };
      const token = stored.token || 'desktop_local_jwt_' + Date.now();
      saveStoredAuth({ user, token });
      return { ok: true, user, token, message: 'Logged in successfully (Desktop mode)' };
    } catch (err) {
      console.error('[auth.routes] auth-login error:', err);
      return { ok: false, error: err.message };
    }
  });

  // 3. Local Signup
  ipcMain.handle('auth-signup', async (event, { email, name, password }) => {
    try {
      const user = {
        id: `user_${Date.now()}`,
        name: name || (email ? email.split('@')[0] : 'Desktop User'),
        email: email || 'user@desktop.local',
        role: 'USER',
        tier: 'PRO',
        credits: 999999,
        createdAt: new Date().toISOString()
      };
      const token = 'desktop_local_jwt_' + Date.now();
      saveStoredAuth({ user, token });
      return { ok: true, user, token };
    } catch (err) {
      console.error('[auth.routes] auth-signup error:', err);
      return { ok: false, error: err.message };
    }
  });

  // 4. Request OTP (Instant simulated local verification for desktop)
  ipcMain.handle('auth-request-otp', async (event, { email }) => {
    return { ok: true, message: 'OTP verified automatically in desktop mode.' };
  });

  // 5. Verify OTP
  ipcMain.handle('auth-verify-otp', async (event, { email, otp }) => {
    const user = {
      id: `user_${Date.now()}`,
      name: email ? email.split('@')[0] : 'Desktop User',
      email: email || 'user@desktop.local',
      role: 'USER',
      tier: 'PRO',
      credits: 999999
    };
    const token = 'desktop_local_jwt_' + Date.now();
    saveStoredAuth({ user, token });
    return { ok: true, user, token };
  });

  // 6. Logout
  ipcMain.handle('auth-logout', async () => {
    try {
      const filePath = getAuthFilePath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return { ok: true };
    } catch (err) {
      return { ok: true };
    }
  });
}

module.exports = {
  registerAuthRoutes,
  getStoredAuth,
  saveStoredAuth,
  getDefaultUser
};
