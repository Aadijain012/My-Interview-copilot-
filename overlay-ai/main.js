// Stub browser canvas/DOM primitives for headless pdf.js in Node/Electron environment
if (typeof process !== 'undefined' && !process.getBuiltinModule) {
  process.getBuiltinModule = (mod) => { try { return require(mod); } catch (_) { return null; } };
}
if (typeof global !== 'undefined') {
  if (typeof global.DOMMatrix === 'undefined') global.DOMMatrix = class DOMMatrix {};
  if (typeof global.ImageData === 'undefined') global.ImageData = class ImageData {};
  if (typeof global.Path2D === 'undefined') global.Path2D = class Path2D {};
}

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');

// Register node_modules search paths so all backend services (fluent-ffmpeg, pdf-parse, etc.) resolve cleanly in Electron
const backendNmPaths = [
  path.join(__dirname, 'node_modules'),
  path.join(__dirname, '../../Kairos-Backend/node_modules'),
  path.join(__dirname, '../Kairos-Backend/node_modules'),
  path.join(__dirname, '../backend/node_modules'),
  path.join(process.cwd(), 'node_modules'),
  path.join(process.cwd(), 'Kairos-Backend/node_modules'),
  path.join(process.cwd(), '../Kairos-Backend/node_modules'),
  path.join(process.cwd(), '../../Kairos-Backend/node_modules')
];
for (const p of backendNmPaths) {
  if (fs.existsSync(p)) {
    Module.globalPaths.push(p);
  }
}
if (process.env.NODE_PATH) {
  process.env.NODE_PATH += ';' + backendNmPaths.join(';');
} else {
  process.env.NODE_PATH = backendNmPaths.join(';');
}
Module._initPaths();

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const { app, BrowserWindow, desktopCapturer, session, dialog, globalShortcut, screen, ipcMain } = require('electron');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// app.disableHardwareAcceleration();

// Resolve cache lock & "Access is denied" conflicts by using a unique temp profile folder
const userDataPath = path.join(app.getPath('temp'), 'my-interview-copilot-userdata');
app.setPath('userData', userDataPath);

// Persistent Device Identifier for Device Binding and Tracking
function getOrCreateAppDeviceId() {
  try {
    const idFilePath = path.join(app.getPath('userData'), 'device-identifier.json');
    if (fs.existsSync(idFilePath)) {
      const data = JSON.parse(fs.readFileSync(idFilePath, 'utf8'));
      if (data && typeof data.deviceId === 'string' && data.deviceId.trim()) {
        return data.deviceId.trim();
      }
    }
    const newDeviceId = (crypto.randomUUID && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');
    const record = {
      deviceId: newDeviceId,
      createdAt: new Date().toISOString()
    };
    fs.mkdirSync(path.dirname(idFilePath), { recursive: true });
    fs.writeFileSync(idFilePath, JSON.stringify(record, null, 2), 'utf8');
    return newDeviceId;
  } catch (err) {
    console.warn('[electron] Failed to read/write device-identifier.json:', err.message);
    if (!global._fallbackDeviceId) {
      global._fallbackDeviceId = (crypto.randomUUID && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString('hex');
    }
    return global._fallbackDeviceId;
  }
}

ipcMain.handle('get-device-id', async () => getOrCreateAppDeviceId());

ipcMain.on('get-device-id-sync', (event) => {
  event.returnValue = getOrCreateAppDeviceId();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Load .env - bundled first (inside installer), then exe dir, userData, backend dir, cwd
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '../../Kairos-Backend/.env'),
  path.join(__dirname, '../Kairos-Backend/.env'),
  path.join(__dirname, '../backend/.env'),
  path.join(path.dirname(app.getPath('exe')), '.env'),
  path.join(app.getPath('userData'), '.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'Kairos-Backend/.env'),
  path.join(process.cwd(), '../Kairos-Backend/.env')
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}
if (!process.env.DEEPGRAM_API_KEY) require('dotenv').config();

// Same origin as the web app (VITE_API_URL / API_URL). Persist runs in the main process, so browser CORS does not apply.
const API_BASE_URL = String(
  process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:4000'
).replace(/\/$/, '');

const { setupIpcHandlers, setCaptureWindow, setInterviewAuth, setTeleprompterWindow, setTopBarWindow } = require('./src/ipcHandlers');
const { excludeWindowFromCapture, setWindowCaptureExclusion } = require('./win32-capture-exclude');

let mainWindow = null;
let pendingAuthSession = null;
let backendProcess = null;
let teleprompterWindow = null;
let topBarWindow = null;
let isExcludedFromCapture = true; // By default, overlay is invisible on screen share

const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:5173';
function getDistPath() {
  const candidates = [
    path.join(__dirname, 'frontend_dist/index.html'),
    path.join(app.getAppPath(), 'frontend_dist/index.html'),
    path.join(process.resourcesPath || '', 'frontend_dist/index.html'),
    path.join(process.resourcesPath || '', 'app.asar/frontend_dist/index.html'),
    path.join(__dirname, '../../Kairos-Frontend/dist/index.html'),
    path.join(__dirname, '../Kairos-Frontend/dist/index.html'),
    path.join(__dirname, '../frontend/dist/index.html'),
    path.join(__dirname, '../../frontend/dist/index.html'),
    path.join(__dirname, './dist/index.html'),
    path.join(app.getAppPath(), 'dist/index.html')
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return path.join(__dirname, 'frontend_dist/index.html');
}
const DIST_PATH = getDistPath();

const http = require('http');
const { fork } = require('child_process');

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/api/health`, () => resolve(true));
    req.on('error', () => {
      const req2 = http.get(`http://${host}:${port}/`, () => resolve(true));
      req2.on('error', () => resolve(false));
      req2.setTimeout(500, () => { try { req2.destroy(); } catch (_) {} resolve(false); });
    });
    req.setTimeout(500, () => { try { req.destroy(); } catch (_) {} resolve(false); });
  });
}

async function startBackendServerIfNeeded() {
  const backendPort = 4000;
  const isRunning = await isPortOpen(backendPort);
  if (isRunning) {
    console.log(`[main] Backend server is already running on port ${backendPort}.`);
    return;
  }

  const backendServerCandidates = [
    path.join(__dirname, '../../Kairos-Backend/server.js'),
    path.join(__dirname, '../Kairos-Backend/server.js'),
    path.join(__dirname, '../../backend/server.js'),
    path.join(__dirname, '../backend/server.js'),
    path.join(process.cwd(), 'Kairos-Backend/server.js'),
    path.join(process.cwd(), '../Kairos-Backend/server.js'),
    path.join(process.cwd(), '../../Kairos-Backend/server.js')
  ];

  let serverScript = null;
  for (const candidate of backendServerCandidates) {
    if (fs.existsSync(candidate)) {
      serverScript = candidate;
      break;
    }
  }

  if (serverScript) {
    console.log(`[main] Auto-starting backend server from: ${serverScript}`);
    try {
      backendProcess = fork(serverScript, [], {
        cwd: path.dirname(serverScript),
        env: { ...process.env, PORT: String(backendPort) },
        stdio: 'inherit'
      });
      backendProcess.on('error', (err) => {
        console.error('[main] Backend server process error:', err);
      });
      backendProcess.on('exit', (code, signal) => {
        if (code !== 0) {
          console.log(`[main] Backend server process exited (${code}). Electron is operating in native embedded mode.`);
        }
        backendProcess = null;
      });
      console.log('[main] Backend server process spawned successfully.');
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const ready = await isPortOpen(backendPort);
        if (ready) {
          console.log(`[main] Backend server is ready and listening on port ${backendPort}.`);
          break;
        }
      }
    } catch (err) {
      console.error('[main] Failed to spawn backend server:', err);
    }
  } else {
    console.warn('[main] Kairos-Backend server.js not found in candidate paths. Running in standalone embedded mode.');
  }
}

let isViteRunning = false;
async function checkViteDevServer() {
  isViteRunning = await isPortOpen(5173);
}

function loadWindowContent(win, windowName) {
  const isChild = (windowName === 'teleprompter' || windowName === 'topbar') ? '&isChild=true' : '';
  
  // Clear session cache to prevent caching old Vite assets
  try {
    win.webContents.session.clearCache().catch(() => {});
  } catch (_) {}

  if (isDev && isViteRunning) {
    win.loadURL(`${DEV_URL}?window=${windowName}${isChild}`).catch(() => {
      win.loadFile(DIST_PATH, { search: `window=${windowName}${isChild}` }).catch((err2) => {
        console.error('[main] Failed to load fallback built file:', err2);
      });
    });
  } else {
    win.loadFile(DIST_PATH, { search: `window=${windowName}${isChild}` }).catch((err) => {
      console.error(`[main] Failed to load built file for ${windowName}:`, err);
    });
  }
}

function registerZoomShortcuts(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isControl = input.control || input.meta;
      if (isControl) {
        if (input.key === '=' || input.key === '+') {
          try {
            const currentZoom = win.webContents.getZoomLevel();
            win.webContents.setZoomLevel(currentZoom + 0.5);
            event.preventDefault();
          } catch (e) {
            console.error('Failed to zoom in:', e);
          }
        } else if (input.key === '-') {
          try {
            const currentZoom = win.webContents.getZoomLevel();
            win.webContents.setZoomLevel(Math.max(-3, currentZoom - 0.5));
            event.preventDefault();
          } catch (e) {
            console.error('Failed to zoom out:', e);
          }
        } else if (input.key === '0') {
          try {
            win.webContents.setZoomLevel(0);
            event.preventDefault();
          } catch (e) {
            console.error('Failed to reset zoom:', e);
          }
        }
      }
    }
  });
}

function createMainWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 1440;
  const windowHeight = 900;

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    frame: false,
    transparent: false,
    backgroundColor: '#13131f',
    resizable: true,
    title: 'My Interview Copilot',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  });
  mainWindow.customType = 'copilot-main';
  setCaptureWindow(mainWindow);

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`[main] Renderer process gone (reason: ${details.reason}, code: ${details.exitCode})`);
    try {
      const logPath = path.join(__dirname, 'renderer_error.log');
      const msg = `[${new Date().toISOString()}] Renderer Process Gone: ${details.reason} (Code: ${details.exitCode})\n\n`;
      fs.appendFileSync(logPath, msg, 'utf8');
    } catch (_) {}
    if (details.reason !== 'killed' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  mainWindow.maximize();
  mainWindow.setBackgroundColor('#13131f');

  loadWindowContent(mainWindow, 'auth');
  registerZoomShortcuts(mainWindow);

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingAuthSession) {
      mainWindow.webContents.send('auth-session', pendingAuthSession);
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[renderer console] [Level:${level}] ${message} (Line:${line}, Source:${sourceId})`);
  });

  mainWindow.webContents.closeDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
    setCaptureWindow(null);
  });
}

function createTeleprompterWindow() {
  if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
    teleprompterWindow.focus();
    return;
  }

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 380;
  const windowHeight = 480;

  teleprompterWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    title: 'Teleprompter & Notepad',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  });
  teleprompterWindow.customType = 'teleprompter';

  loadWindowContent(teleprompterWindow, 'teleprompter');
  registerZoomShortcuts(teleprompterWindow);

  teleprompterWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`[main] Teleprompter renderer gone (reason: ${details.reason}, code: ${details.exitCode})`);
    try {
      const logPath = path.join(__dirname, 'renderer_error.log');
      const msg = `[${new Date().toISOString()}] Teleprompter Renderer Process Gone: ${details.reason} (Code: ${details.exitCode})\n\n`;
      fs.appendFileSync(logPath, msg, 'utf8');
    } catch (_) {}
    if (details.reason !== 'killed' && teleprompterWindow && !teleprompterWindow.isDestroyed()) {
      teleprompterWindow.reload();
    }
  });

  teleprompterWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  teleprompterWindow.setAlwaysOnTop(true, 'screen-saver');
  setWindowCaptureExclusion(teleprompterWindow, isExcludedFromCapture);
  setTeleprompterWindow(teleprompterWindow);

  teleprompterWindow.on('closed', () => {
    teleprompterWindow = null;
    setTeleprompterWindow(null);
  });
}

function createTopBarWindow() {
  if (topBarWindow && !topBarWindow.isDestroyed()) {
    topBarWindow.focus();
    return;
  }

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 1000;
  const windowHeight = 45;

  topBarWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    title: 'Top Bar Overlay',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  });
  topBarWindow.customType = 'topbar';

  loadWindowContent(topBarWindow, 'topbar');
  registerZoomShortcuts(topBarWindow);

  topBarWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`[main] TopBar renderer gone (reason: ${details.reason}, code: ${details.exitCode})`);
    try {
      const logPath = path.join(__dirname, 'renderer_error.log');
      const msg = `[${new Date().toISOString()}] TopBar Renderer Process Gone: ${details.reason} (Code: ${details.exitCode})\n\n`;
      fs.appendFileSync(logPath, msg, 'utf8');
    } catch (_) {}
    if (details.reason !== 'killed' && topBarWindow && !topBarWindow.isDestroyed()) {
      topBarWindow.reload();
    }
  });

  topBarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  topBarWindow.setAlwaysOnTop(true, 'screen-saver');
  setWindowCaptureExclusion(topBarWindow, isExcludedFromCapture);
  setTopBarWindow(topBarWindow);

  topBarWindow.on('closed', () => {
    topBarWindow = null;
    setTopBarWindow(null);
  });
}

function setDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      let sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 1, height: 1 },
      });
      if (!sources || sources.length === 0) {
        console.warn('[main] desktopCapturer returned empty sources, retrying in 100ms...');
        await new Promise(resolve => setTimeout(resolve, 100));
        sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 1, height: 1 },
        });
      }
      const primaryScreen =
        sources.find(
          (s) =>
            s.display_id === '0' ||
            s.name?.toLowerCase().includes('screen') ||
            s.name?.toLowerCase().includes('display')
        ) || sources[0];
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
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
}

app.whenReady().then(async () => {
  await startBackendServerIfNeeded();
  await checkViteDevServer();
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

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('translate.google.com')) {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      details.requestHeaders['Referer'] = 'https://translate.google.com/';
    }
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  app.on('web-contents-created', (event, webContents) => {
    const ses = webContents.session;
    if (ses) {
      ses.setPermissionRequestHandler(handlePermissionRequest);
      ses.setPermissionCheckHandler(handlePermissionCheck);
    }
  });

  // Warm up desktop capturer to cache screen/window handles and prevent the first-click timeout/glitch
  try {
    desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1, height: 1 } })
      .then(() => console.log('[main] Desktop capturer successfully warmed up.'))
      .catch(err => console.error('[main] Desktop capturer warmup error:', err));
  } catch (err) {
    console.error('[main] Desktop capturer warmup fail:', err);
  }

  setDisplayMediaHandler();
  setupIpcHandlers();

  ipcMain.on('log-renderer-error', (event, errorInfo) => {
    try {
      const logPath = path.join(__dirname, 'renderer_error.log');
      const msg = `[${new Date().toISOString()}] Renderer Error: ${errorInfo.message}\nStack: ${errorInfo.stack || 'no stack'}\nDetails: ${JSON.stringify(errorInfo.details || {})}\n\n`;
      fs.appendFileSync(logPath, msg, 'utf8');
      console.error('[renderer-error-ipc]', errorInfo.message, errorInfo.stack);
    } catch (err) {
      console.error('[main] Failed to write renderer error log:', err);
    }
  });
  
  // Standalone Electron desktop mode: All backend features run natively via IPC handlers
  console.log('[main] Embedded native backend initialized.');

  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  createMainWindow();

  ipcMain.on('auth-login-success', (event, payload) => {
    pendingAuthSession = payload || null;
    setInterviewAuth(pendingAuthSession?.token || null, API_BASE_URL);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      const targetView = payload?.targetView || 'overlay';
      
      if (targetView === 'overlay') {
        mainWindow.setBackgroundColor('#13131f');
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        setWindowCaptureExclusion(mainWindow, isExcludedFromCapture);
        setCaptureWindow(mainWindow);
      } else if (targetView === 'notetaker') {
        mainWindow.setBackgroundColor('#13131f');
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setVisibleOnAllWorkspaces(false);
        setCaptureWindow(mainWindow);
      } else {
        mainWindow.setBackgroundColor('#13131f');
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setVisibleOnAllWorkspaces(false);
        setCaptureWindow(null);
      }
      
      mainWindow.webContents.send('auth-session', pendingAuthSession);
      const viewToMain = (targetView === 'teleprompter' || targetView === 'topbar') ? 'overlay' : targetView;
      mainWindow.webContents.send('change-view', viewToMain);
    }
  });

  ipcMain.on('current-view-changed', (event, viewType) => {
    if (mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents) {
      if (viewType === 'overlay') {
        mainWindow.setBackgroundColor('#13131f');
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        setWindowCaptureExclusion(mainWindow, isExcludedFromCapture);
        setCaptureWindow(mainWindow);
      } else if (viewType === 'notetaker') {
        mainWindow.setBackgroundColor('#13131f');
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setVisibleOnAllWorkspaces(false);
        setCaptureWindow(mainWindow);
      } else {
        mainWindow.setBackgroundColor('#13131f');
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setVisibleOnAllWorkspaces(false);
        setCaptureWindow(null);
      }
    }
  });

  ipcMain.on('go-back-to-auth', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor('#13131f');
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setVisibleOnAllWorkspaces(false);
      setCaptureWindow(null);
      
      pendingAuthSession = null;
      setInterviewAuth(null, API_BASE_URL);
      
      mainWindow.webContents.send('change-view', 'auth');
    }
  });

  ipcMain.on('go-back-to-auth-keep-session', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor('#13131f');
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setVisibleOnAllWorkspaces(false);
      setCaptureWindow(null);
      
      mainWindow.webContents.send('change-view', 'auth');
    }
  });

  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  ipcMain.on('open-teleprompter', () => {
    if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
      teleprompterWindow.close();
      teleprompterWindow = null;
    } else {
      createTeleprompterWindow();
    }
  });

  ipcMain.on('open-topbar', () => {
    if (topBarWindow && !topBarWindow.isDestroyed()) {
      topBarWindow.close();
      topBarWindow = null;
    } else {
      createTopBarWindow();
    }
  });

  ipcMain.on('toggle-screen-share-visibility', (event) => {
    isExcludedFromCapture = !isExcludedFromCapture;

    if (mainWindow && !mainWindow.isDestroyed()) {
      setWindowCaptureExclusion(mainWindow, isExcludedFromCapture);
      mainWindow.webContents.send('screen-share-visibility-status', isExcludedFromCapture);
    }
    if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
      setWindowCaptureExclusion(teleprompterWindow, isExcludedFromCapture);
      teleprompterWindow.webContents.send('screen-share-visibility-status', isExcludedFromCapture);
    }
    if (topBarWindow && !topBarWindow.isDestroyed()) {
      setWindowCaptureExclusion(topBarWindow, isExcludedFromCapture);
      topBarWindow.webContents.send('screen-share-visibility-status', isExcludedFromCapture);
    }
  });

  ipcMain.on('get-screen-share-visibility-status', (event) => {
    event.reply('screen-share-visibility-status', isExcludedFromCapture);
  });

  globalShortcut.register('CommandOrControl+Shift+O', toggleOverlay);

  console.log('\nAI Interview Assistant running.');
  console.log('Press Ctrl+Shift+O to toggle overlay.\n');
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createMainWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (backendProcess) {
    console.log('[main] Killing backend server...');
    backendProcess.kill();
  }
  if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
    console.log('[main] Destroying teleprompter window...');
    teleprompterWindow.destroy();
  }
  if (topBarWindow && !topBarWindow.isDestroyed()) {
    console.log('[main] Destroying top bar window...');
    topBarWindow.destroy();
  }
});
