// ============================================
// NS LUXURY VILLA — Payment Routes
// ============================================

import { Router } from 'express';
import { PaymentService } from '../services/payments.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';

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
router.post('/', requirePermission('payments.create'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await PaymentService.processPayment({ ...req.body, processedBy: userId });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
