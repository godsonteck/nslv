// ============================================
// NS LUXURY VILLA — Electron Preload Script
// Context bridge for safe IPC communication
// ============================================

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  sendSyncTrigger: () => ipcRenderer.send('trigger-sync'),
  onSyncStatus: (callback: (status: unknown) => void) =>
    ipcRenderer.on('sync-status', (_event: any, value: any) => callback(value)),
});
