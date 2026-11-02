import { countries } from './markets.js';
const valid = value => typeof value === 'string' && Object.hasOwn(countries, value);
export const countryCacheKey = session => session.token
  ? (session.id ? 'mic.pricing.country.user.' + encodeURIComponent(session.id) : null)
  : 'mic.pricing.country.guest';
const identity = session => session.token ? (session.id || session.token) : 'guest';

// One state and write queue for every picker in this document. Web Locks also
// serialize writes from other tabs. Only confirmed saves enter the browser cache.
export function createCountryStore({ readSession, storage, resolve, save, locks }) {
  let state = { country: null, source: null, status: 'loading', message: '' };
  let owner, generation = 0, selection = 0, controller, pending = null, running = false, initial;
  const listeners = new Set();
  const emit = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const read = key => { try { return key ? storage.getItem(key) : null; } catch { return null; } };
  const cache = (session, country) => { try { const key = countryCacheKey(session); if (key) storage.setItem(key, country); } catch { /* Account is authoritative. */ } };
  async function sync(force = false) {
    const session = readSession(), who = identity(session);
    if (who === owner && (!force || running || state.status === 'error')) return initial;
    if (who !== owner) {
      owner = who; generation++; selection++; pending = null;
      emit({ country: null, source: null, status: 'loading', message: '' });
    }
    controller?.abort(); controller = new AbortController();
    const current = generation, chosen = selection;
    // The old global key is a guest-only migration. Never use it for an account.
    const local = read(countryCacheKey(session)) || (!session.token ? read('mic.pricing.country') : null);
    initial = resolve({ ...session, local, signal: controller.signal }).then(result => {
      if (!result || current !== generation || chosen !== selection) return;
      if (result.source === 'account') cache(session, result.country);
      emit({ ...result, status: 'idle', message: '' });
    }).catch(() => { /* Resolver supplies the locale fallback for network errors. */ });
    return initial;
  }
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const job = pending; pending = null;
        const perform = async () => {
          if (job.generation !== generation || identity(readSession()) !== job.owner) return false;
          // Read a refreshed token at dispatch, while retaining the same owner.
          await save(job.country, readSession().token);
          return true;
        };
        try {
          const saved = locks?.request
            ? await locks.request('mic-pricing-country-' + job.owner, perform)
            : await perform();
          if (!saved || job.generation !== generation || identity(readSession()) !== job.owner) continue;
          cache(job.session, job.country);
          if (job.selection === selection) emit({ source: 'account', status: 'saved', message: 'Country saved to your account.' });
        } catch {
          if (job.generation === generation && job.selection === selection)
            emit({ status: 'error', message: 'Couldn’t save your country. Try again to remember it next time.' });
        }
      }
    } finally { running = false; }
  }
  function chooseCountry(country) {
    if (!valid(country)) return;
    void sync();
    controller?.abort(); selection++;
    const session = readSession();
    emit({ country, source: 'selected', status: session.token ? 'saving' : 'saved',
      message: session.token ? 'Saving your country…' : 'Country saved in this browser.' });
    if (!session.token) { cache(session, country); return; }
    pending = { country, session, owner, generation, selection };
    void drain();
  }
  return {
    getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    sync, chooseCountry,
    retry: () => { if (valid(state.country)) chooseCountry(state.country); },
    // A confirmed country from another tab is re-read from the account, never
    // copied blindly from a different account's browser cache.
    storageChanged: key => {
      const session = readSession();
      if (!key || key === 'auth_token' || key === 'auth_user') void sync();
      else if (key === countryCacheKey(session) && !running) void sync(true);
    }
  };
}
