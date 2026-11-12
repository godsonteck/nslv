import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  logInTransaction: vi.fn(),
  notifyStaff: vi.fn(),
  assertBusinessDayOpen: vi.fn(),
  lockBusinessDay: vi.fn(),
  recordCashRefund: vi.fn(),
}));

vi.mock('../src/config', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock('../src/services/daily-close.service', () => ({
  lockBusinessDay: mocks.lockBusinessDay,
  DailyCloseService: { assertBusinessDayOpen: mocks.assertBusinessDayOpen },
}));

vi.mock('../src/services/audit.service', () => ({
  AuditService: { logInTransaction: mocks.logInTransaction },
}));

vi.mock('../src/services/cash-register.service', () => ({
  CashRegisterService: { recordCashRefund: mocks.recordCashRefund },
}));

vi.mock('../src/services/notification.service', () => ({
  NotificationService: { notifyStaff: mocks.notifyStaff },
}));

vi.mock('../src/services/payments.service', () => ({
  PaymentService: { processPaymentInTx: vi.fn() },
}));

import { StayService } from '../src/services/stays.service';

const reservationId = 'reservation-1';
const roomId = 'room-b7';
const folioId = 'folio-b7';
const checkOutId = 'checkout-1';
const undoneBy = 'user-manager-1';

const checkoutPayment = {
  id: 'payment-checkout',
  folioId,
  amount: 600,
  method: 'CASH',
  type: 'PAYMENT',
  status: 'COMPLETED',
  processedAt: new Date('2026-11-12T11:48:57.000Z'),
  idempotencyKey: `checkout-payment-${reservationId}`,
  voidedAt: null,
};

const groupDeposit = {
  id: 'payment-group-deposit',
  folioId: 'folio-lead',
  amount: 1200,
  method: 'CASH',
  type: 'DEPOSIT',
  status: 'COMPLETED',
  processedAt: new Date('2026-11-12T11:48:38.000Z'),
  idempotencyKey: 'group-deposit-BK-1',
  voidedAt: null,
};

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    id: reservationId,
    confirmationNo: 'NSVL-TEST-1',
    roomId,
    status: 'CHECKED_OUT',
    room: { number: 'B7', status: 'AVAILABLE' },
    guests: [{ guestId: 'guest-1', guest: { firstName: 'EMMANUEL', lastName: 'TETTEH' } }],
    checkOuts: [
      {
        id: checkOutId,
        reservationId,
        roomId,
        actualCheckOut: new Date('2026-11-12T11:48:57.000Z'),
        finalBalance: 0,
      },
    ],
    folios: [
      {
        id: folioId,
        status: 'CLOSED',
        balance: 0,
        items: [
          { id: 'item-charge', amount: 600, referenceType: null, voidedAt: null },
          { id: 'item-payment', amount: -600, referenceType: 'PAYMENT', referenceId: checkoutPayment.id, voidedAt: null },
        ],
        payments: [checkoutPayment, groupDeposit],
      },
    ],
    ...overrides,
  };
}

function makeTx(current = reservation()) {
  const tx = {
    reservation: {
      findUnique: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockResolvedValue({}),
    },
    payment: {
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
    },
    folioItem: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 600 } }),
    },
    folio: { update: vi.fn().mockResolvedValue({}) },
    checkOut: { delete: vi.fn().mockResolvedValue({}) },
    room: { update: vi.fn().mockResolvedValue({}) },
    cashRegister: { findUnique: vi.fn().mockResolvedValue({ id: 'register-today' }) },
    cashRegisterEntry: { findFirst: vi.fn().mockResolvedValue({ id: 'cash-inflow-1' }) },
  };
  mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
  return tx;
}

describe('Undo check-out', () => {
  beforeEach(() => {
    mocks.transaction.mockReset();
    mocks.logInTransaction.mockReset().mockResolvedValue(undefined);
    mocks.notifyStaff.mockReset().mockResolvedValue(undefined);
    mocks.assertBusinessDayOpen.mockReset().mockResolvedValue(undefined);
    mocks.lockBusinessDay.mockReset().mockResolvedValue(new Date('2026-11-12T00:00:00.000Z'));
    mocks.recordCashRefund.mockReset().mockResolvedValue({ id: 'cash-outflow-1' });
  });

  it('reopens the stay, voids the checkout settlement, and leaves other payments alone', async () => {
    const tx = makeTx();

    const result = await StayService.undoCheckOut({ reservationId, undoneBy, reason: 'Wrong checkout' });

    expect(result).toMatchObject({ reservationId, reopened: true, voidedPaymentIds: [checkoutPayment.id] });

    // Settlement payment voided, group deposit untouched.
    expect(tx.payment.update).toHaveBeenCalledTimes(1);
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: checkoutPayment.id },
        data: expect.objectContaining({ voidedBy: undoneBy, voidedAt: expect.any(Date) }),
      }),
    );

    // Its ledger item is voided too.
    expect(tx.folioItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ referenceId: checkoutPayment.id, referenceType: 'PAYMENT', voidedAt: null }),
      }),
    );

    // Folio reopened at the recomputed ledger balance.
    expect(tx.folio.update).toHaveBeenCalledWith({
      where: { id: folioId },
      data: { status: 'OPEN', closedAt: null, balance: expect.anything() },
    });

    expect(tx.checkOut.delete).toHaveBeenCalledWith({ where: { id: checkOutId } });
    expect(tx.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: reservationId }, data: { status: 'CHECKED_IN' } }),
    );
    expect(tx.room.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: roomId }, data: { status: 'OCCUPIED' } }),
    );
    expect(mocks.logInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'stay.checkout_undone', resourceId: reservationId }),
    );
  });

  it('reverses a cash settlement in the cash register', async () => {
    makeTx();

    await StayService.undoCheckOut({ reservationId, undoneBy });

    expect(mocks.recordCashRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 600, businessDate: '2026-11-12', processedBy: undoneBy }),
      expect.anything(),
    );
  });

  it('rejects a stay that is not checked out', async () => {
    makeTx(reservation({ status: 'CHECKED_IN' }));

    await expect(StayService.undoCheckOut({ reservationId, undoneBy })).rejects.toMatchObject({
      code: 'STAY_NOT_CHECKED_OUT',
      statusCode: 409,
    });
  });

  it('rejects the reversal when a refund is linked to the checkout settlement', async () => {
    const tx = makeTx();
    tx.payment.count.mockResolvedValue(1);

    await expect(StayService.undoCheckOut({ reservationId, undoneBy })).rejects.toMatchObject({
      code: 'CHECKOUT_HAS_REFUNDS',
      statusCode: 409,
    });
    expect(tx.checkOut.delete).not.toHaveBeenCalled();
  });

  it('rejects the reversal when the business day is closed', async () => {
    mocks.assertBusinessDayOpen.mockRejectedValue(
      Object.assign(new Error('This business day is closed'), { statusCode: 409, code: 'BUSINESS_DAY_CLOSED' }),
    );
    const tx = makeTx();

    await expect(StayService.undoCheckOut({ reservationId, undoneBy })).rejects.toMatchObject({
      code: 'BUSINESS_DAY_CLOSED',
    });
    expect(tx.checkOut.delete).not.toHaveBeenCalled();
  });
});
