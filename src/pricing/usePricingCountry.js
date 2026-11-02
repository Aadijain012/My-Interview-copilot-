import { authStorage } from '../auth/tokenStore.mjs';
import { useEffect, useSyncExternalStore } from 'react';
import { API_BASE } from '../utils/api';
import { tokenClaims } from '../auth/sessionRenewal.mjs';
import { resolvePricingCountry } from './countryPreference';
import { createCountryStore } from './countryStore.mjs';

function readSession() {
  try {
    const token = authStorage.getItem('auth_token');
    const user = JSON.parse(authStorage.getItem('auth_user') || 'null');
    return { token, id: tokenClaims(token)?.userId || user?.id };
  } catch { return {}; }
}
const store = createCountryStore({
  readSession, storage: authStorage, locks: navigator.locks,
  resolve: options => resolvePricingCountry({ ...options, hostname: location.hostname,
    language: navigator.language, apiBase: API_BASE }),
  save: async (country, token) => {
    // Uses the existing fetch/session-renewal interceptor. Do not cancel an
    // earlier mutation to start another: the store serializes account writes.
    const response = await fetch(API_BASE + '/api/pricing/preference', {
      method: 'PUT', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'x-suppress-auth-redirect': 'true' },
      body: JSON.stringify({ country })
    });
    const body = await response.json();
    if (!response.ok || body.data?.country !== country) throw Error('Country save failed');
  }
});
let subscribers = 0;
const storageChanged = event => store.storageChanged(event.key);
const authChanged = () => { void store.sync(); };
const refresh = () => { if (!document.hidden) void store.sync(true); };
function subscribe(listener) {
  const unsubscribe = store.subscribe(listener);
  if (subscribers++ === 0) {
    window.addEventListener('storage', storageChanged);
    window.addEventListener('user-session-token', authChanged);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
  }
  void store.sync();
  return () => {
    unsubscribe();
    if (--subscribers === 0) {
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('user-session-token', authChanged);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    }
  };
}
export function usePricingCountry() {
  const snapshot = useSyncExternalStore(subscribe, store.getSnapshot);
  // App's own sign-in/recovery updates re-render consumers in this tab.
  // Renewing a token for the same account does not reset the selected country.
  useEffect(() => { void store.sync(); });
  return { ...snapshot, chooseCountry: store.chooseCountry, retry: store.retry };
}
