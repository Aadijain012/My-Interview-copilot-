try {
  const { contextBridge, ipcRenderer } = require('electron');

  contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    sendAudioChunk: (arrayBuffer) => {
      if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) return;
      const buf = Buffer.from(new Uint8Array(arrayBuffer));
      if (buf.length > 0) ipcRenderer.send('audio-chunk', buf);
    },
    on: (channel, fn) => {
      const subscription = (_, ...args) => fn(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
  });
} catch (err) {
  console.error('[preload] Error:', err);
}
