import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuestSchema, updateGuestSchema, formatGuestName } from '@nslv/shared';
import { AppError } from '../src/middleware/error';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  reservationFindFirst: vi.fn(),
  reservationFindUnique: vi.fn(),
  reservationCreate: vi.fn(),
  reservationUpdate: vi.fn(),
  roomFindUnique: vi.fn(),
  roomUpdate: vi.fn(),
  guestFindUnique: vi.fn(),
  guestFindMany: vi.fn(),
  paymentAggregate: vi.fn(),
  paymentCreate: vi.fn(),
  paymentFindFirst: vi.fn(),
  folioFindFirst: vi.fn(),
  folioItemCreate: vi.fn(),
  folioUpdate: vi.fn(),
  auditLogCreate: vi.fn(),
  userFindMany: vi.fn(),
  notificationCreateMany: vi.fn(),
}));

vi.mock('../src/config', () => ({
  prisma: {
    $transaction: mocks.transaction,
    room: { findUnique: mocks.roomFindUnique, update: mocks.roomUpdate },
    reservation: {
      findFirst: mocks.reservationFindFirst,
      findUnique: mocks.reservationFindUnique,
      create: mocks.reservationCreate,
      update: mocks.reservationUpdate,
    },
    guest: { findUnique: mocks.guestFindUnique, findMany: mocks.guestFindMany },
    auditLog: { create: mocks.auditLogCreate },
    user: { findMany: mocks.userFindMany },
    notification: { createMany: mocks.notificationCreateMany },
  },
}));

vi.mock('../src/services/audit.service', () => ({
  AuditService: {
    logInTransaction: vi.fn().mockImplementation((tx, data) => {
      mocks.auditLogCreate(data);
      return Promise.resolve();
    }),
  },
}));

import { ReservationService } from '../src/services/reservations.service';

describe('Surgical Reservation Fixes', () => {
  const setupTx = () => {
    const tx = {
      reservation: {
        findFirst: mocks.reservationFindFirst,
        findUnique: mocks.reservationFindUnique,
        create: mocks.reservationCreate,
        update: mocks.reservationUpdate,
      },
      room: {
        findUnique: mocks.roomFindUnique,
        update: mocks.roomUpdate,
      },
      guest: {
        findUnique: mocks.guestFindUnique,
        findMany: mocks.guestFindMany,
      },
      payment: {
        aggregate: mocks.paymentAggregate,
        create: mocks.paymentCreate,
        findFirst: mocks.paymentFindFirst,
      },
      folio: {
        findFirst: mocks.folioFindFirst,
        update: mocks.folioUpdate,
      },
      folioItem: {
        create: mocks.folioItemCreate,
      },
      auditLog: {
        create: mocks.auditLogCreate,
      },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    return tx;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindMany.mockResolvedValue([]);
    mocks.notificationCreateMany.mockResolvedValue({ count: 0 });
    setupTx();
  });

  // ==========================================================
  // FIX #1: GUEST LAST NAME OPTIONAL & FORMATTING
  // ==========================================================
  describe('Fix #1: Optional Guest Last Name & Formatting', () => {
    it('TEST 1: Create guest with firstName only (lastName omitted) succeeds in validation', () => {
      const parsed = createGuestSchema.safeParse({ firstName: 'Kwame' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.firstName).toBe('Kwame');
        expect(parsed.data.lastName).toBeUndefined();
      }
    });

    it('TEST 2: Create guest with firstName and lastName = null succeeds in validation', () => {
      const parsed = createGuestSchema.safeParse({ firstName: 'Kwame', lastName: null });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.firstName).toBe('Kwame');
        expect(parsed.data.lastName).toBeNull();
      }
    });

    it('Rejects guest creation when firstName is missing or empty', () => {
      const parsed = createGuestSchema.safeParse({ lastName: 'Mensah' });
      expect(parsed.success).toBe(false);
      const emptyFirst = createGuestSchema.safeParse({ firstName: '   ', lastName: 'Mensah' });
      expect(emptyFirst.success).toBe(false);
    });

    it('TEST 3: formatGuestName with Kwame + Mensah returns "Kwame Mensah"', () => {
      expect(formatGuestName({ firstName: 'Kwame', lastName: 'Mensah' })).toBe('Kwame Mensah');
    });

    it('TEST 4: formatGuestName with Kwame + null returns "Kwame"', () => {
      expect(formatGuestName({ firstName: 'Kwame', lastName: null })).toBe('Kwame');
    });

    it('TEST 5: formatGuestName with Kwame + "" returns "Kwame"', () => {
      expect(formatGuestName({ firstName: 'Kwame', lastName: '' })).toBe('Kwame');
      expect(formatGuestName({ firstName: 'Kwame ', lastName: ' ' })).toBe('Kwame');
    });

    it('formatGuestName prevents literal null, undefined, or trailing spaces', () => {
      expect(formatGuestName({ firstName: 'Kwame', lastName: undefined })).toBe('Kwame');
      expect(formatGuestName(null)).toBe('—');
      expect(formatGuestName(null, 'Guest')).toBe('Guest');
      expect(formatGuestName({ firstName: null, lastName: 'Mensah' })).toBe('Mensah');
    });
  });

  // ==========================================================
  // FIX #2: NO_SHOW TRANSITION
  // ==========================================================
  describe('Fix #2: NO_SHOW Reservation Transition', () => {
    it('1. PENDING -> NO_SHOW succeeds and updates status', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-pending',
        roomId: 'room-101',
        status: 'PENDING',
      });
      mocks.reservationUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 'res-pending', ...data }));
      mocks.reservationFindFirst.mockResolvedValue(null);
      mocks.roomFindUnique.mockResolvedValue({ id: 'room-101', status: 'RESERVED' });

      const result = await ReservationService.markNoShow('res-pending', 'user-1', 'Guest did not check in');
      expect(result.status).toBe('NO_SHOW');
      expect(result.cancelReason).toBe('Guest did not check in');
      expect(result.cancelledBy).toBe('user-1');
    });

    it('2. CONFIRMED -> NO_SHOW succeeds', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-confirmed',
        roomId: 'room-101',
        status: 'CONFIRMED',
      });
      mocks.reservationUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 'res-confirmed', ...data }));
      mocks.reservationFindFirst.mockResolvedValue(null);
      mocks.roomFindUnique.mockResolvedValue({ id: 'room-101', status: 'RESERVED' });

      const result = await ReservationService.markNoShow('res-confirmed', 'user-1');
      expect(result.status).toBe('NO_SHOW');
      expect(result.cancelReason).toBe('Guest did not arrive (No-show)');
    });

    it('3. CHECKED_IN -> rejected', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-checked-in',
        roomId: 'room-101',
        status: 'CHECKED_IN',
      });

      await expect(ReservationService.markNoShow('res-checked-in', 'user-1')).rejects.toThrow(
        /Cannot mark a reservation with status CHECKED_IN as no-show/i,
      );
    });

    it('4. CHECKED_OUT -> rejected', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-checked-out',
        roomId: 'room-101',
        status: 'CHECKED_OUT',
      });

      await expect(ReservationService.markNoShow('res-checked-out', 'user-1')).rejects.toThrow(
        /Cannot mark a reservation with status CHECKED_OUT as no-show/i,
      );
    });

    it('5. CANCELLED -> rejected', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-cancelled',
        roomId: 'room-101',
        status: 'CANCELLED',
      });

      await expect(ReservationService.markNoShow('res-cancelled', 'user-1')).rejects.toThrow(
        /Cannot mark a reservation with status CANCELLED as no-show/i,
      );
    });

    it('6. NO_SHOW -> rejected', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-noshow',
        roomId: 'room-101',
        status: 'NO_SHOW',
      });

      await expect(ReservationService.markNoShow('res-noshow', 'user-1')).rejects.toThrow(
        /Cannot mark a reservation with status NO_SHOW as no-show/i,
      );
    });

    it('7. Correct room release occurs when room is RESERVED and no other active stay needs it', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        roomId: 'room-101',
        status: 'CONFIRMED',
      });
      mocks.reservationUpdate.mockResolvedValue({ id: 'res-1', status: 'NO_SHOW' });
      mocks.reservationFindFirst.mockResolvedValue(null);
      mocks.roomFindUnique.mockResolvedValue({ id: 'room-101', status: 'RESERVED' });

      await ReservationService.markNoShow('res-1', 'user-1');
      expect(mocks.roomUpdate).toHaveBeenCalledWith({
        where: { id: 'room-101' },
        data: { status: 'AVAILABLE' },
      });
    });

    it('8. Occupied / competing room is not incorrectly released', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        roomId: 'room-101',
        status: 'CONFIRMED',
      });
      mocks.reservationUpdate.mockResolvedValue({ id: 'res-1', status: 'NO_SHOW' });
      // Room is OCCUPIED
      mocks.roomFindUnique.mockResolvedValue({ id: 'room-101', status: 'OCCUPIED' });
      mocks.reservationFindFirst.mockResolvedValue(null);

      await ReservationService.markNoShow('res-1', 'user-1');
      expect(mocks.roomUpdate).not.toHaveBeenCalled();

      // Or another reservation is active today
      vi.clearAllMocks();
      setupTx();
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        roomId: 'room-101',
        status: 'CONFIRMED',
      });
      mocks.reservationUpdate.mockResolvedValue({ id: 'res-1', status: 'NO_SHOW' });
      mocks.roomFindUnique.mockResolvedValue({ id: 'room-101', status: 'RESERVED' });
      mocks.reservationFindFirst.mockResolvedValue({ id: 'res-competing' });

      await ReservationService.markNoShow('res-1', 'user-1');
      expect(mocks.roomUpdate).not.toHaveBeenCalled();
    });

    it('9. Audit event is created with action reservation.no_show', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        roomId: 'room-101',
        status: 'CONFIRMED',
      });
      mocks.reservationUpdate.mockResolvedValue({ id: 'res-1', status: 'NO_SHOW' });
      mocks.roomFindUnique.mockResolvedValue({ id: 'room-101', status: 'AVAILABLE' });
      mocks.reservationFindFirst.mockResolvedValue(null);

      await ReservationService.markNoShow('res-1', 'user-1', 'Did not answer phone');
      expect(mocks.auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'reservation.no_show',
          resource: 'reservation',
          resourceId: 'res-1',
        }),
      );
    });

    it('11. Missing reservation returns normal not-found behavior (AppError 404)', async () => {
      mocks.reservationFindUnique.mockResolvedValue(null);
      await expect(ReservationService.markNoShow('res-nonexistent', 'user-1')).rejects.toThrow(
        /Reservation not found/i,
      );
    });
  });

  // ==========================================================
  // FIX #3: ROOM CAPACITY ENFORCEMENT
  // ==========================================================
  describe('Fix #3: Room-Type Capacity Enforcement', () => {
    const baseRoom = {
      id: 'room-1',
      isActive: true,
      status: 'AVAILABLE',
      roomType: { basePrice: 200, maxAdults: 2, maxChildren: 1 },
    };

    beforeEach(() => {
      mocks.reservationFindFirst.mockResolvedValue(null);
      mocks.roomFindUnique.mockResolvedValue(baseRoom);
      mocks.guestFindUnique.mockResolvedValue({ id: 'guest-1' });
      mocks.reservationCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'res-new', ...data }));
    });

    it('1. adults exactly at maximum -> succeeds', async () => {
      const res = await ReservationService.createReservation({
        guestId: 'guest-1',
        roomId: 'room-1',
        checkInDate: '2030-05-01',
        checkOutDate: '2030-05-03',
        adults: 2,
        children: 0,
      });
      expect(res).toBeDefined();
      expect(res.adults).toBe(2);
    });

    it('2. children exactly at maximum -> succeeds', async () => {
      const res = await ReservationService.createReservation({
        guestId: 'guest-1',
        roomId: 'room-1',
        checkInDate: '2030-05-01',
        checkOutDate: '2030-05-03',
        adults: 1,
        children: 1,
      });
      expect(res).toBeDefined();
      expect(res.children).toBe(1);
    });

    it('3. adults above maximum -> rejected with EXCEEDS_ADULT_CAPACITY', async () => {
      await expect(
        ReservationService.createReservation({
          guestId: 'guest-1',
          roomId: 'room-1',
          checkInDate: '2030-05-01',
          checkOutDate: '2030-05-03',
          adults: 3,
          children: 0,
        }),
      ).rejects.toThrow(/Room type allows a maximum of 2 adults/i);
    });

    it('4. children above maximum -> rejected with EXCEEDS_CHILD_CAPACITY', async () => {
      await expect(
        ReservationService.createReservation({
          guestId: 'guest-1',
          roomId: 'room-1',
          checkInDate: '2030-05-01',
          checkOutDate: '2030-05-03',
          adults: 1,
          children: 2,
        }),
      ).rejects.toThrow(/Room type allows a maximum of 1 child/i);
    });

    it('5. both above maximum -> rejected', async () => {
      await expect(
        ReservationService.createReservation({
          guestId: 'guest-1',
          roomId: 'room-1',
          checkInDate: '2030-05-01',
          checkOutDate: '2030-05-03',
          adults: 4,
          children: 3,
        }),
      ).rejects.toThrow(/Room type allows a maximum of 2 adults/i);
    });

    it('6. omitted adults -> existing default (1) preserved and validated', async () => {
      const res = await ReservationService.createReservation({
        guestId: 'guest-1',
        roomId: 'room-1',
        checkInDate: '2030-05-01',
        checkOutDate: '2030-05-03',
      });
      expect(res.adults).toBe(1);
      expect(res.children).toBe(0);
    });

    it('8. valid reservation update -> succeeds', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        roomId: 'room-1',
        status: 'CONFIRMED',
        checkInDate: new Date('2030-05-01'),
        checkOutDate: new Date('2030-05-03'),
        adults: 1,
        children: 0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 400,
      });
      mocks.paymentAggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mocks.reservationUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 'res-1', ...data }));

      const updated = await ReservationService.updateReservation(
        'res-1',
        { checkInDate: '2030-05-01', checkOutDate: '2030-05-03', adults: 2, children: 1 },
        'user-1',
      );
      expect(updated.adults).toBe(2);
      expect(updated.children).toBe(1);
    });

    it('9. update exceeding adult capacity -> rejected', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        roomId: 'room-1',
        status: 'CONFIRMED',
        checkInDate: new Date('2030-05-01'),
        checkOutDate: new Date('2030-05-03'),
        adults: 1,
        children: 0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 400,
      });

      await expect(
        ReservationService.updateReservation(
          'res-1',
          { checkInDate: '2030-05-01', checkOutDate: '2030-05-03', adults: 3 },
          'user-1',
        ),
      ).rejects.toThrow(/Room type allows a maximum of 2 adults/i);
    });

    it('11. room change to lower-capacity room -> final capacity validated against new room', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        roomId: 'suite-1',
        status: 'CONFIRMED',
        checkInDate: new Date('2030-05-01'),
        checkOutDate: new Date('2030-05-03'),
        adults: 3, // Valid in suite-1 (maxAdults: 4)
        children: 0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 800,
      });
      // Target room is room-1 (maxAdults: 2)
      mocks.roomFindUnique.mockResolvedValue(baseRoom);

      // Adults not specified in payload, but existing adults (3) exceed target room capacity (2)
      await expect(
        ReservationService.updateReservation(
          'res-1',
          { roomId: 'room-1', checkInDate: '2030-05-01', checkOutDate: '2030-05-03' },
          'user-1',
        ),
      ).rejects.toThrow(/Room type allows a maximum of 2 adults/i);
    });

    it('12. room change to compatible room -> succeeds', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        roomId: 'room-1',
        status: 'CONFIRMED',
        checkInDate: new Date('2030-05-01'),
        checkOutDate: new Date('2030-05-03'),
        adults: 2,
        children: 0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 400,
      });
      mocks.roomFindUnique.mockResolvedValue({
        id: 'room-2',
        isActive: true,
        status: 'AVAILABLE',
        roomType: { basePrice: 200, maxAdults: 2, maxChildren: 1 },
      });
      mocks.paymentAggregate.mockResolvedValue({ _sum: { amount: 0 } });
      mocks.reservationUpdate.mockImplementation(({ data }) => Promise.resolve({ id: 'res-1', ...data }));

      const updated = await ReservationService.updateReservation(
        'res-1',
        { roomId: 'room-2', checkInDate: '2030-05-01', checkOutDate: '2030-05-03' },
        'user-1',
      );
      expect(updated.roomId).toBe('room-2');
    });
  });

  // ==========================================================
  // FIX #4: DEPOSIT CANNOT EXCEED RESERVATION TOTAL
  // ==========================================================
  describe('Fix #4: Deposit Validation at Reservation Creation', () => {
    // 2 nights @ 250 = total 500
    const room = {
      id: 'room-1',
      isActive: true,
      status: 'AVAILABLE',
      roomType: { basePrice: 250, maxAdults: 2, maxChildren: 1 },
    };

    beforeEach(() => {
      mocks.reservationFindFirst.mockResolvedValue(null);
      mocks.roomFindUnique.mockResolvedValue(room);
      mocks.guestFindUnique.mockResolvedValue({ id: 'guest-1' });
      mocks.reservationCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'res-1', ...data }));
      // The deposit recorder re-reads the reservation inside the same transaction.
      mocks.reservationFindUnique.mockResolvedValue({ id: 'res-1', totalAmount: 500, guests: [{ guestId: 'guest-1' }] });
      mocks.paymentAggregate.mockResolvedValue({ _sum: { amount: null } });
      mocks.paymentCreate.mockResolvedValue({ id: 'payment-1' });
    });

    it('deposit = 0, total = 500 -> succeeds', async () => {
      const res = await ReservationService.createReservation({
        guestId: 'guest-1',
        roomId: 'room-1',
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-03',
        depositAmount: 0,
      });
      expect(res.depositAmount).toBe(0);
      expect(res.totalAmount).toBe(500);
    });

    it('deposit = 499, total = 500 -> succeeds', async () => {
      const res = await ReservationService.createReservation({
        guestId: 'guest-1',
        roomId: 'room-1',
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-03',
        depositAmount: 499,
        depositMethod: 'CASH',
      });
      expect(res.depositAmount).toBe(499);
      expect(res.totalAmount).toBe(500);
      expect(mocks.paymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DEPOSIT',
            reservationId: 'res-1',
            method: 'CASH',
          }),
        }),
      );
    });

    it('deposit = 500, total = 500 -> succeeds', async () => {
      const res = await ReservationService.createReservation({
        guestId: 'guest-1',
        roomId: 'room-1',
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-03',
        depositAmount: 500,
        depositMethod: 'MOBILE_MONEY',
      });
      expect(res.depositAmount).toBe(500);
      expect(res.totalAmount).toBe(500);
      expect(mocks.paymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DEPOSIT',
            reservationId: 'res-1',
            method: 'MOBILE_MONEY',
          }),
        }),
      );
    });

    it('deposit = 501, total = 500 -> rejected with DEPOSIT_EXCEEDS_TOTAL', async () => {
      try {
        await ReservationService.createReservation({
          guestId: 'guest-1',
          roomId: 'room-1',
          checkInDate: '2030-06-01',
          checkOutDate: '2030-06-03',
          depositAmount: 501,
          depositMethod: 'CASH',
        });
        expect.unreachable('Should have thrown AppError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('DEPOSIT_EXCEEDS_TOTAL');
        expect(err.statusCode).toBe(409);
      }
    });

    it('deposit > 0 without a payment method -> rejected with DEPOSIT_METHOD_REQUIRED', async () => {
      try {
        await ReservationService.createReservation({
          guestId: 'guest-1',
          roomId: 'room-1',
          checkInDate: '2030-06-01',
          checkOutDate: '2030-06-03',
          depositAmount: 100,
        });
        expect.unreachable('Should have thrown AppError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('DEPOSIT_METHOD_REQUIRED');
        expect(err.statusCode).toBe(422);
      }
    });

    it('deposit omitted -> existing behavior preserved (deposit = 0)', async () => {
      const res = await ReservationService.createReservation({
        guestId: 'guest-1',
        roomId: 'room-1',
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-03',
      });
      expect(res.depositAmount).toBe(0);
      expect(res.totalAmount).toBe(500);
    });
  });

  // ==========================================================
  // FIX #5: DEPOSIT MUST BE RESOLVED BEFORE CANCELLING / NO-SHOW
  // ==========================================================
  describe('Fix #5: Deposits blocked from being orphaned on cancel / no-show', () => {
    beforeEach(() => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        status: 'CONFIRMED',
        roomId: 'room-1',
        checkInDate: new Date('2030-06-01'),
        checkOutDate: new Date('2030-06-03'),
      });
      mocks.reservationUpdate.mockResolvedValue({ id: 'res-1', status: 'CANCELLED' });
      mocks.roomFindUnique.mockResolvedValue({ id: 'room-1', status: 'AVAILABLE' });
      mocks.paymentFindFirst.mockResolvedValue(null);
    });

    it('cancelling a reservation without a recorded deposit succeeds', async () => {
      const res = await ReservationService.cancelReservation('res-1', 'user-1', 'Guest changed plans');
      expect(res.status).toBe('CANCELLED');
    });

    it('cancelling a reservation that holds a deposit is blocked with DEPOSIT_REFUND_REQUIRED', async () => {
      mocks.paymentFindFirst.mockResolvedValue({ id: 'payment-1', amount: 499 });
      try {
        await ReservationService.cancelReservation('res-1', 'user-1', 'Guest changed plans');
        expect.unreachable('Should have thrown AppError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('DEPOSIT_REFUND_REQUIRED');
        expect(err.statusCode).toBe(409);
      }
    });

    it('marking a no-show for a reservation that holds a deposit is blocked', async () => {
      mocks.paymentFindFirst.mockResolvedValue({ id: 'payment-1', amount: 500 });
      try {
        await ReservationService.markNoShow('res-1', 'user-1');
        expect.unreachable('Should have thrown AppError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('DEPOSIT_REFUND_REQUIRED');
        expect(err.statusCode).toBe(409);
      }
    });
  });

  // ==========================================================
  // FIX #6: NOTIFICATION DISPATCH MUST NEVER FAIL CORE OPERATIONS
  // Notification delivery is best-effort. A notification DB failure
  // must not fail, roll back, or falsely 500 a committed reservation.
  // ==========================================================
  describe('Fix #6: Notification failures cannot break reservations', () => {
    const room = {
      id: 'room-1',
      isActive: true,
      status: 'AVAILABLE',
      roomType: { basePrice: 250, maxAdults: 2, maxChildren: 1 },
    };

    beforeEach(() => {
      mocks.reservationFindFirst.mockResolvedValue(null);
      mocks.roomFindUnique.mockResolvedValue(room);
      mocks.guestFindUnique.mockResolvedValue({ id: 'guest-1' });
      mocks.reservationCreate.mockImplementation(({ data }) => Promise.resolve({ id: 'res-1', ...data }));
      mocks.reservationFindUnique.mockResolvedValue({ id: 'res-1', totalAmount: 500, guests: [{ guestId: 'guest-1' }] });
      mocks.reservationUpdate.mockResolvedValue({ id: 'res-1', status: 'CANCELLED' });
      mocks.paymentAggregate.mockResolvedValue({ _sum: { amount: null } });
      mocks.paymentCreate.mockResolvedValue({ id: 'payment-1' });
      mocks.paymentFindFirst.mockResolvedValue(null);
    });

    it('creates the reservation even when the notification recipient lookup fails', async () => {
      mocks.userFindMany.mockRejectedValue(new Error('notification database is down'));

      const res = await ReservationService.createReservation({
        guestId: 'guest-1',
        roomId: 'room-1',
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-03',
      });

      expect(res.id).toBe('res-1');
      expect(res.totalAmount).toBe(500);
      expect(mocks.roomUpdate).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { status: 'RESERVED' } });
    });

    it('creates the reservation even when the notification insert fails', async () => {
      mocks.userFindMany.mockResolvedValue([{ id: 'user-manager' }]);
      mocks.notificationCreateMany.mockRejectedValue(new Error('notification insert failed'));

      const res = await ReservationService.createReservation({
        guestId: 'guest-1',
        roomId: 'room-1',
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-03',
      });

      expect(res.id).toBe('res-1');
      expect(res.totalAmount).toBe(500);
    });

    it('cancels the reservation even when the notification dispatch fails', async () => {
      mocks.reservationFindUnique.mockResolvedValue({
        id: 'res-1',
        status: 'CONFIRMED',
        roomId: 'room-1',
        checkInDate: new Date('2030-06-01'),
        checkOutDate: new Date('2030-06-03'),
      });
      mocks.roomFindUnique.mockResolvedValue({ id: 'room-1', status: 'RESERVED' });
      mocks.userFindMany.mockRejectedValue(new Error('notification database is down'));

      const res = await ReservationService.cancelReservation('res-1', 'user-1', 'Guest changed plans');

      expect(res.status).toBe('CANCELLED');
      expect(mocks.roomUpdate).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { status: 'AVAILABLE' } });
    });
  });
});
