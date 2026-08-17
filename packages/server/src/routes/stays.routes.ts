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

// Get checkout policy (hourly rate + checkout time) — used by front desk to display accurate late fees
router.get('/checkout-policy', requirePermission('dashboard.view'), async (_req, res, next) => {
  try {
    const { prisma } = await import('../config');
    const [rateSetting, timeSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'financial.late_checkout_fee' } }),
      prisma.systemSetting.findUnique({ where: { key: 'villa.checkout_time' } }),
    ]);
    const hourlyRate = rateSetting ? Number(JSON.parse(rateSetting.value)) || 50 : 50;
    const checkoutTime = timeSetting ? String(JSON.parse(timeSetting.value) || '12:00') : '12:00';
    res.json({ success: true, data: { hourlyRate, checkoutTime } });
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

// Recalculate and auto-adjust historical late checkout fees
router.post('/recalculate-late-fees', requirePermission('settings.edit'), async (_req, res, next) => {
  try {
    const result = await StayService.autoAdjustHistoricalLateCheckoutFees();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Get all late check-outs audit for admin portal
router.get('/late-checkouts', requirePermission('dashboard.view'), async (req, res, next) => {
  try {
    const { startDate, endDate, search } = req.query;
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    const data = await StayService.getLateCheckoutsAudit({
      startDate: start,
      endDate: end,
      search: search ? String(search) : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
