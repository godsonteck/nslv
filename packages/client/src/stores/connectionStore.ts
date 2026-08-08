// ============================================
// NS LUXURY VILLA — Connection & Sync Store
// Real-time online/offline and sync tracking
// ============================================

import { create } from 'zustand';

export type ConnectionMode = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_ERROR';

interface ConnectionState {
  mode: ConnectionMode;
  pendingSyncCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;

  // Actions
  setMode: (mode: ConnectionMode) => void;
  setPendingSyncCount: (count: number) => void;
  setLastSyncedAt: (timestamp: string) => void;
  setError: (msg: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  mode: 'ONLINE',
  pendingSyncCount: 0,
  lastSyncedAt: new Date().toISOString(),
  errorMessage: null,

  setMode: (mode) => set({ mode }),
  setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setError: (errorMessage) => set({ errorMessage, mode: errorMessage ? 'SYNC_ERROR' : 'ONLINE' }),
}));
