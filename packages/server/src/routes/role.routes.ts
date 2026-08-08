// ============================================
// NS LUXURY VILLA — Role Routes
// /api/v1/roles
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { authenticate, requirePermission } from '../middleware/auth';
import { PERMISSIONS, PERMISSION_DESCRIPTIONS, PERMISSION_MODULES, ALL_PERMISSION_CODES } from '@nslv/shared';

const router = Router();

/**
 * GET /api/v1/roles
 * List all system roles with assigned permissions
 */
router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.ROLES_VIEW),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roles = await UserService.listRoles();
      res.status(200).json({
        success: true,
        data: roles,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/roles/permissions
 * List all available system permissions for role builder UI
 */
router.get(
  '/permissions',
  authenticate,
  requirePermission(PERMISSIONS.PERMISSIONS_MANAGE),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const permissions = ALL_PERMISSION_CODES.map((code) => ({
        code,
        description: PERMISSION_DESCRIPTIONS[code] || code,
        module: code.split('.')[0] || 'general',
      }));

      res.status(200).json({
        success: true,
        data: {
          permissions,
          modules: PERMISSION_MODULES,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
