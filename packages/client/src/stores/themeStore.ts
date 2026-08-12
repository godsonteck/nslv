import { create } from 'zustand';
import { themeApi, type ThemeConfig } from '../services/apiService';

interface ThemeStore {
  theme: ThemeConfig | null;
  isLoading: boolean;
  
  // Actions
  loadTheme: () => Promise<void>;
  updateTheme: (config: Partial<ThemeConfig>) => Promise<void>;
  resetTheme: () => Promise<void>;
  applyTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: null,
  isLoading: false,

  loadTheme: async () => {
    set({ isLoading: true });
    try {
      const result = await themeApi.getTheme();
      set({ theme: result.data });
      get().applyTheme();
    } catch (error) {
      console.error('Failed to load theme:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  updateTheme: async (config: Partial<ThemeConfig>) => {
    try {
      const result = await themeApi.updateTheme(config);
      set({ theme: result.data });
      get().applyTheme();
    } catch (error) {
      console.error('Failed to update theme:', error);
      throw error;
    }
  },

  resetTheme: async () => {
    try {
      const result = await themeApi.resetTheme();
      set({ theme: result.data });
      get().applyTheme();
    } catch (error) {
      console.error('Failed to reset theme:', error);
      throw error;
    }
  },

  applyTheme: () => {
    const theme = get().theme;
    if (!theme) return;

    const root = document.documentElement;
    
    // Set CSS variables for colors
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
    
    // Set font families
    root.style.setProperty('--font-family', theme.fontFamily);
    root.style.setProperty('--font-heading', theme.headingFont);

    // Apply custom CSS if provided
    if (theme.customCss) {
      let styleEl = document.getElementById('theme-custom-css');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'theme-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = theme.customCss;
    }
  },
}));
