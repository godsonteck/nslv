// ============================================
// NS LUXURY VILLA — Check-In & Check-Out Stay Service
// ============================================

import { prisma } from '../config';
import { Prisma, IdDocumentType, PaymentMethod, RoomCondition, ReservationStatus, RoomStatus, FolioStatus } from '@prisma/client';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/error';
import { randomUUID } from 'node:crypto';
import { PaymentService } from './payments.service';
import { FolioService } from './folios.service';
import { NotificationService } from './notification.service';
import { PERMISSIONS } from '@nslv/shared';

// Marker stored in FolioItem.voidReason when the late checkout fee was waived
// at check-out time instead of being charged. The fee is still written to the
// ledger (already voided) so the waiver survives recalculation jobs and stays
// visible in the audit trail.
export const LATE_FEE_WAIVER_VOID_REASON = 'Waived at checkout (fee not charged)';

export interface LateFeeVoidableItem {
  voidedAt?: Date | string | null;
  voidReason?: string | null;
}

export interface CheckInDTO {
  reservationId: string;
  checkedInBy: string;
  idVerified?: boolean;
  idDocumentType?: IdDocumentType | string;
  idDocumentNumber?: string;
  notes?: string;
}

export interface CheckOutDTO {
  reservationId: string;
  checkedOutBy: string;
  roomCondition?: RoomCondition | 'DIRTY' | 'CLEAN' | 'DAMAGED';
  chargeLateCheckoutFee?: boolean;
  // Audit note recorded when the staff member waives the late checkout fee.
  lateCheckoutFeeReason?: string;
  paymentMethod?: PaymentMethod | string;
  // Split settlement: each tender becomes its own Payment row summing to the
  // outstanding folio balance.  Mutually exclusive with paymentMethod.
  tenders?: { method: string; amount: number; reference?: string }[];
  allowOwing?: boolean;
  owingReason?: string;
  idempotencyKey?: string;
  notes?: string;
  paymentDescription?: string;
}

export class StayService {
  /**
   * Calculates the ISO datetime boundary for a given check-in or check-out date.
   * If a string time like "12:00" or "14:00" is given, it parses hours and minutes.
   */
  public static stayBoundary(value: Date | string | undefined, timeStrOrHour: string | number = 12) {
    if (!value) return new Date();
    const dateObj = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(dateObj.getTime())) return new Date();
    const date = dateObj.toISOString().slice(0, 10);
    let hours = 12;
    let minutes = 0;
    if (typeof timeStrOrHour === 'number') {
      if (timeStrOrHour >= 0 && timeStrOrHour <= 23) hours = timeStrOrHour;
    } else if (typeof timeStrOrHour === 'string') {
      const parts = timeStrOrHour.split(':').map((p) => Number(p.replace(/[^0-9]/g, '')));
      if (parts.length >= 1 && Number.isFinite(parts[0]) && parts[0] >= 0 && parts[0] <= 23) hours = parts[0];
      if (parts.length >= 2 && Number.isFinite(parts[1]) && parts[1] >= 0 && parts[1] <= 59) minutes = parts[1];
    }
    return new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`);
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
    return stays.map((stay) => {
      const folio = stay.reservation?.folios?.find((f) => f.status === 'OPEN') || stay.reservation?.folios?.[0];

      // 1. Valid Payments
      const rawPayments = folio?.payments || [];
      const validPayments = rawPayments.filter(
        (p: any) => (!p.status || p.status === 'COMPLETED') && !p.voidedAt && p.type !== 'REFUND',
      );
      const totalPaid = validPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      let cashPaid = 0;
      let momoPaid = 0;
      let cardPaid = 0;
      let bankPaid = 0;
      for (const p of validPayments) {
        const amt = Number(p.amount);
        const m = String(p.method).toUpperCase();
        if (m === 'CASH') cashPaid += amt;
        else if (m === 'MOBILE_MONEY' || m === 'MOMO') momoPaid += amt;
        else if (m === 'CARD') cardPaid += amt;
        else if (m === 'BANK_TRANSFER') bankPaid += amt;
      }

      // 2. Charges posted to folio
      const nonVoidedCharges = (folio?.items || []).filter(
        (i: any) => !i.voidedAt && !['PAYMENT', 'DEPOSIT'].includes(i.type),
      );
      const chargesSum = nonVoidedCharges.reduce((sum, i) => sum + Number(i.amount), 0);
      const rawFolioBalance = Number(folio?.balance ?? 0);
      let currentOwed = rawFolioBalance;
      if (chargesSum > 0) {
        currentOwed = Math.max(0, chargesSum - totalPaid);
      } else if (currentOwed <= 0.005) {
        currentOwed = 0;
      }

      // 3. Supposed to Pay = Total Paid + Current Owed (always in 100% agreement)
      const totalBilled = chargesSum > 0
        ? Math.max(chargesSum, totalPaid + currentOwed)
        : Math.max(totalPaid + currentOwed, Number(stay.reservation?.totalAmount || 0));

      if (totalBilled >= totalPaid) {
        currentOwed = Number((totalBilled - totalPaid).toFixed(2));
      }

      return {
        ...stay,
        totalBilled,
        paidAtCheckout: totalPaid,
        totalPaid,
        currentOwed,
        cashPaid,
        momoPaid,
        cardPaid,
        bankPaid,
        checkedInByUser: staffById.get(stay.checkedInBy) || { id: stay.checkedInBy, name: 'Former staff account' },
      };
    });
  }

  /**
   * Get checked-out stays with an outstanding balance (unsettled folios / debt).
   * Robust search: captures all checked-out reservations with open folios, non-zero folio balance,
   * checkout finalBalance debt, owing notes, or uncollected reservation totals.
   */
  static async getUnsettledStays() {
    const reservations = await prisma.reservation.findMany({
      where: {
        status: 'CHECKED_OUT',
        OR: [
          { folios: { some: { balance: { gt: 0.005 } } } },
          { folios: { some: { status: 'OPEN' } } },
          { checkOuts: { some: { finalBalance: { gt: 0.005 } } } },
          { checkOuts: { some: { notes: { contains: 'owing', mode: 'insensitive' } } } },
          { checkOuts: { some: { notes: { contains: 'unpaid', mode: 'insensitive' } } } },
          { checkOuts: { some: { notes: { contains: 'deferred', mode: 'insensitive' } } } },
          { totalAmount: { gt: 0 } },
        ],
      },
      include: {
        guests: { where: { isPrimary: true }, include: { guest: true } },
        room: { include: { roomType: true } },
        checkIns: true,
        checkOuts: true,
        folios: {
          include: {
            items: true,
            payments: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const staffIds = [
      ...new Set([
        ...reservations.map((r) => r.checkIns[0]?.checkedInBy).filter(Boolean),
        ...reservations.map((r) => r.checkOuts[0]?.checkedOutBy).filter(Boolean),
      ]),
    ] as string[];

    const staff = staffIds.length
      ? await prisma.user.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, firstName: true, lastName: true, username: true },
        })
      : [];
    const staffById = new Map(
      staff.map((u) => [u.id, { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() || u.username, username: u.username }]),
    );

    const unsettledList = reservations.map((res) => {
      const checkIn = res.checkIns[0];
      const checkOut = res.checkOuts[0];
      const primaryGuest = res.guests[0]?.guest;
      const folio = res.folios.find((f) => Number(f.balance) > 0.005) || res.folios.find((f) => f.status === 'OPEN') || res.folios[0];

      // 1. Gather all valid payments (excluding voided, refunded, or failed)
      const rawPayments = folio?.payments || [];
      const validPayments = rawPayments.filter(
        (p: any) => (!p.status || p.status === 'COMPLETED') && !p.voidedAt && p.type !== 'REFUND',
      );
      const totalPaid = validPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Method breakdown
      let cashPaid = 0;
      let momoPaid = 0;
      let cardPaid = 0;
      let bankPaid = 0;
      for (const p of validPayments) {
        const amt = Number(p.amount);
        const m = String(p.method).toUpperCase();
        if (m === 'CASH') cashPaid += amt;
        else if (m === 'MOBILE_MONEY' || m === 'MOMO') momoPaid += amt;
        else if (m === 'CARD') cardPaid += amt;
        else if (m === 'BANK_TRANSFER') bankPaid += amt;
      }

      // Payments made on or before departure checkout time
      const checkoutTime = checkOut?.actualCheckOut ? new Date(checkOut.actualCheckOut).getTime() : null;
      const paymentsByCheckout = checkoutTime
        ? validPayments.filter((p) => new Date(p.processedAt).getTime() <= checkoutTime + 5000)
        : validPayments;
      const paidAtCheckout = paymentsByCheckout.reduce((sum, p) => sum + Number(p.amount), 0);

      // 2. Charges posted to folio
      const nonVoidedCharges = (folio?.items || []).filter(
        (i: any) => !i.voidedAt && !['PAYMENT', 'DEPOSIT'].includes(String(i.type).toUpperCase()),
      );
      const chargesSum = nonVoidedCharges.reduce((sum, i) => sum + Number(i.amount), 0);

      // Separate Late Check-Out fees from Room & Extras
      const lateFeeItems = nonVoidedCharges.filter(
        (i: any) =>
          i.referenceType === 'CHECKOUT' ||
          (i.description && i.description.toLowerCase().includes('late checkout')),
      );
      const lateFeeAmount = lateFeeItems.reduce((sum, i) => sum + Number(i.amount), 0);
      const roomCharges = nonVoidedCharges
        .filter((i: any) => !lateFeeItems.includes(i) && (i.type === 'ACCOMMODATION' || !i.category || i.category === 'ACCOMMODATION'))
        .reduce((sum, i) => sum + Number(i.amount), 0);
      const baseRoomAmount = roomCharges > 0 ? roomCharges : Number(res.totalAmount || 0);
      const otherCharges = nonVoidedCharges
        .filter((i: any) => !lateFeeItems.includes(i) && i.type !== 'ACCOMMODATION' && i.category && i.category !== 'ACCOMMODATION')
        .reduce((sum, i) => sum + Number(i.amount), 0);

      // 3. True Current Balance Owed (Reconciled)
      const coFinalBalance = Number(checkOut?.finalBalance ?? 0);
      const postCheckoutPaid = Math.max(0, totalPaid - paidAtCheckout);

      let totalBilled = 0;
      if (chargesSum > 0) {
        totalBilled = Math.max(chargesSum, baseRoomAmount + lateFeeAmount + otherCharges);
      } else if (coFinalBalance > 0.005) {
        totalBilled = Math.max(Number(res.totalAmount || 0), paidAtCheckout + coFinalBalance);
      } else {
        totalBilled = Math.max(Number(res.totalAmount || 0), totalPaid);
      }

      // Remaining debt is strictly what has not been paid
      let currentOwed = Math.max(0, Number((totalBilled - totalPaid).toFixed(2)));

      // If folio had no charges recorded but checkout recorded a finalBalance,
      // checkout balance is reduced by any post-checkout payment
      if (chargesSum === 0 && coFinalBalance > 0.005) {
        const remainingCheckoutDebt = Math.max(0, Number((coFinalBalance - postCheckoutPaid).toFixed(2)));
        currentOwed = Math.max(currentOwed, remainingCheckoutDebt);
        totalBilled = Math.max(totalBilled, totalPaid + currentOwed);
      }

      // Supposed to pay (totalBilled) must ALWAYS equal totalPaid + currentOwed
      totalBilled = Math.max(totalBilled, totalPaid + currentOwed);
      if (totalPaid >= totalBilled) {
        currentOwed = 0;
      }

      return {
        id: checkIn?.id || res.id,
        reservationId: res.id,
        guestId: primaryGuest?.id,
        guest: primaryGuest ? { firstName: primaryGuest.firstName, lastName: primaryGuest.lastName } : null,
        room: res.room ? { number: res.room.number, name: res.room.name, roomType: res.room.roomType } : null,
        actualCheckIn: checkIn?.actualCheckIn || res.checkInDate,
        actualCheckOut: checkOut?.actualCheckOut || res.checkOutDate,
        checkedOutDate: checkOut?.actualCheckOut || res.checkOutDate,
        checkedInBy: checkIn?.checkedInBy,
        checkedInByUser: checkIn?.checkedInBy ? staffById.get(checkIn.checkedInBy) : undefined,
        checkedOutBy: checkOut?.checkedOutBy,
        checkedOutByUser: checkOut?.checkedOutBy ? staffById.get(checkOut.checkedOutBy) : undefined,
        isCheckedOut: true,
        finalBalance: currentOwed,
        totalBilled,
        paidAtCheckout,
        totalPaid,
        currentOwed,
        baseRoomAmount,
        lateFeeAmount,
        otherCharges,
        hasLateCheckoutFee: lateFeeAmount > 0,
        checkOutId: checkOut?.id,
        cashPaid,
        momoPaid,
        cardPaid,
        bankPaid,
        checkOutNotes: checkOut?.notes,
        checkOutPaymentMethod: checkOut?.paymentMethod,
        reservation: {
          id: res.id,
          confirmationNo: res.confirmationNo,
          bookingId: res.bookingId,
          status: res.status,
          checkInDate: res.checkInDate,
          checkOutDate: res.checkOutDate,
          totalAmount: Number(res.totalAmount || 0),
          folios: res.folios.map((f) => ({
            id: f.id,
            status: f.status,
            balance: f.id === folio?.id ? currentOwed : Number(f.balance),
            items: f.items.map((i) => ({
              id: i.id,
              description: i.description,
              amount: Number(i.amount),
              type: i.type,
              postedAt: i.postedAt,
              voidedAt: i.voidedAt,
            })),
            payments: f.payments.map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              method: p.method,
              status: p.status,
              type: p.type,
              processedAt: p.processedAt,
            })),
          })),
        },
      };
    });

    return unsettledList.filter((stay) => stay.currentOwed > 0.005);
  }

  /**
   * Admin utility: clear all post-checkout outstanding debts by writing a
   * corrective cash payment for each unsettled checked-out reservation.
   * Only the original room total (reservation.totalAmount) is charged; any
   * extra folio items posted at checkout (referenceType = 'CHECKOUT') are
   * voided first so the guest is not overcharged.
   */
  static async clearPostCheckoutDebts(clearedBy: string): Promise<{ cleared: number; totalAmountCleared: number; reservationIds: string[] }> {
    // 1. Find all CHECKED_OUT reservations whose folio still carries a balance
    const reservations = await prisma.reservation.findMany({
      where: {
        status: 'CHECKED_OUT',
        folios: { some: { balance: { gt: 0.005 } } },
      },
      include: {
        guests: { where: { isPrimary: true } },
        folios: {
          where: { balance: { gt: 0.005 } },
          include: { items: true, payments: true },
        },
        checkOuts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    let cleared = 0;
    let totalAmountCleared = 0;
    const reservationIds: string[] = [];

    for (const reservation of reservations) {
      const folio = reservation.folios[0];
      if (!folio) continue;
      const primaryGuestId = reservation.guests[0]?.guestId;
      if (!primaryGuestId) continue;
      const checkOut = reservation.checkOuts[0];

      try {
        await prisma.$transaction(async (tx) => {
          // a. Void extra CHECKOUT-referenceType items (late fees etc.)
          const extraItems = folio.items.filter(
            (i) => !i.voidedAt && i.referenceType === 'CHECKOUT' && !['PAYMENT', 'DEPOSIT'].includes(i.type),
          );
          for (const item of extraItems) {
            await tx.folioItem.update({
              where: { id: item.id },
              data: { voidedAt: new Date(), voidReason: 'Admin cleanup: only base room charge applicable' },
            });
          }

          // b. Calculate how much is owed (only the original room total matters)
          const correctTotal = Number(reservation.totalAmount);
          const alreadyPaid = folio.payments
            .filter((p) => !p.voidedAt && p.type !== 'REFUND')
            .reduce((sum, p) => sum + Number(p.amount), 0);
          const remaining = Math.max(0, correctTotal - alreadyPaid);

          if (remaining > 0.005) {
            // c. Create Payment record
            await tx.payment.create({
              data: {
                reservationId: reservation.id,
                guestId: primaryGuestId,
                folioId: folio.id,
                amount: remaining,
                currency: 'GHS',
                method: 'CASH',
                source: 'FOLIO',
                description: 'Admin: post-checkout balance cleared — charged only for nights stayed',
                processedBy: clearedBy,
                status: 'COMPLETED',
                type: 'PAYMENT',
                idempotencyKey: 'admin-clear-' + reservation.id,
              },
            });

            // d. Create FolioItem payment entry
            await tx.folioItem.create({
              data: {
                type: 'PAYMENT',
                description: 'Admin: post-checkout balance cleared',
                amount: new Prisma.Decimal(-remaining),
                quantity: 1,
                unitPrice: new Prisma.Decimal(remaining),
                department: 'FRONT_DESK',
                referenceType: 'ADMIN_CLEAR',
                postedBy: clearedBy,
                folioId: folio.id,
              },
            });
          }

          // e. Close the folio
          await tx.folio.update({
            where: { id: folio.id },
            data: { status: 'CLOSED', balance: 0, closedAt: new Date() },
          });

          // f. Update checkout finalBalance
          if (checkOut) {
            await tx.checkOut.update({
              where: { id: checkOut.id },
              data: {
                finalBalance: 0,
                notes: checkOut.notes
                  ? checkOut.notes + ' | Admin: balance cleared, only room nights charged'
                  : 'Admin: balance cleared, only room nights charged',
              },
            });
          }

          // g. Audit log
          await AuditService.logInTransaction(tx, {
            userId: clearedBy,
            action: 'admin.post_checkout_debt_cleared',
            resource: 'reservation',
            resourceId: reservation.id,
            afterData: { folioId: folio.id, remaining, correctTotal, alreadyPaid },
          });
        });

        cleared++;
        totalAmountCleared += Math.max(0, Number(reservation.totalAmount) -
          folio.payments.filter((p) => !p.voidedAt && p.type !== 'REFUND').reduce((sum, p) => sum + Number(p.amount), 0));
        reservationIds.push(reservation.id);
      } catch (_err) {
        // One failure must not abort the rest — log and continue
        console.error(`[clearPostCheckoutDebts] Failed for reservation ${reservation.id}:`, _err);
      }
    }

    return { cleared, totalAmountCleared, reservationIds };
  }

  /** Execute Check-In workflow */
  static async checkInGuest(data: CheckInDTO) {
    try {
      return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: data.reservationId },
        include: {
          guests: { where: { isPrimary: true }, include: { guest: true } },
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
          idDocumentType: (data.idDocumentType as IdDocumentType) || null,
          idDocumentNumber: data.idDocumentNumber,
          notes: data.notes,
        },
      });

      // Update reservation status
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CHECKED_IN },
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
      const primaryGuest = reservation.guests[0]?.guest;
      const guestName = primaryGuest ? `${primaryGuest.firstName} ${primaryGuest.lastName}`.trim() : 'Guest';
      return { checkIn, folio, guestName, roomNumber: reservation.room?.number || '—', reservationId: reservation.id, confirmationNo: reservation.confirmationNo };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).then((result) => {
        NotificationService.notifyStaff(
          [PERMISSIONS.CHECKIN_PERFORM],
          {
            type: 'RESERVATION',
            title: 'Guest checked in',
            message: `${result.guestName} · Room ${result.roomNumber} (${result.confirmationNo})`,
            priority: 'HIGH',
            data: { reservationId: result.reservationId, checkInId: result.checkIn.id, roomId: result.checkIn.roomId },
          },
          data.checkedInBy,
        );
        return result;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('The reservation changed while check-in was being processed. Please retry.', 409, 'CHECKIN_CONFLICT');
      }
      throw error;
    }
  }

  /**
   * Detects a late checkout fee item that was waived at check-out time.
   * Used so recalculation jobs never re-charge (or un-void) a waived fee.
   */
  static isCheckoutFeeWaiver(item: LateFeeVoidableItem | null | undefined): boolean {
    if (!item?.voidedAt) return false;
    const reason = item.voidReason || '';
    return reason.startsWith(LATE_FEE_WAIVER_VOID_REASON) || /^waived at checkout/i.test(reason);
  }

  /**
   * Calculates the late checkout charge based on scheduled checkout deadline, actual checkout time, and hourly rate.
   * Policy: 1 hour late -> 1x hourly rate; 2 hours late -> 2x hourly rate; 3 hours late -> 3x hourly rate, etc.
   */
  static calculateLateCheckoutFee(
    checkOutDate: Date | string,
    actualCheckOut: Date | string = new Date(),
    hourlyRate = 50,
    checkoutTimeSetting = '12:00',
  ): {
    isLate: boolean;
    lateHours: number;
    hourlyRate: number;
    fee: number;
    deadline: Date;
    description: string;
  } {
    const deadline = this.stayBoundary(checkOutDate, checkoutTimeSetting || '12:00');
    const actualTime = typeof actualCheckOut === 'string' ? new Date(actualCheckOut) : actualCheckOut;
    const diffMs = actualTime.getTime() - deadline.getTime();
    if (diffMs <= 0 || hourlyRate <= 0) {
      return { isLate: false, lateHours: 0, hourlyRate, fee: 0, deadline, description: '' };
    }
    // Any fraction of an hour past the scheduled check-out deadline counts as 1 full hour
    const lateHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    const fee = lateHours * hourlyRate;
    const description = `Late checkout fee (${lateHours} hr${lateHours > 1 ? 's' : ''} @ GHS ${hourlyRate.toFixed(2)}/hr)`;
    return { isLate: true, lateHours, hourlyRate, fee, deadline, description };
  }

  /**
   * Auto-adjust historical checkout data according to the late checkout policy:
   * Policy: Configured rate (default GHS 50) per hour past checkout time (default 12:00 PM) on departure date.
   * Scans all past checkouts in the system, recomputes exact hourly charges, updates or creates folio items,
   * and recalculates folio balances so old and new records remain 100% synchronized and correct.
   */
  static async autoAdjustHistoricalLateCheckoutFees(customHourlyRate?: number, customCheckoutTime?: string) {
    try {
      // 1. Fetch current settings from DB
      const rateSetting = await prisma.systemSetting.findUnique({ where: { key: 'financial.late_checkout_fee' } });
      const timeSetting = await prisma.systemSetting.findUnique({ where: { key: 'villa.checkout_time' } });

      let hourlyRate = customHourlyRate;
      if (hourlyRate === undefined) {
        if (rateSetting) {
          try {
            const parsed = Number(JSON.parse(rateSetting.value));
            hourlyRate = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
          } catch {
            hourlyRate = 50;
          }
        } else {
          hourlyRate = 50;
          await prisma.systemSetting.create({
            data: {
              key: 'financial.late_checkout_fee',
              value: JSON.stringify(50),
              category: 'financial',
              description: 'Late check-out fee per hour (GHS) applied when departure is after checkout time',
            },
          });
        }
      }

      let checkoutTime = customCheckoutTime;
      if (!checkoutTime) {
        if (timeSetting) {
          try {
            checkoutTime = String(JSON.parse(timeSetting.value) || '12:00');
          } catch {
            checkoutTime = '12:00';
          }
        } else {
          checkoutTime = '12:00';
        }
      }

      // 2. Fetch all historical CheckOut records with Reservation and Folio items
      const checkOuts = await prisma.checkOut.findMany({
        include: {
          reservation: {
            include: {
              folios: {
                include: { items: true },
              },
            },
          },
        },
      });

      let adjustedCount = 0;
      let totalLateChargesAmount = 0;

      for (const co of checkOuts) {
        const reservation = co.reservation;
        if (!reservation) continue;

        // Locate folio for this reservation
        let folio = reservation.folios?.[0];
        if (!folio) {
          folio = (await prisma.folio.findUnique({
            where: { reservationId: reservation.id },
            include: { items: true },
          })) as any;
        }
        if (!folio) continue;

        const lateInfo = this.calculateLateCheckoutFee(reservation.checkOutDate, co.actualCheckOut, hourlyRate, checkoutTime);
        const lateFeeCandidates = folio.items.filter(
          (item: any) =>
            item.referenceType === 'CHECKOUT' ||
            (item.description && item.description.toLowerCase().includes('late checkout')),
        );
        // Prefer the live (non-waived) fee item; fall back to any candidate so
        // legacy rows keep their previous behaviour.
        const existingFeeItem =
          lateFeeCandidates.find((item: any) => !this.isCheckoutFeeWaiver(item)) ?? lateFeeCandidates[0];

        // A fee waived at check-out is a deliberate staff decision: never
        // re-charge, un-void, or overwrite it during historical recalculation.
        if (this.isCheckoutFeeWaiver(existingFeeItem)) continue;

        if (lateInfo.isLate && lateInfo.fee > 0) {
          const expectedAmount = new Prisma.Decimal(lateInfo.fee);
          totalLateChargesAmount += lateInfo.fee;

          if (existingFeeItem) {
            const existingAmount = new Prisma.Decimal(existingFeeItem.amount);
            if (!existingAmount.equals(expectedAmount) || existingFeeItem.quantity !== lateInfo.lateHours || existingFeeItem.voidedAt) {
              await prisma.folioItem.update({
                where: { id: existingFeeItem.id },
                data: {
                  amount: expectedAmount,
                  quantity: lateInfo.lateHours,
                  unitPrice: new Prisma.Decimal(lateInfo.hourlyRate),
                  description: lateInfo.description,
                  voidedAt: null,
                  voidReason: null,
                },
              });
              const newBalance = await FolioService.calculateFolioBalance(folio.id);
              await prisma.folio.update({
                where: { id: folio.id },
                data: { balance: newBalance },
              });
              adjustedCount++;
            }
          } else {
            await prisma.folioItem.create({
              data: {
                folioId: folio.id,
                type: 'ACCOMMODATION',
                description: lateInfo.description,
                amount: expectedAmount,
                quantity: lateInfo.lateHours,
                unitPrice: new Prisma.Decimal(lateInfo.hourlyRate),
                department: 'FRONT_DESK',
                referenceType: 'CHECKOUT',
                postedBy: co.checkedOutBy || 'SYSTEM',
                postedAt: co.actualCheckOut,
              },
            });
            const newBalance = await FolioService.calculateFolioBalance(folio.id);
            await prisma.folio.update({
              where: { id: folio.id },
              data: { balance: newBalance },
            });
            adjustedCount++;
          }
        } else if (!lateInfo.isLate && existingFeeItem && !existingFeeItem.voidedAt) {
          await prisma.folioItem.update({
            where: { id: existingFeeItem.id },
            data: { voidedAt: new Date(), voidReason: 'Auto-adjusted: checkout was on time' },
          });
          const newBalance = await FolioService.calculateFolioBalance(folio.id);
          await prisma.folio.update({
            where: { id: folio.id },
            data: { balance: newBalance },
          });
          adjustedCount++;
        }
      }

      console.log(`[StayService] Auto-adjusted ${adjustedCount} past checkouts. Hourly rate: GHS ${hourlyRate}, checkout time: ${checkoutTime}.`);
      return { success: true, adjustedCount, totalCheckOuts: checkOuts.length, hourlyRate, checkoutTime, totalLateChargesAmount };
    } catch (err) {
      console.error('[StayService] autoAdjustHistoricalLateCheckoutFees error:', err);
      throw err;
    }
  }

  /** Execute Check-Out workflow */
  static async checkOutGuest(data: CheckOutDTO) {
    try {
      return await prisma.$transaction(async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: data.reservationId },
          include: {
            guests: { where: { isPrimary: true }, include: { guest: true } },
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
        // Charge the fee before calculating settlement unless the staff member waives it.
        const lateCheckoutSetting = await tx.systemSetting.findUnique({ where: { key: 'financial.late_checkout_fee' } });
        const checkoutTimeSetting = await tx.systemSetting.findUnique({ where: { key: 'villa.checkout_time' } });

        const settingVal = lateCheckoutSetting ? Number(JSON.parse(lateCheckoutSetting.value)) : 50;
        const hourlyRate = Number.isFinite(settingVal) && settingVal > 0 ? settingVal : 50;
        const checkoutTime = checkoutTimeSetting ? String(JSON.parse(checkoutTimeSetting.value) || '12:00') : '12:00';

        const lateInfo = this.calculateLateCheckoutFee(reservation.checkOutDate, new Date(), hourlyRate, checkoutTime);
        let lateFeeWaivedNote: string | null = null;
        if (folio && lateInfo.isLate && lateInfo.fee > 0) {
          // Late checkout fee is opt-in: staff must explicitly pass chargeLateCheckoutFee: true.
          // Default is false — do NOT automatically charge late fees.
          if (data.chargeLateCheckoutFee === true) {
            const fee = new Prisma.Decimal(lateInfo.fee);
            await tx.folioItem.create({
              data: {
                folioId: folio.id,
                type: 'ACCOMMODATION',
                description: lateInfo.description,
                amount: fee,
                quantity: lateInfo.lateHours,
                unitPrice: new Prisma.Decimal(lateInfo.hourlyRate),
                department: 'FRONT_DESK',
                referenceType: 'CHECKOUT',
                postedBy: data.checkedOutBy,
              },
            });
            await tx.folio.update({ where: { id: folio.id }, data: { balance: { increment: fee } } });
          } else if (data.chargeLateCheckoutFee === false) {
            // Fee explicitly waived by staff: persist the decision on the ledger as an
            // already-voided item so it is auditable but does NOT affect the balance.
            const waiveReason = data.lateCheckoutFeeReason?.trim();
            const voidReason = `${LATE_FEE_WAIVER_VOID_REASON}${waiveReason ? `: ${waiveReason}` : ''}`;
            await tx.folioItem.create({
              data: {
                folioId: folio.id,
                type: 'ACCOMMODATION',
                description: `${lateInfo.description} — waived at checkout`,
                amount: new Prisma.Decimal(lateInfo.fee),
                quantity: lateInfo.lateHours,
                unitPrice: new Prisma.Decimal(lateInfo.hourlyRate),
                department: 'FRONT_DESK',
                referenceType: 'CHECKOUT',
                postedBy: data.checkedOutBy,
                voidedAt: new Date(),
                voidedBy: data.checkedOutBy,
                voidReason,
              },
            });
            lateFeeWaivedNote = `Late checkout fee waived at checkout (GHS ${lateInfo.fee.toFixed(2)}, ${lateInfo.lateHours}h): ${waiveReason || 'No reason given'}`;
            await AuditService.logInTransaction(tx, {
              userId: data.checkedOutBy,
              action: 'stay.late_checkout_waived',
              resource: 'reservation',
              resourceId: reservation.id,
              afterData: {
                folioId: folio.id,
                fee: lateInfo.fee,
                lateHours: lateInfo.lateHours,
                hourlyRate: lateInfo.hourlyRate,
                reason: waiveReason || null,
              },
            });
          }
          // If chargeLateCheckoutFee is undefined/null (not provided), the late fee is
          // simply not posted. No charge, no waiver record — clean slate.
        }
        const ledger = folio
          ? await tx.folioItem.aggregate({ where: { folioId: folio.id, voidedAt: null }, _sum: { amount: true } })
          : null;
        let finalBalance = ledger ? Number(ledger._sum.amount || 0) : 0;

        // The front-desk checkout form captures the settlement method. Settle
        // through PaymentService.processPaymentInTx to enforce daily-close locking,
        // payment method validation, idempotency, and audit logging.
        if (finalBalance > 0) {
          const tenders = data.tenders?.length
            ? data.tenders
            : data.paymentMethod?.trim() && data.paymentMethod !== 'PAY_LATER'
            ? [{ method: data.paymentMethod, amount: finalBalance }]
            : [];
          const tendersTotal = tenders.reduce((sum, t) => sum.plus(new Prisma.Decimal(t.amount)), new Prisma.Decimal(0));

          if (tendersTotal.gt(new Prisma.Decimal(finalBalance))) {
            throw new AppError(`Tender amounts (${tendersTotal.toFixed(2)}) cannot exceed the outstanding balance (${finalBalance.toFixed(2)}).`, 422, 'TENDER_EXCEEDS_BALANCE');
          }

          if (tenders.length > 0) {
            if (!tendersTotal.eq(new Prisma.Decimal(finalBalance))) {
              throw new AppError(`Tender amounts (${tendersTotal.toFixed(2)}) must equal the outstanding balance (${finalBalance.toFixed(2)}).`, 422, 'TENDER_MISMATCH');
            }
            if (!folio) throw new AppError('An open folio is required to settle this stay.', 409, 'OPEN_FOLIO_REQUIRED');
            const checkoutPaymentIdempotencyKey = data.idempotencyKey || `checkout-payment-${reservation.id}`;
            const isFullPayment = tendersTotal.eq(new Prisma.Decimal(finalBalance));

            // Indicate what the money is for with explicit allocation
            let paymentDesc = data.paymentDescription?.trim() || data.notes?.trim();
            if (!paymentDesc) {
              const allocationParts: string[] = [];
              if (folio) {
                const items = await tx.folioItem.findMany({
                  where: { folioId: folio.id, voidedAt: null },
                  select: { description: true, type: true, amount: true },
                });
                const chargeItems = items.filter(
                  (i) => !['PAYMENT', 'DEPOSIT'].includes(i.type) && Number(i.amount) > 0,
                );
                const lateItem = chargeItems.find((i) => i.description?.toLowerCase().includes('late checkout'));
                const otherItems = chargeItems.filter((i) => !i.description?.toLowerCase().includes('late checkout'));
                if (otherItems.length) {
                  const uniqueLabels = [...new Set(otherItems.map((i) => i.description || i.type))];
                  allocationParts.push(uniqueLabels.slice(0, 2).join(', '));
                }
                if (lateItem) {
                  allocationParts.push(`late checkout (${lateInfo.lateHours}h @ GHS ${lateInfo.hourlyRate.toFixed(2)})`);
                }
              }
              paymentDesc = allocationParts.length
                ? `${isFullPayment ? 'Settlement' : 'Partial payment'} for: ${allocationParts.join(' + ')}`
                : isFullPayment ? 'Final settlement at check-out' : 'Partial payment at check-out';
            }

            await PaymentService.processPaymentInTx(tx, {
              folioId: folio.id,
              reservationId: reservation.id,
              guestId: primaryGuestId,
              amount: tendersTotal.toNumber(),
              method: tenders[0].method,
              tenders,
              idempotencyKey: checkoutPaymentIdempotencyKey,
              description: paymentDesc,
              processedBy: data.checkedOutBy,
              paymentType: isFullPayment ? 'PAYMENT' : 'DEPOSIT',
            });
            finalBalance = new Prisma.Decimal(finalBalance).minus(tendersTotal).toNumber();
          } else {
            throw new AppError(
              `Guest has an outstanding balance of GHS ${finalBalance.toFixed(2)}. Full payment is required before check-out. Please collect the full amount or add a payment before proceeding.`,
              422,
              'OUTSTANDING_BALANCE_REQUIRED',
            );
          }
        } else if (finalBalance < 0) {
          throw new AppError(`Folio has a guest credit of GHS ${Math.abs(finalBalance).toFixed(2)}. Process the refund before check-out.`, 409, 'GUEST_CREDIT_UNSETTLED');
        }

        // After payment, finalBalance should be 0 (hard block enforces full settlement)
        // Create CheckOut record
        const checkOut = await tx.checkOut.create({
          data: {
            reservationId: reservation.id,
            roomId: reservation.roomId,
            guestId: primaryGuestId,
            checkedOutBy: data.checkedOutBy,
            roomCondition: (data.roomCondition as RoomCondition) || RoomCondition.DIRTY,
            finalBalance,
            paymentMethod: (data.paymentMethod as PaymentMethod) || (data.tenders?.[0]?.method as PaymentMethod) || null,
            notes: [data.notes, lateFeeWaivedNote].filter(Boolean).join(' | ') || null,
          },
        });

        // Update reservation status
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: ReservationStatus.CHECKED_OUT },
        });

        // Update room status
        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: data.roomCondition === 'DAMAGED' ? RoomStatus.MAINTENANCE : data.roomCondition === 'DIRTY' ? RoomStatus.DIRTY : RoomStatus.AVAILABLE },
        });

        // Close Folio — balance is always settled at this point (hard block above)
        if (folio) {
          await tx.folio.update({
            where: { id: folio.id },
            data: {
              status: FolioStatus.CLOSED,
              closedAt: new Date(),
              balance: new Prisma.Decimal(finalBalance),
            },
          });
        }

        await AuditService.logInTransaction(tx, {
          userId: data.checkedOutBy,
          action: 'stay.checked_out',
          resource: 'reservation',
          resourceId: reservation.id,
          afterData: { checkOutId: checkOut.id, roomId: reservation.roomId, folioId: folio?.id, finalBalance },
        });
        const primaryGuest = reservation.guests[0]?.guest;
        const guestName = primaryGuest ? `${primaryGuest.firstName} ${primaryGuest.lastName}`.trim() : 'Guest';
        return { checkOut, folio, guestName, roomNumber: reservation.roomId, confirmationNo: reservation.confirmationNo };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).then((result) => {
        if (!result.isRetry) {
          NotificationService.notifyStaff(
            [PERMISSIONS.CHECKOUT_PERFORM],
            {
              type: 'RESERVATION',
              title: 'Guest checked out',
              message: `${result.guestName} · ${result.confirmationNo}${result.folio ? ` · Final balance GHS ${result.folio.balance}` : ''}`,
              priority: 'MEDIUM',
              data: { reservationId: result.checkOut.reservationId, checkOutId: result.checkOut.id, roomId: result.checkOut.roomId },
            },
            data.checkedOutBy,
          );
        }
        return result;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034' || (error as { code?: string }).code === 'P2002') {
        throw new AppError('The stay changed or was checked out concurrently. Please retry.', 409, 'CHECKOUT_CONFLICT');
      }
      throw error;
    }
  }

  /**
   * Get Late Check-Outs Audit for Admin Portal
   * Returns complete list of all late checkouts with stay details, delays, fees, and staff attribution
   */
  static async getLateCheckoutsAudit(options: { startDate?: Date; endDate?: Date; search?: string } = {}) {
    const { startDate, endDate, search } = options;

    // 1. Fetch current policy settings
    const [rateSetting, timeSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'financial.late_checkout_fee' } }),
      prisma.systemSetting.findUnique({ where: { key: 'villa.checkout_time' } }),
    ]);
    const hourlyRate = rateSetting ? Number(JSON.parse(rateSetting.value)) || 50 : 50;
    const checkoutTime = timeSetting ? String(JSON.parse(timeSetting.value) || '12:00') : '12:00';

    // 2. Fetch all CheckOut records with associated relations
    const whereDate = startDate && endDate ? { gte: startDate, lte: endDate } : undefined;

    const checkOuts: any[] = await prisma.checkOut.findMany({
      where: whereDate ? { actualCheckOut: whereDate } : undefined,
      include: {
        guest: true,
        room: { include: { roomType: true } },
        reservation: {
          include: {
            room: { include: { roomType: true } },
            checkIns: true,
            guests: { include: { guest: true } },
            folios: {
              include: {
                items: {
                  where: {
                    OR: [
                      { voidedAt: null, referenceType: 'CHECKOUT' },
                      { voidedAt: null, description: { contains: 'late', mode: 'insensitive' } },
                      // Waived-at-checkout fees are voided but must stay visible in the audit.
                      { voidedAt: { not: null }, voidReason: { startsWith: LATE_FEE_WAIVER_VOID_REASON } },
                    ],
                  },
                },
                payments: true,
              },
            },
          },
        },
      },
      orderBy: { actualCheckOut: 'desc' },
    });

    // 3. Resolve user IDs to staff names
    const userIds = new Set<string>();
    for (const co of checkOuts) {
      if (co.checkedOutBy) userIds.add(co.checkedOutBy);
      const inStaff = co.reservation?.checkIns?.[0]?.checkedInBy;
      if (inStaff) userIds.add(inStaff);
    }
    const staffUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const staffMap = new Map(
      staffUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.email || 'Staff']),
    );

    // 4. Filter and structure late check-outs
    const lateList: Array<{
      id: string;
      reservationId: string;
      confirmationNo: string;
      guestId: string;
      guestName: string;
      guestPhone: string;
      guestEmail: string;
      roomNumber: string;
      roomTypeName: string;
      checkInDate: string;
      scheduledCheckOutDate: string;
      actualCheckIn: string | null;
      actualCheckOut: string;
      deadline: string;
      hoursLate: number;
      feeAmount: number;
      refundedAmount: number;
      feeDescription: string;
      waived: boolean;
      waivedAmount: number;
      waivedReason: string | null;
      paymentMethod: string;
      checkedOutByName: string;
      checkedInByName: string;
      roomCondition: string;
      notes: string | null;
    }> = [];

    let totalFees = 0;
    let totalRefunded = 0;
    let totalFeesWaived = 0;
    let totalDelayMinutes = 0;

    for (const co of checkOuts) {
      const res = co.reservation;
      if (!res) continue;

      const schedOut = res.checkOutDate;
      const lateCalc = this.calculateLateCheckoutFee(schedOut, co.actualCheckOut, hourlyRate, checkoutTime);

      // Also check if there was a recorded folio late charge item
      const folio = res.folios?.[0];
      const feeItems: any[] = folio?.items || [];
      const waivedItem = feeItems.find((i: any) => this.isCheckoutFeeWaiver(i));
      const lateItem = feeItems.find((i: any) => !this.isCheckoutFeeWaiver(i));
      const waived = !!waivedItem && !lateItem;

      const isLate = lateCalc.isLate || !!lateItem || waived;
      if (!isLate) continue;

      const trackedItem = lateItem || waivedItem;
      const hoursLate = trackedItem ? Math.max(1, trackedItem.quantity || lateCalc.lateHours) : lateCalc.lateHours;
      const feeAmount = lateItem ? Number(lateItem.amount || 0) : waived ? 0 : lateCalc.fee;
      const waivedAmount = waived ? Number(waivedItem.amount || 0) : 0;
      const waivedReason = waived ? waivedItem.voidReason || null : null;
      const feeDescription =
        lateItem?.description || (waived ? waivedItem.description : undefined) || lateCalc.description || `Late checkout (${hoursLate}h @ GHS ${hourlyRate}/hr)`;

      // Any completed, non-voided refund issued against this folio is a reversal
      // of the late checkout fee that was settled at check-out. Cap it at the fee
      // so the record never shows a net negative charge.
      const folioRefunds = (folio?.payments || []).filter(
        (p: any) => p.type === 'REFUND' && p.status === 'COMPLETED' && !p.voidedAt,
      );
      const refundedAmount = Math.min(feeAmount, folioRefunds.reduce((s: number, p: any) => s + Number(p.amount || 0), 0));

      const guest = (co as any).guest || res.guests?.[0]?.guest;
      const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : 'Guest';
      const guestPhone = guest?.phone || '—';
      const guestEmail = guest?.email || '—';

      const roomObj = (co as any).room || (res as any).room;
      const roomNumber = roomObj?.number || '—';
      const roomTypeName = roomObj?.roomType?.name || 'Standard';

      const checkedOutByName = staffMap.get(co.checkedOutBy) || 'Staff';
      const checkInObj = res.checkIns?.[0];
      const checkedInByName = checkInObj?.checkedInBy ? staffMap.get(checkInObj.checkedInBy) || 'Staff' : 'Staff';

      // Search filter if provided
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          guestName.toLowerCase().includes(q) ||
          guestPhone.toLowerCase().includes(q) ||
          (res.confirmationNo || '').toLowerCase().includes(q) ||
          roomNumber.toLowerCase().includes(q) ||
          checkedOutByName.toLowerCase().includes(q) ||
          (waivedReason || '').toLowerCase().includes(q);
        if (!matches) continue;
      }

      totalFees += feeAmount;
      totalRefunded += refundedAmount;
      totalFeesWaived += waivedAmount;
      totalDelayMinutes += hoursLate * 60;

      lateList.push({
        id: co.id,
        reservationId: res.id,
        confirmationNo: res.confirmationNo || res.id.slice(0, 8),
        guestId: guest?.id || '',
        guestName,
        guestPhone,
        guestEmail,
        roomNumber,
        roomTypeName,
        checkInDate: new Date(res.checkInDate).toISOString(),
        scheduledCheckOutDate: new Date(res.checkOutDate).toISOString(),
        actualCheckIn: checkInObj?.actualCheckIn ? new Date(checkInObj.actualCheckIn).toISOString() : null,
        actualCheckOut: new Date(co.actualCheckOut).toISOString(),
        deadline: lateCalc.deadline.toISOString(),
        hoursLate,
        feeAmount,
        refundedAmount,
        feeDescription,
        waived,
        waivedAmount,
        waivedReason,
        paymentMethod: co.paymentMethod || 'CASH',
        checkedOutByName,
        checkedInByName,
        roomCondition: co.roomCondition || 'CLEAN',
        notes: co.notes,
      });
    }

    const count = lateList.length;
    const avgDelayHours = count > 0 ? Number((totalDelayMinutes / count / 60).toFixed(1)) : 0;

    return {
      policy: { hourlyRate, checkoutTime },
      summary: {
        totalLateCheckouts: count,
        totalFeesBilled: totalFees,
        totalRefunded,
        totalFeesCollected: Math.max(0, totalFees - totalRefunded),
        totalFeesWaived,
        avgDelayHours,
      },
      records: lateList,
    };
  }

  /**
   * Delete or Waive a Late Check-Out record & fee (Admin action)
   * Voids late fee charges, resets actual departure timestamp to on-time deadline,
   * recalculates folio balance, and logs audit trail.
   */
  static async deleteLateCheckout(checkOutId: string, adminUserId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const co = await tx.checkOut.findUnique({
        where: { id: checkOutId },
        include: {
          reservation: {
            include: {
              folios: {
                include: {
                  items: true,
                },
              },
            },
          },
        },
      });

      if (!co) throw new AppError('Check-out record not found.', 404, 'CHECKOUT_NOT_FOUND');

      const res = co.reservation;
      const checkoutTimeSetting = await tx.systemSetting.findUnique({ where: { key: 'villa.checkout_time' } });
      const checkoutTime = checkoutTimeSetting ? String(JSON.parse(checkoutTimeSetting.value) || '12:00') : '12:00';
      const onTimeDeadline = this.stayBoundary(res?.checkOutDate, checkoutTime);

      let voidedFeeTotal = 0;
      const voidReason = reason?.trim() || 'Waived / Deleted by Administrator';

      // 1. Find and void all late fee folio items
      if (res?.folios?.length) {
        for (const folio of res.folios) {
          const lateItems = folio.items.filter(
            (item) =>
              !item.voidedAt &&
              (item.referenceType === 'CHECKOUT' || (item.description && item.description.toLowerCase().includes('late'))),
          );

          for (const item of lateItems) {
            await tx.folioItem.update({
              where: { id: item.id },
              data: {
                voidedAt: new Date(),
                voidedBy: adminUserId,
                voidReason,
              },
            });
            voidedFeeTotal += Number(item.amount || 0);
          }

          // Recalculate folio balance
          const updatedBalance = await tx.folioItem.aggregate({
            where: { folioId: folio.id, voidedAt: null },
            _sum: { amount: true },
          });
          const newBal = new Prisma.Decimal(updatedBalance._sum.amount || 0);
          await tx.folio.update({
            where: { id: folio.id },
            data: { balance: newBal },
          });
        }
      }

      // 2. Adjust actualCheckOut to the on-time deadline
      await tx.checkOut.update({
        where: { id: checkOutId },
        data: {
          actualCheckOut: onTimeDeadline,
          notes: co.notes
            ? `${co.notes} | Late checkout waived by admin: ${voidReason}`
            : `Late checkout waived by admin: ${voidReason}`,
        },
      });

      // 3. Log in Audit trail
      await AuditService.logInTransaction(tx, {
        userId: adminUserId,
        action: 'stay.late_checkout_deleted',
        resource: 'check_out',
        resourceId: checkOutId,
        beforeData: {
          checkOutId,
          reservationId: co.reservationId,
          actualCheckOut: co.actualCheckOut.toISOString(),
        },
        afterData: {
          adjustedCheckOut: onTimeDeadline.toISOString(),
          voidedFeeTotal,
          voidReason,
        },
      });

      return {
        success: true,
        message: 'Late check-out details and fee removed successfully.',
        voidedFeeTotal,
        adjustedCheckOut: onTimeDeadline,
      };
    });
  }

  /**
   * Waive or remove a late check-out fee by reservationId
   * Voids late fee folio items, updates checkout record notes, recalculates folio balance.
   */
  static async waiveOrRemoveLateFee(reservationId: string, userId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: {
          folios: { include: { items: true } },
          checkOuts: true,
        },
      });

      if (!reservation) throw new AppError('Reservation not found.', 404, 'RESERVATION_NOT_FOUND');

      const voidReason = reason?.trim() || 'Waived / Removed by staff (Late check-out fee cancelled)';
      let voidedFeeTotal = 0;

      for (const folio of reservation.folios) {
        const lateItems = folio.items.filter(
          (item) =>
            !item.voidedAt &&
            (item.referenceType === 'CHECKOUT' ||
              (item.description && item.description.toLowerCase().includes('late'))),
        );

        for (const item of lateItems) {
          await tx.folioItem.update({
            where: { id: item.id },
            data: {
              voidedAt: new Date(),
              voidedBy: userId,
              voidReason,
            },
          });
          voidedFeeTotal += Number(item.amount || 0);
        }

        // Recalculate folio balance
        const updatedBalance = await tx.folioItem.aggregate({
          where: { folioId: folio.id, voidedAt: null },
          _sum: { amount: true },
        });
        await tx.folio.update({
          where: { id: folio.id },
          data: { balance: new Prisma.Decimal(updatedBalance._sum.amount || 0) },
        });
      }

      // Reset checkout departure to on-time deadline if checkOut exists
      const checkoutTimeSetting = await tx.systemSetting.findUnique({ where: { key: 'villa.checkout_time' } });
      const checkoutTime = checkoutTimeSetting ? String(JSON.parse(checkoutTimeSetting.value) || '12:00') : '12:00';
      const onTimeDeadline = this.stayBoundary(reservation.checkOutDate, checkoutTime);

      for (const co of reservation.checkOuts) {
        await tx.checkOut.update({
          where: { id: co.id },
          data: {
            actualCheckOut: onTimeDeadline,
            notes: co.notes
              ? `${co.notes} | Late fee waived: ${voidReason}`
              : `Late fee waived: ${voidReason}`,
          },
        });
      }

      await AuditService.logInTransaction(tx, {
        userId,
        action: 'stay.late_fee_waived',
        resource: 'reservation',
        resourceId: reservationId,
        afterData: { voidedFeeTotal, voidReason },
      });

      return {
        success: true,
        message: `Late check-out fee of GHS ${voidedFeeTotal.toFixed(2)} removed successfully.`,
        voidedFeeTotal,
      };
    });
  }
}
