import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refundPaymentSchema } from '@nslv/shared';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), transaction: vi.fn() }));
const originalPaymentId = '553061d5-97c9-4e71-977c-1d776e82ea04';
const idempotencyKey = '9dd18b1a-47f7-42dc-931c-1eb1a644628b';

vi.mock('../src/config', () => ({
  prisma: { payment: { findUnique: mocks.findUnique }, dailyClose: { findUnique: vi.fn().mockResolvedValue(null) }, $transaction: mocks.transaction },
}));
vi.mock('../src/services/audit.service', () => ({ AuditService: { logInTransaction: vi.fn() } }));

import { PaymentService } from '../src/services/payments.service';

describe('refund validation and retry safety', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.transaction.mockReset();
  });

  it('requires a positive amount, reason, and idempotency key', () => {
    const valid = { amount: 100, reason: 'Guest cancellation', idempotencyKey };
    expect(refundPaymentSchema.safeParse(valid).success).toBe(true);
    expect(refundPaymentSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    expect(refundPaymentSchema.safeParse({ ...valid, reason: '' }).success).toBe(false);
    expect(refundPaymentSchema.safeParse({ amount: 100, reason: 'Guest cancellation' }).success).toBe(false);
  });

  it('returns the original linked refund on an idempotent retry', async () => {
    const existingRefund = { id: 'refund-1', type: 'REFUND', originalPaymentId, idempotencyKey };
    mocks.findUnique.mockResolvedValue(existingRefund);

    const result = await PaymentService.refundPayment(originalPaymentId, {
      amount: 100,
      reason: 'Guest cancellation',
      idempotencyKey,
      processedBy: 'd4b7968b-8988-4207-af89-07311791ef77',
    });

    expect(result).toBe(existingRefund);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key that belongs to another transaction', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'payment-2', type: 'PAYMENT', originalPaymentId: null, idempotencyKey });

    await expect(PaymentService.refundPayment(originalPaymentId, {
      amount: 100,
      reason: 'Guest cancellation',
      idempotencyKey,
      processedBy: 'd4b7968b-8988-4207-af89-07311791ef77',
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED', statusCode: 409 });
  });

  it('returns the one durable refund after a concurrent idempotency-key race', async () => {
    const refund = { id: 'refund-1', type: 'REFUND', originalPaymentId, idempotencyKey };
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(refund);
    mocks.transaction.mockRejectedValue({ code: 'P2002' });
    await expect(PaymentService.refundPayment(originalPaymentId, {
      amount: 100, reason: 'Guest cancellation', idempotencyKey,
      processedBy: 'd4b7968b-8988-4207-af89-07311791ef77',
    })).resolves.toBe(refund);
  });

  it('mathematically prevents an over-refund: prior refunds plus the new refund cannot exceed the original payment', async () => {
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue({ id: originalPaymentId, type: 'PAYMENT', status: 'COMPLETED', voidedAt: null, amount: 100, folioId: null }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 70 } }),
      },
    };
    mocks.findUnique.mockResolvedValue(null);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await expect(PaymentService.refundPayment(originalPaymentId, {
      amount: 31, reason: 'Guest cancellation', idempotencyKey,
      processedBy: 'd4b7968b-8988-4207-af89-07311791ef77',
    })).rejects.toMatchObject({ code: 'REFUND_EXCEEDS_PAYMENT', statusCode: 422 });
  });

  it('rejects refund on a closed folio if allowClosedFolioReopen is not set', async () => {
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue({ id: originalPaymentId, type: 'PAYMENT', status: 'COMPLETED', voidedAt: null, amount: 100, folioId: 'folio-closed' }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      folio: {
        findUnique: vi.fn().mockResolvedValue({ id: 'folio-closed', status: 'CLOSED' }),
      },
    };
    mocks.findUnique.mockResolvedValue(null);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await expect(PaymentService.refundPayment(originalPaymentId, {
      amount: 50, reason: 'Authorized post-checkout refund', idempotencyKey,
      processedBy: 'd4b7968b-8988-4207-af89-07311791ef77',
    })).rejects.toMatchObject({ code: 'CLOSED_FOLIO_REFUND', statusCode: 409 });
  });

  it('successfully processes a refund on a closed folio when allowClosedFolioReopen is true', async () => {
    const folioUpdate = vi.fn().mockResolvedValue({});
    const paymentCreate = vi.fn().mockResolvedValue({ id: 'refund-100', method: 'CASH', reference: null });
    const folioItemCreate = vi.fn().mockResolvedValue({});
    const paymentUpdate = vi.fn().mockResolvedValue({});
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue({ id: originalPaymentId, type: 'PAYMENT', status: 'COMPLETED', voidedAt: null, amount: 100, folioId: 'folio-closed', currency: 'GHS', method: 'CASH' }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: paymentCreate,
        update: paymentUpdate,
      },
      folio: {
        findUnique: vi.fn().mockResolvedValue({ id: 'folio-closed', status: 'CLOSED' }),
        update: folioUpdate,
      },
      folioItem: {
        create: folioItemCreate,
      },
    };
    mocks.findUnique.mockResolvedValue(null);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await PaymentService.refundPayment(originalPaymentId, {
      amount: 50,
      reason: 'Authorized post-checkout correction',
      idempotencyKey,
      processedBy: 'admin-user-1',
      allowClosedFolioReopen: true,
    });

    expect(result).toEqual({ id: 'refund-100', method: 'CASH', reference: null });
    expect(folioUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'folio-closed' }, data: { status: 'OPEN' } }));
    expect(folioUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'folio-closed' }, data: expect.objectContaining({ status: 'CLOSED' }) }));
  });
});
