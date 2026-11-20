// ============================================
// NS LUXURY VILLA — Public Booking Service
// Guest-facing availability, holds and self-service bookings.
//
// Payment model (v1): the guest pays a deposit to the villa's Mobile Money
// number and submits the transaction reference. Reception verifies the credit
// and records the deposit through the normal payments workflow. Recording the
// deposit confirms a PENDING website booking automatically.
// ============================================

import crypto from 'node:crypto';
import { prisma, config } from '../config';
import { Prisma, BookingSource, ReservationStatus, RoomStatus, PaymentType } from '@prisma/client';
import { AppError } from '../middleware/error';
import { ReservationService } from './reservations.service';
import { NotificationService } from './notification.service';
import { MessagingService } from './messaging.service';
import { GuestAuthService } from './guest-auth.service';
import { PERMISSIONS } from '@nslv/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PublicBookingConfig {
  publicEnabled: boolean;
  villa: { name: string; address: string; phone: string; email: string; website: string };
  currency: string;
  currencySymbol: string;
  taxRate: number;
  depositPercent: number;
  holdMinutes: number;
  cancellationHours: number;
  maxAdvanceDays: number;
  maxNights: number;
  /** False until staff set a Mobile Money number; the guest UI must not offer payment then. */
  momoConfigured: boolean;
  momo: { number: string; name: string };
}

export interface PublicBookingInput {
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password?: string;
  specialRequests?: string | null;
  paymentReference?: string;
  acceptPolicy: boolean;
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseDateOnly(value: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return date;
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function setting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

function formatMoney(amount: number, currency: string): string {
  const prefix = /^(GHS|GHC)$/i.test(currency || '') ? 'GH₵' : currency;
  return `${prefix} ${amount.toFixed(2)}`;
}

export class PublicBookingService {
  static async getConfig(): Promise<PublicBookingConfig> {
    const [momoNumber, momoName, depositPercent, holdMinutes, cancellationHours, maxAdvanceDays, maxNights, publicEnabled, taxRate, currency, currencySymbol] =
      await Promise.all([
        setting<string>('booking.momo_number', ''),
        setting<string>('booking.momo_name', ''),
        setting<number>('booking.deposit_percent', 30),
        setting<number>('booking.hold_minutes', 60),
        setting<number>('booking.cancellation_hours', 24),
        setting<number>('booking.max_advance_days', 365),
        setting<number>('booking.max_nights', 30),
        setting<boolean>('booking.public_enabled', true),
        setting<number>('villa.tax_rate', 0),
        setting<string>('villa.currency', config.villa.currency),
        setting<string>('regional.currency_symbol', 'GH₵'),
      ]);

    return {
      publicEnabled: publicEnabled !== false,
      villa: {
        name: config.villa.name,
        address: config.villa.address,
        phone: config.villa.phone,
        email: config.villa.email,
        website: config.villa.website,
      },
      currency,
      currencySymbol,
      taxRate: Number(taxRate) || 0,
      depositPercent: Math.min(100, Math.max(1, Number(depositPercent) || 30)),
      holdMinutes: Math.max(5, Math.min(24 * 60, Number(holdMinutes) || 60)),
      cancellationHours: Math.max(0, Number(cancellationHours) || 0),
      maxAdvanceDays: Math.max(1, Number(maxAdvanceDays) || 365),
      maxNights: Math.max(1, Number(maxNights) || 30),
      momoConfigured: Boolean(String(momoNumber || '').trim()),
      momo: { number: String(momoNumber || '').trim(), name: String(momoName || '').trim() || config.villa.name },
    };
  }

  private static validateDates(checkIn: Date, checkOut: Date, cfg: PublicBookingConfig) {
    if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime())) {
      throw new AppError('Please choose valid arrival and departure dates.', 400, 'INVALID_DATES');
    }
    if (checkOut <= checkIn) {
      throw new AppError('Departure must be after arrival.', 400, 'INVALID_DATES');
    }
    const today = todayUtc();
    if (checkIn < today) {
      throw new AppError('Arrival cannot be in the past.', 400, 'INVALID_DATES');
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) {
      throw new AppError('Book at least one night.', 400, 'INVALID_DATES');
    }
    if (nights > cfg.maxNights) {
      throw new AppError(`Stays longer than ${cfg.maxNights} nights must be arranged with the villa directly.`, 400, 'STAY_TOO_LONG');
    }
    const latest = new Date(today.getTime() + cfg.maxAdvanceDays * DAY_MS);
    if (checkIn > latest) {
      throw new AppError(`Online bookings open ${cfg.maxAdvanceDays} days ahead. Please contact the villa for later dates.`, 400, 'TOO_FAR_AHEAD');
    }
    return nights;
  }

  /**
   * Release expired PENDING holds. Paid or payment-claimed holds get a 24-hour
   * grace period so reception can verify a MoMo transfer without losing the room.
   */
  static async expireStaleHolds() {
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - DAY_MS);

    const stale = await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.PENDING,
        holdExpiresAt: { lt: now },
        OR: [
          { paymentSubmittedAt: null },
          { paymentSubmittedAt: { lt: graceCutoff } },
        ],
        payments: { none: { type: { in: [PaymentType.DEPOSIT, PaymentType.PAYMENT] }, status: 'COMPLETED', voidedAt: null } },
      },
      select: { id: true, roomId: true, confirmationNo: true },
    });
    if (!stale.length) return 0;

    const dayStart = todayUtc();
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    await prisma.$transaction(async (tx) => {
      for (const reservation of stale) {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.CANCELLED,
            cancelledAt: now,
            cancelReason: 'Deposit payment window expired',
            holdExpiresAt: null,
          },
        });

        const stillCoveringToday = await tx.reservation.count({
          where: {
            roomId: reservation.roomId,
            id: { not: reservation.id },
            status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
            checkInDate: { lt: dayEnd },
            checkOutDate: { gt: dayStart },
          },
        });
        if (stillCoveringToday === 0) {
          await tx.room.updateMany({
            where: { id: reservation.roomId, status: RoomStatus.RESERVED },
            data: { status: RoomStatus.AVAILABLE },
          });
        }
      }
    });

    return stale.length;
  }

  static async getAvailability(query: {
    checkInDate: string;
    checkOutDate: string;
    adults?: number;
    children?: number;
    roomNumber?: string;
  }) {
    const cfg = await this.getConfig();
    if (!cfg.publicEnabled) {
      throw new AppError('Online booking is temporarily unavailable. Please call the villa.', 503, 'BOOKING_DISABLED');
    }

    const checkIn = parseDateOnly(query.checkInDate);
    const checkOut = parseDateOnly(query.checkOutDate);
    const nights = this.validateDates(checkIn, checkOut, cfg);
    const adults = Math.max(1, Number(query.adults) || 1);
    const children = Math.max(0, Number(query.children) || 0);
    const roomNumber = query.roomNumber?.trim();

    await this.expireStaleHolds();

    const roomTypes = await prisma.roomType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        amenities: { include: { amenity: true } },
        rooms: {
          where: {
            isActive: true,
            status: { notIn: [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE] },
            ...(roomNumber ? { number: { equals: roomNumber, mode: 'insensitive' } } : {}),
          },
          select: { id: true, number: true, name: true },
        },
      },
    });

    const unavailable = await prisma.reservation.findMany({
      where: {
        status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.CHECKED_OUT] },
        AND: [{ checkInDate: { lt: checkOut } }, { checkOutDate: { gt: checkIn } }],
      },
      select: { roomId: true },
    });
    const unavailableRoomIds = new Set(unavailable.map((r) => r.roomId));

    return roomTypes.map((type) => {
      const availableRooms = type.rooms
        .filter((room) => !unavailableRoomIds.has(room.id))
        .map((room) => ({ number: room.number, name: room.name }));
      const availableCount = availableRooms.length;
      const baseRate = Number(type.basePrice);
      const subtotal = roundMoney(baseRate * nights);
      const taxAmount = roundMoney(subtotal * (cfg.taxRate / 100));
      const totalAmount = roundMoney(subtotal + taxAmount);
      const depositAmount = roundMoney(totalAmount * (cfg.depositPercent / 100));
      const capacityOk = adults <= type.maxAdults && children <= type.maxChildren;

      return {
        id: type.id,
        name: type.name,
        description: type.description,
        shortDescription: type.shortDescription,
        imageUrls: type.imageUrls || [],
        basePrice: baseRate,
        maxAdults: type.maxAdults,
        maxChildren: type.maxChildren,
        amenities: type.amenities.map((entry) => ({
          name: entry.amenity.name,
          icon: entry.amenity.icon,
          category: entry.amenity.category,
        })),
        availableRooms: capacityOk ? availableRooms : [],
        availableCount,
        available: capacityOk && availableCount > 0,
        capacityOk,
        nights,
        subtotal,
        taxAmount,
        totalAmount,
        depositAmount,
        currency: cfg.currency,
      };
    });
  }

  static async createBooking(input: PublicBookingInput) {
    const cfg = await this.getConfig();
    if (!cfg.publicEnabled) {
      throw new AppError('Online booking is temporarily unavailable. Please call the villa.', 503, 'BOOKING_DISABLED');
    }
    if (!cfg.momoConfigured) {
      // Never let a guest reach a payment screen with no number to pay into.
      throw new AppError('Online booking is not open yet. Please call the villa to reserve your stay.', 503, 'PAYMENTS_NOT_CONFIGURED');
    }

    const checkIn = parseDateOnly(input.checkInDate);
    const checkOut = parseDateOnly(input.checkOutDate);
    const nights = this.validateDates(checkIn, checkOut, cfg);
    const email = input.email.toLowerCase().trim();
    const phone = input.phone.trim();

    await this.expireStaleHolds();

    let accountCreated = false;
    let guestId = '';

    const result = await prisma.$transaction(
      async (tx) => {
        const roomType = await tx.roomType.findUnique({
          where: { id: input.roomTypeId },
          include: {
            rooms: {
              where: { isActive: true, status: { notIn: [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE] } },
              orderBy: { number: 'asc' },
            },
          },
        });
        if (!roomType || !roomType.isActive) {
          throw new AppError('That room type is not available.', 404, 'ROOM_TYPE_NOT_FOUND');
        }
        if (input.adults > roomType.maxAdults) {
          throw new AppError(`This room type allows up to ${roomType.maxAdults} adult${roomType.maxAdults === 1 ? '' : 's'}.`, 400, 'EXCEEDS_ADULT_CAPACITY');
        }
        if (input.children > roomType.maxChildren) {
          throw new AppError(`This room type allows up to ${roomType.maxChildren} child${roomType.maxChildren === 1 ? '' : 'ren'}.`, 400, 'EXCEEDS_CHILD_CAPACITY');
        }

        // If the email already belongs to a guest account, link the booking to
        // that guest so it appears in their account automatically.
        const existingAccount = await tx.guestAccount.findUnique({
          where: { email },
          include: { guest: true },
        });
        if (existingAccount && existingAccount.status !== 'ACTIVE') {
          throw new AppError('This account is disabled. Please contact the villa.', 403, 'ACCOUNT_INACTIVE');
        }

        let guest = existingAccount?.guest || null;
        if (!guest) {
          guest = await tx.guest.findFirst({
            where: { OR: [{ email: { equals: email, mode: 'insensitive' } }, { phone }] },
          });
        }
        if (guest) {
          guest = await tx.guest.update({
            where: { id: guest.id },
            data: {
              firstName: guest.firstName || input.firstName.trim(),
              lastName: guest.lastName || input.lastName.trim(),
              email: guest.email || email,
              phone: guest.phone || phone,
            },
          });
        } else {
          guest = await tx.guest.create({
            data: {
              firstName: input.firstName.trim(),
              lastName: input.lastName.trim(),
              email,
              phone,
            },
          });
        }
        guestId = guest.id;

        // Allocate a concrete room at booking time. The availability check and
        // the insert share this serializable transaction, so two guests cannot
        // take the last room at once.
        let allocatedRoomId: string | null = null;
        for (const room of roomType.rooms) {
          const available = await ReservationService.checkAvailability(room.id, checkIn, checkOut, undefined, tx);
          if (available) {
            allocatedRoomId = room.id;
            break;
          }
        }
        if (!allocatedRoomId) {
          throw new AppError('That room type sold out while you were booking. Please choose another room or dates.', 409, 'ROOM_UNAVAILABLE');
        }

        const baseRate = Number(roomType.basePrice);
        const subtotal = roundMoney(baseRate * nights);
        const taxAmount = roundMoney(subtotal * (cfg.taxRate / 100));
        const totalAmount = roundMoney(subtotal + taxAmount);
        const depositAmount = roundMoney(totalAmount * (cfg.depositPercent / 100));
        const holdExpiresAt = addMinutes(new Date(), cfg.holdMinutes);
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const confirmationNo = `NSVL-${dateStr}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        const reservation = await tx.reservation.create({
          data: {
            confirmationNo,
            roomId: allocatedRoomId,
            status: ReservationStatus.PENDING,
            source: BookingSource.WEBSITE,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            adults: input.adults,
            children: input.children,
            baseRate,
            taxAmount,
            totalAmount,
            depositAmount,
            specialRequests: input.specialRequests?.trim() || null,
            notes: 'Online booking via the public website. Deposit verification required.',
            holdExpiresAt,
            guestPaymentReference: input.paymentReference?.trim() || null,
            paymentSubmittedAt: input.paymentReference?.trim() ? new Date() : null,
            createdBy: 'PUBLIC_WEBSITE',
            guests: { create: [{ guestId: guest.id, isPrimary: true }] },
          },
          include: {
            room: { include: { roomType: true } },
            guests: { include: { guest: true } },
          },
        });

        return { reservation, roomType, guest, baseRate, subtotal, taxAmount, totalAmount, depositAmount, holdExpiresAt, nights };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const { reservation, roomType, guest, baseRate, subtotal, taxAmount, totalAmount, depositAmount, holdExpiresAt } = result;
    const guestName = `${guest.firstName} ${guest.lastName || ''}`.trim();

    // Create the guest account after the booking commits. A failure here must
    // never discard a valid room hold.
    if (input.password && !(await prisma.guestAccount.findUnique({ where: { email } }))) {
      try {
        await GuestAuthService.createAccountForGuest({
          guestId: guest.id,
          email,
          password: input.password,
          firstName: guest.firstName,
        });
        accountCreated = true;
      } catch (error) {
        console.error('[PUBLIC BOOKING] Guest account creation failed:', error);
      }
    }

    await NotificationService.notifyStaff([PERMISSIONS.RESERVATIONS_VIEW], {
      type: 'RESERVATION',
      title: 'New website booking — deposit pending',
      message: `${guestName} · ${roomType.name} · ${nights} night${nights === 1 ? '' : 's'} · Deposit ${formatMoney(depositAmount, cfg.currency)}`,
      priority: 'HIGH',
      data: {
        reservationId: reservation.id,
        confirmationNo: reservation.confirmationNo,
        depositAmount,
        guestPaymentReference: input.paymentReference || null,
      },
    });

    const paymentReference = reservation.confirmationNo;
    const emailBody = [
      `Hello ${guest.firstName},`,
      '',
      `Your room is being held for ${cfg.holdMinutes} minutes.`,
      '',
      `Confirmation: ${reservation.confirmationNo}`,
      `Room type: ${roomType.name}`,
      `Arrival: ${input.checkInDate.slice(0, 10)}`,
      `Departure: ${input.checkOutDate.slice(0, 10)}`,
      `${nights} night${nights === 1 ? '' : 's'} · ${input.adults} adult${input.adults === 1 ? '' : 's'}${input.children ? ` · ${input.children} child${input.children === 1 ? '' : 'ren'}` : ''}`,
      '',
      `Deposit required: ${formatMoney(depositAmount, cfg.currency)}`,
      `Mobile Money: ${cfg.momo.number} (${cfg.momo.name})`,
      `Payment reference: ${paymentReference}`,
      '',
      `Send the deposit to the MoMo number above and submit the transaction reference at ${config.clientUrl}/book. Your booking is confirmed once reception verifies the payment.`,
      '',
      '— NS Luxury Villa',
    ].join('\n');

    await MessagingService.queueEmail({
      recipient: email,
      subject: `Booking ${reservation.confirmationNo} — pay your deposit`,
      template: 'PUBLIC_BOOKING_DEPOSIT',
      body: emailBody,
      payload: {
        confirmationNo: reservation.confirmationNo,
        depositAmount,
        momoNumber: cfg.momo.number,
        momoName: cfg.momo.name,
        paymentReference,
        holdExpiresAt: holdExpiresAt.toISOString(),
      },
      relatedType: 'reservation',
      relatedId: reservation.id,
    });

    await MessagingService.queueWhatsApp({
      recipient: phone,
      subject: `Booking ${reservation.confirmationNo}`,
      template: 'PUBLIC_BOOKING_DEPOSIT',
      body: `NS Luxury Villa: ${reservation.confirmationNo}. ${roomType.name}, ${nights} night(s). Deposit ${formatMoney(depositAmount, cfg.currency)} to MoMo ${cfg.momo.number} (${cfg.momo.name}), reference ${paymentReference}. We confirm once payment is verified.`,
      payload: { confirmationNo: reservation.confirmationNo, depositAmount, momoNumber: cfg.momo.number },
      relatedType: 'reservation',
      relatedId: reservation.id,
    });

    return {
      confirmationNo: reservation.confirmationNo,
      reservationId: reservation.id,
      status: reservation.status,
      holdExpiresAt: holdExpiresAt.toISOString(),
      checkInDate: input.checkInDate.slice(0, 10),
      checkOutDate: input.checkOutDate.slice(0, 10),
      nights: result.nights,
      adults: input.adults,
      children: input.children,
      roomType: { id: roomType.id, name: roomType.name, imageUrls: roomType.imageUrls || [] },
      room: { number: reservation.room.number, name: reservation.room.name },
      baseRate,
      subtotal,
      taxAmount,
      totalAmount,
      depositAmount,
      currency: cfg.currency,
      momo: cfg.momo,
      paymentReference,
      guest: { firstName: guest.firstName, lastName: guest.lastName, email, phone },
      accountCreated,
    };
  }

  private static assertGuestOwnsReservation(reservation: any, email: string) {
    const primary = reservation.guests?.find((entry: any) => entry.isPrimary)?.guest;
    if (!primary || String(primary.email || '').toLowerCase() !== email.toLowerCase()) {
      throw new AppError('We could not find a booking with that confirmation number and email.', 404, 'BOOKING_NOT_FOUND');
    }
    return primary;
  }

  private static mapReservation(reservation: any, cfg: PublicBookingConfig) {
    const deposits = (reservation.payments || []).filter(
      (p: any) =>
        (p.type === PaymentType.DEPOSIT || p.type === PaymentType.PAYMENT) &&
        p.status === 'COMPLETED' &&
        !p.voidedAt,
    );
    const amountPaid = deposits.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const primary = reservation.guests?.find((entry: any) => entry.isPrimary)?.guest;
    const roomType = reservation.room?.roomType;

    return {
      id: reservation.id,
      confirmationNo: reservation.confirmationNo,
      status: reservation.status,
      source: reservation.source,
      checkInDate: reservation.checkInDate.toISOString().slice(0, 10),
      checkOutDate: reservation.checkOutDate.toISOString().slice(0, 10),
      adults: reservation.adults,
      children: reservation.children,
      room: { number: reservation.room?.number, name: reservation.room?.name },
      roomType: roomType
        ? { id: roomType.id, name: roomType.name, imageUrls: roomType.imageUrls || [] }
        : null,
      baseRate: Number(reservation.baseRate),
      taxAmount: Number(reservation.taxAmount),
      totalAmount: Number(reservation.totalAmount),
      depositAmount: Number(reservation.depositAmount),
      amountPaid: roundMoney(amountPaid),
      balance: roundMoney(Math.max(0, Number(reservation.totalAmount) - amountPaid)),
      currency: cfg.currency,
      holdExpiresAt: reservation.holdExpiresAt?.toISOString() || null,
      guestPaymentReference: reservation.guestPaymentReference || null,
      paymentSubmittedAt: reservation.paymentSubmittedAt?.toISOString() || null,
      specialRequests: reservation.specialRequests || null,
      guest: primary
        ? { firstName: primary.firstName, lastName: primary.lastName, email: primary.email, phone: primary.phone }
        : null,
      momo: cfg.momo,
    };
  }

  static async lookupBooking(confirmationNo: string, email: string) {
    await this.expireStaleHolds();
    const cfg = await this.getConfig();
    const reservation = await prisma.reservation.findUnique({
      where: { confirmationNo: confirmationNo.trim().toUpperCase() },
      include: {
        room: { include: { roomType: true } },
        guests: { include: { guest: true } },
        payments: { where: { type: { in: [PaymentType.DEPOSIT, PaymentType.PAYMENT] } } },
      },
    });
    if (!reservation) {
      throw new AppError('We could not find a booking with that confirmation number and email.', 404, 'BOOKING_NOT_FOUND');
    }
    this.assertGuestOwnsReservation(reservation, email);
    return this.mapReservation(reservation, cfg);
  }

  static async submitPaymentReference(confirmationNo: string, email: string, reference: string) {
    const cfg = await this.getConfig();
    const reservation = await prisma.reservation.findUnique({
      where: { confirmationNo: confirmationNo.trim().toUpperCase() },
      include: {
        room: { include: { roomType: true } },
        guests: { include: { guest: true } },
        payments: { where: { type: { in: [PaymentType.DEPOSIT, PaymentType.PAYMENT] } } },
      },
    });
    if (!reservation) {
      throw new AppError('We could not find a booking with that confirmation number and email.', 404, 'BOOKING_NOT_FOUND');
    }
    this.assertGuestOwnsReservation(reservation, email);

    if (!['PENDING', 'CONFIRMED'].includes(String(reservation.status))) {
      throw new AppError('This booking can no longer accept a deposit reference.', 409, 'BOOKING_NOT_OPEN');
    }

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        guestPaymentReference: reference.trim(),
        paymentSubmittedAt: new Date(),
      },
    });

    await NotificationService.notifyStaff([PERMISSIONS.RESERVATIONS_VIEW, PERMISSIONS.PAYMENTS_VIEW], {
      type: 'PAYMENT',
      title: 'MoMo reference submitted',
      message: `${updated.confirmationNo} · ${formatMoney(Number(updated.depositAmount), cfg.currency)} · Ref ${reference.trim()}`,
      priority: 'HIGH',
      data: {
        reservationId: updated.id,
        confirmationNo: updated.confirmationNo,
        reference: reference.trim(),
      },
    });

    const primary = reservation.guests.find((entry) => entry.isPrimary)?.guest;
    if (primary?.email) {
      await MessagingService.queueEmail({
        recipient: primary.email,
        subject: `We received your payment reference for ${updated.confirmationNo}`,
        template: 'PUBLIC_BOOKING_REFERENCE_RECEIVED',
        body: `Hello ${primary.firstName},\n\nWe received your MoMo reference ${reference.trim()} for booking ${updated.confirmationNo}. Reception will verify the payment and confirm your booking shortly.\n\n— NS Luxury Villa`,
        relatedType: 'reservation',
        relatedId: updated.id,
      });
    }
    if (primary?.phone) {
      await MessagingService.queueWhatsApp({
        recipient: primary.phone,
        subject: `Payment reference received — ${updated.confirmationNo}`,
        template: 'PUBLIC_BOOKING_REFERENCE_RECEIVED',
        body: `NS Luxury Villa: we received your MoMo reference for ${updated.confirmationNo}. Reception will verify and confirm shortly.`,
        relatedType: 'reservation',
        relatedId: updated.id,
      });
    }

    return this.mapReservation({ ...reservation, ...updated, payments: reservation.payments }, cfg);
  }

  private static async requireVerifiedAccount(guestAccountId: string) {
    const account = await prisma.guestAccount.findUnique({ where: { id: guestAccountId } });
    if (!account) throw new AppError('Guest account not found.', 404, 'GUEST_ACCOUNT_NOT_FOUND');
    if (!account.emailVerifiedAt) {
      throw new AppError('Verify your email address to view your bookings. Check your inbox for the link we sent.', 403, 'EMAIL_NOT_VERIFIED');
    }
    return account;
  }

  static async getGuestBookings(guestAccountId: string) {
    const cfg = await this.getConfig();
    const account = await this.requireVerifiedAccount(guestAccountId);

    await this.expireStaleHolds();
    const reservations = await prisma.reservation.findMany({
      where: { guests: { some: { guestId: account.guestId } } },
      orderBy: { checkInDate: 'desc' },
      include: {
        room: { include: { roomType: true } },
        guests: { include: { guest: true } },
        payments: { where: { type: { in: [PaymentType.DEPOSIT, PaymentType.PAYMENT] } } },
      },
    });
    return reservations.map((reservation) => this.mapReservation(reservation, cfg));
  }

  static async getGuestBooking(guestAccountId: string, reservationId: string) {
    const cfg = await this.getConfig();
    const account = await this.requireVerifiedAccount(guestAccountId);

    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, guests: { some: { guestId: account.guestId } } },
      include: {
        room: { include: { roomType: true } },
        guests: { include: { guest: true } },
        payments: { where: { type: { in: [PaymentType.DEPOSIT, PaymentType.PAYMENT] } } },
      },
    });
    if (!reservation) throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    return this.mapReservation(reservation, cfg);
  }

  static async cancelGuestBooking(guestAccountId: string, reservationId: string, reason?: string) {
    const cfg = await this.getConfig();
    const account = await this.requireVerifiedAccount(guestAccountId);

    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, guests: { some: { guestId: account.guestId } } },
      include: { guests: { include: { guest: true } }, room: { include: { roomType: true } }, payments: { where: { type: 'DEPOSIT' } } },
    });
    if (!reservation) throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    if (reservation.status !== ReservationStatus.PENDING && reservation.status !== ReservationStatus.CONFIRMED) {
      throw new AppError('This booking can no longer be cancelled online.', 409, 'BOOKING_NOT_CANCELLABLE');
    }

    const hoursUntilArrival = (reservation.checkInDate.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursUntilArrival < cfg.cancellationHours) {
      throw new AppError(
        `Online cancellation closes ${cfg.cancellationHours} hours before arrival. Please call the villa to cancel.`,
        409,
        'CANCELLATION_WINDOW_CLOSED',
      );
    }

    const cancelReason = reason?.trim()
      ? `Guest cancellation: ${reason.trim()}`
      : 'Cancelled by guest from the online portal';

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason,
        holdExpiresAt: null,
      },
    });

    const dayStart = todayUtc();
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const stillCoveringToday = await prisma.reservation.count({
      where: {
        roomId: reservation.roomId,
        id: { not: reservation.id },
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        checkInDate: { lt: dayEnd },
        checkOutDate: { gt: dayStart },
      },
    });
    if (stillCoveringToday === 0) {
      await prisma.room.updateMany({
        where: { id: reservation.roomId, status: RoomStatus.RESERVED },
        data: { status: RoomStatus.AVAILABLE },
      });
    }

    const primary = reservation.guests.find((entry) => entry.isPrimary)?.guest;
    await NotificationService.notifyStaff([PERMISSIONS.RESERVATIONS_VIEW], {
      type: 'RESERVATION',
      title: 'Website booking cancelled by guest',
      message: `${updated.confirmationNo} — ${primary ? `${primary.firstName} ${primary.lastName || ''}`.trim() : 'Guest'}`,
      priority: 'MEDIUM',
      data: { reservationId: updated.id, confirmationNo: updated.confirmationNo },
    });

    if (primary?.email) {
      await MessagingService.queueEmail({
        recipient: primary.email,
        subject: `Booking ${updated.confirmationNo} cancelled`,
        template: 'PUBLIC_BOOKING_CANCELLED',
        body: `Hello ${primary.firstName},\n\nBooking ${updated.confirmationNo} has been cancelled. If you paid a deposit, please contact the villa to arrange any eligible refund.\n\n— NS Luxury Villa`,
        relatedType: 'reservation',
        relatedId: updated.id,
      });
    }
    if (primary?.phone) {
      await MessagingService.queueWhatsApp({
        recipient: primary.phone,
        subject: `Booking ${updated.confirmationNo} cancelled`,
        template: 'PUBLIC_BOOKING_CANCELLED',
        body: `NS Luxury Villa: booking ${updated.confirmationNo} has been cancelled. Contact us regarding any deposit refund.`,
        relatedType: 'reservation',
        relatedId: updated.id,
      });
    }

    return this.mapReservation({ ...reservation, ...updated, payments: reservation.payments }, cfg);
  }

  /**
   * Called after reception records a deposit. A PENDING website booking is
   * confirmed once the recorded deposit covers the required deposit.
   */
  static async confirmIfDepositMet(reservationId: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guests: { include: { guest: true } },
        room: { include: { roomType: true } },
        payments: { where: { type: { in: [PaymentType.DEPOSIT, PaymentType.PAYMENT] }, status: 'COMPLETED', voidedAt: null } },
      },
    });
    if (!reservation || reservation.status !== ReservationStatus.PENDING) return null;

    const paid = reservation.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const required = Number(reservation.depositAmount || 0);
    if (required > 0 && paid < required) return null;

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.CONFIRMED, holdExpiresAt: null },
    });

    const cfg = await this.getConfig();
    const primary = reservation.guests.find((entry) => entry.isPrimary)?.guest;
    if (primary?.email) {
      await MessagingService.queueEmail({
        recipient: primary.email,
        subject: `Booking ${updated.confirmationNo} confirmed`,
        template: 'PUBLIC_BOOKING_CONFIRMED',
        body: `Hello ${primary.firstName},\n\nYour payment has been verified and booking ${updated.confirmationNo} is confirmed.\n\nRoom type: ${reservation.room.roomType.name}\nArrival: ${reservation.checkInDate.toISOString().slice(0, 10)}\nDeparture: ${reservation.checkOutDate.toISOString().slice(0, 10)}\n\nWe look forward to welcoming you.\n\n— NS Luxury Villa`,
        relatedType: 'reservation',
        relatedId: updated.id,
      });
    }
    if (primary?.phone) {
      await MessagingService.queueWhatsApp({
        recipient: primary.phone,
        subject: `Booking ${updated.confirmationNo} confirmed`,
        template: 'PUBLIC_BOOKING_CONFIRMED',
        body: `NS Luxury Villa: payment verified. Booking ${updated.confirmationNo} is confirmed for ${reservation.checkInDate.toISOString().slice(0, 10)} to ${reservation.checkOutDate.toISOString().slice(0, 10)}.`,
        relatedType: 'reservation',
        relatedId: updated.id,
      });
    }

    await NotificationService.notifyStaff([PERMISSIONS.RESERVATIONS_VIEW], {
      type: 'PAYMENT',
      title: 'Website booking confirmed',
      message: `${updated.confirmationNo} · deposit verified (${formatMoney(paid, cfg.currency)})`,
      priority: 'MEDIUM',
      data: { reservationId: updated.id, confirmationNo: updated.confirmationNo },
    });

    return updated;
  }
}
