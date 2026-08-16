// ============================================
// NS LUXURY VILLA — Payment Routes
// ============================================

import { Router } from 'express';
import { PaymentService } from '../services/payments.service';
import { authenticate, requireAdmin, requirePermission, requireAnyPermission, requireManagerOrAdmin, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { processPaymentSchema, refundPaymentSchema } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

// Get Payments
router.get('/', requirePermission('payments.view'), async (req, res, next) => {
  try {
    const { folioId, reservationId, guestId } = req.query;
    const data = await PaymentService.getPayments({
      folioId: folioId as string,
      reservationId: reservationId as string,
      guestId: guestId as string,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Process Payment
router.post('/', requirePermission('payments.create'), validateBody(processPaymentSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await PaymentService.processPayment({ ...req.body, processedBy: userId });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Request or Direct-Issue a Refund
// If requested by receptionist (non-manager/non-admin), creates a PENDING refund request.
// If requested by manager or admin, creates an immediately completed reversal.
router.post('/:id/refunds', requireAnyPermission('payments.refund', 'payments.create'), validateBody(refundPaymentSchema), async (req, res, next) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const isPrivileged = authUser.roles.some((r) => ['admin', 'manager'].includes(r.toLowerCase())) ||
      authUser.permissions.includes('payments.refund');
    const data = await PaymentService.refundPayment(req.params.id as string, { ...req.body, processedBy: authUser.userId }, isPrivileged);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Approve a Pending Refund Request (Admin or Manager only)
router.post('/:id/approve-refund', requireManagerOrAdmin, async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await PaymentService.approveRefund(req.params.id as string, userId, true);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Reject a Pending Refund Request (Admin or Manager only)
router.post('/:id/reject-refund', requireManagerOrAdmin, async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const reason = req.body.reason || 'Rejected by Manager/Admin';
    const data = await PaymentService.rejectRefund(req.params.id as string, userId, reason);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
