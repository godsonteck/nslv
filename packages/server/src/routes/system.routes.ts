// ============================================
// NS LUXURY VILLA — System Administration Routes
// /api/v1/system
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { SystemService } from '../services/system.service';
import { BackupService } from '../services/backup.service';
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
 * Destructive selective or full-system reset. Automatically creates a pre-reset
 * safety snapshot before wiping, allowing the admin to reverse/restore at any time.
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
        ? 'Full system reset complete. All operational and catalog records have been cleared. A safety snapshot was created.'
        : `Selective reset complete. Cleared data for: ${result.modulesWiped.join(', ')}. A safety snapshot was created.`;

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

/**
 * GET /api/v1/system/backups
 * List all available system snapshots & backups
 */
router.get(
  '/backups',
  requirePermission(PERMISSIONS.SYSTEM_CONFIGURE),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const snapshots = BackupService.listSnapshots();
      res.status(200).json({
        success: true,
        data: snapshots,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/system/backups
 * Create a new point-in-time system snapshot / backup
 */
router.post(
  '/backups',
  requirePermission(PERMISSIONS.SYSTEM_CONFIGURE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const metadata = await BackupService.createSnapshot(authReq.user.userId, 'MANUAL', req.body);
      res.status(201).json({
        success: true,
        data: metadata,
        message: `System snapshot "${metadata.id}" created successfully (${metadata.totalRecords} records).`,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/system/backups/:id
 * Retrieve or download full JSON payload of a snapshot
 */
router.get(
  '/backups/:id',
  requirePermission(PERMISSIONS.SYSTEM_CONFIGURE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const snapshot = BackupService.getSnapshot(req.params.id);
      res.status(200).json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/system/backups/:id/restore
 * Reverse / Restore deleted data from a chosen snapshot back into the live database
 */
router.post(
  '/backups/:id/restore',
  requirePermission(PERMISSIONS.SYSTEM_CONFIGURE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await BackupService.restoreSnapshot(authReq.user.userId, req.params.id);
      res.status(200).json({
        success: true,
        data: result,
        message: `Successfully restored ${result.restoredRecords} records from snapshot "${req.params.id}".`,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/v1/system/backups/:id
 * Delete an old snapshot file
 */
router.delete(
  '/backups/:id',
  requirePermission(PERMISSIONS.SYSTEM_CONFIGURE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      BackupService.deleteSnapshot(authReq.user.userId, req.params.id);
      res.status(200).json({
        success: true,
        message: `Snapshot "${req.params.id}" has been deleted.`,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;