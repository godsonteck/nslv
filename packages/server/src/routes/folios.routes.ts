// ============================================
// NS LUXURY VILLA — Folio Routes
// ============================================

import { Router } from 'express';
import { FolioService } from '../services/folios.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, verifyActiveUser);

// Get Folio details
router.get('/:id', requirePermission('folios.view'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await FolioService.getFolio(id);
    if (!data) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Add Charge to Folio
router.post('/:id/charges', requirePermission('folios.manage'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await FolioService.addCharge({ ...req.body, folioId: id, postedBy: userId });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Void Charge Item
router.post('/items/:itemId/void', requirePermission('folios.adjust'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const { reason } = req.body;
    const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
    const data = await FolioService.voidCharge(itemId, userId, reason || 'Voided by user');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
