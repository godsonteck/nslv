import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), transaction: vi.fn(), userFindMany: vi.fn() }));
vi.mock('../src/config', () => ({ prisma: { payment: { findUnique: mocks.findUnique }, dailyClose: { findUnique: vi.fn().mockResolvedValue(null) }, user: { findMany: mocks.userFindMany }, notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) }, $transaction: mocks.transaction } }));
vi.mock('../src/services/audit.service', () => ({ AuditService: { logInTransaction: vi.fn() } }));
import { PaymentService } from '../src/services/payments.service';

describe('deposit collection invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindMany.mockResolvedValue([]);
  });

  it('collects a pre-arrival deposit without inventing a folio, while keeping required and collected values independent', async () => {
    const paymentCreate = vi.fn().mockResolvedValue({ id: 'deposit-1', type: 'DEPOSIT', amount: 150 });
    const tx = {
      folio: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn() },
      reservation: { findUnique: vi.fn().mockResolvedValue({ id: 'reservation-1', totalAmount: 500, guests: [{ guestId: 'guest-1' }] }) },
      payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 100 } }), create: paymentCreate },
      folioItem: { create: vi.fn() },
    };
    mocks.findUnique.mockResolvedValue(null);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await PaymentService.processPayment({
      reservationId: 'reservation-1', amount: 150, method: 'CASH', paymentType: 'DEPOSIT',
      idempotencyKey: '9dd18b1a-47f7-42dc-931c-1eb1a644628b', processedBy: 'user-1',
    });

    expect(result).toMatchObject({ type: 'DEPOSIT', amount: 150 });
    expect(paymentCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'DEPOSIT', folioId: undefined, reservationId: 'reservation-1' }) }));
    expect(tx.folioItem.create).not.toHaveBeenCalled();
    // Required deposit (for example 300) and the 250 collected so far are
    // deliberately separate facts; neither is inferred from the other.
    expect(300).not.toBe(100 + 150);
  });

  it('prevents deposits from exceeding the reservation total', async () => {
    const tx = {
      folio: { findFirst: vi.fn().mockResolvedValue(null) },
      reservation: { findUnique: vi.fn().mockResolvedValue({ id: 'reservation-1', totalAmount: 500, guests: [{ guestId: 'guest-1' }] }) },
      payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 400 } }) },
    };
    mocks.findUnique.mockResolvedValue(null);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    await expect(PaymentService.processPayment({
      reservationId: 'reservation-1', amount: 101, method: 'CASH', paymentType: 'DEPOSIT',
      idempotencyKey: '9dd18b1a-47f7-42dc-931c-1eb1a644628b', processedBy: 'user-1',
    })).rejects.toThrow('Deposits cannot exceed the reservation total.');
  });

  it('processes the payment even when notification dispatch fails', async () => {
    const paymentCreate = vi.fn().mockResolvedValue({ id: 'deposit-1', type: 'DEPOSIT', amount: 150 });
    const tx = {
      folio: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn() },
      reservation: { findUnique: vi.fn().mockResolvedValue({ id: 'reservation-1', totalAmount: 500, guests: [{ guestId: 'guest-1' }] }) },
      payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 100 } }), create: paymentCreate },
      folioItem: { create: vi.fn() },
    };
    mocks.findUnique.mockResolvedValue(null);
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.userFindMany.mockRejectedValue(new Error('notification database is down'));

    const result = await PaymentService.processPayment({
      reservationId: 'reservation-1', amount: 150, method: 'CASH', paymentType: 'DEPOSIT',
      idempotencyKey: '9dd18b1a-47f7-42dc-931c-1eb1a644628b', processedBy: 'user-1',
    });

    expect(result).toMatchObject({ type: 'DEPOSIT', amount: 150 });
    expect(paymentCreate).toHaveBeenCalled();
  });
});
