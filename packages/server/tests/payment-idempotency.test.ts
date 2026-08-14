import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), transaction: vi.fn() }));
const existingPayment = { id: 'payment-1', type: 'PAYMENT', idempotencyKey: '9dd18b1a-47f7-42dc-931c-1eb1a644628b' };

vi.mock('../src/config', () => ({
  prisma: {
    payment: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../src/services/audit.service', () => ({
  AuditService: { logInTransaction: vi.fn() },
}));

import { PaymentService } from '../src/services/payments.service';

describe('PaymentService idempotency', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.transaction.mockReset();
  });

  it('returns the original payment without opening a second transaction for a retried idempotency key', async () => {
    mocks.findUnique.mockResolvedValue(existingPayment);

    const result = await PaymentService.processPayment({
      folioId: '553061d5-97c9-4e71-977c-1d776e82ea04',
      amount: 200,
      method: 'CASH',
      idempotencyKey: existingPayment.idempotencyKey,
      processedBy: 'd4b7968b-8988-4207-af89-07311791ef77',
    });

    expect(result).toBe(existingPayment);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('returns the single durable payment when simultaneous requests race on the unique idempotency key', async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existingPayment);
    mocks.transaction.mockRejectedValue({ code: 'P2002' });

    await expect(PaymentService.processPayment({
      folioId: '553061d5-97c9-4e71-977c-1d776e82ea04', amount: 200, method: 'CASH',
      idempotencyKey: existingPayment.idempotencyKey, processedBy: 'd4b7968b-8988-4207-af89-07311791ef77',
    })).resolves.toBe(existingPayment);
  });

  it('rejects reuse of a key that belongs to a refund rather than a payment', async () => {
    mocks.findUnique.mockResolvedValue({ ...existingPayment, type: 'REFUND' });
    await expect(PaymentService.processPayment({
      folioId: '553061d5-97c9-4e71-977c-1d776e82ea04', amount: 200, method: 'CASH',
      idempotencyKey: existingPayment.idempotencyKey, processedBy: 'd4b7968b-8988-4207-af89-07311791ef77',
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED', statusCode: 409 });
  });
});
