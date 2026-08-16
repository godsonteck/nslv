// ============================================
// NS LUXURY VILLA — Check-In & Check-Out Stay Service
// ============================================

import { prisma } from '../config';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/error';
import { randomUUID } from 'node:crypto';
import { PaymentService } from './payments.service';

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
  idempotencyKey?: string;
  notes?: string;
}

export class StayService {
  /** NS Luxury Villa operates on Ghana time: 2 PM check-in, noon check-out. */
  private static stayBoundary(value: Date | string | undefined, hour: number) {
    if (!value) return new Date();
    const dateObj = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(dateObj.getTime())) return new Date();
    const date = dateObj.toISOString().slice(0, 10);
    return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  }
  /** Get active stays */
  static async getActiveStays() {
    const stays = await prisma.checkIn.findMany({
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
    const staffIds = [...new Set(stays.map((stay) => stay.checkedInBy))];
    const staff = staffIds.length ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true, username: true } }) : [];
    const staffById = new Map(staff.map((user) => [user.id, { id: user.id, name: `${user.firstName} ${user.lastName}`.trim() || user.username, username: user.username }]));
    return stays.map((stay) => ({ ...stay, checkedInByUser: staffById.get(stay.checkedInBy) || { id: stay.checkedInBy, name: 'Former staff account' } }));
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
      const checkinTime = this.stayBoundary(reservation.checkInDate, 14);
      const checkoutTime = this.stayBoundary(reservation.checkOutDate, 12);
      if (now < checkinTime || now >= checkoutTime) {
        throw new Error('Check-in is available from 2:00 PM on arrival until 12:00 PM on the departure date.');
      }
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

        if (!reservation) throw new AppError('Reservation not found.', 404, 'RESERVATION_NOT_FOUND');

        if (reservation.status === 'CHECKED_OUT') {
          const existingCheckOut = await tx.checkOut.findUnique({ where: { reservationId: reservation.id } });
          const existingFolio = reservation.folios[0];
          if (existingCheckOut) {
            return { checkOut: existingCheckOut, folio: existingFolio, isRetry: true };
          }
          throw new AppError('Stay has already been checked out.', 409, 'STAY_ALREADY_CHECKED_OUT');
        }

        if (reservation.status !== 'CHECKED_IN') {
          throw new AppError('Stay is not currently active for check-out.', 409, 'STAY_NOT_ACTIVE');
        }

        const primaryGuestId = reservation.guests[0]?.guestId;
        if (!primaryGuestId) throw new Error('No primary guest linked to reservation');

        const folio = reservation.folios.find((f) => f.status === 'OPEN') || reservation.folios[0];
        // The fee is a live, admin-controlled business rule. Charge it before
        // calculating the ledger settlement so it reaches the bill, payment
        // record, checkout audit and printed receipt as one durable operation.
        const lateCheckoutSetting = await tx.systemSetting.findUnique({ where: { key: 'financial.late_checkout_fee' } });
        const lateCheckoutFee = lateCheckoutSetting ? Number(JSON.parse(lateCheckoutSetting.value)) : 0;
        const checkoutDeadline = this.stayBoundary(reservation.checkOutDate, 12);
        if (folio && Number.isFinite(lateCheckoutFee) && lateCheckoutFee > 0 && new Date() > checkoutDeadline) {
          const fee = new Prisma.Decimal(lateCheckoutFee);
          await tx.folioItem.create({ data: {
            folioId: folio.id, type: 'ACCOMMODATION', description: 'Late checkout fee', amount: fee,
            quantity: 1, unitPrice: fee, department: 'FRONT_DESK', referenceType: 'CHECKOUT', postedBy: data.checkedOutBy,
          } });
          await tx.folio.update({ where: { id: folio.id }, data: { balance: { increment: fee } } });
        }
        const ledger = folio
          ? await tx.folioItem.aggregate({ where: { folioId: folio.id, voidedAt: null }, _sum: { amount: true } })
          : null;
        let finalBalance = ledger ? Number(ledger._sum.amount || 0) : 0;

        // The front-desk checkout form captures the settlement method. Settle
        // through PaymentService.processPaymentInTx to enforce daily-close locking,
        // payment method validation, idempotency, and audit logging.
        if (finalBalance > 0) {
          if (!data.paymentMethod?.trim()) throw new AppError('Select a payment method to settle the outstanding balance.', 422, 'PAYMENT_METHOD_REQUIRED');
          if (!folio) throw new AppError('An open folio is required to settle this stay.', 409, 'OPEN_FOLIO_REQUIRED');

          const checkoutPaymentIdempotencyKey = data.idempotencyKey || `checkout-payment-${reservation.id}`;
          await PaymentService.processPaymentInTx(tx, {
            folioId: folio.id,
            reservationId: reservation.id,
            guestId: primaryGuestId,
            amount: finalBalance,
            method: data.paymentMethod,
            idempotencyKey: checkoutPaymentIdempotencyKey,
            description: 'Final settlement at check-out',
            processedBy: data.checkedOutBy,
            paymentType: 'PAYMENT',
          });
          finalBalance = 0;
        } else if (finalBalance < 0) {
          throw new AppError(`Folio has a guest credit of GHS ${Math.abs(finalBalance).toFixed(2)}. Process the refund before check-out.`, 409, 'GUEST_CREDIT_UNSETTLED');
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
      if ((error as { code?: string }).code === 'P2034' || (error as { code?: string }).code === 'P2002') {
        throw new AppError('The stay changed or was checked out concurrently. Please retry.', 409, 'CHECKOUT_CONFLICT');
      }
      throw error;
    }
  }
}
