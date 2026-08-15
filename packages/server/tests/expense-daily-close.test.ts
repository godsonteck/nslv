import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  assertBusinessDayOpen: vi.fn(),
  assertConfiguredValue: vi.fn(),
  logInTransaction: vi.fn(),
}));

vi.mock('../src/config', () => ({
  prisma: { $transaction: mocks.transaction, expense: { findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock('../src/services/categories.service', () => ({
  CategoryService: { assertConfiguredValue: mocks.assertConfiguredValue },
}));
vi.mock('../src/services/daily-close.service', () => ({
  lockBusinessDay: vi.fn().mockResolvedValue(new Date('2026-08-15T00:00:00.000Z')),
  DailyCloseService: { assertBusinessDayOpen: mocks.assertBusinessDayOpen },
}));
vi.mock('../src/services/audit.service', () => ({
  AuditService: { logInTransaction: mocks.logInTransaction },
}));

import { ExpenseService } from '../src/services/expense.service';

describe('ExpenseService transactional business day safety', () => {
  beforeEach(() => {
    mocks.transaction.mockReset();
    mocks.assertBusinessDayOpen.mockReset();
    mocks.assertConfiguredValue.mockReset().mockResolvedValue(true);
    mocks.logInTransaction.mockReset().mockResolvedValue(undefined);
  });

  it('runs createExpense within a transaction that locks and asserts open business day', async () => {
    const expenseData = { id: 'exp-1', category: 'SUPPLIES', description: 'Cleaning chemicals', amount: 150 };
    const tx = {
      expense: {
        create: vi.fn().mockResolvedValue(expenseData),
      },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await ExpenseService.createExpense(
      { category: 'SUPPLIES', description: 'Cleaning chemicals', amount: 150, incurredOn: '2026-08-15' },
      'user-admin',
    );

    expect(result).toEqual(expenseData);
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.assertBusinessDayOpen).toHaveBeenCalled();
    expect(tx.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'SUPPLIES',
          description: 'Cleaning chemicals',
          amount: 150,
        }),
      }),
    );
  });

  it('aborts expense creation if business day is closed inside the transaction', async () => {
    mocks.assertBusinessDayOpen.mockRejectedValue(new Error('This business day is closed.'));
    const tx = { expense: { create: vi.fn() } };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(
      ExpenseService.createExpense(
        { category: 'SUPPLIES', description: 'Cleaning chemicals', amount: 150, incurredOn: '2026-08-15' },
        'user-admin',
      ),
    ).rejects.toThrow('This business day is closed.');

    expect(tx.expense.create).not.toHaveBeenCalled();
  });
});
