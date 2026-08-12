// ============================================
// NS LUXURY VILLA — Expense Routes
// ============================================

import { Router } from 'express';
import { ExpenseService } from '../services/expense.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, verifyActiveUser);

// List expenses
router.get('/', requirePermission('expenses.view'), async (req, res, next) => {
  try {
    const { status, category, search, startDate, endDate } = req.query;
    const data = await ExpenseService.listExpenses({
      status: status as string | undefined,
      category: category as string | undefined,
      search: search as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create expense
router.post('/', requirePermission('expenses.create'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await ExpenseService.createExpense(req.body, userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Update expense
router.put('/:id', requirePermission('expenses.create'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await ExpenseService.updateExpense(id, req.body, userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Approve / reject expense
router.patch('/:id/status', requirePermission('expenses.approve'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status } = req.body;
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ success: false, message: 'Status must be PENDING, APPROVED, or REJECTED.' });
      return;
    }
    const data = await ExpenseService.setStatus(id, status, userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Delete expense
router.delete('/:id', requirePermission('expenses.delete'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await ExpenseService.deleteExpense(id, userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
