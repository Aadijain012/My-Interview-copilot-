const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./upload.routes');

function getReferralFilePath() {
  return path.join(getDataDir(), 'referral_info.json');
}

function getStoredReferral() {
  const filePath = getReferralFilePath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');
    } catch (_) {}
  }
  return {
    code: 'KAIROS-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    referralsCount: 0,
    earnedCredits: 500,
    history: []
  };
}

function saveStoredReferral(data) {
  const filePath = getReferralFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

const API_BASE_URL = String(
  process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:4000'
).replace(/\/$/, '');

function registerReferralRoutes(ipcMain) {
  // 1. Get Referral Info (synced with live backend database)
  ipcMain.handle('get-referral-info', async (event, args = {}) => {
    const token = args?.token || process.env.AUTH_TOKEN;
    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/referrals/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.data || json?.profile) {
            const prof = json.data || json.profile;
            return {
              ok: true,
              data: {
                code: prof.code || prof.referralCode,
                referralsCount: prof.successfulReferralsCount || prof.referralsCount || 0,
                earnedCredits: prof.totalCreditsEarned || prof.earnedCredits || 0,
                shareUrl: `https://myinterviewcopilot.com/join?ref=${prof.code || prof.referralCode}`,
                referrals: prof.recentReferrals || prof.referrals || []
              }
            };
          }
        }
      } catch (err) {
        console.warn('[referral-ipc] Backend fetch failed, using local cache:', err.message);
      }
    }

    const data = getStoredReferral();
    return {
      ok: true,
      data: {
        code: data.code,
        referralsCount: data.referralsCount,
        earnedCredits: data.earnedCredits,
        shareUrl: `https://myinterviewcopilot.com/join?ref=${data.code}`,
        referrals: data.history || []
      }
    };
  });

  // 2. Get Referral Milestones (synced with Admin Panel configs in backend)
  ipcMain.handle('get-referral-milestones', async (event, args = {}) => {
    const token = args?.token || process.env.AUTH_TOKEN;
    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/referrals/milestones`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.milestones) || Array.isArray(json?.data)) {
            return {
              ok: true,
              milestones: json.milestones || json.data
            };
          }
        }
      } catch (err) {
        console.warn('[referral-ipc] Backend milestones fetch failed, using default:', err.message);
      }
    }

    return {
      ok: true,
      milestones: [
        { count: 1, reward: '100 Bonus Credits', unlocked: true },
        { count: 5, reward: '1 Month Free Pro Upgrade', unlocked: false },
        { count: 10, reward: 'Lifetime Priority Support', unlocked: false }
      ]
    };
  });

  // 3. Apply Referral Code (synced with backend database)
  ipcMain.handle('apply-referral-code', async (event, { code, token }) => {
    const effectiveToken = token || process.env.AUTH_TOKEN;
    if (effectiveToken && code) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/referrals/claim-code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveToken}`
          },
          body: JSON.stringify({ code })
        });
        if (res.ok) {
          const json = await res.json();
          return { ok: true, message: json?.message || 'Referral code applied successfully!' };
        }
      } catch (err) {
        console.warn('[referral-ipc] Backend claim code failed, updating local:', err.message);
      }
    }

    const data = getStoredReferral();
    data.earnedCredits += 100;
    saveStoredReferral(data);
    return { ok: true, message: 'Referral code applied! +100 credits awarded.' };
  });
}

module.exports = {
  registerReferralRoutes
};
