const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');

function updateDisplay(transcript, status, isWaiting) {
  statusEl.textContent = status || 'Listening...';
  statusEl.classList.toggle('waiting', isWaiting);
  if (transcript) {
    transcriptEl.textContent = transcript;
    transcriptEl.classList.remove('empty');
  } else {
    transcriptEl.innerHTML = '<span class="placeholder">Waiting for speech...</span>';
    transcriptEl.classList.add('empty');
  }
}

if (window.electronAPI?.on) {
  window.electronAPI.on('transcript-update', ({ transcript, status, isWaiting }) => {
    updateDisplay(transcript, status, isWaiting);
  });
}
