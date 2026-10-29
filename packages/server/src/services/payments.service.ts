// NSVilla — Payment service
// Payments are persistent, transactional and never trusted from client totals alone.

import { prisma } from '../config';
import { Prisma, PaymentMethod, PaymentStatus, PaymentType, OrderPaymentStatus, FolioStatus } from '@prisma/client';
import { CashRegisterService } from './cash-register.service';
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
  // Split settlements: each tender becomes its own Payment row (idempotency
  // keys `key`, `key#1`, `key#2`, …) and the tender amounts must sum to amount.
  tenders?: { method: string; amount: number; reference?: string }[];
  source?: string;
  sourceId?: string;
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
      include: { guest: true, reservation: { include: { room: true } }, folio: true },
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

    // A reservation deposit that completes the reservation total is a *full*
    // payment for presentation purposes. This is DERIVED at read time only —
    // the stored type stays DEPOSIT so check-in can still materialise it onto
    // the folio as immutable payment history.
    const reservationIds = Array.from(new Set(payments.map((p) => p.reservationId).filter(Boolean))) as string[];

    // Fetch reservation metadata (totalAmount, bookingId, room) for all referenced reservations
    const reservationMeta = reservationIds.length > 0
      ? await prisma.reservation.findMany({
          where: { id: { in: reservationIds } },
          select: { id: true, totalAmount: true, bookingId: true, room: { select: { number: true } } },
        })
      : [];
    const reservationById = new Map(reservationMeta.map((r) => [r.id, r]));

    // For group bookings: gather all sibling reservations to compute group totals
    const groupBookingIds = Array.from(new Set(reservationMeta.map((r) => r.bookingId).filter(Boolean))) as string[];
    const groupReservations = groupBookingIds.length > 0
      ? await prisma.reservation.findMany({
          where: { bookingId: { in: groupBookingIds } },
          select: { id: true, totalAmount: true, bookingId: true, room: { select: { number: true } } },
        })
      : [];

    // bookingId → { combinedTotal, resIds, rooms[] }
    const groupByBookingId = new Map<string, { combinedTotal: number; resIds: string[]; rooms: string[] }>();
    for (const r of groupReservations) {
      if (!r.bookingId) continue;
      if (!groupByBookingId.has(r.bookingId)) groupByBookingId.set(r.bookingId, { combinedTotal: 0, resIds: [], rooms: [] });
      const g = groupByBookingId.get(r.bookingId)!;
      g.combinedTotal += Number(r.totalAmount || 0);
      g.resIds.push(r.id);
      if (r.room?.number) g.rooms.push(String(r.room.number));
    }

    // Aggregate deposits per reservation across all affected reservations
    const uniqueResIds = Array.from(new Set([...reservationIds, ...groupReservations.map((r) => r.id)]));
    const depositTotals = new Map<string, number>();
    if (uniqueResIds.length > 0) {
      const depositRows = await prisma.payment.findMany({
        where: { reservationId: { in: uniqueResIds }, type: 'DEPOSIT', status: 'COMPLETED', voidedAt: null },
        select: { reservationId: true, amount: true },
      });
      for (const row of depositRows) {
        if (!row.reservationId) continue;
        depositTotals.set(row.reservationId, (depositTotals.get(row.reservationId) || 0) + Number(row.amount));
      }
    }

    // Precompute group-level deposit totals (sum across every room in the group)
    const groupDepositTotals = new Map<string, number>();
    for (const [bookingId, g] of groupByBookingId.entries()) {
      groupDepositTotals.set(bookingId, g.resIds.reduce((sum, id) => sum + (depositTotals.get(id) || 0), 0));
    }

    return payments.map((p) => {
      const res = p.reservationId ? reservationById.get(p.reservationId) : null;
      const bookingId = (res?.bookingId ?? (p.reservation as any)?.bookingId) ?? null;
      const isGroupPayment = !!bookingId && groupByBookingId.has(bookingId);

      let amountDue: number;
      let fullySettled: boolean;
      let remainingBalance: number;
      let groupTotal: number | null = null;
      let groupRooms: string[] | null = null;

      if (isGroupPayment && bookingId) {
        const g = groupByBookingId.get(bookingId)!;
        groupTotal = g.combinedTotal;
        groupRooms = g.rooms.sort((a, b) => Number(a) - Number(b));
        const groupPaid = groupDepositTotals.get(bookingId) || 0;
        // A group deposit fully settles only when combined paid >= combined total
        fullySettled = groupTotal > 0 && groupPaid >= groupTotal;
        remainingBalance = Math.max(0, groupTotal - groupPaid);
        amountDue = groupTotal;
      } else if (p.reservationId || p.reservation) {
        const reservationTotal = Number(res?.totalAmount || p.reservation?.totalAmount || 0);
        const reservationPaid = p.reservationId ? (depositTotals.get(p.reservationId) || 0) : 0;
        fullySettled = reservationTotal > 0 && reservationPaid >= reservationTotal;
        remainingBalance = Math.max(0, reservationTotal - reservationPaid);
        amountDue = reservationTotal > 0 ? reservationTotal : Number(p.amount);
      } else if (p.folio) {
        const folioBal = Number(p.folio.balance ?? 0);
        fullySettled = folioBal <= 0.005 || p.folio.status === 'CLOSED';
        remainingBalance = fullySettled ? 0 : Math.max(0, folioBal);
        amountDue = Math.max(Number(p.amount), folioBal + Number(p.amount));
      } else {
        fullySettled = true;
        remainingBalance = 0;
        amountDue = Number(p.amount);
      }

      return {
        ...p,
        processorName: userMap.get(p.processedBy) || p.processedBy || 'System / Staff',
        fullySettled,
        amountDue,
        remainingBalance,
        groupTotal,
        groupBookingId: bookingId,
        groupRooms,
      };
    });
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

    let paymentType = data.paymentType || 'PAYMENT';
    const existing = tx.payment?.findUnique ? await tx.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } }) : null;
    if (existing) {
      if (existing.type !== paymentType) throw new AppError('This idempotency key belongs to a different transaction.', 409, 'IDEMPOTENCY_KEY_REUSED');
      return existing;
    }

    await lockBusinessDay(tx, new Date());
    await DailyCloseService.assertBusinessDayOpen(new Date());

    const targetFolio = data.folioId
      ? (tx.folio?.findUnique ? await tx.folio.findUnique({ where: { id: data.folioId } }) : { id: data.folioId, reservationId: data.reservationId, status: 'OPEN', balance: data.amount, guestId: data.guestId })
      : (tx.folio?.findFirst ? await tx.folio.findFirst({
          where: { reservationId: data.reservationId },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        }) : null);
    const reservationId = data.reservationId || targetFolio?.reservationId;
    const reservation = reservationId
      ? (tx.reservation?.findUnique ? await tx.reservation.findUnique({
          where: { id: reservationId }, include: { guests: { where: { isPrimary: true }, select: { guestId: true } } },
        }) : { id: reservationId, totalAmount: data.amount, bookingId: null as string | null, guests: [{ guestId: data.guestId || targetFolio?.guestId }] })
      : null;
    if (!reservation) throw new Error('Reservation not found.');
    if (data.folioId && targetFolio?.reservationId && targetFolio.reservationId !== reservation.id) throw new Error('The folio does not belong to the supplied reservation.');
    const expectedGuestId = targetFolio?.guestId || reservation.guests[0]?.guestId;
    if (data.guestId && expectedGuestId && data.guestId !== expectedGuestId) throw new Error('The supplied guest does not belong to this reservation.');
    if (targetFolio && targetFolio.status && targetFolio.status !== 'OPEN') {
      const folioBal = new Prisma.Decimal(targetFolio.balance || 0);
      if (folioBal.lte(0)) {
        throw new AppError('This folio is closed and has no outstanding balance.', 400, 'FOLIO_ALREADY_CLOSED');
      }
    }
    if (paymentType === 'PAYMENT' && !targetFolio) throw new Error('Open folio not found.');

    const amount = new Prisma.Decimal(data.amount);

    // Auto-classify: if the caller did not explicitly request DEPOSIT and the
    // amount is less than the outstanding folio balance, treat it as a partial
    // payment (DEPOSIT). Only a payment that exactly clears the balance keeps
    // the PAYMENT type.
    if (targetFolio) {
      const balance = new Prisma.Decimal(targetFolio.balance || 0);
      if (amount.gt(balance)) {
        throw new AppError(`Payment exceeds the outstanding folio balance of ${balance.toFixed(2)}.`, 400, 'PAYMENT_EXCEEDS_BALANCE');
      }
      if (paymentType === 'PAYMENT' && amount.lt(balance)) {
        paymentType = 'DEPOSIT';
      }
    } else {
      const groupBookingId = (reservation as any).bookingId;
      if (groupBookingId) {
        const groupRes = await tx.reservation.findMany({
          where: { bookingId: groupBookingId },
          select: { id: true, totalAmount: true },
        });
        const combinedTotal = groupRes.reduce((sum, r) => sum.plus(new Prisma.Decimal(r.totalAmount || 0)), new Prisma.Decimal(0));
        const groupResIds = groupRes.map((r) => r.id);
        const priorDeposits = await tx.payment.aggregate({
          where: { reservationId: { in: groupResIds }, type: 'DEPOSIT', status: 'COMPLETED', voidedAt: null },
          _sum: { amount: true },
        });
        if (new Prisma.Decimal(priorDeposits._sum.amount || 0).plus(amount).gt(combinedTotal)) {
          throw new AppError('Group deposit cannot exceed the combined group total amount.', 409, 'DEPOSIT_EXCEEDS_TOTAL');
        }
      } else {
        const priorDeposits = await tx.payment.aggregate({
          where: { reservationId: reservation.id, type: 'DEPOSIT', status: 'COMPLETED', voidedAt: null }, _sum: { amount: true },
        });
        if (new Prisma.Decimal(priorDeposits._sum.amount || 0).plus(amount).gt(reservation.totalAmount)) {
          throw new AppError('Deposits cannot exceed the reservation total.', 409, 'DEPOSIT_EXCEEDS_TOTAL');
        }
      }
    }

    // Resolve the settlement into one or more tender lines.  Every tender must
    // use a direct method and the tender amounts must exactly cover `amount`.
    const tenders = data.tenders?.length
      ? data.tenders
      : [{ method: data.method, amount: data.amount, reference: data.reference }];
    const tendersTotal = tenders.reduce((sum, t) => sum.plus(new Prisma.Decimal(t.amount)), new Prisma.Decimal(0));
    for (const t of tenders) {
      if (!['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'].includes(t.method)) {
        throw new AppError('Invalid payment method.', 422, 'INVALID_PAYMENT_METHOD');
      }
      if (!Number.isFinite(t.amount) || t.amount <= 0) throw new Error('Each tender amount must be greater than zero.');
    }
    if (!tendersTotal.eq(amount)) {
      throw new Error(`Tender amounts (${tendersTotal.toFixed(2)}) must equal the payment amount (${amount.toFixed(2)}).`);
    }

    // One immutable Payment ledger row per tender.  The first carries the base
    // idempotency key so a replay still short-circuits above; the rest use a
    // `key#n` suffix scoped to the same settlement.
    const createdPayments = [];
    for (let i = 0; i < tenders.length; i++) {
      const t = tenders[i];
      const p = await tx.payment.create({ data: {
        folioId: targetFolio?.id, reservationId: reservation.id,
        guestId: expectedGuestId,
        source: data.source,
        sourceId: data.sourceId,
        amount: new Prisma.Decimal(t.amount), currency: data.currency || 'GHS', method: t.method as PaymentMethod, reference: t.reference,
        idempotencyKey: i === 0 ? data.idempotencyKey : `${data.idempotencyKey}#${i}`,
        status: PaymentStatus.COMPLETED, type: paymentType as PaymentType,
        description: data.description || (paymentType === 'DEPOSIT' ? 'Part payment / deposit received' : 'Guest payment settlement'),
        processedBy: data.processedBy,
      } });
      createdPayments.push(p);
    }
    const payment = createdPayments[0];

    // Fire-and-forget: auto-record cash payments in cash register AFTER transaction commits
    const cashTenderIndices = tenders.map((t, i) => t.method === 'CASH' ? i : -1).filter(i => i !== -1);
    if (cashTenderIndices.length > 0) {
      const businessDate = new Date().toISOString().slice(0, 10);
      for (const idx of cashTenderIndices) {
        const t = tenders[idx];
        const p = createdPayments[idx];
        CashRegisterService.recordCashPayment({
          businessDate,
          amount: t.amount,
          description: p.description
            ? `${p.description} (${reservation.id.slice(0, 8).toUpperCase()})`
            : `Cash payment${paymentType === 'DEPOSIT' ? ' (deposit)' : ''} - ${reservation.id}`,
          source: 'FRONT_DESK',
          sourceId: p.id,
          reference: t.reference,
          processedBy: data.processedBy,
        }).catch((err) => console.error('Failed to record cash payment in cash register:', err));
      }
    }

    if (targetFolio) {
      const reservationStatus = (reservation as { status?: string }).status;
      const isCheckedOutGuest = reservationStatus === 'CHECKED_OUT';
      const tenderLabel = tenders.map(t => `${t.method} ${new Prisma.Decimal(t.amount).toFixed(2)}${t.reference ? ` · ${t.reference}` : ''}`).join(', ');
      const purposeTag = data.description ? ` — For: ${data.description}` : '';
      await tx.folioItem.create({ data: {
        folioId: targetFolio.id, type: paymentType === 'DEPOSIT' ? 'DEPOSIT' : 'PAYMENT',
        description: `${paymentType === 'DEPOSIT' ? 'Deposit / Part payment collected' : 'Payment received'} (${tenderLabel})${purposeTag}${isCheckedOutGuest ? ' — Post-checkout settlement' : ''}`,
        amount: amount.negated(), quantity: 1, unitPrice: amount.negated(), department: 'FRONT_DESK',
        referenceId: payment.id, referenceType: 'PAYMENT', postedBy: data.processedBy,
      } });
      const currentBal = new Prisma.Decimal(targetFolio.balance || 0);
      const newBal = currentBal.minus(amount);
      const isSettled = newBal.lte(0.005);
      const folioClosedAt = (targetFolio as { closedAt?: Date | null }).closedAt;
      await tx.folio.update({
        where: { id: targetFolio.id },
        data: {
          balance: { decrement: amount },
          ...(isCheckedOutGuest && isSettled ? { status: FolioStatus.CLOSED, closedAt: folioClosedAt || new Date() } : {}),
        },
      });
      if (isCheckedOutGuest && tx.checkOut?.findUnique) {
        const existingCheckOut = await tx.checkOut.findUnique({ where: { reservationId: reservation.id } });
        if (existingCheckOut) {
          await tx.checkOut.update({
            where: { id: existingCheckOut.id },
            data: { finalBalance: Prisma.Decimal.max(new Prisma.Decimal(0), newBal) },
          });
        }
      }
    }
    await AuditService.logInTransaction(tx, {
      userId: data.processedBy, action: 'payment.created', resource: 'payment', resourceId: payment.id,
      afterData: { folioId: targetFolio?.id, reservationId: reservation.id, amount: amount.toString(), method: data.method, tenders: tenders.map(t => ({ method: t.method, amount: t.amount })), type: paymentType },
    });
    return payment;
  }

  static async processPayment(data: ProcessPaymentDTO) {
    const paymentType = data.paymentType || 'PAYMENT';
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (existing) {
      // Accept if types match OR if the stored type is DEPOSIT and caller sent PAYMENT
      // (the auto-downgrade path — amount was less than balance inside the tx).
      const compatibleTypes = existing.type === paymentType || (paymentType === 'PAYMENT' && existing.type === 'DEPOSIT');
      if (!compatibleTypes) throw new AppError('This idempotency key belongs to a different transaction.', 409, 'IDEMPOTENCY_KEY_REUSED');
      return existing;
    }
    try {
      return await prisma.$transaction(async (tx) => this.processPaymentInTx(tx, data), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).then((payment) => {
        const totalAmount = data.tenders?.length
          ? data.tenders.reduce((sum, t) => sum + t.amount, 0)
          : Number(payment.amount);
        const methodLabel = data.tenders?.length
          ? data.tenders.map((t) => String(t.method || '—').replace('_', ' ')).join(' + ')
          : String(payment.method || '—').replace('_', ' ');
        const isPartPayment = payment.type === 'DEPOSIT';
        NotificationService.notifyStaff(
          [PERMISSIONS.PAYMENTS_VIEW],
          {
            type: 'PAYMENT',
            title: isPartPayment ? 'Part payment / deposit received' : 'Payment received',
            message: `GHS ${totalAmount.toFixed(2)} via ${methodLabel}${payment.reference ? ` · ${payment.reference}` : ''}`,
            priority: 'MEDIUM',
            data: { paymentId: payment.id, reservationId: payment.reservationId, amount: totalAmount.toString(), method: methodLabel },
          },
          data.processedBy,
        );
        return payment;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const duplicate = await prisma.payment.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
        if (duplicate && (duplicate.type === paymentType || (paymentType === 'PAYMENT' && duplicate.type === 'DEPOSIT'))) return duplicate;
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
   *
   * Single payments are refused when financially materialized: posted to a guest
   * folio, referenced by a refund, settling a POS order, or inside a business day
   * that has already been closed. Refunds are only deleted as a *pair* together
   * with the payment they reversed (see deleteRefundPair), so removing the
   * reversal can never silently resurrect a "paid" amount or leave an orphan.
   */
  static async deletePayment(paymentId: string, deletedBy: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        refunds: { select: { id: true } },
        originalPayment: { include: { refunds: { select: { id: true } } } },
      },
    });
    if (!payment) throw new AppError('Payment record not found.', 404, 'PAYMENT_NOT_FOUND');

    if (payment.type === 'REFUND') return this.deleteRefundPayment(payment, deletedBy);

    if (payment.refunds.length > 0) {
      throw new AppError('Cannot delete this payment — a refund references it. Delete the refund instead, which removes both records together.', 409, 'PAYMENT_HAS_REFUNDS');
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
          throw new AppError('Cannot delete this payment — a refund references it. Delete the refund instead, which removes both records together.', 409, 'PAYMENT_HAS_REFUNDS');
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

  /**
   * Admin-only deletion of a refund payment record regardless of folio posting,
   * business day status, or POS linkages.
   * Cleans up any associated refund folio items, reconciles the folio balance,
   * restores the original payment's status on the ledger, and permanently removes the refund.
   */
  private static async deleteRefundPayment(refund: any, deletedBy: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Fetch latest refund record with relations inside transaction
        const latestRefund = await tx.payment.findUnique({
          where: { id: refund.id },
          include: {
            originalPayment: {
              include: {
                refunds: { where: { id: { not: refund.id }, status: 'COMPLETED', voidedAt: null } },
              },
            },
          },
        });
        if (!latestRefund) throw new AppError('Refund record not found.', 404, 'PAYMENT_NOT_FOUND');

        const original = latestRefund.originalPayment;

        // 2. Remove or void any FolioItem associated with this refund
        const targetFolioId = latestRefund.folioId || original?.folioId;
        if (targetFolioId) {
          // Delete any folio item referencing this refund
          await tx.folioItem.deleteMany({
            where: {
              folioId: targetFolioId,
              OR: [
                { referenceId: latestRefund.id },
                { id: latestRefund.id },
                { description: { contains: latestRefund.id } },
              ],
            },
          });

          // Live recalculation of the folio balance from remaining ledger items
          const itemsSum = await tx.folioItem.aggregate({
            where: { folioId: targetFolioId, voidedAt: null },
            _sum: { amount: true },
          });
          const recalculatedBalance = new Prisma.Decimal(itemsSum._sum.amount || 0);
          await tx.folio.update({
            where: { id: targetFolioId },
            data: { balance: recalculatedBalance },
          });
        }

        // 3. Restore original payment status
        if (original) {
          const otherCompletedRefunds = original.refunds || [];
          const totalOtherRefunded = otherCompletedRefunds.reduce(
            (sum, r) => sum.plus(new Prisma.Decimal(r.amount)),
            new Prisma.Decimal(0),
          );

          let newStatus: PaymentStatus = PaymentStatus.COMPLETED;
          if (totalOtherRefunded.gte(new Prisma.Decimal(original.amount))) {
            newStatus = PaymentStatus.REFUNDED;
          } else if (totalOtherRefunded.gt(0)) {
            newStatus = PaymentStatus.PARTIALLY_REFUNDED;
          }

          await tx.payment.update({
            where: { id: original.id },
            data: { status: newStatus },
          });
        }

        // 4. Audit Log
        await AuditService.logInTransaction(tx, {
          userId: deletedBy,
          action: 'payment.refund_deleted_by_admin',
          resource: 'payment',
          resourceId: latestRefund.id,
          beforeData: {
            id: latestRefund.id,
            amount: latestRefund.amount.toString(),
            method: latestRefund.method,
            status: latestRefund.status,
            type: latestRefund.type,
            reference: latestRefund.reference || null,
            originalPaymentId: latestRefund.originalPaymentId || null,
            folioId: latestRefund.folioId || null,
            description: latestRefund.description || null,
            processedAt: latestRefund.processedAt.toISOString(),
          },
        });

        // 5. Delete the refund record
        await tx.payment.delete({ where: { id: latestRefund.id } });

        return {
          id: latestRefund.id,
          type: 'REFUND',
          amount: latestRefund.amount,
          method: latestRefund.method,
          restoredOriginalPaymentId: original?.id || null,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2003') {
        throw new AppError('Cannot delete this refund — it is still referenced by other database records.', 409, 'PAYMENT_IN_USE');
      }
      throw error;
    }
  }

  /**
   * Correct a payment amount and/or method when staff made a data entry mistake.
   * Adjusts the Payment record, the linked FolioItem credit, re-balances the Folio,
   * updates the CheckOut finalBalance if checked out, and writes a full audit trail.
   */
  static async correctPayment(
    paymentId: string,
    data: { amount: number; method?: string; reason?: string; correctedBy: string },
  ) {
    const newAmount = Number(data.amount);
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      throw new AppError('The corrected payment amount must be a positive number greater than zero.', 422, 'INVALID_AMOUNT');
    }

    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          refunds: { where: { status: 'COMPLETED' }, select: { amount: true } },
        },
      });

      if (!payment) {
        throw new AppError('Payment record not found.', 404, 'PAYMENT_NOT_FOUND');
      }

      if (payment.type === 'REFUND') {
        throw new AppError('Cannot edit refund transactions directly. Adjust the original payment or delete the refund.', 422, 'CANNOT_EDIT_REFUND');
      }

      // Check refunds limit
      const totalRefunded = payment.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
      if (newAmount < totalRefunded) {
        throw new AppError(
          `Corrected amount (GHS ${newAmount.toFixed(2)}) cannot be less than the GHS ${totalRefunded.toFixed(2)} already refunded from this payment.`,
          422,
          'AMOUNT_LESS_THAN_REFUNDS',
        );
      }

      const oldAmount = Number(payment.amount);
      const oldMethod = payment.method;
      const newMethod =
        data.method && Object.values(PaymentMethod).includes(data.method as any)
          ? (data.method as PaymentMethod)
          : payment.method;
      const reason = data.reason?.trim() || 'Entry mistake correction';

      // 1. Update Payment record
      const correctionTag = ` [Corrected from GHS ${oldAmount.toFixed(2)} to GHS ${newAmount.toFixed(2)}: ${reason}]`;
      const cleanDesc = payment.description
        ? payment.description.replace(/ \[Corrected from GHS [^\]]+\]/g, '')
        : '';
      const updatedDescription = `${cleanDesc}${correctionTag}`.trim();

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          amount: new Prisma.Decimal(newAmount),
          method: newMethod,
          description: updatedDescription,
        },
      });

      // 2. Update linked FolioItem(s)
      await tx.folioItem.updateMany({
        where: {
          referenceId: paymentId,
          referenceType: 'PAYMENT',
        },
        data: {
          amount: new Prisma.Decimal(newAmount).negated(),
          unitPrice: new Prisma.Decimal(newAmount).negated(),
        },
      });

      // 3. Recalculate and update Folio balance if attached to a folio
      let folioBalance = 0;
      if (payment.folioId) {
        const ledger = await tx.folioItem.aggregate({
          where: { folioId: payment.folioId, voidedAt: null },
          _sum: { amount: true },
        });
        const rawBal = Number(ledger._sum.amount || 0);
        folioBalance = Math.max(0, Number(rawBal.toFixed(2)));
        const isSettled = folioBalance <= 0.005;

        await tx.folio.update({
          where: { id: payment.folioId },
          data: {
            balance: new Prisma.Decimal(folioBalance),
            ...(isSettled
              ? { status: FolioStatus.CLOSED, closedAt: new Date() }
              : { status: FolioStatus.OPEN, closedAt: null }),
          },
        });
      }

      // 4. Update CheckOut finalBalance if guest already checked out
      if (payment.reservationId) {
        const checkOut = await tx.checkOut.findUnique({
          where: { reservationId: payment.reservationId },
        });
        if (checkOut) {
          await tx.checkOut.update({
            where: { id: checkOut.id },
            data: {
              finalBalance: new Prisma.Decimal(folioBalance),
            },
          });
        }
      }

      // 5. Audit Log
      await AuditService.logInTransaction(tx, {
        userId: data.correctedBy,
        action: 'payment.corrected',
        resource: 'payment',
        resourceId: paymentId,
        beforeData: {
          amount: oldAmount,
          method: oldMethod,
          description: payment.description,
        },
        afterData: {
          amount: newAmount,
          method: newMethod,
          reason,
          folioBalance,
        },
      });

      return updatedPayment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
