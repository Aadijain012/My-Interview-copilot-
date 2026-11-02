// Where the app lives in the address bar.
//
// On the main domain (myinterviewcopilot.com) the app has paths of its own. A
// Cloudflare Worker routes them to this Firebase site; the marketing website
// keeps every other path:
//   /login  /signup                        sign-in and sign-up
//   /workspace                             the Workspace
//   /workspace/copilot | voice-agent | notetaker | uploads | profile
//   /app/terms  /app/privacy               the app's policies (the website's own
//                                          are /terms and /privacy)
//   /app/...                               the app's files
// Everywhere else -- app.myinterviewcopilot.com, the Firebase hosts, local
// builds and the desktop app -- the app keeps its original addresses: one page
// at / with ?auth=login|signup and ?window=<view>, policies at /terms and
// /privacy. Both forms are understood everywhere: an address in the other
// form is converted when the page opens, so either kind of link opens the
// right screen.

import { TOOL_VIEWS, WORKSPACE_VIEW } from '../components/workspace/workspaceViews.js';

const env = import.meta.env || {};

const hostList = (value, fallback) => String(value || fallback)
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

// The hosts where the app uses its own paths: the main domain, www, and the
// canary host edge-check.myinterviewcopilot.com, where the same Worker routes
// are tried before the main domain is changed (edge/RELEASE.md). On these
// hosts every address the app writes is one of the Worker's routes, so a
// reload or a shared link reaches the app again.
const MAIN_HOSTS = hostList(env.VITE_MAIN_DOMAIN_HOSTS, 'myinterviewcopilot.com,www.myinterviewcopilot.com,edge-check.myinterviewcopilot.com');
// The main domain: the website's pages, and the app's paths on it.
export const MAIN_ORIGIN = String(env.VITE_MAIN_DOMAIN_ORIGIN || 'https://myinterviewcopilot.com').replace(/\/+$/, '');
// Prepared for after the main domain is validated: off unless the build sets
// VITE_LEGACY_HOST_REDIRECT=on.
const LEGACY_REDIRECT_ON = String(env.VITE_LEGACY_HOST_REDIRECT || '').trim().toLowerCase() === 'on';
const LEGACY_REDIRECT_HOSTS = hostList(env.VITE_LEGACY_REDIRECT_HOSTS, 'app.myinterviewcopilot.com');
// Added by the website's and the Worker's fallbacks when they send someone to
// the legacy host because the main domain is not routing the app: that page
// must not send them back.
export const STAY_PARAM = 'legacy';

export const LOGIN_PATH = '/login';
export const SIGNUP_PATH = '/signup';
export const WORKSPACE_PATH = '/workspace';
export const APP_TERMS_PATH = '/app/terms';
export const APP_PRIVACY_PATH = '/app/privacy';
const LEGACY_TERMS_PATH = '/terms';
const LEGACY_PRIVACY_PATH = '/privacy';

// The tools and Profile under /workspace, by view (the ?window= value).
const VIEW_SLUGS = Object.freeze({
  overlay: 'copilot',
  'voice-agent': 'voice-agent',
  notetaker: 'notetaker',
  upload: 'uploads',
  profile: 'profile',
  credits: 'credits'
});
const SLUG_VIEWS = Object.freeze(Object.fromEntries(Object.entries(VIEW_SLUGS).map(([view, slug]) => [slug, view])));

// Notetaker sessions the server never received (their upload failed) stay in
// this browser's storage for the address they were made on.
const LOCAL_NOTETAKER_SESSIONS_KEY = 'notetaker_saved_sessions';

function isDesktopApp() {
  return typeof window !== 'undefined' && Boolean(window.require);
}

function isWebPage(loc) {
  return /^https?:$/.test(loc.protocol) && !isDesktopApp();
}

function cleanPath(pathname) {
  const path = String(pathname || '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return path || '/';
}

/** True where the app writes its own paths: the main domain, in a browser. */
export function usesPathRoutes(loc = window.location) {
  if (!isWebPage(loc)) return false;
  if (new URLSearchParams(loc.search).get('isChild') === 'true') return false;
  return MAIN_HOSTS.includes(String(loc.hostname || '').toLowerCase());
}

/**
 * What an address asks for, in either form:
 *   auth     'login' | 'signup' | null
 *   view     the ?window= value, or the view of a /workspace path; on a sign-in
 *            address, the tool to open afterwards (?window=), if one is named
 *   policy   'terms' | 'privacy' | null
 *   isChild  a desktop child window (teleprompter, top bar)
 *   pathForm the address is one of the app's own paths
 */
export function readRoute(loc = window.location) {
  const path = cleanPath(loc.pathname);
  const params = new URLSearchParams(loc.search);
  const route = { auth: null, view: null, policy: null, isChild: params.get('isChild') === 'true', pathForm: false };

  if (path === APP_TERMS_PATH || path === LEGACY_TERMS_PATH) return { ...route, policy: 'terms', pathForm: path === APP_TERMS_PATH };
  if (path === APP_PRIVACY_PATH || path === LEGACY_PRIVACY_PATH) return { ...route, policy: 'privacy', pathForm: path === APP_PRIVACY_PATH };
  if (path === LOGIN_PATH || path === SIGNUP_PATH) {
    return { ...route, auth: path === LOGIN_PATH ? 'login' : 'signup', view: params.get('window'), pathForm: true };
  }
  if (path === WORKSPACE_PATH || path.startsWith(`${WORKSPACE_PATH}/`)) {
    const slug = path.slice(WORKSPACE_PATH.length + 1).split('/')[0];
    return { ...route, view: slug ? (SLUG_VIEWS[slug] || WORKSPACE_VIEW) : WORKSPACE_VIEW, pathForm: true };
  }
  if (path === '/app' || path.startsWith('/app/')) {
    // The app's own folder (/app/, /app/index.html): its home.
    return { ...route, view: WORKSPACE_VIEW, pathForm: true };
  }
  // The original form: / with ?auth= and ?window=.
  const auth = params.get('auth');
  return { ...route, auth: auth === 'login' || auth === 'signup' ? auth : null, view: params.get('window') };
}

/** The main-domain path of a signed-in view (anything else: the Workspace). */
export function viewPath(view) {
  const target = view === 'teleprompter' || view === 'topbar' ? 'overlay' : view;
  const slug = VIEW_SLUGS[target];
  return slug ? `${WORKSPACE_PATH}/${slug}` : WORKSPACE_PATH;
}

/** A link to a signed-in view, in this host's form. */
export function viewHref(view) {
  return usesPathRoutes() ? viewPath(view) : `?window=${view}`;
}

/** A link to sign-in or sign-up, in this host's form. */
export function authHref(mode) {
  if (!usesPathRoutes()) return `?auth=${mode}`;
  return mode === 'signup' ? SIGNUP_PATH : LOGIN_PATH;
}

/** A link to one of the app's policies, in this host's form. */
export function policyHref(doc) {
  if (usesPathRoutes()) return doc === 'privacy' ? APP_PRIVACY_PATH : APP_TERMS_PATH;
  return doc === 'privacy' ? LEGACY_PRIVACY_PATH : LEGACY_TERMS_PATH;
}

/**
 * The main-domain address of a sign-in page, keeping the rest of the query
 * (for example ?window=<tool>) and the hash.
 */
export function authPathUrl(mode, loc = window.location) {
  const params = new URLSearchParams(loc.search);
  params.delete('auth');
  const query = params.toString();
  return `${mode === 'signup' ? SIGNUP_PATH : LOGIN_PATH}${query ? `?${query}` : ''}${loc.hash || ''}`;
}

/**
 * The original-form address (/ with ?auth= or ?window=) for an address in the
 * app's own form, keeping the other query parameters and the hash. Policy
 * pages and original-form addresses come back unchanged.
 */
export function originalFormUrl(loc = window.location) {
  const route = readRoute(loc);
  if (!route.pathForm || route.policy) return `${loc.pathname}${loc.search}${loc.hash || ''}`;
  const params = new URLSearchParams(loc.search);
  params.delete('auth');
  params.delete('window');
  const lead = new URLSearchParams();
  if (route.auth) {
    lead.set('auth', route.auth);
    if (route.view) lead.set('window', route.view);
  } else {
    lead.set('window', route.view || WORKSPACE_VIEW);
  }
  for (const [key, value] of params) lead.append(key, value);
  return `/?${lead.toString()}${loc.hash || ''}`;
}

function hasUnsyncedNotetakerSessions(storage) {
  try {
    const list = JSON.parse(storage?.getItem(LOCAL_NOTETAKER_SESSIONS_KEY) || '[]');
    return Array.isArray(list) && list.some((session) => String(session?.id || '').startsWith('local_'));
  } catch {
    return false;
  }
}

function localStorageOrNull() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The main-domain address for an address of the legacy host, in either form.
 * Keeps ref and utm_* in the query, and the hash; the view and sign-in
 * parameters become the path.
 */
export function mainDomainUrlFor(loc) {
  const route = readRoute(loc);
  const params = new URLSearchParams(loc.search);
  const kept = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === 'ref' || key === 'appleReview' || key.startsWith('utm_')) kept.append(key, value);
  }
  let path;
  if (route.policy) {
    path = route.policy === 'privacy' ? APP_PRIVACY_PATH : APP_TERMS_PATH;
  } else if (route.auth) {
    path = route.auth === 'signup' ? SIGNUP_PATH : LOGIN_PATH;
    if (TOOL_VIEWS.includes(route.view)) kept.set('window', route.view);
  } else {
    path = viewPath(route.view);
  }
  const query = kept.toString();
  return `${MAIN_ORIGIN}${path}${query ? `?${query}` : ''}${loc.hash || ''}`;
}

/**
 * Where to send this page instead, or null. Only when the build turns the
 * legacy-host redirect on, only on that host, only in a browser (not the
 * desktop app or its child windows), not when a fallback sent the visitor here
 * (?legacy=1), and not while this browser holds Notetaker sessions the server
 * never received -- they can only be seen at this address.
 */
export function legacyHostRedirect(loc = window.location, storage = localStorageOrNull()) {
  if (!LEGACY_REDIRECT_ON || !isWebPage(loc)) return null;
  if (!LEGACY_REDIRECT_HOSTS.includes(String(loc.hostname || '').toLowerCase())) return null;
  const params = new URLSearchParams(loc.search);
  if (params.get('isChild') === 'true') return null;
  // Retire the old Apple review entry without moving browser-only recordings.
  if (params.get('appleReview') === '1' && !hasUnsyncedNotetakerSessions(storage)) return mainDomainUrlFor(loc);
  if (params.has(STAY_PARAM)) return null;
  if (hasUnsyncedNotetakerSessions(storage)) return null;
  return mainDomainUrlFor(loc);
}

/**
 * Converts the address once, when the page opens, to the form this host uses:
 * an app path opened on the legacy host becomes the original form, so the
 * original code below runs exactly as before there. On the main domain the
 * paths are already the app's own form.
 */
export function normalizeAddressOnLoad() {
  try {
    const loc = window.location;
    if (!isWebPage(loc) || usesPathRoutes(loc)) return;
    const route = readRoute(loc);
    if (!route.pathForm || route.policy) return;
    window.history.replaceState(window.history.state, '', originalFormUrl(loc));
  } catch {
    // Without history the page still opens; the address keeps its form.
  }
}
