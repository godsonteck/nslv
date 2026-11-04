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
    update: vi.fn(),
  },
  folioItem: {
    findFirst: mocks.txFolioItemFindFirst,
    deleteMany: vi.fn(),
    aggregate: vi.fn(),
  },
  folio: { update: vi.fn() },
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

describe('PaymentService.deletePayment — refund removal', () => {
  // The query inside the transaction filters the refund being deleted out of
  // `originalPayment.refunds`, so a surviving original has no remaining refunds.
  const refundWith = (original: Record<string, unknown> = {}, otherRefunds: unknown[] = []) => ({
    ...cleanRefundPair,
    originalPayment: { ...basePayment, refunds: otherRefunds, ...original },
  });

  beforeEach(() => {
    mocks.paymentFindUnique.mockReset();
    mocks.folioItemFindFirst.mockReset();
    mocks.transaction.mockReset();
    mocks.paymentDelete.mockReset();
    mocks.txPaymentFindUnique.mockReset();
    mocks.txFolioItemFindFirst.mockReset();
    mocks.dailyCloseFindUnique.mockReset();
    (txMock.payment.update as any).mockReset();
    (txMock.folioItem.deleteMany as any).mockReset();
    (txMock.folioItem.aggregate as any).mockReset().mockResolvedValue({ _sum: { amount: 0 } });
    (txMock.folio.update as any).mockReset();
    mocks.transaction.mockImplementation(async (cb: any) => cb(txMock));
    mocks.folioItemFindFirst.mockResolvedValue(null);
    mocks.paymentDelete.mockResolvedValue({ id: 'refund-1' });
  });

  it('deletes only the refund and restores the original payment', async () => {
    mocks.paymentFindUnique.mockResolvedValue(refundWith());
    mocks.txPaymentFindUnique.mockResolvedValue(refundWith());

    const result = await PaymentService.deletePayment('refund-1', 'admin-1');

    expect(result).toMatchObject({ id: 'refund-1', type: 'REFUND', restoredOriginalPaymentId: 'pay-1' });
    expect(mocks.paymentDelete.mock.calls.map((c: any[]) => c[0].where.id)).toEqual(['refund-1']);
    expect(txMock.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { status: 'COMPLETED' } });
  });

  it('never deletes the original payment, even when it was posted to a folio', async () => {
    mocks.paymentFindUnique.mockResolvedValue(refundWith({ folioId: 'folio-1' }));
    mocks.txPaymentFindUnique.mockResolvedValue(refundWith({ folioId: 'folio-1' }));

    await PaymentService.deletePayment('refund-1', 'admin-1');

    expect(mocks.paymentDelete).toHaveBeenCalledTimes(1);
    expect(mocks.paymentDelete).toHaveBeenCalledWith({ where: { id: 'refund-1' } });
    expect(txMock.folioItem.deleteMany).toHaveBeenCalled();
    expect(txMock.folio.update).toHaveBeenCalled();
    expect(txMock.payment.update).toHaveBeenCalled();
  });

  it('restores PARTIALLY_REFUNDED when other refunds remain', async () => {
    const other = [{ id: 'refund-2', amount: 50 }];
    mocks.paymentFindUnique.mockResolvedValue(refundWith({}, other));
    mocks.txPaymentFindUnique.mockResolvedValue(refundWith({}, other));

    await PaymentService.deletePayment('refund-1', 'admin-1');

    expect(txMock.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { status: 'PARTIALLY_REFUNDED' } });
  });

  it('restores REFUNDED when the remaining refunds cover the original', async () => {
    const other = [{ id: 'refund-2', amount: 250 }];
    mocks.paymentFindUnique.mockResolvedValue(refundWith({}, other));
    mocks.txPaymentFindUnique.mockResolvedValue(refundWith({}, other));

    await PaymentService.deletePayment('refund-1', 'admin-1');

    expect(txMock.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { status: 'REFUNDED' } });
  });

  it('handles a refund whose original cannot be resolved without deleting anything else', async () => {
    mocks.paymentFindUnique.mockResolvedValue({ ...cleanRefundPair, originalPayment: null });
    mocks.txPaymentFindUnique.mockResolvedValue({ ...cleanRefundPair, originalPayment: null });

    const result = await PaymentService.deletePayment('refund-1', 'admin-1');

    expect(result).toMatchObject({ id: 'refund-1', restoredOriginalPaymentId: null });
    expect(mocks.paymentDelete).toHaveBeenCalledTimes(1);
    expect(txMock.payment.update).not.toHaveBeenCalled();
  });
});
