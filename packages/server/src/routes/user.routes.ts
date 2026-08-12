// ============================================
// NS LUXURY VILLA — User Management Routes
// /api/v1/users
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { authenticate, requirePermission, requireAnyPermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createUserSchema, updateUserSchema, userFilterSchema, PERMISSIONS } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

/**
 * GET /api/v1/users
 * List all users with filtering/search (Supports users.view or staff.view permission)
 */
router.get(
  '/',
  requireAnyPermission(PERMISSIONS.USERS_VIEW, PERMISSIONS.STAFF_VIEW),
  validateQuery(userFilterSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await UserService.listUsers(req.query as any);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/users/:id
 * Get single user details
 */
router.get(
  '/:id',
  requireAnyPermission(PERMISSIONS.USERS_VIEW, PERMISSIONS.STAFF_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParam = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const user = await UserService.getUserById(idParam);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/users
 * Create a new user account
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  validateBody(createUserSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await UserService.createUser(req.body, authReq.user.userId);
      res.status(201).json({
        success: true,
        data: user,
        message: 'User account created successfully.',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/v1/users/:id
 * Update user details or roles
 */
router.put(
  '/:id',
  requirePermission(PERMISSIONS.USERS_EDIT),
  validateBody(updateUserSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const idParam = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const updated = await UserService.updateUser(idParam, req.body, authReq.user.userId);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'User account updated successfully.',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/v1/users/:id
 * Permanently delete a non-admin user account
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS_DELETE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const idParam = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const result = await UserService.deleteUser(idParam, authReq.user.userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'User account deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
