import { describe, expect, it } from 'vitest';
import { createOrderSchema, createPoolTransactionSchema, processPaymentSchema } from '@nslv/shared';

const idempotencyKey = '9dd18b1a-47f7-42dc-931c-1eb1a644628b';
const itemId = '74d7cf44-224e-47ca-82f0-0fa9342ddb5c';

describe('financial request validation', () => {
  it('requires an idempotency key for F&B orders and pool transactions', () => {
    const baseOrder = { items: [{ itemId, quantity: 1 }], paymentMethod: 'CASH' };
    expect(createOrderSchema.safeParse(baseOrder).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...baseOrder, idempotencyKey }).success).toBe(true);

    const basePool = { serviceId: itemId, quantity: 1, paymentMethod: 'CARD' };
    expect(createPoolTransactionSchema.safeParse(basePool).success).toBe(false);
    expect(createPoolTransactionSchema.safeParse({ ...basePool, idempotencyKey }).success).toBe(true);
  });

  it('accepts only supported direct settlement methods', () => {
    const payment = { folioId: itemId, amount: 125.5, method: 'CASH', idempotencyKey };
    expect(processPaymentSchema.safeParse(payment).success).toBe(true);
    expect(processPaymentSchema.safeParse({ folioId: itemId, amount: 125.5, method: 'CASH' }).success).toBe(false);
    expect(processPaymentSchema.safeParse({ ...payment, method: 'ROOM_CHARGE' }).success).toBe(false);
    expect(processPaymentSchema.safeParse({ ...payment, method: 'CRYPTO' }).success).toBe(false);
  });
});
