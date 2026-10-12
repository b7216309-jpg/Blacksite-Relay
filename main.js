const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
const { createSaveStore } = require('./src/save-store');
const { createLocalLeaderboardStore, LIMIT: LOCAL_BOARD_LIMIT } = require('./src/local-leaderboard-store');

// Test/preview runs use separate local saves and records from the player's profile.
const testMode = process.env.RISK_V2_TEST_MODE === '1';
if (testMode) {
  if (!process.env.RISK_V2_USER_DATA_DIR) throw new Error('Test mode requires an isolated user-data directory.');
  const isolatedPath = path.resolve(process.env.RISK_V2_USER_DATA_DIR);
  fs.mkdirSync(isolatedPath, { recursive: true });
  app.setPath('userData', isolatedPath);
}
const userDataPath = path.join(app.getPath('userData'), 'user_data.json');
const saveStore = createSaveStore(userDataPath);
const leaderboardStore = createLocalLeaderboardStore(path.join(app.getPath('userData'), 'local_leaderboard.json'));
const ownsInstance = testMode || app.requestSingleInstanceLock();
let mainWindow = null;
let quitAllowed = false, quitPending = false, quitNotified = false, quitListenerReady = false;
let quitGeneration = 0, finishQuitPromise = null, saveVersion = 0, quitSaveFloor = 0, activeSaves = 0, lastGameSaveSucceeded = false;
let gameSaveDrain = Promise.resolve();
if (!ownsInstance) app.quit();

function notifyQuitRequest() {
  if (!quitPending || quitNotified || !quitListenerReady || !mainWindow || mainWindow.webContents.isDestroyed()) return;
  quitNotified = true;
  mainWindow.webContents.send('quit-requested');
}

function requestQuit() {
  if (quitAllowed) return;
  if (!quitPending) {
    quitPending = true; quitNotified = false; quitGeneration++;
    quitSaveFloor = saveVersion;
    lastGameSaveSucceeded = false; // Require a fresh successful save for this exit attempt.
  }
  notifyQuitRequest();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 650,
    useContentSize: true,
    transparent: false,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#0b101a',
    icon: path.join(__dirname, 'icon', 'icon1.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow = win;
  win.on('close', event => { if (!quitAllowed) { event.preventDefault(); requestQuit(); } });
  win.on('closed', () => { if (mainWindow === win) { mainWindow = null; quitListenerReady = false; quitNotified = false; } });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-redirect', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  // Windows rounds frameless content bounds differently at fractional DPI.
  // Measure the renderer and correct the request before revealing the portrait.
  win.once('ready-to-show', async () => {
    let requestedWidth = 420, requestedHeight = 650;
    try {
      for (let attempt = 0; attempt < 4 && !win.isDestroyed(); attempt++) {
        win.setContentSize(requestedWidth, requestedHeight);
        await new Promise(resolve => setTimeout(resolve, 40));
        if (win.isDestroyed()) return;
        const size = await win.webContents.executeJavaScript('({width: innerWidth, height: innerHeight})');
        if (size.width === 420 && size.height === 650) break;
        requestedWidth += 420 - size.width;
        requestedHeight += 650 - size.height;
      }
    } catch (_) { /* Closing during startup may destroy the renderer. */ }
    if (!win.isDestroyed() && process.env.RISK_V2_HEADLESS !== '1') win.show();
  });
}

// Accept only the main frame of this local game window, never an iframe or
// another webContents. The bridge does not grant an arbitrary URL capability.
function assertGameSender(event) {
  const contents = mainWindow?.webContents;
  if (!contents || contents.isDestroyed() || event.sender !== contents || event.senderFrame !== contents.mainFrame) throw new Error('Untrusted IPC sender.');
  try {
    if (path.resolve(fileURLToPath(event.senderFrame.url)) !== path.resolve(__dirname, 'index.html')) throw new Error();
  } catch (_) { throw new Error('Untrusted IPC sender.'); }
}

// The board belongs only to this OS user. No online service or write credential
// is involved; bridge names remain compatible with the existing renderer.
ipcMain.handle('submit-score', async (event, data) => {
  assertGameSender(event);
  if (!data || typeof data !== 'object') throw new Error('Invalid score submission.');
  try {
    await leaderboardStore.submit(data.name, data.score);
    return 'OK';
  } catch (error) {
    if (error.code === 'INVALID_RECORD') throw new Error('Invalid score submission.');
    throw new Error('Local score could not be saved. Try again.');
  }
});

ipcMain.handle('get-leaderboard', async event => {
  assertGameSender(event);
  try {
    return JSON.stringify({ scope: 'local', metric: 'best-bank-balance', limit: LOCAL_BOARD_LIMIT, entries: await leaderboardStore.read() });
  } catch (_) { throw new Error('Leaderboard unavailable. Try again shortly.'); }
});

ipcMain.handle('save-game', (event, data) => {
  assertGameSender(event);
  const version = ++saveVersion; activeSaves++; lastGameSaveSucceeded = false;
  const operation = (async () => {
    let saved = false;
    try { saved = await saveStore.save(data) === true; return saved; }
    finally { activeSaves--; if (version === saveVersion) lastGameSaveSucceeded = saved; }
  })();
  gameSaveDrain = Promise.all([gameSaveDrain, operation]).then(() => undefined, () => undefined);
  return operation;
});
ipcMain.handle('load-game', event => { assertGameSender(event); return saveStore.load(); });
ipcMain.on('close-app', event => { try { assertGameSender(event); requestQuit(); } catch (_) {} });
ipcMain.on('quit-listener-ready', (event, ready) => {
  try {
    assertGameSender(event);
    if (typeof ready !== 'boolean') return;
    quitListenerReady = ready;
    if (!ready) quitNotified = false;
    else notifyQuitRequest();
  } catch (_) {}
});
ipcMain.on('quit-cancelled', event => {
  try {
    assertGameSender(event);
    if (quitAllowed) return;
    quitPending = false; quitNotified = false; lastGameSaveSucceeded = false; quitGeneration++;
  } catch (_) {}
});
ipcMain.handle('flush-local-scores', async (event, options = {}) => {
  assertGameSender(event);
  if (!options || typeof options !== 'object' || (options.retry !== undefined && typeof options.retry !== 'boolean')) return false;
  try { return await leaderboardStore.flush({ retry: options.retry === true }) === true; } catch (_) { return false; }
});
ipcMain.handle('finish-quit', (event, options = {}) => {
  assertGameSender(event);
  if (!options || typeof options !== 'object' || (options.discard !== undefined && typeof options.discard !== 'boolean') || !quitPending || quitAllowed) return Promise.resolve(false);
  if (finishQuitPromise) return finishQuitPromise;
  const discard = options.discard === true, generation = quitGeneration, version = saveVersion;
  const savesAtStart = gameSaveDrain;
  finishQuitPromise = (async () => {
    await savesAtStart;
    let localSaved = false;
    try { localSaved = await leaderboardStore.flush({ retry: false }) === true; } catch (_) {}
    if (!quitPending || quitAllowed || generation !== quitGeneration) return false;
    if (!discard && (!localSaved || !lastGameSaveSucceeded || activeSaves > 0 || version !== saveVersion || version <= quitSaveFloor)) return false;
    quitAllowed = true;
    app.quit();
    return true;
  })().finally(() => { finishQuitPromise = null; });
  return finishQuitPromise;
});

app.on('before-quit', event => {
  if (quitAllowed || !ownsInstance) return;
  event.preventDefault(); requestQuit();
});

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(() => {
  if (ownsInstance) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && quitAllowed) app.quit();
});
