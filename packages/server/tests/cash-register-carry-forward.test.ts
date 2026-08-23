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
  it('carries the last counted balance and includes cash sales and manual movements, not refunds', async () => {
    const day = new Date('2026-08-23T00:00:00.000Z');
    mocks.registerFindUnique.mockResolvedValue(null);
    mocks.registerFindFirst.mockResolvedValue({ businessDate: new Date('2026-08-22T00:00:00.000Z'), openingCash: { toNumber: () => 100 }, notes: 'Night handover' });
    mocks.entryFindMany.mockResolvedValue([
      { type: 'INFLOW', amount: { toNumber: () => 25 }, cashRegister: { businessDate: day } },
      { type: 'OUTFLOW', amount: { toNumber: () => 10 }, category: 'FUEL', cashRegister: { businessDate: day } },
    ]);
    mocks.paymentFindMany.mockResolvedValue([
      { id: 'sale', amount: { toNumber: () => 80 }, type: 'PAYMENT', processedAt: day },
    ]);

    const result = await CashRegisterService.getSummary('2026-08-23');
    expect(result).toMatchObject({ carriedIntoToday: 100, cashSales: 80, manualInflows: 25, manualOutflows: 10, expectedCash: 195 });
    expect(result.cashPayments).toHaveLength(1);
    expect(mocks.paymentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ type: 'PAYMENT' }) }));
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
