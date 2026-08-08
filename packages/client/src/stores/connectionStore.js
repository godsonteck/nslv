// ============================================
// NS LUXURY VILLA — Connection & Sync Store
// Real-time online/offline and sync tracking
// ============================================
import { create } from 'zustand';
export const useConnectionStore = create((set) => ({
    mode: 'ONLINE',
    pendingSyncCount: 0,
    lastSyncedAt: new Date().toISOString(),
    errorMessage: null,
    setMode: (mode) => set({ mode }),
    setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
    setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
    setError: (errorMessage) => set({ errorMessage, mode: errorMessage ? 'SYNC_ERROR' : 'ONLINE' }),
}));
