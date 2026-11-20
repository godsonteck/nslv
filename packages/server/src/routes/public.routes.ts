// ============================================
// NS LUXURY VILLA — Public Booking Routes
// No staff session. Rate-limited and validated.
// ============================================

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { PublicBookingService } from '../services/public-booking.service';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createPublicBookingSchema,
  publicAvailabilityQuerySchema,
  submitMomoReferenceSchema,
} from '@nslv/shared';

const router = Router();

const browseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait a moment.' } },
});

const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many booking attempts. Please try again later or call the villa.' } },
});

router.use(browseLimiter);

router.get('/config', async (_req, res, next) => {
  try {
    const data = await PublicBookingService.getConfig();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/availability', validateQuery(publicAvailabilityQuerySchema), async (req, res, next) => {
  try {
    const query = req.query as unknown as {
      checkInDate: string;
      checkOutDate: string;
      adults?: number;
      children?: number;
      roomNumber?: string;
    };
    const data = await PublicBookingService.getAvailability(query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/bookings', writeLimiter, validateBody(createPublicBookingSchema), async (req, res, next) => {
  try {
    const data = await PublicBookingService.createBooking(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/bookings/:confirmationNo', async (req, res, next) => {
  try {
    const confirmationNo = Array.isArray(req.params.confirmationNo) ? req.params.confirmationNo[0] : req.params.confirmationNo;
    const email = String(req.query.email || '').trim();
    if (!email) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email address is required to look up a booking.' } });
    }
    const data = await PublicBookingService.lookupBooking(confirmationNo, email);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/bookings/:confirmationNo/payment-reference',
  writeLimiter,
  validateBody(submitMomoReferenceSchema),
  async (req, res, next) => {
    try {
      const confirmationNo = Array.isArray(req.params.confirmationNo) ? req.params.confirmationNo[0] : req.params.confirmationNo;
      const data = await PublicBookingService.submitPaymentReference(confirmationNo, req.body.email, req.body.reference);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
