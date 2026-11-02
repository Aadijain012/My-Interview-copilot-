let lastBrowserInteraction=Date.now();
const activityListeners=new Set();
if(typeof window!=='undefined'){
 let lastBroadcast=0;
 for(const event of ['pointerdown','keydown','touchstart'])window.addEventListener(event,()=>{
  lastBrowserInteraction=Date.now();
  if(lastBrowserInteraction-lastBroadcast>=1000){lastBroadcast=lastBrowserInteraction;try{window.localStorage.setItem('mic_last_interaction',String(lastBrowserInteraction));}catch{}}
  for(const listener of activityListeners)listener();
 },{passive:true});
 window.addEventListener('storage',event=>{if(event.key==='mic_last_interaction'){const at=Number(event.newValue);if(Number.isFinite(at)&&at<=Date.now())lastBrowserInteraction=Math.max(lastBrowserInteraction,at);}});
}
// Browser session renewal is shared by fetch, axios and the foreground timer.
// Only our user API receives credentials. Admin and signed S3 URLs are excluded.
export function tokenClaims(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part));
  } catch { return null; }
}
export function createSessionRenewal({ apiBase, fetch: rawFetch, storage, notify = () => {}, now = () => Date.now(), lastInteraction = () => lastBrowserInteraction, locks }) {
  const base = new URL(apiBase);
  let pending = null, epoch = 0, refusedToken = null, backoffUntil = 0;
  const read = () => { try { return { token: storage.getItem('auth_token'), user: JSON.parse(storage.getItem('auth_user') || 'null') }; } catch { return {}; } };
  const sameUser = (token, id) => tokenClaims(token)?.userId === id;
  function currentToken(input) {
    const state = read();
    if (!state.token || !state.user?.id) return input;
    if (state.token === input || (sameUser(input, state.user.id) && sameUser(state.token, state.user.id))) return state.token;
    return input;
  }
  function userApi(url, token) {
    try {
      const parsed = new URL(typeof url === 'string' ? url : url.url, base);
      return Boolean(token) && parsed.origin === base.origin && parsed.pathname.startsWith('/api/') &&
        !/^\/api\/(?:auth|admin|diagnostics)(?:\/|$)/.test(parsed.pathname);
    } catch { return false; }
  }
  function nearExpiry(token) {
    const claims = tokenClaims(token);
    return Boolean(claims?.sid && Number.isFinite(claims.exp) && claims.exp * 1000 <= now() + 60000);
  }
  async function renew(failedToken, bootstrap = false) {
    const start = read();
    if(tokenClaims(start.token)?.sharedDevice && now()-lastInteraction()>=1800000)return null;
    if ((!start.token && !bootstrap) || !start.user?.id || (!bootstrap && currentToken(failedToken) !== start.token)) return null;
    if (start.token !== failedToken && !nearExpiry(start.token)) return start.token;
    if (!bootstrap && refusedToken === start.token) return null;
    if (backoffUntil > now()) throw Object.assign(new Error('Could not reconnect. Please try again.'), { status: 503 });
    if (pending) return pending;
    const generation = epoch, userId = start.user.id;
    const run = async () => {
      const latest = read();
      if (generation !== epoch || latest.user?.id !== userId || (!latest.token && !bootstrap)) return null;
      if (latest.token !== start.token && !nearExpiry(latest.token)) return latest.token;
      let response;
      try {
        response = await rawFetch(base.origin + '/api/auth/session/refresh', {
          method: 'POST', credentials: 'include', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-MIC-Session': '1' }, body: JSON.stringify({ expectedUserId: userId, lastInteractionAt: lastInteraction() }),
          signal: AbortSignal.timeout(15000)
        });
      } catch (error) {
        backoffUntil = now() + 5000;
        throw Object.assign(new Error('Could not reconnect. Please try again.', { cause: error }), { status: 503 });
      }
      if (response.status === 401 || response.status === 409 || response.status === 404) {
        refusedToken = start.token; return null;
      }
      if (!response.ok) {
        backoffUntil = now() + 5000;
        throw Object.assign(new Error('Could not reconnect. Please try again.'), { status: 503 });
      }
      const payload = await response.json();
      const after = read();
      if (generation !== epoch || after.user?.id !== userId || after.token !== latest.token) return null;
      if (payload.user?.id !== userId || !sameUser(payload.token, userId)) {
        refusedToken = start.token; return null;
      }
      storage.setItem('auth_token', payload.token);
      refusedToken = null;
      notify({ token: payload.token, userId });
      return payload.token;
    };
    const operation = locks?.request ? locks.request('mic-user-session-renewal', run) : run();
    pending = Promise.resolve(operation).finally(() => { pending = null; });
    return pending;
  }
  function reset() { epoch++; refusedToken = null; backoffUntil = 0; }
  async function logout() {
    reset();
    // An in-flight refresh must finish before logout revokes its new cookie.
    await pending?.catch(() => {});
    const response = await rawFetch(base.origin + '/api/auth/session/logout', {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-MIC-Session': '1' }, body: '{}', signal: AbortSignal.timeout(15000)
    });
    if (!response.ok && response.status !== 404) throw new Error('Sign out could not finish. Please try again.');
  }
  async function restore() {
    const state=read(), claims=tokenClaims(state.token);
    if (state.token && claims?.exp * 1000 > now() + 60000 && sameUser(state.token,state.user?.id)) return state.token;
    if (!state.user?.id) return null;
    const restored=await renew(state.token, true);
    if (!restored) storage.removeItem('auth_token');
    return restored;
  }
  let lastActivityRenewal=-Infinity;
  function activity(){
    const current=read();
    if(!tokenClaims(current.token)?.sharedDevice||now()-lastActivityRenewal<60000)return;
    lastActivityRenewal=now();
    // Renew on actual interaction, including a return just before the idle limit.
    // Background polling never changes the interaction timestamp.
    void (async()=>{await pending?.catch(()=>{});await renew(read().token);})().catch(()=>{});
  }
  if(typeof window!=='undefined')activityListeners.add(activity);
  return { renew, restore, reset, logout, currentToken, userApi, nearExpiry, activity };
}
