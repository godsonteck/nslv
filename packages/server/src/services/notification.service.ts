// ============================================
// NS LUXURY VILLA — Notification Service
// Manage user notifications
// ============================================

import { prisma } from '../config';

export interface CreateNotificationParams {
  userId: string;
  type: 'RESERVATION' | 'PAYMENT' | 'ALERT' | 'SYSTEM' | 'INFO';
  title: string;
  message: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  data?: Record<string, unknown> | null;
  expiresAt?: Date | null;
}

export class NotificationService {
  /**
   * Create a new notification for a user
   */
  static async create(params: CreateNotificationParams) {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        priority: params.priority || 'MEDIUM',
        data: params.data ? JSON.stringify(params.data) : null,
        expiresAt: params.expiresAt || null,
      },
    });
  }

  /**
   * List notifications for a user with pagination
   */
  static async listForUser(userId: string, params?: {
    page?: number;
    pageSize?: number;
    isRead?: boolean;
    type?: string;
  }) {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { userId };
    if (params?.isRead !== undefined) where['isRead'] = params.isRead;
    if (params?.type) where['type'] = params.type;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    const formatted = notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      priority: n.priority,
      data: n.data ? JSON.parse(n.data) : null,
      isRead: n.isRead,
      readAt: n.readAt?.toISOString() || null,
      createdAt: n.createdAt.toISOString(),
      expiresAt: n.expiresAt?.toISOString() || null,
    }));

    return {
      items: formatted,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId: string) {
    return await prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string) {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string) {
    return await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Delete a notification
   */
  static async delete(notificationId: string) {
    return await prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Clear expired notifications
   */
  static async clearExpired() {
    return await prisma.notification.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    });
  }
}
