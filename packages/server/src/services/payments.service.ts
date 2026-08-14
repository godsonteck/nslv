// NSVilla — Payment service
// Payments are persistent, transactional and never trusted from client totals alone.

import { prisma } from '../config';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/error';
import { DailyCloseService, lockBusinessDay } from './daily-close.service';

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
  paymentType?: 'PAYMENT' | 'DEPOSIT';
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

    const paymentType = data.paymentType || 'PAYMENT';
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing) {
      if (existing.type !== paymentType) throw new AppError('This idempotency key belongs to a different transaction.', 409, 'IDEMPOTENCY_KEY_REUSED');
      return existing;
    }
    try {
      return await prisma.$transaction(async tx => {
        await lockBusinessDay(tx, new Date());
        await DailyCloseService.assertBusinessDayOpen(new Date());
        const targetFolio = data.folioId
          ? await tx.folio.findUnique({ where: { id: data.folioId } })
          : await tx.folio.findFirst({ where: { reservationId: data.reservationId, status: 'OPEN' } });
        const reservationId = data.reservationId || targetFolio?.reservationId;
        const reservation = reservationId ? await tx.reservation.findUnique({
          where: { id: reservationId }, include: { guests: { where: { isPrimary: true }, select: { guestId: true } } },
        }) : null;
        if (!reservation) throw new Error('Reservation not found.');
        if (data.folioId && targetFolio?.reservationId !== reservation.id) throw new Error('The folio does not belong to the supplied reservation.');
        const expectedGuestId = targetFolio?.guestId || reservation.guests[0]?.guestId;
        if (data.guestId && data.guestId !== expectedGuestId) throw new Error('The supplied guest does not belong to this reservation.');
        if (targetFolio && targetFolio.status !== 'OPEN') throw new Error('This folio is already closed.');
        if (paymentType === 'PAYMENT' && !targetFolio) throw new Error('Open folio not found.');

        const amount = new Prisma.Decimal(data.amount);
        if (paymentType === 'PAYMENT') {
          const balance = new Prisma.Decimal(targetFolio!.balance);
          if (amount.gt(balance)) throw new Error(`Payment exceeds the outstanding folio balance of ${balance.toFixed(2)}.`);
        } else {
          const priorDeposits = await tx.payment.aggregate({
            where: { reservationId: reservation.id, type: 'DEPOSIT', status: 'COMPLETED', voidedAt: null }, _sum: { amount: true },
          });
          if (new Prisma.Decimal(priorDeposits._sum.amount || 0).plus(amount).gt(reservation.totalAmount)) {
            throw new Error('Deposits cannot exceed the reservation total.');
          }
        }

        const payment = await tx.payment.create({ data: {
          folioId: targetFolio?.id, reservationId: reservation.id,
          guestId: expectedGuestId,
          amount, currency: data.currency || 'GHS', method: data.method, reference: data.reference,
          idempotencyKey: data.idempotencyKey, status: 'COMPLETED', type: paymentType,
          description: data.description || (paymentType === 'DEPOSIT' ? 'Reservation deposit collected' : 'Guest payment settlement'),
          processedBy: data.processedBy,
        } });

        if (targetFolio) {
          await tx.folioItem.create({ data: {
            folioId: targetFolio.id, type: paymentType === 'DEPOSIT' ? 'DEPOSIT' : 'PAYMENT',
            description: `${paymentType === 'DEPOSIT' ? 'Deposit collected' : 'Payment received'} (${data.method}${data.reference ? ` · ${data.reference}` : ''})`,
            amount: -amount, quantity: 1, unitPrice: -amount, department: 'FRONT_DESK',
            referenceId: payment.id, referenceType: 'PAYMENT', postedBy: data.processedBy,
          } });
          await tx.folio.update({ where: { id: targetFolio.id }, data: { balance: { decrement: amount } } });
        }
        await AuditService.logInTransaction(tx, {
          userId: data.processedBy, action: 'payment.created', resource: 'payment', resourceId: payment.id,
          afterData: { folioId: targetFolio?.id, reservationId: reservation.id, amount: amount.toString(), method: payment.method, type: paymentType },
        });
        return payment;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // A duplicate idempotency key can win a concurrent race after the early
      // lookup. Return that one durable financial effect instead of creating a
      // second payment or presenting a spurious server error.
      if ((error as { code?: string }).code === 'P2002') {
        const duplicate = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
        if (duplicate?.type === paymentType) return duplicate;
      }
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('The folio changed while this payment was being processed. Please retry.', 409, 'PAYMENT_CONFLICT');
      }
      throw error;
    }
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
        await lockBusinessDay(tx, new Date());
        await DailyCloseService.assertBusinessDayOpen(new Date());
        const original = await tx.payment.findUnique({ where: { id: originalPaymentId } });
        if (!original || !['PAYMENT', 'DEPOSIT'].includes(original.type) || original.status === 'FAILED' || original.voidedAt) {
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
      if ((error as { code?: string }).code === 'P2002') {
        const duplicate = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
        if (duplicate?.type === 'REFUND' && duplicate.originalPaymentId === originalPaymentId) return duplicate;
      }
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('The payment changed while the refund was being processed. Please retry.', 409, 'REFUND_CONFLICT');
      }
      throw error;
    }
  }
}
