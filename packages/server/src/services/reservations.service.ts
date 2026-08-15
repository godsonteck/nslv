// ============================================
// NS LUXURY VILLA — Reservation Service
// Real availability calculation & booking transaction safety
// ============================================

import { prisma } from '../config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AppError } from '../middleware/error';
import { AuditService } from './audit.service';

export interface CreateReservationDTO {
  guestId: string;
  roomId: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  adults?: number;
  children?: number;
  baseRate?: number;
  discountAmount?: number;
  discountReason?: string;
  discountApprovedBy?: string;
  taxAmount?: number;
  depositAmount?: number;
  source?: string;
  specialRequests?: string;
  notes?: string;
  createdBy?: string;
  /** Groups this reservation with others into one party/booking */
  bookingId?: string;
  /** Additional guests staying in this room (per-room guest list) */
  additionalGuestIds?: string[];
}

export interface CreateMultiReservationDTO {
  checkInDate: string | Date;
  checkOutDate: string | Date;
  source?: string;
  specialRequests?: string;
  notes?: string;
  createdBy?: string;
  /** One entry per room in the party */
  rooms: Array<{
    roomId: string;
    guestId: string;
    adults?: number;
    children?: number;
    additionalGuestIds?: string[];
  }>;
}

export interface UpdateReservationDTO {
  roomId?: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  adults?: number;
  children?: number;
  source?: string;
  specialRequests?: string;
  notes?: string;
}

export class ReservationService {
  /** Check if room is available for given dates */
  static async checkAvailability(
    roomId: string,
    checkInDate: Date,
    checkOutDate: Date,
    excludeReservationId?: string,
    txClient?: any,
  ) {
    const db = txClient || prisma;
    const overlapping = await db.reservation.findFirst({
      where: {
        roomId,
        id: excludeReservationId ? { not: excludeReservationId } : undefined,
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'] },
        AND: [
          { checkInDate: { lt: checkOutDate } },
          { checkOutDate: { gt: checkInDate } },
        ],
      },
    });

    return !overlapping;
  }

  /** Find available rooms for date range */
  static async getAvailableRooms(checkInDate: Date, checkOutDate: Date, roomTypeId?: string) {
    const where: any = {
      isActive: true,
      status: { notIn: ['MAINTENANCE', 'OUT_OF_SERVICE'] },
    };
    if (roomTypeId) where.roomTypeId = roomTypeId;

    const allRooms = await prisma.room.findMany({
      where,
      include: { roomType: true },
    });

    const unavailableRoomIds = (
      await prisma.reservation.findMany({
        where: {
          status: { notIn: ['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'] },
          AND: [
            { checkInDate: { lt: checkOutDate } },
            { checkOutDate: { gt: checkInDate } },
          ],
        },
        select: { roomId: true },
      })
    ).map((r) => r.roomId);

    return allRooms.filter((room) => !unavailableRoomIds.includes(room.id));
  }

  /** List reservations */
  static async getReservations(filters?: { status?: string; search?: string; roomId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.roomId) where.roomId = filters.roomId;
    if (filters?.search) {
      where.OR = [
        { confirmationNo: { contains: filters.search, mode: 'insensitive' } },
        { guests: { some: { guest: { lastName: { contains: filters.search, mode: 'insensitive' } } } } },
        { guests: { some: { guest: { firstName: { contains: filters.search, mode: 'insensitive' } } } } },
      ];
    }

    return prisma.reservation.findMany({
      where,
      include: {
        room: { include: { roomType: true } },
        guests: { include: { guest: true } },
        folios: true,
      },
      orderBy: { checkInDate: 'asc' },
    });
  }

  /** Amend a booking before check-in, protecting availability and prior deposits. */
  static async updateReservation(id: string, data: UpdateReservationDTO, updatedBy: string) {
    const checkIn = new Date(data.checkInDate);
    const checkOut = new Date(data.checkOutDate);
    if (checkOut <= checkIn) throw new Error('Departure date must be strictly after arrival date.');

    try {
      return await prisma.$transaction(async (tx) => {
        const reservation = await tx.reservation.findUnique({ where: { id } });
        if (!reservation) throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
        if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
          throw new AppError('Only pending or confirmed reservations can be edited. Use the stay workflow after check-in.', 409, 'RESERVATION_NOT_EDITABLE');
        }
        const roomId = data.roomId || reservation.roomId;
        const [available, room] = await Promise.all([
          this.checkAvailability(roomId, checkIn, checkOut, id, tx),
          tx.room.findUnique({ where: { id: roomId }, include: { roomType: true } }),
        ]);
        if (!available || !room || !room.isActive || ['MAINTENANCE', 'OUT_OF_SERVICE'].includes(room.status)) {
          throw new Error('The selected room is not available for the specified dates.');
        }
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const totalAmount = Math.max(0, Number(room.roomType.basePrice) * nights - Number(reservation.discountAmount) + Number(reservation.taxAmount));
        const deposits = await tx.payment.aggregate({
          where: { reservationId: id, type: 'DEPOSIT', status: 'COMPLETED', voidedAt: null }, _sum: { amount: true },
        });
        if (Number(deposits._sum.amount || 0) > totalAmount) {
          throw new AppError('This change would make completed deposits exceed the revised reservation total.', 409, 'DEPOSIT_EXCEEDS_TOTAL');
        }
        const updated = await tx.reservation.update({
          where: { id },
          data: {
            roomId, checkInDate: checkIn, checkOutDate: checkOut,
            adults: data.adults ?? reservation.adults, children: data.children ?? reservation.children,
            source: data.source ?? reservation.source, specialRequests: data.specialRequests,
            notes: data.notes, baseRate: room.roomType.basePrice, totalAmount,
          },
          include: { room: { include: { roomType: true } }, guests: { include: { guest: true } }, folios: true },
        });
        if (roomId !== reservation.roomId) {
          await tx.room.update({ where: { id: roomId }, data: { status: 'RESERVED' } });
          const otherReservations = await tx.reservation.findFirst({
            where: { roomId: reservation.roomId, id: { not: id }, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] } }, select: { id: true },
          });
          const oldRoom = await tx.room.findUnique({ where: { id: reservation.roomId }, select: { status: true } });
          if (oldRoom?.status === 'RESERVED' && !otherReservations) await tx.room.update({ where: { id: reservation.roomId }, data: { status: 'AVAILABLE' } });
        }
        await AuditService.logInTransaction(tx, {
          userId: updatedBy, action: 'reservation.updated', resource: 'reservation', resourceId: id,
          beforeData: { roomId: reservation.roomId, checkInDate: reservation.checkInDate.toISOString(), checkOutDate: reservation.checkOutDate.toISOString(), adults: reservation.adults, children: reservation.children, totalAmount: reservation.totalAmount.toString() },
          afterData: { roomId, checkInDate: checkIn.toISOString(), checkOutDate: checkOut.toISOString(), adults: updated.adults, children: updated.children, totalAmount: updated.totalAmount.toString() },
        });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') throw new AppError('The room was changed concurrently. Refresh availability and retry.', 409, 'RESERVATION_CONFLICT');
      throw error;
    }
  }

  /** Create reservation with atomic availability check transaction */
  static async createReservation(data: CreateReservationDTO) {
    const checkIn = new Date(data.checkInDate);
    const checkOut = new Date(data.checkOutDate);

    if (checkOut <= checkIn) {
      throw new Error('Departure date must be strictly after arrival date.');
    }

    // Atomic transaction for double booking protection
    try {
      return await prisma.$transaction(
        (tx) => this.createReservationInTx(tx, data, checkIn, checkOut),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('The room was booked or changed concurrently. Refresh availability and retry.', 409, 'RESERVATION_CONFLICT');
      }
      throw error;
    }
  }

  /** Per-room reservation creation inside a transaction (shared by single & multi booking) */
  private static async createReservationInTx(
    tx: any,
    data: CreateReservationDTO,
    checkIn: Date,
    checkOut: Date,
  ) {
    const isAvailable = await this.checkAvailability(data.roomId, checkIn, checkOut, undefined, tx);
    if (!isAvailable) throw new Error('The selected room is not available for the specified dates.');

    const [room, guest] = await Promise.all([
      tx.room.findUnique({ where: { id: data.roomId }, include: { roomType: true } }),
      tx.guest.findUnique({ where: { id: data.guestId }, select: { id: true } }),
    ]);
    if (!room || !room.isActive || ['MAINTENANCE', 'OUT_OF_SERVICE'].includes(room.status)) {
      throw new Error('Selected room is not available.');
    }
    if (!guest) throw new Error('Guest not found.');

    // Pricing is authoritative on the server. The client cannot override the room rate.
    const baseRate = Number(room.roomType.basePrice);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24));
    const discountAmount = Math.max(0, Number(data.discountAmount || 0));
    if (discountAmount > 0 && (!data.discountReason?.trim() || !data.discountApprovedBy)) {
      throw new Error('A discount requires an approval reason and an authorized approver.');
    }
    const taxAmount = Math.max(0, Number(data.taxAmount || 0));
    const totalAmount = Math.max(0, baseRate * nights - discountAmount + taxAmount);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const confirmationNo = `NSVL-${dateStr}-${randomBytes(3).toString('hex').toUpperCase()}`;

    // Validate additional guests exist and are not duplicated
    const additionalIds = [...new Set(data.additionalGuestIds || [])].filter((id) => id !== data.guestId);
    const additionalGuests = additionalIds.length
      ? await tx.guest.findMany({ where: { id: { in: additionalIds } }, select: { id: true } })
      : [];
    if (additionalGuests.length !== additionalIds.length) {
      throw new Error('One or more additional guests were not found.');
    }

    const reservation = await tx.reservation.create({
      data: {
        confirmationNo,
        bookingId: data.bookingId || null,
        roomId: data.roomId,
        status: 'CONFIRMED',
        source: data.source || 'WALK_IN',
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: data.adults || 1,
        children: data.children || 0,
        baseRate,
        discountAmount,
        discountReason: discountAmount > 0 ? data.discountReason!.trim() : null,
        discountApprovedBy: discountAmount > 0 ? data.discountApprovedBy : null,
        taxAmount,
        depositAmount: Math.max(0, Number(data.depositAmount || 0)),
        totalAmount,
        specialRequests: data.specialRequests,
        notes: data.notes,
        createdBy: data.createdBy,
        guests: {
          create: [
            { guestId: data.guestId, isPrimary: true },
            ...additionalGuests.map((g: any) => ({ guestId: g.id, isPrimary: false })),
          ],
        },
      },
      include: {
        room: { include: { roomType: true } },
        guests: { include: { guest: true } },
      },
    });

    // A confirmed reservation owns the room until it is cancelled or the
    // guest checks in. Check-in changes this marker to OCCUPIED.
    await tx.room.update({
      where: { id: data.roomId },
      data: { status: 'RESERVED' },
    });

    return reservation;
  }

  /**
   * Book multiple rooms in one request as a single party. Every reservation shares
   * the same bookingId, so the front desk can see, cancel and manage them together.
   */
  static async createMultiReservation(data: CreateMultiReservationDTO) {
    const checkIn = new Date(data.checkInDate);
    const checkOut = new Date(data.checkOutDate);

    if (checkOut <= checkIn) {
      throw new Error('Departure date must be strictly after arrival date.');
    }
    if (!data.rooms || data.rooms.length === 0) {
      throw new Error('At least one room is required for a booking.');
    }

    const roomIds = data.rooms.map((r) => r.roomId);
    if (new Set(roomIds).size !== roomIds.length) {
      throw new Error('Each room can only be booked once in a single request.');
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const bookingId = `BK-${dateStr}-${randomBytes(3).toString('hex').toUpperCase()}`;

    try {
    const reservations = await prisma.$transaction(
      async (tx) => {
        const created: any[] = [];
        for (const room of data.rooms) {
          const reservation = await this.createReservationInTx(
            tx,
            {
              ...room,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              source: data.source,
              specialRequests: data.specialRequests,
              notes: data.notes,
              createdBy: data.createdBy,
              bookingId,
            },
            checkIn,
            checkOut,
          );
          created.push(reservation);
        }
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { bookingId, reservations };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('One or more rooms changed concurrently. Refresh availability and retry.', 409, 'RESERVATION_CONFLICT');
      }
      throw error;
    }
  }

  /** Return all reservations that share a booking (one party / multi-room request) */
  static async getParty(bookingId: string) {
    const reservations = await prisma.reservation.findMany({
      where: { bookingId },
      include: {
        room: { include: { roomType: true } },
        guests: { include: { guest: true } },
        folios: true,
      },
      orderBy: { checkInDate: 'asc' },
    });
    if (reservations.length === 0) throw new Error('Booking not found.');
    return { bookingId, reservations };
  }

  /** Attach additional guests to an existing reservation (per-room guest list) */
  static async addGuestsToReservation(id: string, guestIds: string[]) {
    if (!guestIds || guestIds.length === 0) {
      throw new Error('At least one guest id is required.');
    }

    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
        include: { guests: { select: { guestId: true, isPrimary: true } } },
      });
      if (!reservation) throw new Error('Reservation not found.');

      const existing = new Set(reservation.guests.map((g: any) => g.guestId));
      const toAdd = [...new Set(guestIds)].filter((id) => !existing.has(id));
      if (toAdd.length === 0) return this.getPartyReservation(id, tx);

      const found = await tx.guest.findMany({ where: { id: { in: toAdd } }, select: { id: true } });
      if (found.length !== toAdd.length) {
        throw new Error('One or more guests were not found.');
      }

      await tx.reservationGuest.createMany({
        data: toAdd.map((guestId) => ({ reservationId: id, guestId, isPrimary: false })),
      });

      return this.getPartyReservation(id, tx);
    });
  }

  private static async getPartyReservation(id: string, tx: any) {
    return tx.reservation.findUnique({
      where: { id },
      include: {
        room: { include: { roomType: true } },
        guests: { include: { guest: true } },
        folios: true,
      },
    });
  }

  /** Cancel reservation */
  static async cancelReservation(id: string, cancelledBy: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });
      if (!reservation) throw new Error('Reservation not found');
      if (reservation.status === 'CHECKED_IN') {
        throw new Error('Cannot cancel a reservation that is currently checked in.');
      }

      const updated = await tx.reservation.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledBy,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      // Never overwrite operational room states. A cancelled reservation only
      // releases a room when it was the current reservation marker and no
      // other active arrival/stay still needs the room today.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const otherActiveToday = await tx.reservation.findFirst({
        where: {
          roomId: reservation.roomId,
          id: { not: reservation.id },
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          checkInDate: { lt: tomorrow },
          checkOutDate: { gt: today },
        },
        select: { id: true },
      });
      const room = await tx.room.findUnique({ where: { id: reservation.roomId }, select: { status: true } });
      if (room?.status === 'RESERVED' && !otherActiveToday) {
        await tx.room.update({ where: { id: reservation.roomId }, data: { status: 'AVAILABLE' } });
      }

      return updated;
    });
  }

  /** Permanently remove a cancelled reservation that has no immutable activity. */
  static async deleteCancelledReservation(id: string, deletedBy: string) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
        include: { checkIns: { select: { id: true } }, checkOuts: { select: { id: true } }, folios: { select: { id: true } }, payments: { select: { id: true } } },
      });
      if (!reservation) throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
      if (reservation.status !== 'CANCELLED') throw new AppError('Only cancelled reservations can be permanently deleted.', 409, 'RESERVATION_NOT_CANCELLED');
      if (reservation.checkIns.length || reservation.checkOuts.length || reservation.folios.length || reservation.payments.length) {
        throw new AppError('This cancelled reservation has stay or financial records and must be retained for audit.', 409, 'RESERVATION_AUDIT_REQUIRED');
      }
      await AuditService.logInTransaction(tx, {
        userId: deletedBy, action: 'reservation.deleted', resource: 'reservation', resourceId: reservation.id,
        beforeData: { confirmationNo: reservation.confirmationNo, status: reservation.status, roomId: reservation.roomId },
      });
      await tx.reservation.delete({ where: { id } });
      return { id: reservation.id };
    });
  }
}
