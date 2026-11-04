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

type RGB = { r: number; g: number; b: number };

const DARK_BG = '#070d14';
const LIGHT_BG = '#f5f6f4';

function parseHex(value: string | undefined | null): RGB | null {
  if (typeof value !== 'string') return null;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1].length === 3
    ? match[1].split('').map((c) => c + c).join('')
    : match[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

const toHex = ({ r, g, b }: RGB) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

const channelLuminance = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: RGB) =>
  0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);

function contrastRatio(a: RGB, b: RGB) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(from: RGB, to: RGB, amount: number): RGB {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

/**
 * Brand colours are authored by admins, so they cannot be trusted to stay
 * legible. Darken (light mode) or lighten (dark mode) towards the background's
 * opposite until the token clears WCAG AA for normal text.
 */
function readableBrand(color: string | undefined, background: string, fallback: string): string {
  const fg = parseHex(color);
  const bg = parseHex(background);
  if (!fg || !bg) return fallback;
  if (contrastRatio(fg, bg) >= 4.5) return toHex(fg);

  const target: RGB = luminance(bg) > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  let candidate = fg;
  for (let step = 1; step <= 20; step++) {
    candidate = mix(fg, target, step / 20);
    if (contrastRatio(candidate, bg) >= 4.5) break;
  }
  return toHex(candidate);
}

function shade(color: string, amount: number, fallback: string): string {
  const rgb = parseHex(color);
  if (!rgb) return fallback;
  const target: RGB = amount < 0 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  return toHex(mix(rgb, target, Math.abs(amount)));
}

function rgba(color: string, alpha: number, fallback: string): string {
  const rgb = parseHex(color);
  if (!rgb) return fallback;
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
}

function applyThemeDirect(theme: ThemeConfig | null, preference: ThemePreference | null) {
  if (!theme || typeof document === 'undefined') return;

  const root = document.documentElement;
  const dark = resolveDark(theme, preference);

  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.classList.toggle('dark', dark);

  // The stylesheet reads --ns-* tokens, not the --color-* names that used to be
  // written here. Keep the old names as aliases for any custom CSS an admin has
  // pasted in, and drive the real tokens from the same values.
  const surface = dark ? DARK_BG : parseHex(theme.bgColor) ? theme.bgColor : LIGHT_BG;
  const primary = readableBrand(theme.primaryColor, surface, dark ? '#38bdf8' : '#075f76');
  const secondary = readableBrand(theme.secondaryColor, surface, dark ? '#fbbf24' : '#2b7f97');
  const accent = parseHex(theme.accentColor) ? theme.accentColor : secondary;
  const ink = readableBrand(theme.textColor, surface, dark ? '#f8fafc' : '#0b1d28');
  const muted = readableBrand(theme.textMuted, surface, dark ? '#edf6fb' : '#3f6073');
  const success = readableBrand(theme.successColor, surface, dark ? '#34d399' : '#0d6b51');
  const warning = readableBrand(theme.warningColor, surface, dark ? '#fbbf24' : '#92400e');
  const danger = readableBrand(theme.errorColor, surface, dark ? '#f87171' : '#b91c1c');
  const info = readableBrand(theme.infoColor, surface, dark ? '#60a5fa' : '#0369a1');

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

  root.style.setProperty('--ns-teal', primary);
  root.style.setProperty('--ns-teal-deep', shade(primary, dark ? 0.16 : -0.14, primary));
  root.style.setProperty('--ns-gold', secondary);
  root.style.setProperty('--ns-gold-soft', rgba(accent, dark ? 0.16 : 0.12, 'rgba(43, 127, 151, 0.12)'));
  root.style.setProperty('--ns-bg', surface);
  root.style.setProperty('--ns-ink', ink);
  root.style.setProperty('--ns-ink-2', toHex(mix(parseHex(ink)!, parseHex(surface)!, 0.18)));
  root.style.setProperty('--ns-muted', muted);
  root.style.setProperty('--ns-success', success);
  root.style.setProperty('--ns-warning', warning);
  root.style.setProperty('--ns-danger', danger);
  root.style.setProperty('--ns-info', info);

  root.style.setProperty('--font-body', theme.fontFamily || 'system-ui, -apple-system, sans-serif');
  root.style.setProperty('--font-heading', theme.headingFont || 'Manrope, sans-serif');
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