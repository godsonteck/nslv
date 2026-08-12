// ============================================
// NS LUXURY VILLA — Check-In / Check-Out Stays Routes
// ============================================

import { Router } from 'express';
import { StayService } from '../services/stays.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { checkInSchema, checkOutSchema } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

// Get active stays
router.get('/active', requirePermission('dashboard.view'), async (_req, res, next) => {
  try {
    const data = await StayService.getActiveStays();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Check in guest
router.post('/check-in', requirePermission('checkin.perform'), validateBody(checkInSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await StayService.checkInGuest({ ...req.body, checkedInBy: userId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Check out guest
router.post('/check-out', requirePermission('checkout.perform'), validateBody(checkOutSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await StayService.checkOutGuest({ ...req.body, checkedOutBy: userId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
