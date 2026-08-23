import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  registerFindUnique: vi.fn(), registerFindFirst: vi.fn(), entryFindMany: vi.fn(), paymentFindMany: vi.fn(),
}));
vi.mock('../src/config', () => ({ prisma: {
  cashRegister: { findUnique: mocks.registerFindUnique, findFirst: mocks.registerFindFirst },
  cashRegisterEntry: { findMany: mocks.entryFindMany }, payment: { findMany: mocks.paymentFindMany },
} }));
vi.mock('../src/services/audit.service', () => ({ AuditService: { logInTransaction: vi.fn() } }));
vi.mock('../src/services/categories.service', () => ({ CategoryService: { assertConfiguredValue: vi.fn() } }));
import { CashRegisterService } from '../src/services/cash-register.service';

describe('cash-register carry-forward', () => {
  it('carries the last counted balance and includes cash sales, refunds, and manual movements', async () => {
    const day = new Date('2026-08-23T00:00:00.000Z');
    mocks.registerFindUnique.mockResolvedValue(null);
    mocks.registerFindFirst.mockResolvedValue({ businessDate: new Date('2026-08-22T00:00:00.000Z'), openingCash: { toNumber: () => 100 }, notes: 'Night handover' });
    mocks.entryFindMany.mockResolvedValue([
      { type: 'INFLOW', amount: { toNumber: () => 25 }, cashRegister: { businessDate: day } },
      { type: 'OUTFLOW', amount: { toNumber: () => 10 }, category: 'FUEL', cashRegister: { businessDate: day } },
    ]);
    mocks.paymentFindMany.mockResolvedValue([
      { id: 'sale', amount: { toNumber: () => 80 }, type: 'PAYMENT', processedAt: day },
      { id: 'refund', amount: { toNumber: () => 5 }, type: 'REFUND', processedAt: day },
    ]);

    const result = await CashRegisterService.getSummary('2026-08-23');
    expect(result).toMatchObject({ carriedForward: 100, cashSales: 80, cashRefunds: 5, inflows: 25, outflows: 10, netCash: 190 });
  });
});
