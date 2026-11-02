/**
 * Persistent Device Identifier utility for Kairos.
 * Retrieves hardware/app device ID when running inside Electron,
 * or generates and persists a UUID in localStorage for web clients.
 */

const STORAGE_KEY = 'kairos_device_id';

export function getDeviceId() {
  if (typeof window === 'undefined') {
    return '';
  }

  // 1. Electron Desktop App environment check
  if (typeof window.require === 'function') {
    try {
      const electron = window.require('electron');
      if (electron?.ipcRenderer?.sendSync) {
        const electronDeviceId = electron.ipcRenderer.sendSync('get-device-id-sync');
        if (electronDeviceId && typeof electronDeviceId === 'string' && electronDeviceId.trim()) {
          return electronDeviceId.trim();
        }
      }
    } catch (_) {
      // Fall through to browser storage if electron ipc is unavailable
    }
  }

  // 2. Browser persistent fallback in localStorage
  try {
    let storedId = localStorage.getItem(STORAGE_KEY);
    if (storedId && typeof storedId === 'string' && storedId.trim()) {
      return storedId.trim();
    }

    // 3. Generate new persistent UUID
    const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

    localStorage.setItem(STORAGE_KEY, newId);
    return newId;
  } catch (err) {
    console.warn('[device] Failed to read/write persistent device ID:', err);
    return '';
  }
}

export default getDeviceId;
