// ============================================
// NS LUXURY VILLA — Events Routes
// Event spaces and event bookings
// ============================================

import { Router } from 'express';
import { EventsService } from '../services/events.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createEventSpaceSchema,
  updateEventSpaceSchema,
  createEventBookingSchema,
  updateEventBookingSchema,
} from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

// ── EVENT SPACES ──
router.get('/spaces', requirePermission('events.view'), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await EventsService.listSpaces() });
  } catch (error) {
    next(error);
  }
});

router.post('/spaces', requirePermission('events.edit'), async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await EventsService.createSpace(req.body) });
  } catch (error) {
    next(error);
  }
});

router.patch('/spaces/:id', requirePermission('events.edit'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ success: true, data: await EventsService.updateSpace(id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.delete('/spaces/:id', requirePermission('events.edit'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ success: true, data: await EventsService.deleteSpace(id) });
  } catch (error) {
    next(error);
  }
});

// ── EVENT BOOKINGS ──
router.get('/', requirePermission('events.view'), async (req, res, next) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    res.json({ success: true, data: await EventsService.listBookings(from, to) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requirePermission('events.view'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const booking = await EventsService.getBooking(id);
    if (!booking) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found.' } });
      return;
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
});

router.post('/', requirePermission('events.create'), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    res.status(201).json({ success: true, data: await EventsService.createBooking(req.body, userId) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requirePermission('events.edit'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ success: true, data: await EventsService.updateBooking(id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', requirePermission('events.edit'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ success: true, data: await EventsService.cancelBooking(id) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requirePermission('events.cancel'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ success: true, data: await EventsService.deleteBooking(id) });
  } catch (error) {
    next(error);
  }
});

export default router;