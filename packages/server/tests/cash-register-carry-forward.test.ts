import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  registerFindUnique: vi.fn(), registerFindFirst: vi.fn(), registerDelete: vi.fn(), entryFindMany: vi.fn(), entryCount: vi.fn(), paymentFindMany: vi.fn(), transaction: vi.fn(),
}));
vi.mock('../src/config', () => ({ prisma: {
  cashRegister: { findUnique: mocks.registerFindUnique, findFirst: mocks.registerFindFirst, delete: mocks.registerDelete },
  cashRegisterEntry: { findMany: mocks.entryFindMany, count: mocks.entryCount }, payment: { findMany: mocks.paymentFindMany }, $transaction: mocks.transaction,
} }));
vi.mock('../src/services/audit.service', () => ({ AuditService: { logInTransaction: vi.fn() } }));
vi.mock('../src/services/categories.service', () => ({ CategoryService: { assertConfiguredValue: vi.fn() } }));
import { CashRegisterService } from '../src/services/cash-register.service';

describe('cash-register carry-forward', () => {
  it('counts deposits in and subtracts refunds from expected cash', async () => {
    const day = new Date('2026-08-23T00:00:00.000Z');
    mocks.registerFindUnique.mockResolvedValue({
      id: 'register-1',
      businessDate: day,
      openingCash: 100,
      notes: 'Night handover',
      entries: [
        { type: 'INFLOW', amount: 25, category: null, cashRegister: { businessDate: day } },
        { type: 'OUTFLOW', amount: 10, category: 'FUEL', cashRegister: { businessDate: day } },
        { type: 'OUTFLOW', amount: 50, category: 'REFUND', cashRegister: { businessDate: day } },
      ],
    });
    mocks.entryFindMany.mockResolvedValue([]);
    mocks.paymentFindMany.mockResolvedValue([
      { id: 'sale', amount: 80, type: 'PAYMENT', processedAt: day },
      { id: 'deposit', amount: 40, type: 'DEPOSIT', processedAt: day },
      { id: 'refund', amount: 30, type: 'REFUND', processedAt: day },
    ]);

    const result = await CashRegisterService.getSummary('2026-08-23');

    // 100 opening + 120 cash in (80 sale + 40 deposit) + 25 manual
    // - 10 expense - 30 refund = 205.
    expect(result).toMatchObject({
      openingCash: 100,
      cashSales: 120,
      manualInflows: 25,
      manualOutflows: 10,
      cashRefunds: 30,
      expectedCash: 205,
    });
    expect(result.cashPayments).toHaveLength(3);
    // Refund register entries are excluded from the outflow total so a refund is
    // never subtracted twice (the Payment ledger already carries it).
    expect(mocks.paymentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: { in: ['PAYMENT', 'DEPOSIT', 'REFUND'] } }),
      }),
    );
  });

  it('resets the opening and every manual cash movement for the selected date', async () => {
    const tx = { cashRegister: { findUnique: vi.fn().mockResolvedValue({ id: 'register-1' }), delete: mocks.registerDelete }, cashRegisterEntry: { count: mocks.entryCount }, $executeRaw: vi.fn() };
    mocks.transaction.mockImplementationOnce((callback) => callback(tx));
    mocks.entryCount.mockResolvedValueOnce(4);
    mocks.registerDelete.mockResolvedValueOnce({ id: 'register-1' });

    await expect(CashRegisterService.clearAllEntriesForDate('2026-08-23', 'user-1')).resolves.toMatchObject({ deleted: 4 });
    expect(mocks.registerDelete).toHaveBeenCalledWith({ where: { id: 'register-1' } });
  });
});
