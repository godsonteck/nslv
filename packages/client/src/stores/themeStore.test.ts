import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { themeApi, type ThemeConfig } from '../services/apiService';
import { contrastRatio, readableText, vividForDark, type RGB } from './themeStore';

vi.mock('../services/apiService', () => ({
  themeApi: {
    getTheme: vi.fn(async () => ({ data: null })),
    updateTheme: vi.fn(),
    resetTheme: vi.fn(),
  },
}));

const SURFACES = {
  light: { '--ns-clay-bg': '#e5edf2', '--ns-well-bg': '#d7e2e9', '--ns-clay-raised': '#edf3f6' },
  dark: { '--ns-clay-bg': '#293c4a', '--ns-well-bg': '#20313e', '--ns-clay-raised': '#304554' },
};
const TEXT_TOKENS = [
  '--ns-ink', '--ns-ink-2', '--ns-muted', '--ns-teal', '--ns-teal-deep',
  '--ns-gold', '--ns-success', '--ns-warning', '--ns-danger', '--ns-info', '--ns-purple',
];
const CUSTOM_THEME: Partial<ThemeConfig> = {
  villaName: 'Coastal House',
  villaTagline: 'Welcome home',
  logoUrl: '/custom-logo.svg',
  loginBgUrl: '/custom-login.jpg',
  primaryColor: '#174b59',
  secondaryColor: '#493d6a',
  accentColor: '#abc',
  bgColor: '#eef1e8',
  textColor: '#1d3443',
  textMuted: '#48616e',
  borderColor: '#c3ccc1',
  successColor: '#436150',
  warningColor: '#816124',
  errorColor: '#924b69',
  infoColor: '#465d83',
  fontFamily: 'Georgia, serif',
  headingFont: 'Lora, serif',
  customCss: '.custom { color: var(--color-primary); }',
  useCustomLogin: true,
  enableDarkMode: true,
};

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
    expect(contrastRatio(vivid, rgb(SURFACES.dark['--ns-clay-bg']))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps a configured text colour only when it is crisp on dark clay', () => {
    const background = SURFACES.dark['--ns-clay-bg'];
    expect(readableText('#203641', background, '#edf3f7')).toBe('#edf3f7');
    expect(readableText('#526773', background, '#b1c4d0')).toBe('#b1c4d0');
    expect(readableText('#edf3f7', background, '#000000')).toBe('#edf3f7');
  });

  it('leaves a readable light-mode text colour untouched', () => {
    expect(readableText('#203641', '#dce6ed', '#edf3f7', 4.5)).toBe('#203641');
  });

  it('preserves helper fallbacks for invalid colours', () => {
    expect(vividForDark('invalid', '#82c7bb')).toBe('#82c7bb');
    expect(readableText('invalid', '#293c4a', '#edf3f7')).toBe('#edf3f7');
    expect(readableText('#edf3f7', 'invalid', '#b1c4d0')).toBe('#b1c4d0');
  });
});

describe('themeStore coastal clay', () => {
  let cache: Map<string, string>;
  let attributes: Map<string, string>;
  let properties: Map<string, string>;
  let classes: Set<string>;
  let systemDark: boolean;
  let onSystemChange: (() => void) | undefined;
  let surfaceOverrides: Record<string, string> | undefined;

  function expectReadable(backgrounds: Record<string, string>) {
    for (const [surface, background] of Object.entries(backgrounds)) {
      for (const token of TEXT_TOKENS) {
        expect(
          contrastRatio(rgb(properties.get(token)!), rgb(background)),
          `${token} on ${surface} (${background})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  }

  function expectReadableStatuses(mode: 'light' | 'dark') {
    const clay = rgb(SURFACES[mode]['--ns-clay-bg']);
    const statuses = {
      success: properties.get('--ns-success')!,
      warning: properties.get('--ns-warning')!,
      danger: properties.get('--ns-danger')!,
      ready: properties.get('--ns-teal')!,
      info: properties.get('--ns-info')!,
      neutral: properties.get('--ns-muted')!,
      cleaning: properties.get('--ns-purple')!,
    };
    for (const [status, color] of Object.entries(statuses)) {
      const foreground = rgb(color);
      const background = {
        r: foreground.r * 0.09 + clay.r * 0.91,
        g: foreground.g * 0.09 + clay.g * 0.91,
        b: foreground.b * 0.09 + clay.b * 0.91,
      };
      expect(contrastRatio(foreground, background), `${status} on its 9% sRGB tint`).toBeGreaterThanOrEqual(4.5);
    }
  }

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cache = new Map();
    attributes = new Map();
    properties = new Map();
    classes = new Set();
    systemDark = false;
    onSystemChange = undefined;
    surfaceOverrides = undefined;
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
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (key: string) => {
        const mode = attributes.get('data-theme') === 'dark' ? 'dark' : 'light';
        const surfaces: Record<string, string> = surfaceOverrides ?? SURFACES[mode];
        return ` ${surfaces[key] ?? ''} `;
      },
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses the coastal defaults without rewriting saved branding', async () => {
    const { useThemeStore } = await import('./themeStore');
    expect(useThemeStore.getState().theme).toEqual({
      villaName: 'NS Luxury Villa',
      villaTagline: 'Property Operations',
      logoUrl: undefined,
      loginBgUrl: undefined,
      primaryColor: '#276b78',
      secondaryColor: '#426e98',
      accentColor: '#82c7bb',
      bgColor: '#dce6ed',
      textColor: '#203641',
      textMuted: '#526773',
      borderColor: '#bacdd7',
      successColor: '#276e57',
      warningColor: '#93622a',
      errorColor: '#ad4654',
      infoColor: '#386c98',
      fontFamily: '"DM Sans", system-ui, sans-serif',
      headingFont: 'Manrope, sans-serif',
      customCss: undefined,
      useCustomLogin: false,
      enableDarkMode: false,
    });
    expect(properties.get('--font-body')).toBe('"DM Sans", system-ui, sans-serif');
    expect(properties.get('--font-heading')).toBe('Manrope, sans-serif');
    expect(cache.size).toBe(0);
    expect(themeApi.updateTheme).not.toHaveBeenCalled();
    expect(themeApi.resetTheme).not.toHaveBeenCalled();
  });

  describe.each(['light', 'dark'] as const)('%s contrast', (mode) => {
    it.each([
      { name: 'defaults', theme: {} },
      { name: 'custom branding', theme: CUSTOM_THEME },
      {
        name: 'low-contrast custom colours',
        theme: {
          primaryColor: '#ddd', secondaryColor: '#ddd', textColor: '#666', textMuted: '#ddd',
          successColor: '#ddd', warningColor: '#ddd', errorColor: '#ddd', infoColor: '#ddd',
        },
      },
      {
        name: 'invalid colours and empty fonts',
        theme: {
          primaryColor: 'invalid', secondaryColor: '', accentColor: '#12', bgColor: 'invalid',
          textColor: 'invalid', textMuted: '', successColor: 'invalid', warningColor: '#xyz',
          errorColor: 'invalid', infoColor: 'invalid', fontFamily: '', headingFont: '',
        },
      },
    ])('keeps all text tokens at AA on material surfaces and tinted badges with $name', async ({ name, theme }) => {
      cache.set('nslv_theme_config', JSON.stringify(theme));
      cache.set('nslv_theme_preference', mode);
      await import('./themeStore');
      expectReadable(SURFACES[mode]);
      expectReadableStatuses(mode);
      if (name === 'defaults') expectReadable({ canvas: properties.get('--ns-bg')! });
      expect(cache.get('nslv_theme_config')).toBe(JSON.stringify(theme));
      if ('fontFamily' in theme && theme.fontFamily === '') {
        expect(properties.get('--font-body')).toBe('"DM Sans", system-ui, sans-serif');
        expect(properties.get('--font-heading')).toBe('Manrope, sans-serif');
        expect(properties.get('--ns-bg')).toBe(mode === 'dark' ? '#1b2833' : '#dce6ed');
      }
    });

    it('selects by luminance rather than assuming the well is darker', async () => {
      surfaceOverrides = {
        ...SURFACES[mode],
        '--ns-clay-bg': SURFACES[mode]['--ns-well-bg'],
        '--ns-well-bg': SURFACES[mode]['--ns-clay-bg'],
      };
      cache.set('nslv_theme_preference', mode);
      await import('./themeStore');
      expectReadable(surfaceOverrides);
    });

    it.each(Object.keys(SURFACES[mode]))('uses valid surfaces when %s is invalid', async (invalid) => {
      surfaceOverrides = { ...SURFACES[mode], [invalid]: 'invalid' };
      cache.set('nslv_theme_preference', mode);
      await import('./themeStore');
      expectReadable(Object.fromEntries(Object.entries(surfaceOverrides).filter(([key]) => key !== invalid)));
    });

    it('falls back to the canvas when CSS surfaces are unavailable', async () => {
      surfaceOverrides = {};
      cache.set('nslv_theme_preference', mode);
      await import('./themeStore');
      expectReadable({ canvas: mode === 'dark' ? '#1b2833' : '#dce6ed' });
    });

    it('preserves readable admin colours and fonts', async () => {
      const textColor = mode === 'dark' ? '#d6eeee' : CUSTOM_THEME.textColor;
      const textMuted = mode === 'dark' ? '#cbdfe5' : CUSTOM_THEME.textMuted;
      const custom = { ...CUSTOM_THEME, textColor, textMuted };
      cache.set('nslv_theme_config', JSON.stringify(custom));
      cache.set('nslv_theme_preference', mode);
      const { useThemeStore } = await import('./themeStore');
      expect(useThemeStore.getState().theme).toMatchObject(custom);
      expect(properties.get('--ns-ink')).toBe(textColor);
      expect(properties.get('--ns-muted')).toBe(textMuted);
      expect(properties.get('--color-primary')).toBe(CUSTOM_THEME.primaryColor);
      expect(properties.get('--color-accent')).toBe(CUSTOM_THEME.accentColor);
      expect(properties.get('--font-body')).toBe(CUSTOM_THEME.fontFamily);
      expect(properties.get('--font-heading')).toBe(CUSTOM_THEME.headingFont);
      if (mode === 'light') {
        expect(properties.get('--ns-teal')).toBe(CUSTOM_THEME.primaryColor);
        expect(properties.get('--ns-bg')).toBe(CUSTOM_THEME.bgColor);
      }
      expectReadable(SURFACES[mode]);
    });
  });

  it('applies a cached dark preference before rendering', async () => {
    cache.set('nslv_theme_preference', 'dark');
    const { useThemeStore } = await import('./themeStore');
    expect(attributes.get('data-theme')).toBe('dark');
    expect(classes.has('dark')).toBe(true);
    expect(useThemeStore.getState().effectiveDark).toBe(true);
    expect(properties.get('--ns-ink')).toBe('#edf3f7');
    expect(properties.get('--ns-muted')).toBe('#b1c4d0');
  });

  it('honours the saved dark-mode flag when no preference is set', async () => {
    cache.set('nslv_theme_config', JSON.stringify({ enableDarkMode: true }));
    const { useThemeStore } = await import('./themeStore');
    expect(useThemeStore.getState().themePreference).toBe('dark');
    expect(attributes.get('data-theme')).toBe('dark');
  });

  it('recovers from malformed cached JSON and an invalid preference', async () => {
    cache.set('nslv_theme_config', '{broken');
    cache.set('nslv_theme_preference', 'invalid');
    const { useThemeStore } = await import('./themeStore');
    expect(useThemeStore.getState().themePreference).toBe('light');
    expect(properties.get('--ns-bg')).toBe('#dce6ed');
    expectReadable(SURFACES.light);
    expect(cache.get('nslv_theme_config')).toBe('{broken');
  });

  it('persists repeated switches and recalculates tokens without altering branding', async () => {
    const saved = JSON.stringify({ primaryColor: '#16a4d4', fontFamily: 'Georgia, serif' });
    cache.set('nslv_theme_config', saved);
    const { useThemeStore } = await import('./themeStore');
    const lightTokens = new Map(properties);
    for (const mode of ['dark', 'light', 'dark', 'light'] as const) {
      useThemeStore.getState().setThemePreference(mode);
      expect(attributes.get('data-theme')).toBe(mode);
      expect(classes.has('dark')).toBe(mode === 'dark');
      expect(useThemeStore.getState().effectiveDark).toBe(mode === 'dark');
      expect(cache.get('nslv_theme_preference')).toBe(mode);
      expect(properties.get('--ns-bg')).toBe(mode === 'dark' ? '#1b2833' : '#dce6ed');
      expect(properties.get('--ns-ink')).toBe(mode === 'dark' ? '#edf3f7' : '#203641');
      expectReadable(SURFACES[mode]);
      if (mode === 'light') expect(properties).toEqual(lightTokens);
    }
    expect(cache.get('nslv_theme_config')).toBe(saved);
    expect(properties.get('--color-primary')).toBe('#16a4d4');
    expect(properties.get('--font-body')).toBe('Georgia, serif');
    expect(themeApi.updateTheme).not.toHaveBeenCalled();
    expect(themeApi.resetTheme).not.toHaveBeenCalled();
  });

  it('tracks operating system changes only in system mode', async () => {
    const { useThemeStore } = await import('./themeStore');
    useThemeStore.getState().setThemePreference('system');
    for (const dark of [true, false, true]) {
      systemDark = dark;
      onSystemChange?.();
      expect(useThemeStore.getState().effectiveDark).toBe(dark);
      expect(attributes.get('data-theme')).toBe(dark ? 'dark' : 'light');
      expectReadable(SURFACES[dark ? 'dark' : 'light']);
    }
    useThemeStore.getState().setThemePreference('light');
    onSystemChange?.();
    expect(attributes.get('data-theme')).toBe('light');
    useThemeStore.getState().setThemePreference('dark');
    systemDark = false;
    onSystemChange?.();
    expect(attributes.get('data-theme')).toBe('dark');
  });

  it('keeps the selected mode when loading the default theme', async () => {
    const { useThemeStore } = await import('./themeStore');
    useThemeStore.getState().setThemePreference('dark');
    await useThemeStore.getState().loadTheme();
    expect(attributes.get('data-theme')).toBe('dark');
    expect(properties.get('--color-primary')).toBe('#276b78');
    expect(properties.get('--ns-bg')).toBe('#1b2833');
    expect(properties.get('--ns-ink')).toBe('#edf3f7');
    expect(properties.get('--font-body')).toBe('"DM Sans", system-ui, sans-serif');
    expectReadable(SURFACES.dark);
  });

  it('caches loaded admin branding unchanged and retains the selected mode', async () => {
    const { useThemeStore } = await import('./themeStore');
    const custom = { ...useThemeStore.getState().theme!, ...CUSTOM_THEME };
    vi.mocked(themeApi.getTheme).mockResolvedValueOnce({ success: true, data: custom });
    useThemeStore.getState().setThemePreference('light');
    await useThemeStore.getState().loadTheme();
    expect(useThemeStore.getState().theme).toEqual(custom);
    expect(JSON.parse(cache.get('nslv_theme_config')!)).toEqual(custom);
    expect(attributes.get('data-theme')).toBe('light');
    expect(properties.get('--ns-teal')).toBe(CUSTOM_THEME.primaryColor);
    expect(properties.get('--font-body')).toBe(CUSTOM_THEME.fontFamily);
    expect(themeApi.updateTheme).not.toHaveBeenCalled();
    expect(themeApi.resetTheme).not.toHaveBeenCalled();
    expectReadable(SURFACES.light);
  });
});
