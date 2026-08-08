// ============================================
// NS LUXURY VILLA — Audit Log Routes
// /api/v1/audit
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { auditLogFilterSchema, PERMISSIONS } from '@nslv/shared';

const router = Router();

/**
 * GET /api/v1/audit
 * Query audit logs (Admin/Manager only)
 */
router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  validateQuery(auditLogFilterSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const logs = await AuditService.queryLogs(req.query as any);
      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
