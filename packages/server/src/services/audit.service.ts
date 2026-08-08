// ============================================
// NS LUXURY VILLA — Audit Logging Service
// Writes immutable audit trail to database
// ============================================

import { prisma } from '../config';

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
      if (params.startDate) createdAt['gte'] = new Date(params.startDate);
      if (params.endDate) createdAt['lte'] = new Date(params.endDate);
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
