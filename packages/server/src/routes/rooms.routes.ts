// ============================================
// NS LUXURY VILLA — Room Routes
// ============================================

import { Router } from 'express';
import { RoomService } from '../services/rooms.service';
import { authenticate, requirePermission, verifyActiveUser } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createRoomTypeSchema,
  updateRoomTypeSchema,
  createRoomSchema,
  updateRoomSchema,
  updateRoomStatusSchema,
} from '@nslv/shared';


const router = Router();
router.use(authenticate, verifyActiveUser);

// Get room types
router.get('/types', requirePermission('rooms.view'), async (_req, res, next) => {
  try {
    const data = await RoomService.getRoomTypes();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create room type
router.post('/types', requirePermission('rooms.manage'), validateBody(createRoomTypeSchema), async (req, res, next) => {
  try {
    const data = await RoomService.createRoomType(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Update room type
router.patch('/types/:id', requirePermission('rooms.manage'), validateBody(updateRoomTypeSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await RoomService.updateRoomType(id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Delete room type
router.delete('/types/:id', requirePermission('rooms.manage'), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await RoomService.deleteRoomType(id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// List room amenities
router.get('/amenities', requirePermission('rooms.view'), async (_req, res, next) => {
  try {
    const data = await RoomService.getAmenities();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Get rooms
router.get('/', requirePermission('rooms.view'), async (req, res, next) => {
  try {
    const { status, roomTypeId, search } = req.query;
    const data = await RoomService.getRooms({
      status: status as string,
      roomTypeId: roomTypeId as string,
      search: search as string,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create room
router.post('/', requirePermission('rooms.manage'), validateBody(createRoomSchema), async (req, res, next) => {
  try {
    const data = await RoomService.createRoom(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Update room status
router.patch('/:id/status', requirePermission('rooms.status'), validateBody(updateRoomStatusSchema), async (req, res, next) => {
  try {
    const roomId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status, notes } = req.body;
    const data = await RoomService.updateRoomStatus(roomId, status as string, typeof notes === 'string' ? notes : undefined);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Update room details
router.patch('/:id', requirePermission('rooms.manage'), validateBody(updateRoomSchema), async (req, res, next) => {
  try {
    const roomId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await RoomService.updateRoom(roomId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Delete room
router.delete('/:id', requirePermission('rooms.manage'), async (req, res, next) => {
  try {
    const roomId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await RoomService.deleteRoom(roomId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});


export default router;
