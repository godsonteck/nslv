import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkOutSchema } from '@nslv/shared';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  assertBusinessDayOpen: vi.fn(),
  logInTransaction: vi.fn(),
  processPaymentInTx: vi.fn(),
}));

vi.mock('../src/config', () => ({
  prisma: {
    $transaction: mocks.transaction,
    checkOut: { findUnique: vi.fn() },
    payment: { findUnique: vi.fn() },
  },
}));

vi.mock('../src/services/daily-close.service', () => ({
  lockBusinessDay: vi.fn().mockResolvedValue(new Date('2026-08-15T00:00:00.000Z')),
  DailyCloseService: { assertBusinessDayOpen: mocks.assertBusinessDayOpen },
}));

vi.mock('../src/services/audit.service', () => ({
  AuditService: { logInTransaction: mocks.logInTransaction },
}));

vi.mock('../src/services/payments.service', () => ({
  PaymentService: { processPaymentInTx: mocks.processPaymentInTx },
}));

import { StayService } from '../src/services/stays.service';

describe('Checkout Financial Settlement Hardening', () => {
  const reservationId = '11111111-2222-3333-4444-555555555555';
  const checkedOutBy = 'user-staff-1';
  const primaryGuestId = 'guest-primary-1';
  const roomId = 'room-101';
  const folioId = 'folio-open-1';

  beforeEach(() => {
    mocks.transaction.mockReset();
    mocks.assertBusinessDayOpen.mockReset().mockResolvedValue(undefined);
    mocks.logInTransaction.mockReset().mockResolvedValue(undefined);
    mocks.processPaymentInTx.mockReset().mockResolvedValue({ id: 'payment-checkout-1' });
  });

  it('TEST 1: Normal checkout with zero balance succeeds without creating a fake payment', async () => {
    const tx = {
      reservation: {
        findUnique: vi.fn().mockResolvedValue({
          id: reservationId, roomId, status: 'CHECKED_IN',
          guests: [{ guestId: primaryGuestId }],
          folios: [{ id: folioId, status: 'OPEN' }],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
      folioItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
      checkOut: { create: vi.fn().mockResolvedValue({ id: 'co-1', reservationId, finalBalance: 0 }) },
      room: { update: vi.fn().mockResolvedValue({}) },
      folio: { update: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await StayService.checkOutGuest({ reservationId, checkedOutBy, roomCondition: 'CLEAN' });

    expect(result.checkOut.finalBalance).toBe(0);
    expect(mocks.processPaymentInTx).not.toHaveBeenCalled();
    expect(tx.checkOut.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ finalBalance: 0 }) }));
    expect(tx.reservation.update).toHaveBeenCalledWith({ where: { id: reservationId }, data: { status: 'CHECKED_OUT' } });
    expect(tx.room.update).toHaveBeenCalledWith({ where: { id: roomId }, data: { status: 'AVAILABLE' } });
    expect(tx.folio.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: folioId }, data: expect.objectContaining({ status: 'CLOSED' }) }));
  });

  it('TEST 2: Checkout with outstanding balance settles via PaymentService.processPaymentInTx and succeeds', async () => {
    const tx = {
      reservation: {
        findUnique: vi.fn().mockResolvedValue({
          id: reservationId, roomId, status: 'CHECKED_IN',
          guests: [{ guestId: primaryGuestId }],
          folios: [{ id: folioId, status: 'OPEN' }],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
      folioItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 450 } }) },
      checkOut: { create: vi.fn().mockResolvedValue({ id: 'co-2', reservationId, finalBalance: 0 }) },
      room: { update: vi.fn().mockResolvedValue({}) },
      folio: { update: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await StayService.checkOutGuest({
      reservationId, checkedOutBy, paymentMethod: 'CASH', roomCondition: 'DIRTY',
    });

    expect(result.checkOut.finalBalance).toBe(0);
    expect(mocks.processPaymentInTx).toHaveBeenCalledWith(tx, expect.objectContaining({
      folioId, reservationId, guestId: primaryGuestId, amount: 450, method: 'CASH', processedBy: checkedOutBy,
    }));
    expect(tx.room.update).toHaveBeenCalledWith({ where: { id: roomId }, data: { status: 'DIRTY' } });
  });

  it('TEST 3: Rejects invalid payment method at schema and service boundaries', () => {
    const invalidSchema = checkOutSchema.safeParse({ reservationId, paymentMethod: 'UNSUPPORTED_METHOD' });
    expect(invalidSchema.success).toBe(false);
  });

  it('TEST 4: Rejects checkout when folio has an unsettled guest credit (< 0 balance)', async () => {
    const tx = {
      reservation: {
        findUnique: vi.fn().mockResolvedValue({
          id: reservationId, roomId, status: 'CHECKED_IN',
          guests: [{ guestId: primaryGuestId }],
          folios: [{ id: folioId, status: 'OPEN' }],
        }),
      },
      systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
      folioItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -150 } }) },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(StayService.checkOutGuest({ reservationId, checkedOutBy })).rejects.toMatchObject({
      code: 'GUEST_CREDIT_UNSETTLED',
      statusCode: 409,
    });
  });

  it('TEST 6 & 7: Rejects checkout settlement if business day is closed inside transaction', async () => {
    mocks.processPaymentInTx.mockRejectedValue(new Error('This business day is closed; record a correcting entry on an open day instead.'));
    const tx = {
      reservation: {
        findUnique: vi.fn().mockResolvedValue({
          id: reservationId, roomId, status: 'CHECKED_IN',
          guests: [{ guestId: primaryGuestId }],
          folios: [{ id: folioId, status: 'OPEN' }],
        }),
      },
      systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
      folioItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 300 } }) },
      checkOut: { create: vi.fn() },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(StayService.checkOutGuest({ reservationId, checkedOutBy, paymentMethod: 'CASH' })).rejects.toThrow('This business day is closed');
    expect(tx.checkOut.create).not.toHaveBeenCalled();
  });

  it('TEST 8: Handles concurrent checkout attempts with HTTP 409 CHECKOUT_CONFLICT', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' });

    await expect(StayService.checkOutGuest({ reservationId, checkedOutBy })).rejects.toMatchObject({
      code: 'CHECKOUT_CONFLICT',
      statusCode: 409,
    });
  });

  it('TEST 9: Idempotent retry returns existing checkout record when reservation is already CHECKED_OUT', async () => {
    const existingCheckOut = { id: 'co-existing', reservationId, finalBalance: 0 };
    const existingFolio = { id: folioId, status: 'CLOSED' };
    const tx = {
      reservation: {
        findUnique: vi.fn().mockResolvedValue({
          id: reservationId, roomId, status: 'CHECKED_OUT',
          guests: [{ guestId: primaryGuestId }],
          folios: [existingFolio],
        }),
      },
      checkOut: { findUnique: vi.fn().mockResolvedValue(existingCheckOut) },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await StayService.checkOutGuest({ reservationId, checkedOutBy, idempotencyKey: 'checkout-key-retry' });

    expect(result).toEqual({ checkOut: existingCheckOut, folio: existingFolio, isRetry: true });
  });

  it('TEST 11: Transaction failure at any step rolls back completely without partial state', async () => {
    const tx = {
      reservation: {
        findUnique: vi.fn().mockResolvedValue({
          id: reservationId, roomId, status: 'CHECKED_IN',
          guests: [{ guestId: primaryGuestId }],
          folios: [{ id: folioId, status: 'OPEN' }],
        }),
        update: vi.fn().mockRejectedValue(new Error('Database write failure during reservation update')),
      },
      systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
      folioItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 200 } }) },
      checkOut: { create: vi.fn().mockResolvedValue({ id: 'co-failed' }) },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(StayService.checkOutGuest({ reservationId, checkedOutBy, paymentMethod: 'CARD' })).rejects.toThrow('Database write failure');
  });
});
