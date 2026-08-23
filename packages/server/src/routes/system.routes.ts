// ============================================
// NS LUXURY VILLA — System Administration Routes
// /api/v1/system
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { SystemService } from '../services/system.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { PERMISSIONS, resetSystemSchema } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

/**
 * GET /api/v1/system/counts
 * Preview current record counts across modules for the reset dialog.
 */
router.get(
  '/counts',
  requirePermission(PERMISSIONS.SYSTEM_CONFIGURE),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const counts = await SystemService.getCounts();
      res.status(200).json({
        success: true,
        data: counts,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/system/reset
 * Destructive selective or full-system reset. Requires confirmation phrase "RESET",
 * admin's own password, and optional list of modules to clear.
 */
router.post(
  '/reset',
  requirePermission(PERMISSIONS.SYSTEM_CONFIGURE),
  validateBody(resetSystemSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await SystemService.resetSystem(authReq.user.userId, req.body);

      const message = result.isFullWipe
        ? 'Full system reset complete. All operational and catalog records have been cleared.'
        : `Selective reset complete. Cleared data for: ${result.modulesWiped.join(', ')}.`;

      res.status(200).json({
        success: true,
        data: result,
        message,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;