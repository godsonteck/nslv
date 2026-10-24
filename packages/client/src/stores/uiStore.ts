import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const SIDEBAR_STORAGE_KEY = 'nslv_sidebar_open';

function getInitialSidebarOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) return saved === 'true';
  } catch {}
  return true;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: getInitialSidebarOpen(),
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarOpen;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {}
      return { sidebarOpen: next };
    }),
  setSidebarOpen: (open: boolean) => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
    } catch {}
    set({ sidebarOpen: open });
  },
}));
