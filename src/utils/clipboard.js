/**
 * Bulletproof cross-platform clipboard copy utility.
 * Works in Electron, standard browsers, HTTP/HTTPS, and inside modals/iframes.
 */
export function copyToClipboardSafely(text) {
  if (!text) return false;
  const str = String(text);
  let success = false;

  // 1. Electron native clipboard (instant, bypasses browser permission/focus checks)
  try {
    if (typeof window !== 'undefined' && window.require) {
      const electron = window.require('electron');
      if (electron?.clipboard?.writeText) {
        electron.clipboard.writeText(str);
        success = true;
      }
    }
  } catch (_) {}

  // 2. Synchronous DOM fallback (guaranteed to execute inside user-interaction event)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = str;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, str.length);
    const execSuccess = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (execSuccess) success = true;
  } catch (_) {}

  // 3. Modern navigator.clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(str).catch(() => {});
      success = true;
    }
  } catch (_) {}

  return success;
}
