// Praelecta desktop: a dedicated window around the web app.
//
// The app itself is https://praelecta.ca, loaded live. Nothing is bundled
// except this shell, so every fix that ships to the site is in the desktop
// app the next time it opens, with no update to download. What the shell
// adds over a browser tab: its own dock / taskbar icon, a window that
// remembers its size, microphone access handled once at the OS level,
// external links going to the system browser, and no tab to lose mid-lecture.

const { app, BrowserWindow, Menu, session, shell, systemPreferences } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_URL = 'https://praelecta.ca';
const APP_ORIGIN = new URL(APP_URL).origin;

// Hosts that may load inside the app window. Everything else opens in the
// system browser. Sign-in providers and Stripe have to stay in-window because
// they redirect back to praelecta.ca to finish.
const IN_APP_HOSTS = [
  /(^|\.)praelecta\.ca$/,
  /\.supabase\.co$/,
  /(^|\.)accounts\.google\.com$/,
  /(^|\.)appleid\.apple\.com$/,
  /(^|\.)checkout\.stripe\.com$/,
  /(^|\.)billing\.stripe\.com$/,
];

function isInAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'file:') return true;
    if (url.protocol !== 'https:') return false;
    return IN_APP_HOSTS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

// Google refuses OAuth sign-in from anything that announces itself as an
// embedded browser, and the stock Electron user agent does exactly that.
// Present as the Chrome build we actually are, plus one token of our own so
// the site can tell it is running inside the desktop app.
function desktopUserAgent() {
  return `${app.userAgentFallback
    .replace(/\s?praelecta-desktop\/\S+/i, '')
    .replace(/\s?Electron\/\S+/, '')} PraelectaDesktop/${app.getVersion()}`;
}

// ---- window state -------------------------------------------------------

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function readWindowState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (parsed && Number.isFinite(parsed.width) && Number.isFinite(parsed.height)) return parsed;
  } catch {
    // First launch, or an unreadable file: fall through to the defaults.
  }
  return { width: 1280, height: 840 };
}

function saveWindowState(win) {
  try {
    if (win.isMinimized() || win.isFullScreen()) return;
    const bounds = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }));
  } catch {
    // Not worth surfacing; the window just opens at the default size next time.
  }
}

// ---- window -------------------------------------------------------------

let mainWindow = null;

function createWindow() {
  const state = readWindowState();
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    // Matches the app's own dark base so there is no white flash before load.
    backgroundColor: '#0e1421',
    autoHideMenuBar: true,
    title: 'Praelecta',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  if (state.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());

  const persist = () => mainWindow && saveWindowState(mainWindow);
  mainWindow.on('resize', persist);
  mainWindow.on('move', persist);
  mainWindow.on('close', persist);
  mainWindow.on('closed', () => { mainWindow = null; });

  const { webContents } = mainWindow;

  // In-app hosts navigate in place; anything else is the system browser's job.
  webContents.on('will-navigate', (event, url) => {
    if (isInAppUrl(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  webContents.setWindowOpenHandler(({ url }) => {
    // The app opens a blank window to print transcripts and study guides;
    // that has to stay a real window.
    if (url === 'about:blank' || url === '') return { action: 'allow' };
    if (isInAppUrl(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Keep the window title ours rather than whatever the page sets.
  webContents.on('page-title-updated', (event) => event.preventDefault());

  // Offline or the site unreachable: show the shell's own page with a retry,
  // not Chromium's grey error. -3 is ERR_ABORTED (a navigation we cancelled
  // ourselves), which is not a failure.
  webContents.on('did-fail-load', (_event, errorCode, _description, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    mainWindow.loadFile(path.join(__dirname, 'offline.html'), { query: { from: validatedUrl } });
  });

  mainWindow.loadURL(APP_URL);
}

// ---- permissions --------------------------------------------------------

function installPermissionHandlers() {
  const ses = session.defaultSession;

  const allowedForOrigin = (requestingOrigin, permission, details) => {
    if (requestingOrigin !== APP_ORIGIN) return false;
    if (permission === 'media') {
      // Microphone only. The app never asks for the camera.
      const types = details?.mediaTypes;
      return !types || (types.length > 0 && types.every((t) => t === 'audio'));
    }
    return ['notifications', 'clipboard-sanitized-write', 'fullscreen'].includes(permission);
  };

  ses.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    const origin = safeOrigin(details?.requestingUrl || webContents.getURL());
    if (!allowedForOrigin(origin, permission, details)) return callback(false);
    if (permission === 'media' && process.platform === 'darwin') {
      // macOS needs the OS-level prompt answered before getUserMedia works.
      const granted = await systemPreferences.askForMediaAccess('microphone');
      return callback(granted);
    }
    callback(true);
  });

  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    return allowedForOrigin(safeOrigin(requestingOrigin), permission, details);
  });
}

function safeOrigin(rawUrl) {
  try { return new URL(rawUrl).origin; } catch { return null; }
}

// ---- menu ---------------------------------------------------------------

function installMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { label: 'Go to Today', accelerator: 'CmdOrCtrl+Shift+T', click: () => mainWindow?.loadURL(`${APP_URL}/today`) },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Email support', click: () => shell.openExternal('mailto:help@praelecta.ca') },
        { label: 'Privacy policy', click: () => shell.openExternal(`${APP_URL}/privacy`) },
        { label: 'Terms', click: () => shell.openExternal(`${APP_URL}/terms`) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- lifecycle ----------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.setAppUserModelId('ca.praelecta.desktop');
  app.userAgentFallback = desktopUserAgent();

  app.whenReady().then(() => {
    installPermissionHandlers();
    installMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
