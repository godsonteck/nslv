// ============================================
// NS LUXURY VILLA — Payment Routes
// ============================================

import { Router } from 'express';
import { PaymentService } from '../services/payments.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
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

// Refund a payment by creating a separate immutable reversal transaction.
router.post('/:id/refunds', requirePermission('payments.refund'), validateBody(refundPaymentSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await PaymentService.refundPayment(req.params.id as string, { ...req.body, processedBy: userId });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
