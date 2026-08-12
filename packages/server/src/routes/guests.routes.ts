// ============================================
// NS LUXURY VILLA — Guest Routes
// ============================================

import { Router } from 'express';
import { GuestService } from '../services/guests.service';
import { authenticate, requirePermission, verifyActiveUser } from '../middleware/auth';

const router = Router();
router.use(authenticate, verifyActiveUser);

router.get('/', requirePermission('guests.view'), async (req, res, next) => {
  try {
    const { search, isVip } = req.query;
    const data = await GuestService.getGuests({
      search: search as string,
      isVip: isVip === 'true' ? true : isVip === 'false' ? false : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requirePermission('guests.view'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await GuestService.getGuestById(id);
    if (!data) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/', requirePermission('guests.create'), async (req, res, next) => {
  try {
    const data = await GuestService.createGuest(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requirePermission('guests.edit'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await GuestService.updateGuest(id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
