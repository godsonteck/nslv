// ============================================
// NS LUXURY VILLA — Electron Main Process
// Application window lifecycle, cloud connectivity & offline handling
// ============================================

import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'NS Luxury Villa Management System',
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

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Priority logic for Desktop App URL:
  // 1. Remote App URL (if configured via env, e.g. Vercel deployment URL)
  // 2. Local dev server (if unpackaged `electron .`)
  // 3. Built local HTML bundle (extraResources client-dist)
  const remoteUrl = process.env.REMOTE_APP_URL || process.env.VITE_APP_URL;

  if (remoteUrl) {
    console.log(`[DESKTOP] Loading remote live cloud URL: ${remoteUrl}`);
    mainWindow.loadURL(remoteUrl);
  } else if (!app.isPackaged) {
    console.log('[DESKTOP] Loading local development server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('[DESKTOP] Loading packaged production client assets');
    mainWindow.loadFile(path.join(process.resourcesPath, 'client-dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

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
