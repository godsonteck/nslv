// ============================================
// NS LUXURY VILLA — POS Routes (Restaurant, Bar, Pool)
// ============================================

import { Router } from 'express';
import { POSService } from '../services/pos.service';
import { authenticate, requirePermission, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createOrderSchema, createPOSItemSchema, createPoolAttendanceSchema, createPoolTransactionSchema, setAvailabilitySchema, updatePOSItemSchema } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

// ── RESTAURANT ──
router.get('/restaurant/items', requirePermission('restaurant.view'), async (_req, res, next) => {
  try {
    const data = await POSService.getRestaurantItems();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/restaurant/items', requirePermission('restaurant.menu'), validateBody(createPOSItemSchema), async (req, res, next) => {
  try {
    const data = await POSService.createRestaurantItem(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/restaurant/items/:id', requirePermission('restaurant.menu'), validateBody(updatePOSItemSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await POSService.updateRestaurantItem(id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/restaurant/items/:id/availability', requirePermission('restaurant.menu'), validateBody(setAvailabilitySchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await POSService.toggleRestaurantItem(id, Boolean(req.body.isAvailable));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete('/restaurant/items/:id', requirePermission('restaurant.menu'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await POSService.deleteRestaurantItem(id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/restaurant/orders', requirePermission('restaurant.orders'), async (_req, res, next) => {
  try {
    const data = await POSService.getRestaurantOrders();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/restaurant/orders', requirePermission('restaurant.orders'), validateBody(createOrderSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await POSService.createRestaurantOrder({ ...req.body, createdBy: userId });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ── BAR ──
router.get('/bar/items', requirePermission('bar.view'), async (_req, res, next) => {
  try {
    const data = await POSService.getBarItems();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/bar/items', requirePermission('bar.menu'), validateBody(createPOSItemSchema), async (req, res, next) => {
  try {
    const data = await POSService.createBarItem(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/bar/items/:id', requirePermission('bar.menu'), validateBody(updatePOSItemSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await POSService.updateBarItem(id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/bar/items/:id/availability', requirePermission('bar.menu'), validateBody(setAvailabilitySchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await POSService.toggleBarItem(id, Boolean(req.body.isAvailable));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete('/bar/items/:id', requirePermission('bar.menu'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await POSService.deleteBarItem(id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/bar/orders', requirePermission('bar.orders'), async (_req, res, next) => {
  try {
    const data = await POSService.getBarOrders();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/bar/orders', requirePermission('bar.orders'), validateBody(createOrderSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await POSService.createBarOrder({ ...req.body, createdBy: userId });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ── POOL ──
router.get('/pool/attendance', requirePermission('pool.view'), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await POSService.getPoolAttendance() });
  } catch (error) { next(error); }
});

router.post('/pool/attendance', requirePermission('pool.manage'), validateBody(createPoolAttendanceSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await POSService.createPoolAttendance({ ...req.body, partySize: Number(req.body.partySize), recordedBy: userId });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

router.get('/pool/services', requirePermission('pool.view'), async (_req, res, next) => {
  try {
    const data = await POSService.getPoolServices();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/pool/services', requirePermission('pool.manage'), validateBody(createPOSItemSchema), async (req, res, next) => {
  try {
    const data = await POSService.createPoolService(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/pool/services/:id', requirePermission('pool.manage'), validateBody(updatePOSItemSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await POSService.updatePoolService(id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/pool/services/:id/availability', requirePermission('pool.manage'), validateBody(setAvailabilitySchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await POSService.togglePoolService(id, Boolean(req.body.isAvailable));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete('/pool/services/:id', requirePermission('pool.manage'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await POSService.deletePoolService(id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/pool/transactions', requirePermission('pool.view'), async (_req, res, next) => {
  try {
    const data = await POSService.getPoolTransactions();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/pool/transactions', requirePermission('pool.manage'), validateBody(createPoolTransactionSchema), async (req, res, next) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const data = await POSService.createPoolTransaction({ ...req.body, processedBy: userId });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
