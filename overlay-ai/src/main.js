const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, session, dialog } = require('electron');
app.disableHardwareAcceleration();
const path = require('path');
const { excludeWindowFromCapture } = require('../win32-capture-exclude');
const { setupIpcHandlers, setOverlayWindow, setCaptureWindow } = require('./ipcHandlers');
require('dotenv').config();

let overlayWindow = null;
let captureWindow = null;

function createOverlayWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 380;
  const windowHeight = 280;
  const margin = 20;

  overlayWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - margin,
    y: margin,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'));
  excludeWindowFromCapture(overlayWindow);
  setOverlayWindow(overlayWindow);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    setOverlayWindow(null);
  });
}

function createCaptureWindow() {
  const capturePath = path.join(__dirname, '../renderer/capture.html');
  captureWindow = new BrowserWindow({
    width: 500,
    height: 400,
    show: false,
    title: 'AI Assistant - Capture',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  captureWindow.webContents.on('did-fail-load', (_, code, desc, url) => {
    console.error('[capture] Load failed:', code, desc, url);
  });

  captureWindow.once('ready-to-show', () => {
    captureWindow.show();
  });

  captureWindow.loadFile(capturePath);
  setCaptureWindow(captureWindow);

  captureWindow.on('closed', () => {
    captureWindow = null;
    setCaptureWindow(null);
  });
}

function setDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
      });
      const primaryScreen = sources.find((s) => s.display_id === '0' || s.name?.toLowerCase().includes('screen') || s.name?.toLowerCase().includes('display')) || sources[0];
      if (primaryScreen) {
        callback({ video: primaryScreen, audio: 'loopback' });
      } else {
        callback({});
      }
    } catch (err) {
      console.error('[main] setDisplayMediaRequestHandler error:', err);
      callback({});
    }
  });
}

function toggleOverlay() {
  if (!overlayWindow) return;
  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    overlayWindow.show();
  }
}

app.whenReady().then(() => {
  const handlePermissionRequest = (webContents, permission, callback) => {
    const allowed = ['media', 'microphone', 'audio', 'video', 'display-capture'];
    if (allowed.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  };

  const handlePermissionCheck = (webContents, permission, origin, details) => {
    const allowed = ['media', 'microphone', 'audio', 'video', 'display-capture'];
    return allowed.includes(permission);
  };

  session.defaultSession.setPermissionRequestHandler(handlePermissionRequest);
  session.defaultSession.setPermissionCheckHandler(handlePermissionCheck);

  app.on('web-contents-created', (event, webContents) => {
    const ses = webContents.session;
    if (ses) {
      ses.setPermissionRequestHandler(handlePermissionRequest);
      ses.setPermissionCheckHandler(handlePermissionCheck);
    }
  });
  setDisplayMediaHandler();
  createOverlayWindow();
  createCaptureWindow();
  setupIpcHandlers();

  globalShortcut.register('CommandOrControl+Shift+O', toggleOverlay);
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (overlayWindow === null) createOverlayWindow();
  if (captureWindow === null) createCaptureWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
