// ============================================
// NS LUXURY VILLA — Notifications Routes
// /api/v1/notifications
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { authenticate, verifyActiveUser, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, verifyActiveUser);

/**
 * GET /api/v1/notifications
 * List notifications for the authenticated user
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const pageSize = typeof req.query.pageSize === 'string' ? parseInt(req.query.pageSize, 10) : 20;
    const isRead = typeof req.query.isRead === 'string' ? req.query.isRead === 'true' : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;

    const result = await NotificationService.listForUser(authReq.user.userId, {
      page,
      pageSize,
      isRead,
      type,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/notifications/unread/count
 * Get unread notification count
 */
router.get('/unread/count', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const count = await NotificationService.getUnreadCount(authReq.user.userId);
    res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a specific notification as read
 */
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notification = await NotificationService.markAsRead(id);
    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/notifications/mark-all-read
 * Mark all notifications as read for the user
 */
router.patch('/mark-all-read', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    await NotificationService.markAllAsRead(authReq.user.userId);
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await NotificationService.delete(id);
    res.status(200).json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
