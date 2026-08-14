// ============================================
// NS LUXURY VILLA — Check-In & Check-Out Stay Service
// ============================================

import { prisma } from '../config';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/error';

export interface CheckInDTO {
  reservationId: string;
  checkedInBy: string;
  idVerified?: boolean;
  idDocumentType?: string;
  idDocumentNumber?: string;
  notes?: string;
}

export interface CheckOutDTO {
  reservationId: string;
  checkedOutBy: string;
  roomCondition?: 'DIRTY' | 'CLEAN' | 'DAMAGED';
  paymentMethod?: string;
  notes?: string;
}

export class StayService {
  /** Get active stays */
  static async getActiveStays() {
    return prisma.checkIn.findMany({
      where: {
        reservation: { status: 'CHECKED_IN' },
      },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        reservation: {
          include: {
            folios: {
              include: {
                items: true,
                payments: true,
              },
            },
          },
        },
      },
      orderBy: { actualCheckIn: 'desc' },
    });
  }

  /** Execute Check-In workflow */
  static async checkInGuest(data: CheckInDTO) {
    try {
      return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: data.reservationId },
        include: {
          guests: { where: { isPrimary: true } },
          room: true,
        },
      });

      if (!reservation) throw new Error('Reservation not found');
      if (reservation.status === 'CHECKED_IN') throw new Error('Guest is already checked in');
      if (reservation.status === 'CANCELLED') throw new Error('Cannot check in a cancelled reservation');
      if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) throw new Error('Reservation is not eligible for check-in');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const checkoutDay = new Date(reservation.checkOutDate);
      checkoutDay.setHours(0, 0, 0, 0);
      const checkinDay = new Date(reservation.checkInDate);
      checkinDay.setHours(0, 0, 0, 0);
      if (today < checkinDay || today >= checkoutDay) throw new Error('Check-in is outside the reservation stay dates.');
      if (!reservation.room.isActive || ['MAINTENANCE', 'OUT_OF_SERVICE', 'OCCUPIED'].includes(reservation.room.status)) {
        throw new Error('The assigned room is not available for check-in.');
      }

      const primaryGuestId = reservation.guests[0]?.guestId;
      if (!primaryGuestId) throw new Error('No primary guest linked to reservation');

      // Create CheckIn record
      const checkIn = await tx.checkIn.create({
        data: {
          reservationId: reservation.id,
          roomId: reservation.roomId,
          guestId: primaryGuestId,
          checkedInBy: data.checkedInBy,
          idVerified: data.idVerified ?? true,
          idDocumentType: data.idDocumentType,
          idDocumentNumber: data.idDocumentNumber,
          notes: data.notes,
        },
      });

      // Update reservation status
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CHECKED_IN' },
      });

      // Update room status
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { status: 'OCCUPIED' },
      });

      // Create or find open Folio
      let folio = await tx.folio.findFirst({
        where: { reservationId: reservation.id, status: 'OPEN' },
      });

      if (!folio) {
        folio = await tx.folio.create({
          data: {
            reservationId: reservation.id,
            guestId: primaryGuestId,
            status: 'OPEN',
            balance: reservation.totalAmount,
          },
        });

        // Add accommodation charge item
        await tx.folioItem.create({
          data: {
            folioId: folio.id,
            type: 'ACCOMMODATION',
            description: `Accommodation (${reservation.room?.number || 'Room'})`,
            amount: reservation.totalAmount,
            quantity: 1,
            unitPrice: reservation.totalAmount,
            department: 'FRONT_DESK',
            postedBy: data.checkedInBy,
          },
        });

        // Deposits collected before arrival have no folio yet.  Materialise
        // their immutable payment history into the new folio so the cached
        // balance and the ledger agree from the first moment of the stay.
        const depositActivity = await tx.payment.findMany({
          where: {
            reservationId: reservation.id,
            status: 'COMPLETED',
            voidedAt: null,
            OR: [
              { type: 'DEPOSIT' },
              { type: 'REFUND', originalPayment: { type: 'DEPOSIT' } },
            ],
          },
          select: { id: true, type: true, amount: true, method: true, reference: true },
        });
        for (const activity of depositActivity) {
          const amount = new Prisma.Decimal(activity.amount);
          const isDeposit = activity.type === 'DEPOSIT';
          await tx.folioItem.create({ data: {
            folioId: folio.id, type: isDeposit ? 'DEPOSIT' : 'REFUND',
            description: `${isDeposit ? 'Deposit collected' : 'Deposit refunded'} (${activity.method}${activity.reference ? ` · ${activity.reference}` : ''})`,
            amount: isDeposit ? amount.negated() : amount, quantity: 1,
            unitPrice: isDeposit ? amount.negated() : amount, department: 'FRONT_DESK',
            referenceId: activity.id, referenceType: isDeposit ? 'PAYMENT' : 'REFUND', postedBy: data.checkedInBy,
          } });
          await tx.payment.update({ where: { id: activity.id }, data: { folioId: folio.id } });
          await tx.folio.update({ where: { id: folio.id }, data: { balance: isDeposit ? { decrement: amount } : { increment: amount } } });
        }
      }

      await AuditService.logInTransaction(tx, {
        userId: data.checkedInBy,
        action: 'stay.checked_in',
        resource: 'reservation',
        resourceId: reservation.id,
        afterData: { checkInId: checkIn.id, roomId: reservation.roomId, folioId: folio.id },
      });
      return { checkIn, folio };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('The reservation changed while check-in was being processed. Please retry.', 409, 'CHECKIN_CONFLICT');
      }
      throw error;
    }
  }

  /** Execute Check-Out workflow */
  static async checkOutGuest(data: CheckOutDTO) {
    try {
      return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: data.reservationId },
        include: {
          guests: { where: { isPrimary: true } },
          folios: {
            include: { items: true, payments: true },
          },
        },
      });

      if (!reservation) throw new Error('Reservation not found');
      if (reservation.status !== 'CHECKED_IN') throw new Error('Stay is not currently active for check-out');

      const primaryGuestId = reservation.guests[0]?.guestId;
      if (!primaryGuestId) throw new Error('No primary guest linked to reservation');

      const folio = reservation.folios.find((f) => f.status === 'OPEN') || reservation.folios[0];
      const ledger = folio
        ? await tx.folioItem.aggregate({ where: { folioId: folio.id, voidedAt: null }, _sum: { amount: true } })
        : null;
      const finalBalance = ledger ? Number(ledger._sum.amount || 0) : 0;

      if (!new Prisma.Decimal(finalBalance).isZero()) {
        throw new Error(`Folio balance of GHS ${finalBalance.toFixed(2)} must be settled to zero before check-out.`);
      }

      // Create CheckOut record
      const checkOut = await tx.checkOut.create({
        data: {
          reservationId: reservation.id,
          roomId: reservation.roomId,
          guestId: primaryGuestId,
          checkedOutBy: data.checkedOutBy,
          roomCondition: data.roomCondition || 'DIRTY',
          finalBalance,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        },
      });

      // Update reservation status
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CHECKED_OUT' },
      });

      // Update room status
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { status: data.roomCondition === 'DAMAGED' ? 'MAINTENANCE' : data.roomCondition === 'DIRTY' ? 'DIRTY' : 'AVAILABLE' },
      });

      // Close Folio
      if (folio) {
        await tx.folio.update({
          where: { id: folio.id },
          data: { status: 'CLOSED', closedAt: new Date(), balance: new Prisma.Decimal(finalBalance) },
        });
      }

      await AuditService.logInTransaction(tx, {
        userId: data.checkedOutBy,
        action: 'stay.checked_out',
        resource: 'reservation',
        resourceId: reservation.id,
        afterData: { checkOutId: checkOut.id, roomId: reservation.roomId, folioId: folio?.id, finalBalance },
      });
      return { checkOut, folio };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('The stay changed while check-out was being processed. Please retry.', 409, 'CHECKOUT_CONFLICT');
      }
      throw error;
    }
  }
}
