// ============================================
// NS LUXURY VILLA — Guest Booking Routes
// A signed-in guest can only see and cancel their own bookings.
// ============================================

import { Router } from 'express';
import { z } from 'zod';
import { PublicBookingService } from '../services/public-booking.service';
import { authenticateGuest, GuestAuthenticatedRequest } from '../middleware/guest-auth';
import { validateBody } from '../middleware/validate';

const router = Router();
router.use(authenticateGuest);

const cancelSchema = z.object({
  reason: z.string().max(500).trim().optional(),
});

router.get('/bookings', async (req, res, next) => {
  try {
    const data = await PublicBookingService.getGuestBookings((req as GuestAuthenticatedRequest).guest.guestAccountId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/bookings/:id', async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await PublicBookingService.getGuestBooking((req as unknown as GuestAuthenticatedRequest).guest.guestAccountId, id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/bookings/:id/cancel', validateBody(cancelSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await PublicBookingService.cancelGuestBooking(
      (req as unknown as GuestAuthenticatedRequest).guest.guestAccountId,
      id,
      req.body.reason,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
