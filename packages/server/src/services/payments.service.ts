// NSVilla — Payment service
// Payments are persistent, transactional and never trusted from client totals alone.

import { prisma } from '../config';

export interface ProcessPaymentDTO {
  folioId?: string;
  reservationId?: string;
  guestId?: string;
  amount: number;
  currency?: string;
  method: string;
  reference?: string;
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

    return prisma.$transaction(async tx => {
      const targetFolio = data.folioId
        ? await tx.folio.findUnique({ where: { id: data.folioId } })
        : await tx.folio.findFirst({ where: { reservationId: data.reservationId, status: 'OPEN' } });

      if (!targetFolio) throw new Error('Open folio not found.');
      if (targetFolio.status !== 'OPEN') throw new Error('This folio is already closed.');

      const amount = Number(data.amount);
      const balance = Number(targetFolio.balance);
      if (amount > balance) throw new Error(`Payment exceeds the outstanding folio balance of ${balance.toFixed(2)}.`);

      const payment = await tx.payment.create({
        data: {
          folioId: targetFolio.id,
          reservationId: data.reservationId || targetFolio.reservationId,
          guestId: data.guestId || targetFolio.guestId,
          amount,
          currency: data.currency || 'GHS',
          method: data.method,
          reference: data.reference,
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
      return payment;
    });
  }
}
