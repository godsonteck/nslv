// ============================================
// NS LUXURY VILLA — Branding & Theme Service
// Manages UI customization & branding
// ============================================

import { prisma } from '../config';
import { AppError } from '../middleware/error';
import { AuditService } from './audit.service';

export interface ThemeConfig {
  id?: string;
  villaName: string;
  villaTagline: string;
  logoUrl?: string;
  loginBgUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  textMuted: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;
  fontFamily: string;
  headingFont: string;
  customCss?: string;
  useCustomLogin: boolean;
  enableDarkMode: boolean;
}

const DEFAULT_THEME: ThemeConfig = {
  villaName: 'NS Luxury Villa',
  villaTagline: 'Property Operations',
  logoUrl: undefined,
  loginBgUrl: undefined,
  primaryColor: '#174b59',
  secondaryColor: '#b18a55',
  accentColor: '#d9bd91',
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

export class ThemeService {
  /**
   * Get the current theme configuration
   */
  static async getTheme(): Promise<ThemeConfig> {
    let theme = await prisma.brandingTheme.findFirst();

    if (!theme) {
      // Create default theme if it doesn't exist
      theme = await prisma.brandingTheme.create({
        data: {
          villaName: DEFAULT_THEME.villaName,
          villaTagline: DEFAULT_THEME.villaTagline,
          primaryColor: DEFAULT_THEME.primaryColor,
          secondaryColor: DEFAULT_THEME.secondaryColor,
          accentColor: DEFAULT_THEME.accentColor,
          bgColor: DEFAULT_THEME.bgColor,
          textColor: DEFAULT_THEME.textColor,
          textMuted: DEFAULT_THEME.textMuted,
          borderColor: DEFAULT_THEME.borderColor,
          successColor: DEFAULT_THEME.successColor,
          warningColor: DEFAULT_THEME.warningColor,
          errorColor: DEFAULT_THEME.errorColor,
          infoColor: DEFAULT_THEME.infoColor,
          fontFamily: DEFAULT_THEME.fontFamily,
          headingFont: DEFAULT_THEME.headingFont,
          useCustomLogin: DEFAULT_THEME.useCustomLogin,
          enableDarkMode: DEFAULT_THEME.enableDarkMode,
        },
      });
    }

    return {
      id: theme.id,
      villaName: theme.villaName,
      villaTagline: theme.villaTagline,
      logoUrl: theme.logoUrl ?? undefined,
      loginBgUrl: theme.loginBgUrl ?? undefined,
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      accentColor: theme.accentColor,
      bgColor: theme.bgColor,
      textColor: theme.textColor,
      textMuted: theme.textMuted,
      borderColor: theme.borderColor,
      successColor: theme.successColor,
      warningColor: theme.warningColor,
      errorColor: theme.errorColor,
      infoColor: theme.infoColor,
      fontFamily: theme.fontFamily,
      headingFont: theme.headingFont,
      customCss: theme.customCss ?? undefined,
      useCustomLogin: theme.useCustomLogin,
      enableDarkMode: theme.enableDarkMode,
    };
  }

  /**
   * Update theme configuration
   */
  static async updateTheme(config: Partial<ThemeConfig>, updatedByUserId: string): Promise<ThemeConfig> {
    console.log('[ThemeService] updateTheme called with:', {
      keys: Object.keys(config),
      updatedByUserId,
      logoUrlLength: (config.logoUrl?.length ?? 0),
      loginBgUrlLength: (config.loginBgUrl?.length ?? 0),
    });
    
    let theme = await prisma.brandingTheme.findFirst();

    if (!theme) {
      theme = await prisma.brandingTheme.create({
        data: {
          villaName: config.villaName || DEFAULT_THEME.villaName,
          villaTagline: config.villaTagline || DEFAULT_THEME.villaTagline,
          primaryColor: config.primaryColor || DEFAULT_THEME.primaryColor,
          secondaryColor: config.secondaryColor || DEFAULT_THEME.secondaryColor,
          accentColor: config.accentColor || DEFAULT_THEME.accentColor,
          bgColor: config.bgColor || DEFAULT_THEME.bgColor,
          textColor: config.textColor || DEFAULT_THEME.textColor,
          textMuted: config.textMuted || DEFAULT_THEME.textMuted,
          borderColor: config.borderColor || DEFAULT_THEME.borderColor,
          successColor: config.successColor || DEFAULT_THEME.successColor,
          warningColor: config.warningColor || DEFAULT_THEME.warningColor,
          errorColor: config.errorColor || DEFAULT_THEME.errorColor,
          infoColor: config.infoColor || DEFAULT_THEME.infoColor,
          fontFamily: config.fontFamily || DEFAULT_THEME.fontFamily,
          headingFont: config.headingFont || DEFAULT_THEME.headingFont,
          customCss: config.customCss,
          useCustomLogin: config.useCustomLogin ?? DEFAULT_THEME.useCustomLogin,
          enableDarkMode: config.enableDarkMode ?? DEFAULT_THEME.enableDarkMode,
          updatedBy: updatedByUserId,
        },
      });
    } else {
      const beforeData = { ...theme };
      
      theme = await prisma.brandingTheme.update({
        where: { id: theme.id },
        data: {
          villaName: config.villaName ?? theme.villaName,
          villaTagline: config.villaTagline ?? theme.villaTagline,
          logoUrl: config.logoUrl !== undefined ? config.logoUrl : theme.logoUrl,
          loginBgUrl: config.loginBgUrl !== undefined ? config.loginBgUrl : theme.loginBgUrl,
          primaryColor: config.primaryColor ?? theme.primaryColor,
          secondaryColor: config.secondaryColor ?? theme.secondaryColor,
          accentColor: config.accentColor ?? theme.accentColor,
          bgColor: config.bgColor ?? theme.bgColor,
          textColor: config.textColor ?? theme.textColor,
          textMuted: config.textMuted ?? theme.textMuted,
          borderColor: config.borderColor ?? theme.borderColor,
          successColor: config.successColor ?? theme.successColor,
          warningColor: config.warningColor ?? theme.warningColor,
          errorColor: config.errorColor ?? theme.errorColor,
          infoColor: config.infoColor ?? theme.infoColor,
          fontFamily: config.fontFamily ?? theme.fontFamily,
          headingFont: config.headingFont ?? theme.headingFont,
          customCss: config.customCss !== undefined ? config.customCss : theme.customCss,
          useCustomLogin: config.useCustomLogin ?? theme.useCustomLogin,
          enableDarkMode: config.enableDarkMode ?? theme.enableDarkMode,
          updatedBy: updatedByUserId,
        },
      });

      // Audit the change
      await AuditService.log({
        userId: updatedByUserId,
        action: 'theme.updated',
        resource: 'branding_theme',
        resourceId: theme.id,
        beforeData: beforeData,
        afterData: config,
      });
    }

    return {
      id: theme.id,
      villaName: theme.villaName,
      villaTagline: theme.villaTagline,
      logoUrl: theme.logoUrl ?? undefined,
      loginBgUrl: theme.loginBgUrl ?? undefined,
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      accentColor: theme.accentColor,
      bgColor: theme.bgColor,
      textColor: theme.textColor,
      textMuted: theme.textMuted,
      borderColor: theme.borderColor,
      successColor: theme.successColor,
      warningColor: theme.warningColor,
      errorColor: theme.errorColor,
      infoColor: theme.infoColor,
      fontFamily: theme.fontFamily,
      headingFont: theme.headingFont,
      customCss: theme.customCss ?? undefined,
      useCustomLogin: theme.useCustomLogin,
      enableDarkMode: theme.enableDarkMode,
    };
  }

  /**
   * Reset to default theme
   */
  static async resetTheme(updatedByUserId: string): Promise<ThemeConfig> {
    const theme = await prisma.brandingTheme.findFirst();

    if (theme) {
      await prisma.brandingTheme.delete({ where: { id: theme.id } });
    }

    return this.getTheme();
  }
}
