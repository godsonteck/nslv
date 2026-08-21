// ============================================
// NS LUXURY VILLA — Cash Register Routes
// /api/v1/cash-register
// ============================================

import { Router } from 'express';
import { CashRegisterService } from '../services/cash-register.service';
import { authenticate, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import type { NextFunction, Request, Response } from 'express';
import { validateBody, validateQuery } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
router.use(authenticate, verifyActiveUser);

/**
 * Reception is the designated cash-desk role. Keep the permission check too
 * so delegated users can be granted access without changing their role.
 */
const requireCashRegisterAccess = (manage = false) => (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  const roles = user?.roles.map((role) => role.toLowerCase()) ?? [];
  const permission = manage ? 'cash_register.manage' : 'cash_register.view';
  if (roles.includes('admin') || roles.includes('reception') || user?.permissions.includes(permission)) {
    next();
    return;
  }
  res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cash at Hand is available to Reception staff only.' } });
};

const openingSchema = z.object({
  businessDate: z.string().min(10, 'Business date required (YYYY-MM-DD)'),
  amount: z.number().nonnegative('Opening cash must be non-negative'),
  notes: z.string().max(500).optional(),
});

const entrySchema = z.object({
  businessDate: z.string().min(10, 'Business date required (YYYY-MM-DD)'),
  type: z.enum(['INFLOW', 'OUTFLOW']),
  amount: z.number().positive('Amount must be greater than zero'),
  description: z.string().min(1, 'Description is required').max(500),
  category: z.string().max(100).optional(),
  recipient: z.string().max(200).optional(),
  receiptRef: z.string().max(200).optional(),
});

const dateQuerySchema = z.object({
  businessDate: z.string().min(10, 'Business date required (YYYY-MM-DD)'),
});

// GET /api/v1/cash-register - get register with entries
router.get('/', requireCashRegisterAccess(), validateQuery(dateQuerySchema), async (req, res, next) => {
  try {
    const { businessDate } = req.query as { businessDate: string };
    const register = await CashRegisterService.listEntries(businessDate);
    if (!register) {
      res.json({ success: true, data: null });
      return;
    }
    const summary = await CashRegisterService.getSummary(businessDate);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/cash-register/summary - quick summary for dashboard
router.get('/summary', requireCashRegisterAccess(), validateQuery(dateQuerySchema), async (req, res, next) => {
  try {
    const { businessDate } = req.query as { businessDate: string };
    const summary = await CashRegisterService.getSummary(businessDate);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/cash-register/opening - set opening float
router.post('/opening', requireCashRegisterAccess(true), validateBody(openingSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const register = await CashRegisterService.setOpeningCash(req.body, userId);
    res.status(201).json({ success: true, data: register, message: 'Opening cash set successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/cash-register/entries - add inflow/outflow
router.post('/entries', requireCashRegisterAccess(true), validateBody(entrySchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const entry = await CashRegisterService.addEntry(req.body, userId);
    res.status(201).json({ success: true, data: entry, message: 'Cash entry recorded.' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/cash-register/entries/:id - delete entry (not opening)
router.delete('/entries/:id', requireCashRegisterAccess(true), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await CashRegisterService.deleteEntry(id, userId);
    res.json({ success: true, data: result, message: 'Entry deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
