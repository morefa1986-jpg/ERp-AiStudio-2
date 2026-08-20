const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const APP_PORT = 38761;
const APP_HOST = '127.0.0.1';
const APP_URL = `http://${APP_HOST}:${APP_PORT}`;

const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const userDataPath = path.join(localAppData, 'FathiAquaSuperERP', 'UserData');
fs.mkdirSync(userDataPath, { recursive: true });
app.setPath('userData', userDataPath);

const logDir = path.join(localAppData, 'FathiAquaSuperERP', 'Logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'desktop.log');

function log(message) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {
    // Logging must never block application startup.
  }
}

let mainWindow = null;
let serverStarted = false;

function startLocalServer() {
  if (serverStarted) return;
  const appRoot = app.getAppPath();
  process.chdir(appRoot);
  process.env.NODE_ENV = 'production';
  process.env.PORT = String(APP_PORT);
  process.env.APP_VERSION = app.getVersion();
  process.env.FATHI_DESKTOP = '1';

  const serverEntry = path.join(appRoot, 'dist', 'server.cjs');
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Desktop server bundle is missing: ${serverEntry}`);
  }

  require(serverEntry);
  serverStarted = true;
  log(`Local ERP server started on ${APP_URL}`);
}

function waitForServer(timeoutMs = 25000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(`${APP_URL}/api/health`, (response) => {
        response.resume();
        if (response.statusCode === 200) return resolve();
        retry();
      });
      request.setTimeout(1500, () => request.destroy());
      request.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        return reject(new Error('Local ERP server did not become ready in time.'));
      }
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

function isLocalAppUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    return parsed.hostname === APP_HOST && Number(parsed.port || 80) === APP_PORT;
  } catch {
    return false;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#09090B',
    autoHideMenuBar: true,
    title: 'Fathi Aqua SuperERP',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocalAppUrl(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isLocalAppUrl(url)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(APP_URL);
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      startLocalServer();
      await waitForServer();
      await createMainWindow();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Startup failure: ${message}`);
      dialog.showErrorBox(
        'Fathi Aqua SuperERP - Startup Error',
        `The local ERP service could not start.\n\n${message}\n\nLog: ${logFile}`,
      );
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverStarted) createMainWindow().catch(() => {});
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

process.on('uncaughtException', (error) => log(`uncaughtException: ${error?.stack || error}`));
process.on('unhandledRejection', (error) => log(`unhandledRejection: ${error?.stack || error}`));
