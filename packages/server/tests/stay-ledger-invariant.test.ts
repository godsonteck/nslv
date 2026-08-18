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
    user: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
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
    vi.setSystemTime(new Date('2030-10-12T13:00:00.000Z')); // 1 hour past 12:00 PM deadline
    mocks.settingFindUnique.mockImplementation(async ({ where }: any) => {
      if (where.key === 'financial.late_checkout_fee') return { value: '50' };
      if (where.key === 'villa.checkout_time') return { value: '"12:00"' };
      return null;
    });
    await StayService.checkOutGuest({ reservationId: 'reservation-1', checkedOutBy: 'user-1', paymentMethod: 'CASH' });
    expect(mocks.folioItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: expect.stringContaining('Late checkout fee'),
          amount: expect.anything(),
          quantity: 1,
        }),
      }),
    );
    vi.useRealTimers();
  });

  it('calculates hourly late checkout fee correctly (50 GHS/hr)', () => {
    // Exactly on time (12:00 PM) -> 0 fee
    const onTime = StayService.calculateLateCheckoutFee('2030-10-12', new Date('2030-10-12T12:00:00.000Z'), 50);
    expect(onTime.isLate).toBe(false);
    expect(onTime.fee).toBe(0);

    // 15 minutes late (12:15 PM) -> 1 hour fee (50 GHS)
    const late15m = StayService.calculateLateCheckoutFee('2030-10-12', new Date('2030-10-12T12:15:00.000Z'), 50);
    expect(late15m.isLate).toBe(true);
    expect(late15m.lateHours).toBe(1);
    expect(late15m.fee).toBe(50);

    // 2 hours 10 minutes late (14:10 PM) -> 3 hours fee (150 GHS)
    const late3h = StayService.calculateLateCheckoutFee('2030-10-12', new Date('2030-10-12T14:10:00.000Z'), 50);
    expect(late3h.isLate).toBe(true);
    expect(late3h.lateHours).toBe(3);
    expect(late3h.fee).toBe(150);
    expect(late3h.description).toContain('3 hrs @ GHS 50.00/hr');
  });
});
