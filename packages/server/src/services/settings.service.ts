import { prisma } from '../config';
import { AppError } from '../middleware/error';
import { AuditService } from './audit.service';
import { StayService } from './stays.service';

export class SettingsService {
  /**
   * Get all system settings grouped by category
   */
  static async getAllSettings() {
    const settings = await prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const formatted = settings.map((s) => ({
      id: s.id,
      key: s.key,
      value: JSON.parse(s.value),
      category: s.category,
      description: s.description,
      updatedAt: s.updatedAt.toISOString(),
    }));

    return formatted;
  }

  /**
   * Get setting by key
   */
  static async getSettingByKey(key: string) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new AppError(`Setting '${key}' not found.`, 404, 'SETTING_NOT_FOUND');
    }

    return {
      id: setting.id,
      key: setting.key,
      value: JSON.parse(setting.value),
      category: setting.category,
      description: setting.description,
      updatedAt: setting.updatedAt.toISOString(),
    };
  }

  /**
   * Update setting value with audit logging
   */
  static async updateSetting(key: string, value: unknown, updatedByUserId: string) {
    const existing = await prisma.systemSetting.findUnique({ where: { key } });

    const beforeValue = existing ? JSON.parse(existing.value) : null;
    const valueString = JSON.stringify(value);

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: valueString,
        updatedBy: updatedByUserId,
      },
      create: {
        key,
        value: valueString,
        category: key.split('.')[0] || 'general',
        description: `Config setting for ${key}`,
        updatedBy: updatedByUserId,
      },
    });

    await AuditService.log({
      userId: updatedByUserId,
      action: 'setting.updated',
      resource: 'system_setting',
      resourceId: key,
      beforeData: { key, value: beforeValue },
      afterData: { key, value },
    });

    // If late checkout fee or checkout time is changed, immediately auto-adjust historical checkouts
    if (key === 'financial.late_checkout_fee' || key === 'villa.checkout_time') {
      try {
        const rate = key === 'financial.late_checkout_fee' ? Number(value) : undefined;
        const time = key === 'villa.checkout_time' ? String(value) : undefined;
        void StayService.autoAdjustHistoricalLateCheckoutFees(rate, time);
      } catch (err) {
        console.warn('[SettingsService] autoAdjust error on setting change:', err);
      }
    }

    return {
      id: setting.id,
      key: setting.key,
      value: JSON.parse(setting.value),
      category: setting.category,
      description: setting.description,
      updatedAt: setting.updatedAt.toISOString(),
    };
  }

  /**
   * Bulk update multiple settings
   */
  static async bulkUpdateSettings(settingsMap: Record<string, unknown>, updatedByUserId: string) {
    const results = [];

    for (const [key, value] of Object.entries(settingsMap)) {
      const updated = await this.updateSetting(key, value, updatedByUserId);
      results.push(updated);
    }

    return results;
  }
}
