// ============================================
// NS LUXURY VILLA — System Administration Routes
// /api/v1/system
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { SystemService } from '../services/system.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { PERMISSIONS } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

/**
 * POST /api/v1/system/reset
 * Destructive full-system reset. Requires the confirmation phrase "RESET"
 * and the admin's own password. Clears all operational & catalog data.
 */
router.post(
  '/reset',
  requirePermission(PERMISSIONS.SYSTEM_CONFIGURE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await SystemService.resetSystem(authReq.user.userId, req.body);

      res.status(200).json({
        success: true,
        data: result,
        message: 'System reset complete. All operational and catalog data has been cleared.',
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;