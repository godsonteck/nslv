// NSVilla — Payment service
// Payments are persistent, transactional and never trusted from client totals alone.

import { prisma } from '../config';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/error';

export interface ProcessPaymentDTO {
  folioId?: string;
  reservationId?: string;
  guestId?: string;
  amount: number;
  currency?: string;
  method: string;
  reference?: string;
  idempotencyKey: string;
  description?: string;
  processedBy: string;
}

export interface RefundPaymentDTO {
  amount: number;
  method?: string;
  reference?: string;
  reason: string;
  idempotencyKey: string;
  processedBy: string;
}

export class PaymentService {
  static async getPayments(filters?: { folioId?: string; reservationId?: string; guestId?: string }) {
    const where: any = {};
    if (filters?.folioId) where.folioId = filters.folioId;
    if (filters?.reservationId) where.reservationId = filters.reservationId;
    if (filters?.guestId) where.guestId = filters.guestId;
    return prisma.payment.findMany({ where, include: { guest: true, reservation: true, folio: true }, orderBy: { processedAt: 'desc' } });
  }

  static async processPayment(data: ProcessPaymentDTO) {
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error('Payment amount must be greater than zero.');
    if (!data.method?.trim()) throw new Error('Payment method is required.');
    if (!data.folioId && !data.reservationId) throw new Error('A folio or reservation is required for a payment.');

    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing) return existing;

    return prisma.$transaction(async tx => {
      const targetFolio = data.folioId
        ? await tx.folio.findUnique({ where: { id: data.folioId } })
        : await tx.folio.findFirst({ where: { reservationId: data.reservationId, status: 'OPEN' } });

      if (!targetFolio) throw new Error('Open folio not found.');
      if (targetFolio.status !== 'OPEN') throw new Error('This folio is already closed.');

      const amount = new Prisma.Decimal(data.amount);
      const balance = new Prisma.Decimal(targetFolio.balance);
      if (amount.gt(balance)) throw new Error(`Payment exceeds the outstanding folio balance of ${balance.toFixed(2)}.`);

      const payment = await tx.payment.create({
        data: {
          folioId: targetFolio.id,
          reservationId: data.reservationId || targetFolio.reservationId,
          guestId: data.guestId || targetFolio.guestId,
          amount,
          currency: data.currency || 'GHS',
          method: data.method,
          reference: data.reference,
          idempotencyKey: data.idempotencyKey,
          status: 'COMPLETED',
          type: 'PAYMENT',
          description: data.description || 'Guest payment settlement',
          processedBy: data.processedBy,
        },
      });

      await tx.folioItem.create({
        data: {
          folioId: targetFolio.id,
          type: 'PAYMENT',
          description: `Payment received (${data.method}${data.reference ? ` · ${data.reference}` : ''})`,
          amount: -amount,
          quantity: 1,
          unitPrice: -amount,
          department: 'FRONT_DESK',
          referenceId: payment.id,
          referenceType: 'PAYMENT',
          postedBy: data.processedBy,
        },
      });

      await tx.folio.update({ where: { id: targetFolio.id }, data: { balance: { decrement: amount } } });
      await AuditService.logInTransaction(tx, {
        userId: data.processedBy,
        action: 'payment.created',
        resource: 'payment',
        resourceId: payment.id,
        afterData: { folioId: targetFolio.id, amount: amount.toString(), method: payment.method, source: 'FOLIO' },
      });
      return payment;
    });
  }

  /**
   * Records an immutable reversal. The original payment is never changed in-place:
   * this creates a linked REFUND payment and, where relevant, returns value to the folio.
   */
  static async refundPayment(originalPaymentId: string, data: RefundPaymentDTO) {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new AppError('Refund amount must be greater than zero.', 422, 'INVALID_REFUND_AMOUNT');
    }

    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing) {
      if (existing.type !== 'REFUND' || existing.originalPaymentId !== originalPaymentId) {
        throw new AppError('This idempotency key belongs to a different transaction.', 409, 'IDEMPOTENCY_KEY_REUSED');
      }
      return existing;
    }

    try {
      return await prisma.$transaction(async tx => {
        const original = await tx.payment.findUnique({ where: { id: originalPaymentId } });
        if (!original || original.type !== 'PAYMENT' || original.status === 'FAILED' || original.voidedAt) {
          throw new AppError('Only completed, non-voided payments can be refunded.', 422, 'PAYMENT_NOT_REFUNDABLE');
        }
        if (!['COMPLETED', 'PARTIALLY_REFUNDED'].includes(original.status)) {
          throw new AppError('This payment is not eligible for a refund.', 422, 'PAYMENT_NOT_REFUNDABLE');
        }

        const priorRefunds = await tx.payment.aggregate({
          where: { originalPaymentId, type: 'REFUND', status: 'COMPLETED', voidedAt: null },
          _sum: { amount: true },
        });
        const refunded = new Prisma.Decimal(priorRefunds._sum.amount || 0);
        const refundAmount = new Prisma.Decimal(data.amount);
        const refundable = new Prisma.Decimal(original.amount).minus(refunded);
        if (refundAmount.gt(refundable)) {
          throw new AppError(`Refund exceeds the remaining refundable amount of ${refundable.toFixed(2)}.`, 422, 'REFUND_EXCEEDS_PAYMENT');
        }

        if (original.folioId) {
          const folio = await tx.folio.findUnique({ where: { id: original.folioId } });
          if (!folio || folio.status !== 'OPEN') {
            throw new AppError('A payment on a closed folio must be refunded through an authorised folio reopening workflow.', 409, 'CLOSED_FOLIO_REFUND');
          }
        }

        const refund = await tx.payment.create({
          data: {
            reservationId: original.reservationId,
            guestId: original.guestId,
            folioId: original.folioId,
            amount: refundAmount,
            currency: original.currency,
            method: data.method || original.method,
            reference: data.reference,
            source: original.source,
            sourceId: original.sourceId,
            originalPaymentId: original.id,
            idempotencyKey: data.idempotencyKey,
            status: 'COMPLETED',
            type: 'REFUND',
            description: data.reason,
            processedBy: data.processedBy,
          },
        });

        if (original.folioId) {
          await tx.folioItem.create({
            data: {
              folioId: original.folioId,
              type: 'REFUND',
              description: `Refund issued (${refund.method}${refund.reference ? ` · ${refund.reference}` : ''})`,
              amount: refundAmount,
              quantity: 1,
              unitPrice: refundAmount,
              department: 'FRONT_DESK',
              referenceId: refund.id,
              referenceType: 'REFUND',
              postedBy: data.processedBy,
            },
          });
          await tx.folio.update({ where: { id: original.folioId }, data: { balance: { increment: refundAmount } } });
        }

        const remaining = refundable.minus(refundAmount);
        const paymentStatus = remaining.isZero() ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        await tx.payment.update({
          where: { id: original.id },
          data: { status: paymentStatus },
        });
        // Financial state remains independent from the restaurant/bar/pool operational status.
        if (original.source === 'RESTAURANT_ORDER' && original.sourceId) {
          await tx.restaurantOrder.update({ where: { id: original.sourceId }, data: { paymentStatus } });
        } else if (original.source === 'BAR_ORDER' && original.sourceId) {
          await tx.barOrder.update({ where: { id: original.sourceId }, data: { paymentStatus } });
        } else if (original.source === 'POOL_TRANSACTION' && original.sourceId) {
          await tx.poolTransaction.update({ where: { id: original.sourceId }, data: { paymentStatus } });
        }
        await AuditService.logInTransaction(tx, {
          userId: data.processedBy,
          action: 'payment.refunded',
          resource: 'payment',
          resourceId: refund.id,
          afterData: { originalPaymentId: original.id, amount: refundAmount.toString(), folioId: original.folioId, reason: data.reason },
        });
        return refund;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('The payment changed while the refund was being processed. Please retry.', 409, 'REFUND_CONFLICT');
      }
      throw error;
    }
  }
}
