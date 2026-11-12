import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  logInTransaction: vi.fn(),
  processPaymentInTx: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('../src/config', () => ({
  prisma: {
    $transaction: mocks.transaction,
    checkOut: { findUnique: vi.fn() },
    payment: { findUnique: vi.fn() },
    user: { findMany: mocks.userFindMany },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
}));

vi.mock('../src/services/daily-close.service', () => ({
  lockBusinessDay: vi.fn().mockResolvedValue(new Date('2026-08-15T00:00:00.000Z')),
  DailyCloseService: { assertBusinessDayOpen: vi.fn() },
}));

vi.mock('../src/services/audit.service', () => ({
  AuditService: { logInTransaction: mocks.logInTransaction },
}));

vi.mock('../src/services/payments.service', () => ({
  PaymentService: { processPaymentInTx: mocks.processPaymentInTx },
}));

import { StayService } from '../src/services/stays.service';

const bookingId = 'BK-GROUP-1';
const leadId = 'reservation-lead';
const siblingId = 'reservation-sibling';
const leadFolioId = 'folio-lead';
const siblingFolioId = 'folio-sibling';
const leadGuestId = 'guest-lead';
const siblingGuestId = 'guest-sibling';
const leadRoomId = 'room-a1';
const checkedOutBy = 'user-staff-1';

const groupProcessedAt = new Date('2026-08-14T10:00:00.000Z');

function groupPaymentRow() {
  return {
    id: 'payment-group-deposit',
    amount: 3400,
    currency: 'GHS',
    method: 'CASH',
    reference: `Group: ${bookingId}`,
    source: 'GROUP_BOOKING',
    sourceId: bookingId,
    type: 'DEPOSIT',
    status: 'COMPLETED',
    processedAt: groupProcessedAt,
    voidedAt: null,
    description: 'Group partial payment for group booking',
  };
}

function leadReservation() {
  return {
    id: leadId,
    roomId: leadRoomId,
    bookingId,
    status: 'CHECKED_IN',
    room: { number: 'A1' },
    guests: [{ guestId: leadGuestId, guest: { firstName: 'Gloria', lastName: 'Manu' } }],
    folios: [
      {
        id: leadFolioId,
        status: 'OPEN',
        items: [{ amount: 1700 }, { amount: -3400 }],
        payments: [groupPaymentRow()],
      },
    ],
  };
}

function siblingReservation() {
  return {
    id: siblingId,
    room: { number: 'A2' },
    guests: [{ guestId: siblingGuestId }],
    folios: [{ id: siblingFolioId, items: [{ amount: 1700 }], payments: [] }],
  };
}

function makeTx(options: {
  current: Record<string, unknown>;
  siblings: Record<string, unknown>[];
  currentLedger: number;
  sourceItemAmount?: number;
}) {
  const tx = {
    reservation: {
      findUnique: vi.fn().mockResolvedValue(options.current),
      findMany: vi.fn().mockResolvedValue(options.siblings),
      update: vi.fn().mockResolvedValue({}),
    },
    systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    folioItem: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: options.currentLedger } }),
      findMany: vi.fn().mockResolvedValue([
        { id: 'folio-item-source-payment', amount: options.sourceItemAmount ?? -3400 },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'folio-item-new' }),
    },
    payment: {
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({ id: 'payment-split' }),
    },
    folio: { update: vi.fn().mockResolvedValue({}) },
    checkOut: {
      create: vi.fn().mockResolvedValue({ id: 'checkout-1', reservationId: (options.current as { id: string }).id, finalBalance: 0 }),
    },
    room: { update: vi.fn().mockResolvedValue({}) },
  };
  mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
  return tx;
}

function findFolioItemCreate(tx: ReturnType<typeof makeTx>, folioId: string) {
  return tx.folioItem.create.mock.calls.find(([arg]) => arg.data.folioId === folioId)?.[0];
}

describe('Group booking checkout credit reallocation', () => {
  beforeEach(() => {
    mocks.transaction.mockReset();
    mocks.logInTransaction.mockReset().mockResolvedValue(undefined);
    mocks.processPaymentInTx.mockReset().mockResolvedValue({ id: 'checkout-payment' });
    mocks.userFindMany.mockReset().mockResolvedValue([]);
  });

  it('distributes the lead folio credit to a sibling folio that owes money', async () => {
    const tx = makeTx({ current: leadReservation(), siblings: [siblingReservation()], currentLedger: -1700 });

    const result = await StayService.checkOutGuest({ reservationId: leadId, checkedOutBy, roomCondition: 'CLEAN' });

    expect(result.checkOut.finalBalance).toBe(0);
    expect(mocks.processPaymentInTx).not.toHaveBeenCalled();

    // The original group payment is split rather than duplicated.
    expect(Number(tx.payment.update.mock.calls[0][0].data.amount)).toBe(1700);
    const split = tx.payment.create.mock.calls[0][0].data;
    expect(split).toMatchObject({ reservationId: siblingId, folioId: siblingFolioId, type: 'DEPOSIT', method: 'CASH' });
    expect(Number(split.amount)).toBe(1700);
    expect(split.processedAt).toEqual(groupProcessedAt);

    // Both ledgers move by the same amount in opposite directions.
    const siblingItem = findFolioItemCreate(tx, siblingFolioId);
    expect(Number(siblingItem?.data.amount)).toBe(-1700);
    expect(tx.folio.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: siblingFolioId }, data: { balance: { decrement: expect.anything() } } }),
    );
    expect(tx.checkOut.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ finalBalance: 0 }) }),
    );
  });

  it('pulls credit from the lead folio when a sibling with debt checks out first', async () => {
    const current = {
      id: siblingId,
      roomId: 'room-a2',
      bookingId,
      status: 'CHECKED_IN',
      room: { number: 'A2' },
      guests: [{ guestId: siblingGuestId, guest: { firstName: 'Gloria', lastName: 'Manu' } }],
      folios: [{ id: siblingFolioId, status: 'OPEN', items: [{ amount: 1700 }], payments: [] }],
    };
    const lead = {
      id: leadId,
      room: { number: 'A1' },
      guests: [{ guestId: leadGuestId }],
      folios: [
        {
          id: leadFolioId,
          items: [{ amount: 1700 }, { amount: -3400 }],
          payments: [groupPaymentRow()],
        },
      ],
    };
    const tx = makeTx({ current, siblings: [lead], currentLedger: 1700 });

    const result = await StayService.checkOutGuest({ reservationId: siblingId, checkedOutBy, roomCondition: 'CLEAN' });

    expect(result.checkOut.finalBalance).toBe(0);
    expect(mocks.processPaymentInTx).not.toHaveBeenCalled();
    expect(Number(tx.payment.update.mock.calls[0][0].data.amount)).toBe(1700);

    const split = tx.payment.create.mock.calls[0][0].data;
    expect(split).toMatchObject({ reservationId: siblingId, folioId: siblingFolioId });
    expect(Number(split.amount)).toBe(1700);

    const currentItem = findFolioItemCreate(tx, siblingFolioId);
    expect(Number(currentItem?.data.amount)).toBe(-1700);
    expect(tx.folio.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: siblingFolioId }, data: { balance: { decrement: expect.anything() } } }),
    );
  });

  it('still blocks a genuine overpayment after all group debts are settled', async () => {
    const sibling = siblingReservation();
    sibling.folios[0].items = [{ amount: 500 }];
    const tx = makeTx({ current: leadReservation(), siblings: [sibling], currentLedger: -2000 });

    await expect(
      StayService.checkOutGuest({ reservationId: leadId, checkedOutBy, roomCondition: 'CLEAN' }),
    ).rejects.toMatchObject({ code: 'GUEST_CREDIT_UNSETTLED', statusCode: 409 });

    // Only the real sibling debt (500) was moved; the rest remains a credit.
    expect(Number(tx.payment.update.mock.calls[0][0].data.amount)).toBe(2900);
    expect(Number(findFolioItemCreate(tx, siblingFolioId)?.data.amount)).toBe(-500);
    expect(tx.checkOut.create).not.toHaveBeenCalled();
  });

  it('does not move credit that did not come from a group payment', async () => {
    const lead = {
      id: leadId,
      room: { number: 'A1' },
      guests: [{ guestId: leadGuestId }],
      folios: [
        {
          id: leadFolioId,
          items: [{ amount: 1700 }, { amount: -3400 }],
          // Individual overpayment, not a group deposit.
          payments: [{ ...groupPaymentRow(), source: 'FOLIO', sourceId: null }],
        },
      ],
    };
    const current = {
      id: siblingId,
      roomId: 'room-a2',
      bookingId,
      status: 'CHECKED_IN',
      room: { number: 'A2' },
      guests: [{ guestId: siblingGuestId, guest: { firstName: 'Gloria', lastName: 'Manu' } }],
      folios: [{ id: siblingFolioId, status: 'OPEN', items: [{ amount: 1700 }], payments: [] }],
    };
    const tx = makeTx({ current, siblings: [lead], currentLedger: 1700 });

    await expect(
      StayService.checkOutGuest({ reservationId: siblingId, checkedOutBy, roomCondition: 'CLEAN' }),
    ).rejects.toMatchObject({ code: 'OUTSTANDING_BALANCE_REQUIRED', statusCode: 422 });

    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
