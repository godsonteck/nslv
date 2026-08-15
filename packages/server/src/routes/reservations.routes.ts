// ============================================
// NS LUXURY VILLA — Reservation Routes
// ============================================

import { Router } from 'express';
import { ReservationService } from '../services/reservations.service';
import { AppError } from '../middleware/error';
import { authenticate, requireAdmin, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createReservationSchema,
  updateReservationSchema,
  createMultiReservationSchema,
  attachGuestsSchema,
  cancelReservationSchema,
} from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

const reservationFailure = (error: unknown) => {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : 'Unable to complete the reservation.';
  if (/not available|already booked|changed concurrently/i.test(message)) {
    return new AppError(message, 409, 'ROOM_UNAVAILABLE');
  }
  if (/guest not found|departure date|additional guests|at least one room|only be booked once/i.test(message)) {
    return new AppError(message, 400, 'INVALID_RESERVATION');
  }
  return error;
};

// Check availability
router.get('/availability', requirePermission('reservations.view'), async (req, res, next) => {
  try {
    const { checkInDate, checkOutDate, roomTypeId } = req.query;
    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'checkInDate and checkOutDate required' } });
    }
    const data = await ReservationService.getAvailableRooms(
      new Date(checkInDate as string),
      new Date(checkOutDate as string),
      roomTypeId as string,
    );
    res.json({ success: true, data });
  } catch (error) {
    next(reservationFailure(error));
  }
});

// Get reservations
router.get('/', requirePermission('reservations.view'), async (req, res, next) => {
  try {
    const { status, search, roomId } = req.query;
    const data = await ReservationService.getReservations({
      status: status as string,
      search: search as string,
      roomId: roomId as string,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(reservationFailure(error));
  }
});

// Create reservation
router.post('/', requirePermission('reservations.create'), validateBody(createReservationSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const auth = (req as AuthenticatedRequest).user;
    const discountAmount = Number(req.body.discountAmount || 0);
    if (discountAmount > 0 && !auth.permissions.includes('folios.adjust')) {
      return res.status(403).json({ success: false, error: { code: 'DISCOUNT_NOT_AUTHORIZED', message: 'Discounts require folio-adjustment authorization.' } });
    }
    const data = await ReservationService.createReservation({ ...req.body, createdBy: userId, discountApprovedBy: discountAmount > 0 ? userId : undefined });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(reservationFailure(error));
  }
});

// Book multiple rooms as one party
router.post('/multi', requirePermission('reservations.create'), validateBody(createMultiReservationSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const auth = (req as AuthenticatedRequest).user;
    const discountAmount = Number(req.body.discountAmount || 0);
    if (discountAmount > 0 && !auth.permissions.includes('folios.adjust')) {
      return res.status(403).json({ success: false, error: { code: 'DISCOUNT_NOT_AUTHORIZED', message: 'Discounts require folio-adjustment authorization.' } });
    }
    const data = await ReservationService.createMultiReservation({ ...req.body, createdBy: userId });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(reservationFailure(error));
  }
});

// Amend an unstarted booking. The service rechecks availability and recalculates the stay total.
router.patch('/:id', requirePermission('reservations.edit'), validateBody(updateReservationSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await ReservationService.updateReservation(id, req.body, userId);
    res.json({ success: true, data });
  } catch (error) {
    next(reservationFailure(error));
  }
});

// Fetch a whole party (all reservations sharing a booking id)
router.get('/parties/:bookingId', requirePermission('reservations.view'), async (req, res, next) => {
  try {
    const bookingId = Array.isArray(req.params.bookingId) ? req.params.bookingId[0] : req.params.bookingId;
    const data = await ReservationService.getParty(bookingId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Attach additional guests to a reservation
router.post('/:id/guests', requirePermission('reservations.edit'), validateBody(attachGuestsSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await ReservationService.addGuestsToReservation(id, req.body.guestIds);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Cancel reservation
router.post('/:id/cancel', requirePermission('reservations.cancel'), validateBody(cancelReservationSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const { reason } = req.body;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await ReservationService.cancelReservation(id, userId, reason);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await ReservationService.deleteCancelledReservation(id, userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
