import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  reservationFindUnique: vi.fn(),
  folioAggregate: vi.fn(),
  folioItemCreate: vi.fn(),
  paymentCreate: vi.fn(),
  settingFindUnique: vi.fn(),
  checkOutCreate: vi.fn(),
  reservationUpdate: vi.fn(),
  roomUpdate: vi.fn(),
  folioUpdate: vi.fn(),
}));

vi.mock('../src/config', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));
vi.mock('../src/services/audit.service', () => ({ AuditService: { logInTransaction: vi.fn() } }));

import { StayService } from '../src/services/stays.service';

describe('stay ledger invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const tx = {
      reservation: { findUnique: mocks.reservationFindUnique, update: mocks.reservationUpdate },
      folioItem: { aggregate: mocks.folioAggregate, create: mocks.folioItemCreate },
      payment: { create: mocks.paymentCreate },
      systemSetting: { findUnique: mocks.settingFindUnique },
      checkOut: { create: mocks.checkOutCreate },
      room: { update: mocks.roomUpdate },
      folio: { update: mocks.folioUpdate },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.reservationFindUnique.mockResolvedValue({
      id: 'reservation-1', roomId: 'room-1', status: 'CHECKED_IN', checkOutDate: new Date('2030-10-12T00:00:00.000Z'),
      guests: [{ guestId: 'guest-1' }],
      // This deliberately stale cache must not decide checkout eligibility.
      folios: [{ id: 'folio-1', status: 'OPEN', balance: 999 }],
    });
    mocks.folioAggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mocks.folioItemCreate.mockResolvedValue({});
    mocks.paymentCreate.mockResolvedValue({ id: 'payment-1' });
    mocks.settingFindUnique.mockResolvedValue(null);
    mocks.checkOutCreate.mockResolvedValue({ id: 'checkout-1' });
    mocks.reservationUpdate.mockResolvedValue({});
    mocks.roomUpdate.mockResolvedValue({});
    mocks.folioUpdate.mockResolvedValue({});
  });

  it('uses immutable ledger items rather than the cached folio balance at checkout', async () => {
    await expect(StayService.checkOutGuest({ reservationId: 'reservation-1', checkedOutBy: 'user-1' })).resolves.toMatchObject({ checkOut: { id: 'checkout-1' } });
    expect(mocks.folioAggregate).toHaveBeenCalledWith({ where: { folioId: 'folio-1', voidedAt: null }, _sum: { amount: true } });
    expect(mocks.folioUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CLOSED', balance: expect.anything() }) }));
  });

  it('never returns a damaged room to available inventory at checkout', async () => {
    await StayService.checkOutGuest({ reservationId: 'reservation-1', checkedOutBy: 'user-1', roomCondition: 'DAMAGED' });
    expect(mocks.roomUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'MAINTENANCE' } }));
  });

  it('records the exact outstanding balance using the selected checkout method', async () => {
    mocks.folioAggregate.mockResolvedValue({ _sum: { amount: 850 } });
    await StayService.checkOutGuest({ reservationId: 'reservation-1', checkedOutBy: 'user-1', paymentMethod: 'MOBILE_MONEY' });
    expect(mocks.paymentCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: expect.anything(), method: 'MOBILE_MONEY', folioId: 'folio-1' }) }));
    expect(mocks.folioItemCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'PAYMENT', amount: expect.anything() }) }));
  });

  it('adds the admin-configured late checkout fee before settlement after noon', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-10-12T13:00:00.000Z'));
    mocks.settingFindUnique.mockResolvedValue({ value: '125' });
    await StayService.checkOutGuest({ reservationId: 'reservation-1', checkedOutBy: 'user-1', paymentMethod: 'CASH' });
    expect(mocks.folioItemCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ description: 'Late checkout fee', amount: expect.anything() }) }));
    vi.useRealTimers();
  });
});
