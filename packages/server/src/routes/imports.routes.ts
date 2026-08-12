// ============================================
// NS LUXURY VILLA — Data Import Routes
// Document upload → auto-fill menus, inventory & stock
// ============================================

import { Router } from 'express';
import { ImportService, type ImportTarget } from '../services/imports.service';
import {
  authenticate,
  requireAnyPermission,
  verifyActiveUser,
  AuthenticatedRequest,
} from '../middleware/auth';
import type { PermissionCode } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

// Target → permission required to import into it (mirrors the POS/inventory routes)
const TARGET_PERMISSION: Record<ImportTarget, PermissionCode> = {
  MENU: 'restaurant.menu',
  BAR: 'bar.menu',
  POOL: 'pool.manage',
  INVENTORY: 'inventory.manage',
  STOCK: 'inventory.adjust',
};

// Parse a pasted/uploaded document into rows + columns (no writes)
router.post(
  '/parse',
  requireAnyPermission('restaurant.view', 'bar.view', 'pool.view', 'inventory.view'),
  async (req, res, next) => {
    try {
      const { content, format } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Paste or upload a document to parse.' },
        });
      }
      const data = ImportService.parse(content, format === 'tsv' ? 'tsv' : format === 'text' ? 'text' : 'csv');
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

// Run the import into the chosen target
router.post('/run', async (req, res, next) => {
  try {
    const target = String(req.body.target || '').toUpperCase() as ImportTarget;
    const required = TARGET_PERMISSION[target];
    const user = (req as AuthenticatedRequest).user;
    if (!required || !user.permissions.includes(required)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to import into this target.' },
      });
    }
    const data = await ImportService.run(target, req.body, user.userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
