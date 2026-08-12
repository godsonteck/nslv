// ============================================
// NS LUXURY VILLA — Theme & Branding Routes
// /api/v1/theme
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { ThemeService } from '../services/theme.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { PERMISSIONS } from '@nslv/shared';

const router = Router();

/**
 * GET /api/v1/theme
 * Public endpoint - Get current theme configuration
 * No authentication required (needed for login page)
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const theme = await ThemeService.getTheme();
    res.status(200).json({
      success: true,
      data: theme,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/theme
 * Update theme configuration
 * Requires admin access
 */
router.put(
  '/',
  authenticate,
  verifyActiveUser,
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const updated = await ThemeService.updateTheme(req.body, authReq.user.userId);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Theme updated successfully.',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/theme/reset
 * Reset theme to defaults
 * Requires admin access
 */
router.post(
  '/reset',
  authenticate,
  verifyActiveUser,
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const reset = await ThemeService.resetTheme(authReq.user.userId);
      res.status(200).json({
        success: true,
        data: reset,
        message: 'Theme reset to defaults.',
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
