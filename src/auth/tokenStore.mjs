// Browser access credentials. App.jsx, the pricing page and Stripe test
// checkout must all read the same token, so it stays in local storage until
// the backend issues an HttpOnly refresh cookie (/api/auth/session/refresh).
// Moving it to memory before that endpoint exists signs users out on reload
// and makes the pricing page show "Sign in" for signed-in users.
// Native storage is deferred.
const persistent = () => typeof window === 'undefined' ? null : window.localStorage;
try {
  if (typeof window !== 'undefined') for (const key of ['token','copilot_token']) { window.sessionStorage.removeItem(key); persistent()?.removeItem(key); }
} catch {}
export const authStorage = {
  getItem(key) { try { return persistent()?.getItem(key) ?? null; } catch { return null; } },
  setItem(key,value) { try { persistent()?.setItem(key,String(value)); } catch {} },
  removeItem(key) { try { persistent()?.removeItem(key); } catch {} }
};
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  // Another tab signed out (or cleared storage): drop this tab's session too.
  if ((event.key === 'auth_user' || event.key === 'auth_token') && event.newValue === null || event.key === null) {
    window.dispatchEvent(new Event('auth-expired'));
  }
});
