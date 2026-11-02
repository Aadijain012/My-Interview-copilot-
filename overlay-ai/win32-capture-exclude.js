/**
 * Windows-only module to exclude a window from screen capture
 * using SetWindowDisplayAffinity with WDA_EXCLUDEFROMCAPTURE.
 *
 * The overlay remains visible on the local screen but is not
 * captured in screen sharing or screen recording.
 */

const WDA_EXCLUDEFROMCAPTURE = 0x11;

let setWindowDisplayAffinity = null;

if (process.platform === 'win32') {
  try {
    const ffi = require('ffi-napi');
    const user32 = ffi.Library('user32', {
      SetWindowDisplayAffinity: ['bool', ['int64', 'uint32']],
    });
    setWindowDisplayAffinity = user32.SetWindowDisplayAffinity;
  } catch (err) {
    if (process.env.DEBUG_CAPTURE_EXCLUDE) {
      console.warn(
        '[win32-capture-exclude] FFI failed to load. Install build tools if needed:',
        err.message
      );
    }
  }
}

const WDA_NONE = 0x0;

/**
 * Excludes or includes the given BrowserWindow in screen capture.
 * Only runs on Windows. No-op on other platforms.
 * Falls back to Electron's setContentProtection if FFI is unavailable.
 *
 * @param {Electron.BrowserWindow} win - The BrowserWindow to modify
 * @param {boolean} exclude - true to exclude (protect), false to include (reveal)
 * @returns {boolean} - true if changes were applied, false otherwise
 */
function setWindowCaptureExclusion(win, exclude) {
  if (!win || win.isDestroyed()) return false;

  if (process.platform === 'darwin') {
    try {
      win.setContentProtection(exclude);
      return true;
    } catch (err) {
      console.warn('[mac-capture-exclude] setContentProtection failed:', err.message);
      return false;
    }
  }

  if (process.platform !== 'win32') {
    return false;
  }

  const affinity = exclude ? WDA_EXCLUDEFROMCAPTURE : WDA_NONE;

  // Try native SetWindowDisplayAffinity via FFI first
  if (setWindowDisplayAffinity) {
    try {
      const hwndBuf = win.getNativeWindowHandle();
      if (hwndBuf && hwndBuf.length > 0) {
        // HWND is pointer-sized: 64-bit on x64, 32-bit on x86
        const hwndValue =
          process.arch === 'x64'
            ? hwndBuf.readBigInt64LE(0)
            : BigInt(hwndBuf.readUInt32LE(0));

        const result = setWindowDisplayAffinity(hwndValue, affinity);
        if (result) return true;
      }
    } catch (err) {
      console.warn('[win32-capture-exclude] FFI call failed:', err.message);
    }
  }

  // Fallback: Electron's built-in setContentProtection
  try {
    if (typeof win.setContentProtection === 'function') {
      win.setContentProtection(exclude);
      return true;
    }
  } catch (err) {
    console.warn('[win32-capture-exclude] setContentProtection fallback failed:', err.message);
  }

  return false;
}

/**
 * Excludes the given BrowserWindow from screen capture.
 * Only runs on Windows. No-op on other platforms.
 * Falls back to Electron's setContentProtection if FFI is unavailable.
 *
 * @param {Electron.BrowserWindow} win - The BrowserWindow to protect
 * @returns {boolean} - true if exclusion was applied, false otherwise
 */
function excludeWindowFromCapture(win) {
  return setWindowCaptureExclusion(win, true);
}

module.exports = { excludeWindowFromCapture, setWindowCaptureExclusion };
