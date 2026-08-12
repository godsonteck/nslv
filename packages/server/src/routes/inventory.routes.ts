// ============================================
// NS LUXURY VILLA — Inventory Routes
// ============================================

import { Router } from 'express';
import { InventoryService } from '../services/inventory.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, verifyActiveUser);

// List inventory items
router.get('/', requirePermission('inventory.view'), async (req, res, next) => {
  try {
    const { search, category, lowStockOnly, includeInactive } = req.query;
    const data = await InventoryService.listItems({
      search: search as string | undefined,
      category: category as string | undefined,
      lowStockOnly: lowStockOnly === 'true',
      includeInactive: includeInactive === 'true',
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create item
router.post('/', requirePermission('inventory.manage'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await InventoryService.createItem(req.body, userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Update item
router.put('/:id', requirePermission('inventory.manage'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InventoryService.updateItem(id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Adjust stock
router.patch('/:id/stock', requirePermission('inventory.adjust'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { quantityChange, reason } = req.body;
    const change = Number(quantityChange);
    if (!Number.isInteger(change) || change === 0) {
      res.status(400).json({ success: false, message: 'Quantity change must be a non-zero whole number.' });
      return;
    }
    const data = await InventoryService.adjustStock(id, change, typeof reason === 'string' ? reason : undefined, userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Delete item
router.delete('/:id', requirePermission('inventory.manage'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await InventoryService.deleteItem(id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
