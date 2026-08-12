// ============================================
// NS LUXURY VILLA — System Settings Routes
// /api/v1/settings
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { SettingsService } from '../services/settings.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { PERMISSIONS } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

/**
 * GET /api/v1/settings
 * List all system settings
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_VIEW),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await SettingsService.getAllSettings();
      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/v1/settings/:key
 * Update a single setting
 */
router.put(
  '/:key',
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const keyParam = Array.isArray(req.params.key) ? req.params.key[0]! : req.params.key!;
      const updated = await SettingsService.updateSetting(
        keyParam,
        req.body.value,
        authReq.user.userId,
      );

      res.status(200).json({
        success: true,
        data: updated,
        message: `Setting '${keyParam}' updated successfully.`,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/settings/bulk
 * Bulk update settings
 */
router.post(
  '/bulk',
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const updated = await SettingsService.bulkUpdateSettings(req.body, authReq.user.userId);

      res.status(200).json({
        success: true,
        data: updated,
        message: 'System settings updated successfully.',
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
