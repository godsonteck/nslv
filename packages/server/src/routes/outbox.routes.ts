// ============================================
// NS LUXURY VILLA — Message Outbox Routes
// Staff can inspect and manually settle mock messages.
// ============================================

import { Router } from 'express';
import { MessagingService } from '../services/messaging.service';
import { authenticate, requirePermission, verifyActiveUser } from '../middleware/auth';
import { PERMISSIONS } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

router.get('/', requirePermission(PERMISSIONS.SETTINGS_VIEW), async (req, res, next) => {
  try {
    const data = await MessagingService.list({
      status: req.query.status as string | undefined,
      channel: req.query.channel as string | undefined,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 25,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/mark-sent', requirePermission(PERMISSIONS.SETTINGS_EDIT), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await MessagingService.markSent(id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/retry', requirePermission(PERMISSIONS.SETTINGS_EDIT), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await MessagingService.retry(id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
