import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const queryRaw = vi.fn();
  const executeRaw = vi.fn();
  const transaction = vi.fn(async (fn: (tx: { $executeRawUnsafe: typeof executeRaw }) => Promise<void>) =>
    fn({ $executeRawUnsafe: executeRaw }),
  );
  return { queryRaw, executeRaw, transaction };
});

vi.mock('./database', () => ({
  prisma: {
    $queryRawUnsafe: mocks.queryRaw,
    $transaction: mocks.transaction,
  },
}));

import { ensureEventSpacePricingSchema, resetEventSpaceSchemaCacheForTests } from './schema-repair';

const shape = (overrides: Partial<Record<'hasTable' | 'hasPricingColumn' | 'hasLegacyPricingColumn', boolean>> = {}) => [
  {
    hasTable: true,
    hasPricingColumn: false,
    hasLegacyPricingColumn: true,
    ...overrides,
  },
];

const sqlCalls = () => mocks.executeRaw.mock.calls.map(([sql]) => String(sql));

describe('ensureEventSpacePricingSchema', () => {
  beforeEach(() => {
    resetEventSpaceSchemaCacheForTests();
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('does nothing when price_per_day already exists', async () => {
    mocks.queryRaw.mockResolvedValue(shape({ hasPricingColumn: true }));

    await expect(ensureEventSpacePricingSchema()).resolves.toBe(true);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('adds the column and preserves the legacy per-hour value', async () => {
    mocks.queryRaw.mockResolvedValue(shape());

    await expect(ensureEventSpacePricingSchema()).resolves.toBe(true);

    const calls = sqlCalls();
    expect(calls.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS "price_per_day"'))).toBe(true);
    expect(calls.some((sql) => sql.includes('SET "price_per_day" = "price_per_hour"'))).toBe(true);
    expect(calls.some((sql) => sql.toUpperCase().includes('DROP'))).toBe(false);
  });

  it('does not copy from a legacy column that is not there', async () => {
    mocks.queryRaw.mockResolvedValue(shape({ hasLegacyPricingColumn: false }));

    await ensureEventSpacePricingSchema();

    expect(sqlCalls().some((sql) => sql.includes('price_per_hour'))).toBe(false);
  });

  it('leaves a missing table to Prisma instead of inventing one', async () => {
    mocks.queryRaw.mockResolvedValue(shape({ hasTable: false }));

    await expect(ensureEventSpacePricingSchema()).resolves.toBe(true);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('caches a successful probe', async () => {
    mocks.queryRaw.mockResolvedValue(shape({ hasPricingColumn: true }));

    await ensureEventSpacePricingSchema();
    await ensureEventSpacePricingSchema();

    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns false without throwing when DDL is not permitted', async () => {
    mocks.queryRaw.mockResolvedValue(shape());
    mocks.transaction.mockRejectedValueOnce(new Error('permission denied'));

    await expect(ensureEventSpacePricingSchema()).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledTimes(1);

    // The failure is backed off, not retried on every request.
    await expect(ensureEventSpacePricingSchema()).resolves.toBe(false);
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });
});
