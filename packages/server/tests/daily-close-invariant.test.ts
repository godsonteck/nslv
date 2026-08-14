import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ aggregate: vi.fn(), transaction: vi.fn(), findUnique: vi.fn(), create: vi.fn() }));
vi.mock('../src/config', () => ({ prisma: {
  payment: { aggregate: mocks.aggregate }, expense: { aggregate: mocks.aggregate },
  $transaction: mocks.transaction,
} }));
vi.mock('../src/services/audit.service', () => ({ AuditService: { logInTransaction: vi.fn() } }));
import { DailyCloseService } from '../src/services/daily-close.service';

describe('daily cash reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.aggregate.mockResolvedValueOnce({ _sum: { amount: 120 } }).mockResolvedValueOnce({ _sum: { amount: 20 } }).mockResolvedValueOnce({ _sum: { amount: 30 } });
  });

  it('uses opening + cash receipts - refunds - approved cash expenses', async () => {
    const result = await DailyCloseService.preview('2026-08-14', 100);
    expect(result.expectedCash.toString()).toBe('170');
  });

  it('requires an explanation when actual cash differs from expected cash', async () => {
    await expect(DailyCloseService.close({ businessDate: '2026-08-14', openingCash: 100, actualCash: 169 }, 'user-1')).rejects.toMatchObject({ code: 'VARIANCE_NOTE_REQUIRED' });
  });
});
