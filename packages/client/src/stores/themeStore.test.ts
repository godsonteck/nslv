import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio, readableText, vividForDark, type RGB } from './themeStore';

vi.mock('../services/apiService', () => ({
  themeApi: {
    getTheme: vi.fn(async () => ({ data: null })),
  },
}));

function rgb(hex: string): RGB {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not a hex colour: ${hex}`);
  return {
    r: parseInt(match[1].slice(0, 2), 16),
    g: parseInt(match[1].slice(2, 4), 16),
    b: parseInt(match[1].slice(4, 6), 16),
  };
}

describe('dark-mode contrast helpers', () => {
  it('turns a deep light-mode brand colour into a vivid dark-mode tone', () => {
    const original = rgb('#174b59');
    const vivid = rgb(vividForDark('#174b59', '#38bdf8'));

    // A plain mix towards white produced the grey #5d818b seen in production.
    expect(vividForDark('#174b59', '#38bdf8')).not.toBe('#5d818b');

    const spread = Math.max(vivid.r, vivid.g, vivid.b) - Math.min(vivid.r, vivid.g, vivid.b);
    expect(spread).toBeGreaterThan(60);
    expect(vivid.g).toBeGreaterThan(original.g);
    expect(contrastRatio(vivid, rgb('#070d14'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps a configured text colour only when it is crisp on the dark canvas', () => {
    // #14232b is the light-mode default and reads as pale grey on #070d14.
    expect(readableText('#14232b', '#070d14', '#f8fafc')).toBe('#f8fafc');
    expect(readableText('#7a858a', '#070d14', '#edf6fb')).toBe('#edf6fb');

    // A colour that already clears 7:1 is left alone.
    expect(readableText('#f8fafc', '#070d14', '#000000')).toBe('#f8fafc');
  });

  it('leaves a light-mode text colour untouched below the dark-only threshold', () => {
    expect(readableText('#14232b', '#f5f6f4', '#f8fafc', 4.5)).toBe('#14232b');
  });
});

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

  it('persists switches and drives the tokens the stylesheet actually reads', async () => {
    const { useThemeStore } = await import('./themeStore');
    useThemeStore.getState().setThemePreference('dark');
    expect(properties.get('--ns-bg')).toBe('#070d14');
    expect(properties.get('--ns-ink')).toBe('#f8fafc');

    useThemeStore.getState().setThemePreference('light');
    expect(attributes.get('data-theme')).toBe('light');
    expect(classes.has('dark')).toBe(false);
    expect(cache.get('nslv_theme_preference')).toBe('light');
    expect(properties.get('--ns-bg')).toBe('#f5f6f4');
    expect(properties.get('--ns-ink')).toBe('#14232b');
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

  it('keeps the selected mode and applies branding tokens after loading', async () => {
    const { useThemeStore } = await import('./themeStore');
    useThemeStore.getState().setThemePreference('dark');
    await useThemeStore.getState().loadTheme();
    expect(attributes.get('data-theme')).toBe('dark');
    expect(properties.get('--color-primary')).toBeDefined();
    // The stylesheet paints from --ns-*; --color-* is only a compatibility alias.
    expect(properties.get('--ns-bg')).toBe('#070d14');
    expect(properties.get('--ns-ink')).toBe('#f8fafc');
    expect(properties.get('--font-body')).toBeDefined();
  });
});
