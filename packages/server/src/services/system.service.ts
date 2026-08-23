// ============================================
// NS LUXURY VILLA — System Administration Service
// Selective & Full System Reset (Admin Only)
// ============================================

import argon2 from 'argon2';
import { prisma } from '../config';
import { AppError } from '../middleware/error';
import type { ResetSystemModules } from '@nslv/shared';

/**
 * Ordered list of operational and catalog models for full system wipe,
 * deepest dependencies first. Admin identity, roles and permission records
 * are intentionally preserved so the platform can be reset without deleting
 * the administrator accounts.
 */
export const RESET_WIPE_ORDER = [
  'inventoryMovement',
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
  'cashRegisterEntry',
  'cashRegister',
  'dailyClose',
  'notification',
  'session',
  'auditLog',
  'roomTypeAmenity',
  'room',
  'roomAmenity',
  'roomType',
] as const;

export class SystemService {
  /**
   * Get live counts of records across all system modules so the admin
   * can preview what will be affected before confirming a reset.
   */
  static async getCounts() {
    const [
      reservations,
      checkIns,
      checkOuts,
      folios,
      guests,
      restaurantOrders,
      barOrders,
      poolTransactions,
      poolAttendance,
      eventBookings,
      payments,
      cashRegisterEntries,
      cashRegisters,
      dailyCloses,
      expenses,
      inventoryItems,
      restaurantItems,
      barItems,
      poolServices,
      itemCategories,
      rooms,
      roomTypes,
      roomAmenities,
      auditLogs,
      notifications,
    ] = await Promise.all([
      prisma.reservation.count().catch(() => 0),
      prisma.checkIn.count().catch(() => 0),
      prisma.checkOut.count().catch(() => 0),
      prisma.folio.count().catch(() => 0),
      prisma.guest.count().catch(() => 0),
      prisma.restaurantOrder.count().catch(() => 0),
      prisma.barOrder.count().catch(() => 0),
      prisma.poolTransaction.count().catch(() => 0),
      prisma.poolAttendance.count().catch(() => 0),
      prisma.eventBooking.count().catch(() => 0),
      prisma.payment.count().catch(() => 0),
      prisma.cashRegisterEntry.count().catch(() => 0),
      prisma.cashRegister.count().catch(() => 0),
      prisma.dailyClose.count().catch(() => 0),
      prisma.expense.count().catch(() => 0),
      prisma.inventoryItem.count().catch(() => 0),
      prisma.restaurantItem.count().catch(() => 0),
      prisma.barItem.count().catch(() => 0),
      prisma.poolService.count().catch(() => 0),
      prisma.itemCategory.count().catch(() => 0),
      prisma.room.count().catch(() => 0),
      prisma.roomType.count().catch(() => 0),
      prisma.roomAmenity.count().catch(() => 0),
      prisma.auditLog.count().catch(() => 0),
      prisma.notification.count().catch(() => 0),
    ]);

    return {
      reservations: {
        total: reservations + checkIns + checkOuts + folios + guests,
        reservations,
        stays: checkIns,
        checkOuts,
        folios,
        guests,
      },
      posOrders: {
        total: restaurantOrders + barOrders,
        restaurantOrders,
        barOrders,
      },
      pool: {
        total: poolTransactions + poolAttendance,
        poolTransactions,
        poolAttendance,
      },
      events: {
        total: eventBookings,
        eventBookings,
      },
      finance: {
        total: payments + cashRegisterEntries + cashRegisters + dailyCloses,
        payments,
        cashRegisterEntries,
        cashRegisters,
        dailyCloses,
      },
      expenses: {
        total: expenses,
        expenses,
      },
      inventory: {
        total: inventoryItems,
        inventoryItems,
      },
      catalogs: {
        total: restaurantItems + barItems + poolServices + itemCategories,
        restaurantItems,
        barItems,
        poolServices,
        itemCategories,
      },
      rooms: {
        total: rooms + roomTypes + roomAmenities,
        rooms,
        roomTypes,
        roomAmenities,
      },
      auditLogs: {
        total: auditLogs,
        auditLogs,
      },
      notifications: {
        total: notifications,
        notifications,
      },
    };
  }

  /**
   * Wipe operational and catalog records in the system.
   * Supports either full system wipe or selective module wipe.
   */
  static async resetSystem(
    userId: string,
    body: { confirmText?: string; password?: string; modules?: ResetSystemModules },
  ) {
    if (body.confirmText !== 'RESET') {
      throw new AppError('Type RESET to confirm you want to proceed with the reset.', 400, 'INVALID_CONFIRMATION');
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

    const modules = body.modules;
    const isFullWipe =
      !modules ||
      Object.keys(modules).length === 0 ||
      Object.values(modules).every((v) => v === true);

    const counts: Record<string, number> = {};
    const modulesWiped: string[] = [];

    await prisma.$transaction(async (tx) => {
      const client = tx as unknown as Record<string, { deleteMany: (args?: any) => Promise<{ count: number }> }>;

      if (isFullWipe) {
        // Execute full wipe in strict dependency order
        for (const model of RESET_WIPE_ORDER) {
          if (client[model]) {
            const { count } = await client[model].deleteMany({});
            counts[model] = count;
          }
        }
        modulesWiped.push('ALL_MODULES');
      } else {
        // Selective Wipe with dependency protection

        // 1. POS Orders (Restaurant & Bar)
        if (modules.posOrders) {
          if (client.restaurantOrderItem) {
            const { count } = await client.restaurantOrderItem.deleteMany({});
            counts.restaurantOrderItem = count;
          }
          if (client.restaurantOrder) {
            const { count } = await client.restaurantOrder.deleteMany({});
            counts.restaurantOrder = count;
          }
          if (client.barOrderItem) {
            const { count } = await client.barOrderItem.deleteMany({});
            counts.barOrderItem = count;
          }
          if (client.barOrder) {
            const { count } = await client.barOrder.deleteMany({});
            counts.barOrder = count;
          }
          modulesWiped.push('posOrders');
        }

        // 2. Pool Transactions & Attendance
        if (modules.pool) {
          if (client.poolTransaction) {
            const { count } = await client.poolTransaction.deleteMany({});
            counts.poolTransaction = count;
          }
          if (client.poolAttendance) {
            const { count } = await client.poolAttendance.deleteMany({});
            counts.poolAttendance = count;
          }
          modulesWiped.push('pool');
        }

        // 3. Events Bookings
        if (modules.events) {
          if (client.eventBooking) {
            const { count } = await client.eventBooking.deleteMany({});
            counts.eventBooking = count;
          }
          modulesWiped.push('events');
        }

        // 4. Reservations, Stays & Guests (or if Rooms config is being wiped, reservations must be wiped first)
        if (modules.reservations || modules.rooms) {
          if (client.folioItem) {
            const { count } = await client.folioItem.deleteMany({});
            counts.folioItem = count;
          }
          if (client.payment) {
            const { count } = await client.payment.deleteMany({});
            counts.payment = count;
          }
          if (client.folio) {
            const { count } = await client.folio.deleteMany({});
            counts.folio = count;
          }
          if (client.checkOut) {
            const { count } = await client.checkOut.deleteMany({});
            counts.checkOut = count;
          }
          if (client.checkIn) {
            const { count } = await client.checkIn.deleteMany({});
            counts.checkIn = count;
          }
          if (client.reservationGuest) {
            const { count } = await client.reservationGuest.deleteMany({});
            counts.reservationGuest = count;
          }
          if (client.reservation) {
            const { count } = await client.reservation.deleteMany({});
            counts.reservation = count;
          }
          if (client.guest) {
            const { count } = await client.guest.deleteMany({});
            counts.guest = count;
          }
          // Reset all room statuses back to AVAILABLE
          await tx.room.updateMany({ data: { status: 'AVAILABLE' } }).catch(() => null);
          modulesWiped.push('reservations');
        }

        // 5. Finance (Cash Register, Closes, Payments)
        if (modules.finance) {
          if (client.cashRegisterEntry) {
            const { count } = await client.cashRegisterEntry.deleteMany({});
            counts.cashRegisterEntry = count;
          }
          if (client.cashRegister) {
            const { count } = await client.cashRegister.deleteMany({});
            counts.cashRegister = count;
          }
          if (client.dailyClose) {
            const { count } = await client.dailyClose.deleteMany({});
            counts.dailyClose = count;
          }
          if (client.payment && !counts.payment) {
            const { count } = await client.payment.deleteMany({});
            counts.payment = count;
          }
          modulesWiped.push('finance');
        }

        // 6. Expenses
        if (modules.expenses) {
          if (client.expense) {
            const { count } = await client.expense.deleteMany({});
            counts.expense = count;
          }
          modulesWiped.push('expenses');
        }

        // 7. Inventory
        if (modules.inventory) {
          if (client.inventoryMovement) {
            const { count } = await client.inventoryMovement.deleteMany({});
            counts.inventoryMovement = count;
          }
          if (client.inventoryItem) {
            const { count } = await client.inventoryItem.deleteMany({});
            counts.inventoryItem = count;
          }
          modulesWiped.push('inventory');
        }

        // 8. Catalogs (Menus, Pool Services, Categories)
        if (modules.catalogs) {
          // If orders weren't already wiped, clear order items to satisfy FK
          if (client.restaurantOrderItem && !counts.restaurantOrderItem) {
            await client.restaurantOrderItem.deleteMany({});
          }
          if (client.barOrderItem && !counts.barOrderItem) {
            await client.barOrderItem.deleteMany({});
          }
          if (client.restaurantItem) {
            const { count } = await client.restaurantItem.deleteMany({});
            counts.restaurantItem = count;
          }
          if (client.barItem) {
            const { count } = await client.barItem.deleteMany({});
            counts.barItem = count;
          }
          if (client.poolService) {
            const { count } = await client.poolService.deleteMany({});
            counts.poolService = count;
          }
          if (client.itemCategory) {
            const { count } = await client.itemCategory.deleteMany({});
            counts.itemCategory = count;
          }
          modulesWiped.push('catalogs');
        }

        // 9. Room Configuration
        if (modules.rooms) {
          if (client.roomTypeAmenity) {
            const { count } = await client.roomTypeAmenity.deleteMany({});
            counts.roomTypeAmenity = count;
          }
          if (client.room) {
            const { count } = await client.room.deleteMany({});
            counts.room = count;
          }
          if (client.roomAmenity) {
            const { count } = await client.roomAmenity.deleteMany({});
            counts.roomAmenity = count;
          }
          if (client.roomType) {
            const { count } = await client.roomType.deleteMany({});
            counts.roomType = count;
          }
          modulesWiped.push('rooms');
        }

        // 10. Notifications
        if (modules.notifications) {
          if (client.notification) {
            const { count } = await client.notification.deleteMany({});
            counts.notification = count;
          }
          modulesWiped.push('notifications');
        }

        // 11. Historical Audit Logs
        if (modules.auditLogs) {
          if (client.auditLog) {
            const { count } = await client.auditLog.deleteMany({});
            counts.auditLog = count;
          }
          modulesWiped.push('auditLogs');
        }
      }
    });

    // Record an immutable audit trail of this reset operation
    await prisma.auditLog.create({
      data: {
        userId,
        action: isFullWipe ? 'SYSTEM_RESET_FULL' : 'SYSTEM_RESET_SELECTIVE',
        resource: 'SYSTEM',
        afterData: JSON.stringify({
          isFullWipe,
          modulesWiped,
          counts,
          resetAt: new Date().toISOString(),
        }),
        ipAddress: 'server',
        deviceInfo: isFullWipe ? 'full-system-reset' : 'selective-system-reset',
      },
    }).catch(() => null);

    return {
      isFullWipe,
      modulesWiped,
      counts,
      resetAt: new Date().toISOString(),
    };
  }
}