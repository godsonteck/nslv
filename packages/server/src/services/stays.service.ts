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
  paymentMethod?: PaymentMethod | string;
  idempotencyKey?: string;
  notes?: string;
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
      return { checkIn, folio };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('The reservation changed while check-in was being processed. Please retry.', 409, 'CHECKIN_CONFLICT');
      }
      throw error;
    }
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
        const existingFeeItem = folio.items.find(
          (item: any) =>
            item.referenceType === 'CHECKOUT' ||
            (item.description && item.description.toLowerCase().includes('late checkout')),
        );

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
        // The fee is an admin-controlled business rule: GHS 50 per hour past configured check-out time.
        // Charge it before calculating the ledger settlement so it reaches the bill,
        // payment record, checkout audit and printed receipt as one durable operation.
        const lateCheckoutSetting = await tx.systemSetting.findUnique({ where: { key: 'financial.late_checkout_fee' } });
        const checkoutTimeSetting = await tx.systemSetting.findUnique({ where: { key: 'villa.checkout_time' } });

        const settingVal = lateCheckoutSetting ? Number(JSON.parse(lateCheckoutSetting.value)) : 50;
        const hourlyRate = Number.isFinite(settingVal) && settingVal > 0 ? settingVal : 50;
        const checkoutTime = checkoutTimeSetting ? String(JSON.parse(checkoutTimeSetting.value) || '12:00') : '12:00';

        const lateInfo = this.calculateLateCheckoutFee(reservation.checkOutDate, new Date(), hourlyRate, checkoutTime);
        if (folio && lateInfo.isLate && lateInfo.fee > 0) {
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
            roomCondition: (data.roomCondition as RoomCondition) || RoomCondition.DIRTY,
            finalBalance,
            paymentMethod: (data.paymentMethod as PaymentMethod) || null,
            notes: data.notes,
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

        // Close Folio
        if (folio) {
          await tx.folio.update({
            where: { id: folio.id },
            data: { status: FolioStatus.CLOSED, closedAt: new Date(), balance: new Prisma.Decimal(finalBalance) },
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
            checkIn: true,
            guests: { include: { guest: true } },
            folios: {
              include: {
                items: {
                  where: {
                    voidedAt: null,
                    OR: [
                      { referenceType: 'CHECKOUT' },
                      { description: { contains: 'late', mode: 'insensitive' } },
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
      if (co.reservation?.checkIn?.checkedInBy) userIds.add(co.reservation.checkIn.checkedInBy);
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
      feeDescription: string;
      paymentMethod: string;
      checkedOutByName: string;
      checkedInByName: string;
      roomCondition: string;
      notes: string | null;
    }> = [];

    let totalFees = 0;
    let totalDelayMinutes = 0;

    for (const co of checkOuts) {
      const res = co.reservation;
      if (!res) continue;

      const schedOut = res.checkOutDate;
      const lateCalc = this.calculateLateCheckoutFee(schedOut, co.actualCheckOut, hourlyRate, checkoutTime);

      // Also check if there was a recorded folio late charge item
      const folio = res.folios?.[0];
      const lateItem = folio?.items?.find(
        (i: any) => i.description?.toLowerCase().includes('late') || i.referenceType === 'CHECKOUT',
      );

      const isLate = lateCalc.isLate || !!lateItem;
      if (!isLate) continue;

      const hoursLate = lateItem ? Math.max(1, lateItem.quantity || lateCalc.lateHours) : lateCalc.lateHours;
      const feeAmount = lateItem ? Number(lateItem.amount || 0) : lateCalc.fee;
      const feeDescription = lateItem?.description || lateCalc.description || `Late checkout (${hoursLate}h @ GHS ${hourlyRate}/hr)`;

      const guest = (co as any).guest || res.guests?.[0]?.guest;
      const guestName = guest ? `${guest.firstName} ${guest.lastName}`.trim() : 'Guest';
      const guestPhone = guest?.phone || '—';
      const guestEmail = guest?.email || '—';

      const roomObj = (co as any).room || (res as any).room;
      const roomNumber = roomObj?.number || '—';
      const roomTypeName = roomObj?.roomType?.name || 'Standard';

      const checkedOutByName = staffMap.get(co.checkedOutBy) || 'Staff';
      const checkedInByName = res.checkIn?.checkedInBy ? staffMap.get(res.checkIn.checkedInBy) || 'Staff' : 'Staff';

      // Search filter if provided
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          guestName.toLowerCase().includes(q) ||
          guestPhone.toLowerCase().includes(q) ||
          (res.confirmationNo || '').toLowerCase().includes(q) ||
          roomNumber.toLowerCase().includes(q) ||
          checkedOutByName.toLowerCase().includes(q);
        if (!matches) continue;
      }

      totalFees += feeAmount;
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
        actualCheckIn: res.checkIn?.actualCheckIn ? new Date(res.checkIn.actualCheckIn).toISOString() : null,
        actualCheckOut: new Date(co.actualCheckOut).toISOString(),
        deadline: lateCalc.deadline.toISOString(),
        hoursLate,
        feeAmount,
        feeDescription,
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
        totalFeesCollected: totalFees,
        avgDelayHours,
      },
      records: lateList,
    };
  }
}
