// ============================================
// NS LUXURY VILLA — Electron Main Process
// Live Cloud Desktop Shell — connects to Vercel deployment
// ============================================

import { app, BrowserWindow, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';

// The live production URL — always loads the Vercel cloud deployment
const LIVE_APP_URL = 'https://nsluxury.vercel.app';

let mainWindow: BrowserWindow | null = null;

function startAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const checkForUpdate = () => {
    void autoUpdater.checkForUpdates().catch((error: Error) => {
      // Network/feed failures must never prevent the live system from opening.
      console.warn('[AUTO-UPDATE] Update check skipped:', error.message);
    });
  };

  autoUpdater.on('update-available', () => {
    console.log('[AUTO-UPDATE] Update available, downloading...');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[AUTO-UPDATE] Update downloaded; it will install when the app closes.');
  });

  autoUpdater.on('error', (error) => {
    console.warn('[AUTO-UPDATE] Updater error:', error.message);
  });

  checkForUpdate();
  const updateTimer = setInterval(checkForUpdate, 6 * 60 * 60 * 1000);
  updateTimer.unref();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'NS Luxury Villa Management System',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links (e.g. payment portals) in OS browser, not in-app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // In development, load local vite dev server; in production, always go LIVE
  if (!app.isPackaged) {
    console.log('[DESKTOP] DEV: Loading local development server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Always connect to the live cloud deployment — no local server needed
    console.log(`[DESKTOP] PRODUCTION: Connecting to live cloud → ${LIVE_APP_URL}`);
    mainWindow.loadURL(LIVE_APP_URL).catch((err) => {
      console.error('[DESKTOP] Failed to connect to live app:', err);
    });

    // Ctrl+Shift+I opens DevTools for diagnostics
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow?.webContents.openDevTools();
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  startAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
