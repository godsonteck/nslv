// ============================================
// NS LUXURY VILLA — Role Routes
// /api/v1/roles
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { PERMISSIONS, PERMISSION_MODULES } from '@nslv/shared';
import { validateBody } from '../middleware/validate';
import { createRoleSchema, updateRoleSchema } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

/**
 * GET /api/v1/roles
 * List all system roles with assigned permissions
 */
router.get(
  '/',
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
  requirePermission(PERMISSIONS.PERMISSIONS_MANAGE),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const permissions = await UserService.listPermissions();
      res.status(200).json({
        success: true,
        data: {
          permissions: permissions.map((p) => ({
            id: p.id,
            code: p.code,
            action: p.action,
            module: p.module,
            description: p.description,
          })),
          modules: PERMISSION_MODULES,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/roles
 * Create a new role with a permission set
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validateBody(createRoleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const role = await UserService.createRole(req.body, authReq.user.userId);
      res.status(201).json({ success: true, data: role, message: 'Role created successfully.' });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/v1/roles/:id
 * Update a role's name, description or permission set
 */
router.put(
  '/:id',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validateBody(updateRoleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const idParam = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const role = await UserService.updateRole(idParam, req.body, authReq.user.userId);
      res.status(200).json({ success: true, data: role, message: 'Role updated successfully.' });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/v1/roles/:id
 * Delete a non-system role that is not assigned to users
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const idParam = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const result = await UserService.deleteRole(idParam, authReq.user.userId);
      res.status(200).json({ success: true, data: result, message: 'Role deleted successfully.' });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
