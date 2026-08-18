import { create } from 'zustand';
import { themeApi, type ThemeConfig } from '../services/apiService';

export type ThemePreference = 'light' | 'dark' | 'system';

const DEFAULT_THEME: ThemeConfig = {
  villaName: 'NS Luxury Villa',
  villaTagline: 'Property Operations',
  logoUrl: undefined,
  loginBgUrl: undefined,
  primaryColor: '#16a4d4',
  secondaryColor: '#f1a83f',
  accentColor: '#1cecd4',
  bgColor: '#f5f6f4',
  textColor: '#14232b',
  textMuted: '#7a858a',
  borderColor: '#e5e8e5',
  successColor: '#2d8a68',
  warningColor: '#d97706',
  errorColor: '#dc2626',
  infoColor: '#0284c7',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  headingFont: 'Manrope, sans-serif',
  customCss: undefined,
  useCustomLogin: false,
  enableDarkMode: false,
};

const THEME_CACHE_KEY = 'nslv_theme_config';
const PREF_CACHE_KEY = 'nslv_theme_preference';

function getInitialTheme(): ThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached) {
      return { ...DEFAULT_THEME, ...JSON.parse(cached) };
    }
  } catch {
    // Ignore JSON parsing errors and use default
  }
  return DEFAULT_THEME;
}

function getInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(PREF_CACHE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return getInitialTheme().enableDarkMode ? 'dark' : 'light';
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true;
}

function resolveDark(theme: ThemeConfig | null, preference: ThemePreference | null): boolean {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  if (preference === 'system') return prefersDark();
  return Boolean(theme?.enableDarkMode);
}

const initialTheme = getInitialTheme();
const initialPreference = getInitialPreference();

function applyThemeDirect(theme: ThemeConfig | null, preference: ThemePreference | null) {
  if (!theme || typeof document === 'undefined') return;

  const root = document.documentElement;
  const dark = resolveDark(theme, preference);

  root.setAttribute('data-theme', dark ? 'dark' : 'light');

  root.style.setProperty('--color-primary', theme.primaryColor);
  root.style.setProperty('--color-secondary', theme.secondaryColor);
  root.style.setProperty('--color-accent', theme.accentColor);
  root.style.setProperty('--color-bg', theme.bgColor);
  root.style.setProperty('--color-text', theme.textColor);
  root.style.setProperty('--color-text-muted', theme.textMuted);
  root.style.setProperty('--color-border', theme.borderColor);
  root.style.setProperty('--color-success', theme.successColor);
  root.style.setProperty('--color-warning', theme.warningColor);
  root.style.setProperty('--color-error', theme.errorColor);
  root.style.setProperty('--color-info', theme.infoColor);

  root.style.setProperty('--font-family', theme.fontFamily);
  root.style.setProperty('--font-heading', theme.headingFont);
  root.style.setProperty('--ns-bg', dark ? '#0b1220' : '#f5f6f4');
  root.style.setProperty('--ns-surface', dark ? '#121a27' : '#ffffff');
  root.style.setProperty('--ns-surface-2', dark ? '#1a2433' : '#fafaf8');
  root.style.setProperty('--ns-line', dark ? '#2a3747' : '#e6e8e5');
  root.style.setProperty('--ns-ink', dark ? '#edf4f9' : '#14232b');
  root.style.setProperty('--ns-ink-2', dark ? '#dfeaf3' : '#20343e');
  root.style.setProperty('--ns-muted', dark ? '#9ab0c0' : '#7a858a');

  const body = document.body;
  if (body) {
    body.style.background = dark ? 'var(--ns-bg)' : 'var(--ns-bg)';
    body.style.color = dark ? 'var(--ns-ink)' : 'var(--ns-ink)';
  }
}

// Immediately apply cached theme on startup (0ms FOUC)
applyThemeDirect(initialTheme, initialPreference);

// Keep the theme in sync when the OS dark-mode preference changes (system mode)
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    useThemeStore.getState().applyTheme();
  });
}

interface ThemeStore {
  theme: ThemeConfig | null;
  isLoading: boolean;
  themePreference: ThemePreference;
  effectiveDark: boolean;

  // Actions
  loadTheme: () => Promise<void>;
  updateTheme: (config: Partial<ThemeConfig>) => Promise<void>;
  resetTheme: () => Promise<void>;
  setThemePreference: (preference: ThemePreference) => void;
  applyTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  isLoading: false,
  themePreference: initialPreference,
  effectiveDark: resolveDark(initialTheme, initialPreference),

  loadTheme: async () => {
    try {
      const result = await themeApi.getTheme();
      const themeData = result.data ?? DEFAULT_THEME;
      set({ theme: themeData });
      try {
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(themeData));
      } catch {}
      get().applyTheme();
    } catch (error) {
      console.error('Failed to load theme:', error);
      get().applyTheme();
    } finally {
      set({ isLoading: false });
    }
  },

  updateTheme: async (config: Partial<ThemeConfig>) => {
    try {
      const result = await themeApi.updateTheme(config);
      const updatedTheme = result.data ?? { ...get().theme, ...config } as ThemeConfig;
      set({ theme: updatedTheme });
      try {
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(updatedTheme));
      } catch {}
      get().applyTheme();
    } catch (error) {
      console.error('Failed to update theme:', error);
      throw error;
    }
  },

  resetTheme: async () => {
    try {
      const result = await themeApi.resetTheme();
      const resetThemeData = result.data ?? DEFAULT_THEME;
      set({ theme: resetThemeData });
      try {
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(resetThemeData));
      } catch {}
      get().applyTheme();
    } catch (error) {
      console.error('Failed to reset theme:', error);
      throw error;
    }
  },

  setThemePreference: (preference: ThemePreference) => {
    try {
      localStorage.setItem(PREF_CACHE_KEY, preference);
    } catch {}
    set({ themePreference: preference });
    get().applyTheme();
  },

  applyTheme: () => {
    const { theme, themePreference } = get();
    const dark = resolveDark(theme, themePreference);
    set({ effectiveDark: dark });
    applyThemeDirect(theme, themePreference);
  },
}));