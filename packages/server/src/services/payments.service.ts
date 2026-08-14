// NSVilla — Payment service
// Payments are persistent, transactional and never trusted from client totals alone.

import { prisma } from '../config';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';

export interface ProcessPaymentDTO {
  folioId?: string;
  reservationId?: string;
  guestId?: string;
  amount: number;
  currency?: string;
  method: string;
  reference?: string;
  idempotencyKey?: string;
  description?: string;
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

    if (data.idempotencyKey) {
      const existing = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (existing) return existing;
    }

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
}
