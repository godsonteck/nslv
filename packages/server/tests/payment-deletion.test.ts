import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  folioItemFindFirst: vi.fn(),
  transaction: vi.fn(),
  paymentDelete: vi.fn(),
  txPaymentFindUnique: vi.fn(),
  txFolioItemFindFirst: vi.fn(),
  dailyCloseFindUnique: vi.fn(),
}));

const txMock = {
  payment: {
    findUnique: mocks.txPaymentFindUnique,
    delete: mocks.paymentDelete,
  },
  folioItem: { findFirst: mocks.txFolioItemFindFirst },
};

vi.mock('../src/config', () => ({
  prisma: {
    payment: { findUnique: mocks.paymentFindUnique },
    folioItem: { findFirst: mocks.folioItemFindFirst },
    dailyClose: { findUnique: mocks.dailyCloseFindUnique },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../src/services/audit.service', () => ({
  AuditService: { logInTransaction: vi.fn().mockResolvedValue(undefined) },
}));

import { PaymentService } from '../src/services/payments.service';

const basePayment = {
  id: 'pay-1',
  folioId: null,
  processedAt: new Date('2026-08-18T10:00:00.000Z'),
  refunds: [],
  amount: 250,
  method: 'CASH',
  type: 'DEPOSIT',
  status: 'COMPLETED',
  reservationId: 'res-1',
  guestId: 'guest-1',
  reference: null,
  idempotencyKey: 'key-1',
  description: 'Reservation deposit collected',
};

const cleanRefundPair = {
  ...basePayment,
  id: 'refund-1',
  type: 'REFUND',
  description: 'Refund of duplicate deposit',
  originalPayment: { ...basePayment, refunds: [{ id: 'refund-1' }] },
};

describe('PaymentService.deletePayment — single payment', () => {
  beforeEach(() => {
    mocks.paymentFindUnique.mockReset();
    mocks.folioItemFindFirst.mockReset();
    mocks.transaction.mockReset();
    mocks.paymentDelete.mockReset();
    mocks.txPaymentFindUnique.mockReset();
    mocks.txFolioItemFindFirst.mockReset();
    mocks.dailyCloseFindUnique.mockReset();
    mocks.transaction.mockImplementation(async (cb: any) => cb(txMock));
  });

  it('deletes a clean, unposted payment and returns a summary', async () => {
    mocks.paymentFindUnique.mockResolvedValue(basePayment);
    mocks.folioItemFindFirst.mockResolvedValue(null);
    mocks.txPaymentFindUnique.mockResolvedValue(basePayment);
    mocks.paymentDelete.mockResolvedValue({ id: 'pay-1' });

    const result = await PaymentService.deletePayment('pay-1', 'admin-1');

    expect(result).toEqual({ id: 'pay-1', amount: 250, method: 'CASH', type: 'DEPOSIT' });
    expect(mocks.paymentDelete).toHaveBeenCalledWith({ where: { id: 'pay-1' } });
  });

  it('refuses when a refund references the payment', async () => {
    mocks.paymentFindUnique.mockResolvedValue({ ...basePayment, refunds: [{ id: 'refund-1' }] });

    await expect(PaymentService.deletePayment('pay-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'PAYMENT_HAS_REFUNDS', statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses when the payment is already posted to a guest folio', async () => {
    mocks.paymentFindUnique.mockResolvedValue({ ...basePayment, folioId: 'folio-1' });

    await expect(PaymentService.deletePayment('pay-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'PAYMENT_POSTED_TO_FOLIO', statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses when a folio item references the payment', async () => {
    mocks.paymentFindUnique.mockResolvedValue(basePayment);
    mocks.folioItemFindFirst.mockResolvedValue({ folioId: 'folio-1' });

    await expect(PaymentService.deletePayment('pay-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'PAYMENT_POSTED_TO_FOLIO', statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses when the payment settles a POS order', async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      ...basePayment,
      source: 'RESTAURANT_ORDER',
      sourceId: 'order-9',
    });

    await expect(PaymentService.deletePayment('pay-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'PAYMENT_SOURCE_LINKED', statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses when the payment belongs to a closed business day', async () => {
    mocks.paymentFindUnique.mockResolvedValue(basePayment);
    mocks.folioItemFindFirst.mockResolvedValue(null);
    mocks.dailyCloseFindUnique.mockResolvedValue({ id: 'closed-1' });

    await expect(PaymentService.deletePayment('pay-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'BUSINESS_DAY_CLOSED', statusCode: 409 });
    expect(mocks.paymentDelete).not.toHaveBeenCalled();
  });

  it('rejects with 404 when the payment does not exist', async () => {
    mocks.paymentFindUnique.mockResolvedValue(null);

    await expect(PaymentService.deletePayment('missing', 'admin-1'))
      .rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND', statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe('PaymentService.deletePayment — paired refund delete', () => {
  beforeEach(() => {
    mocks.paymentFindUnique.mockReset();
    mocks.folioItemFindFirst.mockReset();
    mocks.transaction.mockReset();
    mocks.paymentDelete.mockReset();
    mocks.txPaymentFindUnique.mockReset();
    mocks.txFolioItemFindFirst.mockReset();
    mocks.dailyCloseFindUnique.mockReset();
    mocks.transaction.mockImplementation(async (cb: any) => cb(txMock));
  });

  it('deletes a refund together with the clean payment it reversed', async () => {
    mocks.paymentFindUnique.mockResolvedValue(cleanRefundPair);
    mocks.folioItemFindFirst.mockResolvedValue(null);
    mocks.txPaymentFindUnique.mockResolvedValue(cleanRefundPair);
    mocks.txFolioItemFindFirst.mockResolvedValue(null);
    mocks.paymentDelete.mockResolvedValue({ id: 'x' });

    const result = await PaymentService.deletePayment('refund-1', 'admin-1');

    expect(result).toMatchObject({ id: 'refund-1', type: 'REFUND', deletedOriginalPaymentId: 'pay-1' });
    expect(mocks.paymentDelete.mock.calls.map((c: any[]) => c[0].where.id)).toEqual(['refund-1', 'pay-1']);
  });

  it('refuses a refund whose original payment is posted to a folio', async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      ...cleanRefundPair,
      originalPayment: { ...basePayment, folioId: 'folio-1', refunds: [{ id: 'refund-1' }] },
    });

    await expect(PaymentService.deletePayment('refund-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'REFUND_ORIGINAL_POSTED', statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses a refund whose original payment has other refunds', async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      ...cleanRefundPair,
      originalPayment: { ...basePayment, refunds: [{ id: 'refund-1' }, { id: 'refund-2' }] },
    });

    await expect(PaymentService.deletePayment('refund-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'REFUND_ORIGINAL_MULTI_REFUND', statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses a refund whose original payment settles a POS order', async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      ...cleanRefundPair,
      originalPayment: {
        ...basePayment,
        source: 'RESTAURANT_ORDER',
        sourceId: 'order-9',
        refunds: [{ id: 'refund-1' }],
      },
    });

    await expect(PaymentService.deletePayment('refund-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'REFUND_ORIGINAL_POS_LINKED', statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses a refund whose original payment is itself a refund', async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      ...cleanRefundPair,
      originalPayment: { ...basePayment, type: 'REFUND', refunds: [{ id: 'refund-1' }] },
    });

    await expect(PaymentService.deletePayment('refund-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'REFUND_ORIGINAL_IS_REFUND', statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses a refund whose original payment cannot be resolved', async () => {
    mocks.paymentFindUnique.mockResolvedValue({ ...cleanRefundPair, originalPayment: null });

    await expect(PaymentService.deletePayment('refund-1', 'admin-1'))
      .rejects.toMatchObject({ code: 'REFUND_ORIGINAL_MISSING', statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
