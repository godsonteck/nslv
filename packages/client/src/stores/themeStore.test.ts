import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/apiService', () => ({
  themeApi: {
    getTheme: vi.fn(async () => ({ data: null })),
  },
}));

describe('themeStore clear glass', () => {
  let cache: Map<string, string>;
  let attributes: Map<string, string>;
  let properties: Map<string, string>;
  let classes: Set<string>;
  let systemDark: boolean;
  let onSystemChange: (() => void) | undefined;

  beforeEach(() => {
    vi.resetModules();
    cache = new Map();
    attributes = new Map();
    properties = new Map();
    classes = new Set();
    systemDark = false;
    onSystemChange = undefined;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => cache.get(key) ?? null,
      setItem: (key: string, value: string) => cache.set(key, value),
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({
        matches: systemDark,
        addEventListener: (_: string, listener: () => void) => { onSystemChange = listener; },
      }),
    });
    vi.stubGlobal('document', {
      documentElement: {
        setAttribute: (key: string, value: string) => attributes.set(key, value),
        classList: { toggle: (key: string, enabled: boolean) => enabled ? classes.add(key) : classes.delete(key) },
        style: { setProperty: (key: string, value: string) => properties.set(key, value) },
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('applies a cached dark preference before rendering', async () => {
    cache.set('nslv_theme_preference', 'dark');
    const { useThemeStore } = await import('./themeStore');
    expect(attributes.get('data-theme')).toBe('dark');
    expect(classes.has('dark')).toBe(true);
    expect(useThemeStore.getState().effectiveDark).toBe(true);
  });

  it('persists switches without overriding CSS surface or contrast tokens', async () => {
    const { useThemeStore } = await import('./themeStore');
    useThemeStore.getState().setThemePreference('dark');
    useThemeStore.getState().setThemePreference('light');
    expect(attributes.get('data-theme')).toBe('light');
    expect(classes.has('dark')).toBe(false);
    expect(cache.get('nslv_theme_preference')).toBe('light');
    expect([...properties.keys()].filter(key => key.startsWith('--ns-'))).toEqual([]);
  });

  it('tracks operating system changes only in system mode', async () => {
    const { useThemeStore } = await import('./themeStore');
    useThemeStore.getState().setThemePreference('system');
    systemDark = true;
    onSystemChange?.();
    expect(useThemeStore.getState().effectiveDark).toBe(true);
    expect(attributes.get('data-theme')).toBe('dark');
    useThemeStore.getState().setThemePreference('light');
    onSystemChange?.();
    expect(attributes.get('data-theme')).toBe('light');
  });

  it('keeps the selected mode and transparent CSS surfaces after loading branding', async () => {
    const { useThemeStore } = await import('./themeStore');
    useThemeStore.getState().setThemePreference('dark');
    await useThemeStore.getState().loadTheme();
    expect(attributes.get('data-theme')).toBe('dark');
    expect(properties.get('--color-primary')).toBeDefined();
    expect(properties.has('--ns-surface')).toBe(false);
    expect(properties.has('--ns-ink')).toBe(false);
  });
});
