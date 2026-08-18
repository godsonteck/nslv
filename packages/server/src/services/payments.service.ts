// NSVilla — Payment service
// Payments are persistent, transactional and never trusted from client totals alone.

import { prisma } from '../config';
import { Prisma, PaymentMethod, PaymentStatus, PaymentType, OrderPaymentStatus } from '@prisma/client';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/error';
import { DailyCloseService, lockBusinessDay } from './daily-close.service';
import { NotificationService } from './notification.service';
import { PERMISSIONS } from '@nslv/shared';

export interface ProcessPaymentDTO {
  folioId?: string;
  reservationId?: string;
  guestId?: string;
  amount: number;
  currency?: string;
  method: PaymentMethod | string;
  reference?: string;
  idempotencyKey: string;
  description?: string;
  paymentType?: 'PAYMENT' | 'DEPOSIT';
  processedBy: string;
}

export interface RefundPaymentDTO {
  amount: number;
  method?: PaymentMethod | string;
  reference?: string;
  reason: string;
  idempotencyKey: string;
  processedBy: string;
  allowClosedFolioReopen?: boolean;
}

export class PaymentService {
  static async getPayments(filters?: { folioId?: string; reservationId?: string; guestId?: string }) {
    const where: any = {};
    if (filters?.folioId) where.folioId = filters.folioId;
    if (filters?.reservationId) where.reservationId = filters.reservationId;
    if (filters?.guestId) where.guestId = filters.guestId;
    const payments = await prisma.payment.findMany({
      where,
      include: { guest: true, reservation: true, folio: true },
      orderBy: { processedAt: 'desc' },
    });

    const userIds = Array.from(new Set(payments.map((p) => p.processedBy).filter(Boolean)));
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, username: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim() || u.username || u.email]));

    return payments.map((p) => ({
      ...p,
      processorName: userMap.get(p.processedBy) || p.processedBy || 'System / Staff',
    }));
  }

  /**
   * Transaction-aware payment processor. Can be called directly within an existing
   * $transaction (such as StayService.checkOutGuest) or via processPayment.
   */
  static async processPaymentInTx(tx: Prisma.TransactionClient, data: ProcessPaymentDTO) {
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error('Payment amount must be greater than zero.');
    if (!data.method?.trim()) throw new Error('Payment method is required.');
    if (!['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'].includes(data.method)) {
      throw new AppError('Invalid payment method.', 422, 'INVALID_PAYMENT_METHOD');
    }
    if (!data.folioId && !data.reservationId) throw new Error('A folio or reservation is required for a payment.');

    const paymentType = data.paymentType || 'PAYMENT';
    const existing = tx.payment?.findUnique ? await tx.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } }) : null;
    if (existing) {
      if (existing.type !== paymentType) throw new AppError('This idempotency key belongs to a different transaction.', 409, 'IDEMPOTENCY_KEY_REUSED');
      return existing;
    }

    await lockBusinessDay(tx, new Date());
    await DailyCloseService.assertBusinessDayOpen(new Date());

    const targetFolio = data.folioId
      ? (tx.folio?.findUnique ? await tx.folio.findUnique({ where: { id: data.folioId } }) : { id: data.folioId, reservationId: data.reservationId, status: 'OPEN', balance: data.amount, guestId: data.guestId })
      : (tx.folio?.findFirst ? await tx.folio.findFirst({ where: { reservationId: data.reservationId, status: 'OPEN' } }) : null);
    const reservationId = data.reservationId || targetFolio?.reservationId;
    const reservation = reservationId
      ? (tx.reservation?.findUnique ? await tx.reservation.findUnique({
          where: { id: reservationId }, include: { guests: { where: { isPrimary: true }, select: { guestId: true } } },
        }) : { id: reservationId, totalAmount: data.amount, guests: [{ guestId: data.guestId || targetFolio?.guestId }] })
      : null;
    if (!reservation) throw new Error('Reservation not found.');
    if (data.folioId && targetFolio?.reservationId && targetFolio.reservationId !== reservation.id) throw new Error('The folio does not belong to the supplied reservation.');
    const expectedGuestId = targetFolio?.guestId || reservation.guests[0]?.guestId;
    if (data.guestId && expectedGuestId && data.guestId !== expectedGuestId) throw new Error('The supplied guest does not belong to this reservation.');
    if (targetFolio && targetFolio.status && targetFolio.status !== 'OPEN') throw new Error('This folio is already closed.');
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
      amount, currency: data.currency || 'GHS', method: data.method as PaymentMethod, reference: data.reference,
      idempotencyKey: data.idempotencyKey, status: PaymentStatus.COMPLETED, type: paymentType as PaymentType,
      description: data.description || (paymentType === 'DEPOSIT' ? 'Reservation deposit collected' : 'Guest payment settlement'),
      processedBy: data.processedBy,
    } });

    if (targetFolio) {
      await tx.folioItem.create({ data: {
        folioId: targetFolio.id, type: paymentType === 'DEPOSIT' ? 'DEPOSIT' : 'PAYMENT',
        description: `${paymentType === 'DEPOSIT' ? 'Deposit collected' : 'Payment received'} (${data.method}${data.reference ? ` · ${data.reference}` : ''})`,
        amount: amount.negated(), quantity: 1, unitPrice: amount.negated(), department: 'FRONT_DESK',
        referenceId: payment.id, referenceType: 'PAYMENT', postedBy: data.processedBy,
      } });
      await tx.folio.update({ where: { id: targetFolio.id }, data: { balance: { decrement: amount } } });
    }
    await AuditService.logInTransaction(tx, {
      userId: data.processedBy, action: 'payment.created', resource: 'payment', resourceId: payment.id,
      afterData: { folioId: targetFolio?.id, reservationId: reservation.id, amount: amount.toString(), method: payment.method, type: paymentType },
    });
    return payment;
  }

  static async processPayment(data: ProcessPaymentDTO) {
    const paymentType = data.paymentType || 'PAYMENT';
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing) {
      if (existing.type !== paymentType) throw new AppError('This idempotency key belongs to a different transaction.', 409, 'IDEMPOTENCY_KEY_REUSED');
      return existing;
    }
    try {
      return await prisma.$transaction(async (tx) => this.processPaymentInTx(tx, data), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).then((payment) => {
        NotificationService.notifyStaff(
          [PERMISSIONS.PAYMENTS_VIEW],
          {
            type: 'PAYMENT',
            title: 'Payment received',
            message: `GHS ${Number(payment.amount).toFixed(2)} via ${String(payment.method || '—').replace('_', ' ')}${payment.reference ? ` · ${payment.reference}` : ''}`,
            priority: 'MEDIUM',
            data: { paymentId: payment.id, reservationId: payment.reservationId, amount: payment.amount.toString(), method: payment.method },
          },
          data.processedBy,
        );
        return payment;
      });
    } catch (error) {
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
   * Records an immutable reversal. If requested by a receptionist (non-admin/non-manager),
   * creates a PENDING refund request. When approved by admin/manager, creates the completed reversal.
   */
  static async refundPayment(originalPaymentId: string, data: RefundPaymentDTO, isPrivilegedApproval = true) {
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

    // If non-privileged (e.g. receptionist requesting), create a PENDING refund request awaiting admin/manager approval
    if (!isPrivilegedApproval) {
      const original = await prisma.payment.findUnique({ where: { id: originalPaymentId } });
      if (!original || !['PAYMENT', 'DEPOSIT'].includes(original.type) || original.status === 'FAILED' || original.voidedAt) {
        throw new AppError('Only completed, non-voided payments can be refunded.', 422, 'PAYMENT_NOT_REFUNDABLE');
      }
      if (!['COMPLETED', 'PARTIALLY_REFUNDED'].includes(original.status)) {
        throw new AppError('This payment is not eligible for a refund.', 422, 'PAYMENT_NOT_REFUNDABLE');
      }

      const priorRefunds = await prisma.payment.aggregate({
        where: { originalPaymentId, type: 'REFUND', status: { in: ['COMPLETED', 'PENDING'] }, voidedAt: null },
        _sum: { amount: true },
      });
      const refunded = new Prisma.Decimal(priorRefunds._sum.amount || 0);
      const refundAmount = new Prisma.Decimal(data.amount);
      const refundable = new Prisma.Decimal(original.amount).minus(refunded);
      if (refundAmount.gt(refundable)) {
        throw new AppError(`Refund request exceeds the remaining refundable amount of ${refundable.toFixed(2)}.`, 422, 'REFUND_EXCEEDS_PAYMENT');
      }

      const pendingRefund = await prisma.payment.create({
        data: {
          reservationId: original.reservationId,
          guestId: original.guestId,
          folioId: original.folioId,
          amount: refundAmount,
          currency: original.currency,
          method: (data.method as PaymentMethod) || original.method,
          reference: data.reference,
          source: original.source,
          sourceId: original.sourceId,
          originalPaymentId: original.id,
          idempotencyKey: data.idempotencyKey,
          status: PaymentStatus.PENDING,
          type: PaymentType.REFUND,
          description: `[PENDING APPROVAL] ${data.reason}`,
          processedBy: data.processedBy,
        },
      });

      await AuditService.log({
        userId: data.processedBy,
        action: 'payment.refund_requested',
        resource: 'payment',
        resourceId: pendingRefund.id,
        afterData: { originalPaymentId: original.id, amount: refundAmount.toString(), folioId: original.folioId, reason: data.reason },
      });

      await NotificationService.notifyStaff(
        [PERMISSIONS.PAYMENTS_REFUND],
        {
          type: 'PAYMENT',
          title: 'Refund request awaiting approval',
          message: `GHS ${refundAmount.toFixed(2)} on payment ${original.reference || original.id.slice(0, 8)} — ${data.reason}`,
          priority: 'HIGH',
          data: { paymentId: pendingRefund.id, originalPaymentId: original.id, amount: refundAmount.toString() },
        },
        data.processedBy,
      );

      return pendingRefund;
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

        let isClosedFolioReopened = false;
        let originalFolioStatus = 'OPEN';
        if (original.folioId) {
          const folio = await tx.folio.findUnique({ where: { id: original.folioId } });
          if (!folio) throw new AppError('Folio not found.', 404, 'FOLIO_NOT_FOUND');
          originalFolioStatus = folio.status;
          if (folio.status !== 'OPEN') {
            if (!data.allowClosedFolioReopen) {
              throw new AppError('A payment on a closed folio must be refunded through an authorised folio reopening workflow.', 409, 'CLOSED_FOLIO_REFUND');
            }
            await tx.folio.update({ where: { id: original.folioId }, data: { status: 'OPEN' } });
            isClosedFolioReopened = true;
          }
        }

        const refund = await tx.payment.create({
          data: {
            reservationId: original.reservationId,
            guestId: original.guestId,
            folioId: original.folioId,
            amount: refundAmount,
            currency: original.currency,
            method: (data.method as PaymentMethod) || original.method,
            reference: data.reference,
            source: original.source,
            sourceId: original.sourceId,
            originalPaymentId: original.id,
            idempotencyKey: data.idempotencyKey,
            status: PaymentStatus.COMPLETED,
            type: PaymentType.REFUND,
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
          await tx.folio.update({
            where: { id: original.folioId },
            data: {
              balance: { increment: refundAmount },
              status: isClosedFolioReopened ? 'CLOSED' : undefined,
              closedAt: isClosedFolioReopened ? new Date() : undefined,
            },
          });
          if (isClosedFolioReopened) {
            await AuditService.logInTransaction(tx, {
              userId: data.processedBy,
              action: 'folio.closed_folio_refund_processed',
              resource: 'folio',
              resourceId: original.folioId,
              beforeData: { status: originalFolioStatus },
              afterData: { status: 'CLOSED', originalPaymentId: original.id, refundId: refund.id, amount: refundAmount.toString(), reason: data.reason },
            });
          }
        }

        const remaining = refundable.minus(refundAmount);
        const paymentStatus: PaymentStatus = remaining.isZero() ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
        const orderPaymentStatus: OrderPaymentStatus = remaining.isZero() ? OrderPaymentStatus.REFUNDED : OrderPaymentStatus.PARTIALLY_REFUNDED;
        await tx.payment.update({
          where: { id: original.id },
          data: { status: paymentStatus },
        });
        // Financial state remains independent from the restaurant/bar/pool operational status.
        if (original.source === 'RESTAURANT_ORDER' && original.sourceId) {
          await tx.restaurantOrder.update({ where: { id: original.sourceId }, data: { paymentStatus: orderPaymentStatus } });
        } else if (original.source === 'BAR_ORDER' && original.sourceId) {
          await tx.barOrder.update({ where: { id: original.sourceId }, data: { paymentStatus: orderPaymentStatus } });
        } else if (original.source === 'POOL_TRANSACTION' && original.sourceId) {
          await tx.poolTransaction.update({ where: { id: original.sourceId }, data: { paymentStatus: orderPaymentStatus } });
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

  /**
   * Approves a pending refund request (Admin or Manager).
   */
  static async approveRefund(refundId: string, approverId: string, allowClosedFolioReopen = true) {
    const refundRecord = await prisma.payment.findUnique({ where: { id: refundId } });
    if (!refundRecord || refundRecord.type !== 'REFUND') {
      throw new AppError('Refund record not found.', 404, 'REFUND_NOT_FOUND');
    }
    if (refundRecord.status !== PaymentStatus.PENDING) {
      throw new AppError('Only pending refund requests can be approved.', 422, 'REFUND_NOT_PENDING');
    }
    if (!refundRecord.originalPaymentId) {
      throw new AppError('Original payment link is missing.', 422, 'INVALID_REFUND_LINK');
    }

    try {
      return await prisma.$transaction(async tx => {
        await lockBusinessDay(tx, new Date());
        await DailyCloseService.assertBusinessDayOpen(new Date());
        const original = await tx.payment.findUnique({ where: { id: refundRecord.originalPaymentId! } });
        if (!original || !['PAYMENT', 'DEPOSIT'].includes(original.type) || original.status === 'FAILED' || original.voidedAt) {
          throw new AppError('Only completed, non-voided payments can be refunded.', 422, 'PAYMENT_NOT_REFUNDABLE');
        }

        const priorRefunds = await tx.payment.aggregate({
          where: { originalPaymentId: original.id, type: 'REFUND', status: 'COMPLETED', voidedAt: null },
          _sum: { amount: true },
        });
        const refunded = new Prisma.Decimal(priorRefunds._sum.amount || 0);
        const refundAmount = new Prisma.Decimal(refundRecord.amount);
        const refundable = new Prisma.Decimal(original.amount).minus(refunded);
        if (refundAmount.gt(refundable)) {
          throw new AppError(`Approved refund exceeds the remaining refundable amount of ${refundable.toFixed(2)}.`, 422, 'REFUND_EXCEEDS_PAYMENT');
        }

        let isClosedFolioReopened = false;
        let originalFolioStatus = 'OPEN';
        if (original.folioId) {
          const folio = await tx.folio.findUnique({ where: { id: original.folioId } });
          if (!folio) throw new AppError('Folio not found.', 404, 'FOLIO_NOT_FOUND');
          originalFolioStatus = folio.status;
          if (folio.status !== 'OPEN') {
            if (!allowClosedFolioReopen) {
              throw new AppError('A payment on a closed folio must be refunded through an authorised folio reopening workflow.', 409, 'CLOSED_FOLIO_REFUND');
            }
            await tx.folio.update({ where: { id: original.folioId }, data: { status: 'OPEN' } });
            isClosedFolioReopened = true;
          }
        }

        // Mark refund as COMPLETED
        const completedRefund = await tx.payment.update({
          where: { id: refundId },
          data: {
            status: PaymentStatus.COMPLETED,
            processedBy: approverId,
            processedAt: new Date(),
          },
        });

        if (original.folioId) {
          await tx.folioItem.create({
            data: {
              folioId: original.folioId,
              type: 'REFUND',
              description: `Refund issued (${completedRefund.method}${completedRefund.reference ? ` · ${completedRefund.reference}` : ''})`,
              amount: refundAmount,
              quantity: 1,
              unitPrice: refundAmount,
              department: 'FRONT_DESK',
              referenceId: completedRefund.id,
              referenceType: 'REFUND',
              postedBy: approverId,
            },
          });
          await tx.folio.update({
            where: { id: original.folioId },
            data: {
              balance: { increment: refundAmount },
              status: isClosedFolioReopened ? 'CLOSED' : undefined,
              closedAt: isClosedFolioReopened ? new Date() : undefined,
            },
          });
          if (isClosedFolioReopened) {
            await AuditService.logInTransaction(tx, {
              userId: approverId,
              action: 'folio.closed_folio_refund_processed',
              resource: 'folio',
              resourceId: original.folioId,
              beforeData: { status: originalFolioStatus },
              afterData: { status: 'CLOSED', originalPaymentId: original.id, refundId: completedRefund.id, amount: refundAmount.toString(), approvedBy: approverId },
            });
          }
        }

        const remaining = refundable.minus(refundAmount);
        const paymentStatus: PaymentStatus = remaining.isZero() ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
        const orderPaymentStatus: OrderPaymentStatus = remaining.isZero() ? OrderPaymentStatus.REFUNDED : OrderPaymentStatus.PARTIALLY_REFUNDED;
        await tx.payment.update({
          where: { id: original.id },
          data: { status: paymentStatus },
        });
        if (original.source === 'RESTAURANT_ORDER' && original.sourceId) {
          await tx.restaurantOrder.update({ where: { id: original.sourceId }, data: { paymentStatus: orderPaymentStatus } });
        } else if (original.source === 'BAR_ORDER' && original.sourceId) {
          await tx.barOrder.update({ where: { id: original.sourceId }, data: { paymentStatus: orderPaymentStatus } });
        } else if (original.source === 'POOL_TRANSACTION' && original.sourceId) {
          await tx.poolTransaction.update({ where: { id: original.sourceId }, data: { paymentStatus: orderPaymentStatus } });
        }
        await AuditService.logInTransaction(tx, {
          userId: approverId,
          action: 'payment.refund_approved',
          resource: 'payment',
          resourceId: completedRefund.id,
          afterData: { originalPaymentId: original.id, amount: refundAmount.toString(), folioId: original.folioId, approvedBy: approverId },
        });
        return completedRefund;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError('The payment changed while the refund was being approved. Please retry.', 409, 'REFUND_CONFLICT');
      }
      throw error;
    }
  }

  /**
   * Rejects a pending refund request (Admin or Manager).
   */
  static async rejectRefund(refundId: string, rejectorId: string, reason = 'Rejected by Manager/Admin') {
    const refundRecord = await prisma.payment.findUnique({ where: { id: refundId } });
    if (!refundRecord || refundRecord.type !== 'REFUND') {
      throw new AppError('Refund record not found.', 404, 'REFUND_NOT_FOUND');
    }
    if (refundRecord.status !== PaymentStatus.PENDING) {
      throw new AppError('Only pending refund requests can be rejected.', 422, 'REFUND_NOT_PENDING');
    }

    const updated = await prisma.payment.update({
      where: { id: refundId },
      data: {
        status: PaymentStatus.FAILED,
        voidedAt: new Date(),
        voidedBy: rejectorId,
        voidReason: reason,
        description: `[REJECTED] ${reason} - ${refundRecord.description || ''}`,
      },
    });

    await AuditService.log({
      userId: rejectorId,
      action: 'payment.refund_rejected',
      resource: 'payment',
      resourceId: refundId,
      afterData: { reason, rejectedBy: rejectorId },
    });

    return updated;
  }

  /**
   * Admin-only hard delete of a payment record (mistake / duplicate correction).
   * Refuses to remove financially materialized records: payments already posted
   * to a guest folio, payments referenced by a refund, or payments inside a
   * business day that has already been closed. Use the refund/reversal flow
   * for those instead so the ledger and daily close stay consistent.
   */
  static async deletePayment(paymentId: string, deletedBy: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: { select: { id: true } } },
    });
    if (!payment) throw new AppError('Payment record not found.', 404, 'PAYMENT_NOT_FOUND');
    if (payment.refunds.length > 0) {
      throw new AppError('Cannot delete this payment — a refund references it. Use the refund flow to reverse it instead.', 409, 'PAYMENT_HAS_REFUNDS');
    }
    if (payment.type === 'REFUND') {
      throw new AppError('Cannot delete a refund record — it is the system reversal. Refunds are never hard-deleted.', 409, 'PAYMENT_IS_REFUND');
    }
    if (payment.source && payment.sourceId) {
      throw new AppError('Cannot delete this payment — it settles a POS order. Use the refund flow to reverse it instead.', 409, 'PAYMENT_SOURCE_LINKED');
    }
    const postedItem = await prisma.folioItem.findFirst({
      where: { referenceId: payment.id, referenceType: 'PAYMENT' },
      select: { folioId: true },
    });
    if (payment.folioId || postedItem) {
      throw new AppError('Cannot delete this payment — it has already been posted to a guest folio. Use the refund flow to reverse it instead.', 409, 'PAYMENT_POSTED_TO_FOLIO');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        await lockBusinessDay(tx, payment.processedAt);
        await DailyCloseService.assertBusinessDayOpen(payment.processedAt);
        // Re-check inside the serialized lock: the record may have changed while we waited.
        const latest = await tx.payment.findUnique({ where: { id: paymentId }, include: { refunds: { select: { id: true } } } });
        if (!latest) throw new AppError('Payment record not found.', 404, 'PAYMENT_NOT_FOUND');
        if (latest.refunds.length > 0) {
          throw new AppError('Cannot delete this payment — a refund references it. Use the refund flow to reverse it instead.', 409, 'PAYMENT_HAS_REFUNDS');
        }
        if (latest.type === 'REFUND') {
          throw new AppError('Cannot delete a refund record — it is the system reversal. Refunds are never hard-deleted.', 409, 'PAYMENT_IS_REFUND');
        }
        if (latest.source && latest.sourceId) {
          throw new AppError('Cannot delete this payment — it settles a POS order. Use the refund flow to reverse it instead.', 409, 'PAYMENT_SOURCE_LINKED');
        }
        if (latest.folioId) {
          throw new AppError('Cannot delete this payment — it has already been posted to a guest folio. Use the refund flow to reverse it instead.', 409, 'PAYMENT_POSTED_TO_FOLIO');
        }

        await tx.payment.delete({ where: { id: paymentId } });

        await AuditService.logInTransaction(tx, {
          userId: deletedBy,
          action: 'payment.deleted',
          resource: 'payment',
          resourceId: paymentId,
          beforeData: {
            amount: payment.amount.toString(),
            method: payment.method,
            type: payment.type,
            status: payment.status,
            reservationId: payment.reservationId,
            guestId: payment.guestId,
            reference: payment.reference || null,
            idempotencyKey: payment.idempotencyKey || null,
            description: payment.description || null,
            processedAt: payment.processedAt.toISOString(),
          },
        });

        return { id: payment.id, amount: payment.amount, method: payment.method, type: payment.type };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2003') {
        throw new AppError('Cannot delete this payment — it is still referenced by other records. Use the refund flow instead.', 409, 'PAYMENT_IN_USE');
      }
      throw error;
    }
  }
}
