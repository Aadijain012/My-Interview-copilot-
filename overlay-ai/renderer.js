/**
 * Renderer script for capture window.
 * UI logic - starts/stops capture, handles IPC events.
 * Transcripts are printed in the main process console.
 */

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const micBtn = document.getElementById('micBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusMsg = document.getElementById('statusMsg');

  const setStatus = (s) => {
    statusMsg.textContent = s || '';
  };

  const disableBoth = () => {
    startBtn.disabled = true;
    micBtn.disabled = true;
  };

  const enableBoth = () => {
    startBtn.disabled = false;
    micBtn.disabled = false;
    stopBtn.style.display = 'none';
  };

  startBtn.onclick = () => {
    disableBoth();
    setStatus('Starting system audio... Select a screen/window when prompted.');
    window.electronAPI?.send?.('prepare-capture', false);
  };

  micBtn.onclick = () => {
    disableBoth();
    setStatus('Requesting microphone... (allow when prompted)');
    window.electronAPI?.send?.('prepare-capture', true);
  };

  stopBtn.onclick = () => {
    window.audioCapture?.stopCapture();
  };

  window.electronAPI?.on?.('do-capture', (useMicrophone) => {
    setStatus(useMicrophone ? 'Opening microphone...' : 'Select screen to share for system audio...');
    window.audioCapture?.startCapture(useMicrophone);
  });

  window.electronAPI?.on?.('capture-started', () => {
    stopBtn.style.display = 'block';
    setStatus('Listening... Transcripts appear in the terminal.');
  });

  window.electronAPI?.on?.('capture-stopped', () => {
    enableBoth();
    setStatus('');
  });

  window.electronAPI?.on?.('capture-error', (msg) => {
    enableBoth();
    setStatus('Error: ' + (msg || 'Capture failed'));
  });
});
