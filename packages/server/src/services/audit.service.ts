// ============================================
// NS LUXURY VILLA — Audit Logging Service
// Writes immutable audit trail to database
// ============================================

import { prisma } from '../config';
import type { Prisma } from '@prisma/client';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
}

export class AuditService {
  /**
   * Write an audit record as part of the caller's transaction. Use this for
   * financial mutations so a committed payment/charge cannot lack its audit
   * record because a separate best-effort write failed.
   */
  static async logInTransaction(tx: Prisma.TransactionClient, params: CreateAuditLogParams): Promise<void> {
    await tx.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId || null,
        beforeData: params.beforeData ? JSON.stringify(params.beforeData) : null,
        afterData: params.afterData ? JSON.stringify(params.afterData) : null,
        ipAddress: params.ipAddress || null,
        deviceInfo: params.deviceInfo || null,
      },
    });
  }
  /**
   * Log an auditable system action
   */
  static async log(params: CreateAuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId || null,
          beforeData: params.beforeData ? JSON.stringify(params.beforeData) : null,
          afterData: params.afterData ? JSON.stringify(params.afterData) : null,
          ipAddress: params.ipAddress || null,
          deviceInfo: params.deviceInfo || null,
        },
      });
    } catch (error) {
      // Audit logging must not crash the primary operation, but log error to console
      console.error('[AUDIT LOG ERROR] Failed to record audit log:', error);
    }
  }

  /**
   * Query audit logs with pagination and filters
   */
  static async queryLogs(params: {
    page?: number;
    pageSize?: number;
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (params.userId) where['userId'] = params.userId;
    if (params.action) where['action'] = { contains: params.action };
    if (params.resource) where['resource'] = params.resource;

    if (params.startDate || params.endDate) {
      const createdAt: Record<string, Date> = {};
      // Accept YYYY-MM-DD (as start-of-day / end-of-day) or full ISO (as-is).
      const parseBound = (value: string, boundary: 'start' | 'end') => {
        const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? `${value}${boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`
          : value;
        return new Date(iso);
      };
      if (params.startDate) createdAt['gte'] = parseBound(params.startDate, 'start');
      if (params.endDate) createdAt['lte'] = parseBound(params.endDate, 'end');
      where['createdAt'] = createdAt;
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const formattedItems = items.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
      userEmail: log.user?.email || null,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      beforeData: log.beforeData ? JSON.parse(log.beforeData) : null,
      afterData: log.afterData ? JSON.parse(log.afterData) : null,
      ipAddress: log.ipAddress,
      deviceInfo: log.deviceInfo,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      items: formattedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
