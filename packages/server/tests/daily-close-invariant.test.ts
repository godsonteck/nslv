import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  dailyCloseFindUnique: vi.fn(),
  dailyCloseCreate: vi.fn(),
  getSummary: vi.fn(),
}));

vi.mock('../src/config', () => ({
  prisma: {
    dailyClose: { findUnique: mocks.dailyCloseFindUnique, create: mocks.dailyCloseCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../src/services/audit.service', () => ({ AuditService: { logInTransaction: vi.fn() } }));
vi.mock('../src/services/cash-register.service', () => ({
  CashRegisterService: { getSummary: mocks.getSummary },
}));

import { DailyCloseService } from '../src/services/daily-close.service';

describe('daily cash reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSummary.mockResolvedValue({
      businessDate: '2026-08-14',
      carriedIntoToday: 100,
      cashSales: 120,
      cashRefunds: 20,
      manualOutflows: 30,
      expectedCash: 170,
    });
    mocks.dailyCloseFindUnique.mockResolvedValue(null);
  });

  it('uses opening + cash receipts - refunds - approved cash expenses', async () => {
    const result = await DailyCloseService.preview('2026-08-14');
    expect(result.expectedCash.toString()).toBe('170');
  });

  it('requires an explanation when actual cash differs from expected cash', async () => {
    await expect(DailyCloseService.close({ businessDate: '2026-08-14', actualCash: 169 }, 'user-1')).rejects.toMatchObject({ code: 'VARIANCE_NOTE_REQUIRED' });
  });
});
