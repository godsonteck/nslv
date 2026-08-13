// NSVilla — System administration service
// Destructive, password-gated full system reset (Admin only).

import argon2 from 'argon2';
import { prisma } from '../config';
import { AppError } from '../middleware/error';

/**
 * Ordered list of operational and catalog models to wipe, deepest dependencies
 * first. Admin identity and authorization records are intentionally preserved so
 * the platform can be reset without deleting the administrator account.
 */
export const RESET_WIPE_ORDER = [
  'barOrderItem',
  'restaurantOrderItem',
  'barOrder',
  'restaurantOrder',
  'poolTransaction',
  'poolAttendance',
  'folioItem',
  'payment',
  'folio',
  'checkOut',
  'checkIn',
  'reservationGuest',
  'reservation',
  'guest',
  'restaurantItem',
  'barItem',
  'poolService',
  'eventBooking',
  'eventSpace',
  'expense',
  'inventoryItem',
  'itemCategory',
  'notification',
  'session',
  'auditLog',
  'roomTypeAmenity',
  'room',
  'roomAmenity',
  'roomType',
] as const;

const WIPE_ORDER = RESET_WIPE_ORDER;

export class SystemService {
  /**
   * Wipe every operational and catalog record in the system.
   * Requires the confirmation phrase "RESET" and the requesting admin's
   * password, then clears all data inside a transaction and leaves an audit
   * trail of the reset afterwards.
   */
  static async resetSystem(userId: string, body: { confirmText?: string; password?: string }) {
    if (body.confirmText !== 'RESET') {
      throw new AppError('Type RESET to confirm you want to clear the entire system.', 400, 'INVALID_CONFIRMATION');
    }
    if (!body.password) {
      throw new AppError('Your password is required to confirm this action.', 400, 'PASSWORD_REQUIRED');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, passwordHash: true, status: true },
    });
    if (!user) throw new AppError('Account not found.', 404, 'USER_NOT_FOUND');
    if (user.status !== 'ACTIVE') throw new AppError('Account is not available.', 403, 'ACCOUNT_INACTIVE');

    const passwordValid = await argon2.verify(user.passwordHash, body.password);
    if (!passwordValid) throw new AppError('Incorrect password. Reset cancelled.', 401, 'INVALID_CREDENTIALS');

    const counts: Record<string, number> = {};

    await prisma.$transaction(async (tx) => {
      const client = tx as unknown as Record<string, { deleteMany: (args?: any) => Promise<{ count: number }> }>;
      for (const model of WIPE_ORDER) {
        const { count } = await client[model].deleteMany({});
        counts[model] = count;
      }
    });

    // Preserve a permanent audit trail of the destructive reset.
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SYSTEM_RESET',
        resource: 'SYSTEM',
        afterData: JSON.stringify({ counts, resetAt: new Date().toISOString() }),
        ipAddress: 'server',
        deviceInfo: 'full-system-reset',
      },
    });

    return { counts, resetAt: new Date().toISOString() };
  }
}