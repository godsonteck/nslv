// ============================================
// NS LUXURY VILLA — User Management Routes
// /api/v1/users
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createUserSchema, updateUserSchema, userFilterSchema, PERMISSIONS } from '@nslv/shared';

const router = Router();

/**
 * GET /api/v1/users
 * List all users with filtering/search
 */
router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.USERS_VIEW),
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
  authenticate,
  requirePermission(PERMISSIONS.USERS_VIEW),
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
  authenticate,
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
  authenticate,
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

export default router;
