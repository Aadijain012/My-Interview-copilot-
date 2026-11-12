import axios from 'axios';
import { authStorage } from '../auth/tokenStore.mjs';
import { createSessionRenewal } from '../auth/sessionRenewal.mjs';
import { getDeviceId } from './device';

const configuredApiUrl = import.meta.env.VITE_API_URL;
const isElectronOrFile = typeof window !== 'undefined' && (!window.location.origin || window.location.origin === 'null' || window.location.protocol === 'file:' || !!window.require);
const defaultApiUrl = (isElectronOrFile ? 'http://localhost:4000' : (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:4000' : window.location.origin)));

export const API_BASE = (defaultApiUrl || 'http://localhost:4000').replace(/\/$/, '');
export const WS_BASE = API_BASE.replace(/^http/, 'ws');

export const userSession = typeof window === 'undefined' ? null : createSessionRenewal({
  apiBase: API_BASE,
  fetch: (typeof window !== 'undefined' && window.fetch) ? window.fetch.bind(window) : globalThis.fetch,
  storage: authStorage,
  locks: typeof navigator !== 'undefined' ? navigator.locks : null,
  notify: detail => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('user-session-token', { detail }));
    }
  }
});

export function websocketProtocols(token) {
  if (!token) return [];
  // RFC 6455 Sec 4.3 strictly forbids separators: ( ) < > @ , ; : \ " / [ ] ? = { } SP HT and non-ASCII.
  // Standard base64 contains +, /, =. Clean token thoroughly so browser will never throw DOMException.
  const cleanToken = String(token).trim().replace(/[^a-zA-Z0-9_\-\.]/g, '').replace(/=/g, '');
  return cleanToken ? [`bearer.${cleanToken}`] : [];
}

let lastNotificationTime = 0;
function notifySessionExpired() {
  const now = Date.now();
  if (now - lastNotificationTime < 4000) return;
  lastNotificationTime = now;
  window.dispatchEvent(
    new CustomEvent('auth-expired', {
      detail: { message: 'Session expired. Please log in again.' }
    })
  );
}

// Helper to generate a unique deterministic fingerprint for in-flight mutations
function getRequestKey(method, url, data) {
  let serialized = '';
  if (data) {
    if (typeof data === 'string') {
      serialized = data.slice(0, 500);
    } else if (typeof FormData !== 'undefined' && data instanceof FormData) {
      serialized = 'formdata';
    } else {
      try {
        serialized = JSON.stringify(data).slice(0, 500);
      } catch (_) {
        serialized = '';
      }
    }
  }
  return `${String(method).toUpperCase()}::${url}::${serialized}`;
}

// Global fetch interceptor to catch expired tokens and inject X-Device-Id header
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const deviceId = getDeviceId();
      if (deviceId) {
        if (!args[1]) {
          args[1] = { headers: { 'X-Device-Id': deviceId } };
        } else if (args[1].headers instanceof Headers) {
          if (!args[1].headers.has('x-device-id')) {
            args[1].headers.set('X-Device-Id', deviceId);
          }
        } else if (Array.isArray(args[1].headers)) {
          if (!args[1].headers.some(([k]) => k.toLowerCase() === 'x-device-id')) {
            args[1].headers.push(['X-Device-Id', deviceId]);
          }
        } else {
          args[1].headers = {
            'X-Device-Id': deviceId,
            ...(args[1].headers || {})
          };
        }
      }
    } catch (_) {}

    const response = await originalFetch(...args);
    if (response && response.status === 401) {
      const url = String(args[0] || '');
      const reqInit = args[1] || {};
      const headers = reqInit.headers || {};
      const suppressRedirect =
        headers['x-suppress-auth-redirect'] === 'true' ||
        (headers instanceof Headers && headers.get('x-suppress-auth-redirect') === 'true') ||
        url.includes('/user/upgrade') ||
        url.includes('/user/subscription-limits') ||
        url.includes('/api/plans') ||
        (typeof window !== 'undefined' && (
          window.location.search.includes('window=subscription') ||
          window.location.search.includes('window=usage')
        ));

      if (!suppressRedirect) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          const msg = String(data?.error?.message || '').toLowerCase();
          if (
            data?.error?.code === 'UNAUTHORIZED' ||
            msg.includes('expired') ||
            msg.includes('invalid token') ||
            msg.includes('login again')
          ) {
            notifySessionExpired();
          }
        } catch (_) {}
      }
    }
    return response;
  };
}

const inFlightAxiosRequests = new Map();

// Global axios interceptors to catch expired tokens and deduplicate identical in-flight mutations
if (typeof window !== 'undefined' && axios) {
  axios.interceptors.request.use(
    (config) => {
      try {
        const deviceId = getDeviceId();
        if (deviceId) {
          config.headers = config.headers || {};
          if (!config.headers['X-Device-Id'] && !config.headers['x-device-id']) {
            config.headers['X-Device-Id'] = deviceId;
          }
        }
      } catch (_) {}

      const method = (config.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const key = getRequestKey(method, config.url, config.data);
        if (inFlightAxiosRequests.has(key)) {
          const controller = new AbortController();
          controller.abort('Duplicate request blocked by anti-spam guard.');
          config.signal = controller.signal;
          config.__blockedAsDuplicate = true;
        } else {
          inFlightAxiosRequests.set(key, true);
          config.__mutationKey = key;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  axios.interceptors.response.use(
    (response) => {
      if (response.config?.__mutationKey) {
        inFlightAxiosRequests.delete(response.config.__mutationKey);
      }
      return response;
    },
    (error) => {
      if (error.config?.__mutationKey) {
        inFlightAxiosRequests.delete(error.config.__mutationKey);
      }
      if (error.config?.__blockedAsDuplicate) {
        console.debug('[AntiSpam] Blocked duplicate in-flight axios request:', error.config?.url);
        return Promise.reject(new Error('A request with identical parameters is already processing.'));
      }
      const suppressRedirect =
        error.config?.headers?.['x-suppress-auth-redirect'] === 'true' ||
        error.config?.url?.includes('/user/upgrade') ||
        error.config?.url?.includes('/user/subscription-limits') ||
        (typeof window !== 'undefined' && (
          window.location.search.includes('window=subscription') ||
          window.location.search.includes('window=usage')
        ));

      if (!suppressRedirect && error.response?.status === 401) {
        const msg = String(error.response.data?.error?.message || '').toLowerCase();
        if (
          error.response.data?.error?.code === 'UNAUTHORIZED' ||
          msg.includes('expired') ||
          msg.includes('invalid token') ||
          msg.includes('login again')
        ) {
          notifySessionExpired();
        }
      }
      return Promise.reject(error);
    }
  );
}