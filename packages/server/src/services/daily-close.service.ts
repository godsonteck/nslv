import { Prisma } from '@prisma/client';
import { prisma } from '../config';
import { AppError } from '../middleware/error';
import { AuditService } from './audit.service';

const dayRange = (value: string) => {
  const start = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) throw new AppError('Invalid business date.', 422, 'INVALID_DATE');
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

/** PostgreSQL transaction advisory lock, scoped to one UTC business date. */
export async function lockBusinessDay(tx: { $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> }, value: Date | string) {
  const { start } = dayRange(typeof value === 'string' ? value : value.toISOString());
  // The test doubles do not expose raw SQL; PostgreSQL clients always do.
  if (tx.$executeRaw) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${start.toISOString()}))`;
  return start;
}

export class DailyCloseService {
  static async assertBusinessDayOpen(value: Date | string) {
    const { start } = dayRange(typeof value === 'string' ? value : value.toISOString());
    const closed = prisma.dailyClose?.findUnique ? await prisma.dailyClose.findUnique({ where: { businessDate: start }, select: { id: true } }) : null;
    if (closed) throw new AppError('This business day is closed; record a correcting entry on an open day instead.', 409, 'BUSINESS_DAY_CLOSED');
  }

  static async preview(businessDate: string, openingCash: number) {
    const { start, end } = dayRange(businessDate);
    const cashWhere = { processedAt: { gte: start, lt: end }, method: 'CASH', status: 'COMPLETED', voidedAt: null };
    const [payments, refunds, expenses] = await Promise.all([
      prisma.payment.aggregate({ where: { ...cashWhere, type: 'PAYMENT' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { ...cashWhere, type: 'REFUND' }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { incurredOn: { gte: start, lt: end }, paymentMethod: 'CASH', status: 'APPROVED' }, _sum: { amount: true } }),
    ]);
    const opening = new Prisma.Decimal(openingCash);
    const cashPayments = new Prisma.Decimal(payments._sum.amount || 0);
    const cashRefunds = new Prisma.Decimal(refunds._sum.amount || 0);
    const cashExpenses = new Prisma.Decimal(expenses._sum.amount || 0);
    const expectedCash = opening.plus(cashPayments).minus(cashRefunds).minus(cashExpenses);
    return { businessDate: start, openingCash: opening, cashPayments, cashRefunds, cashExpenses, expectedCash };
  }

  static async close(input: { businessDate: string; openingCash: number; actualCash: number; varianceNote?: string }, closedBy: string) {
    const preview = await this.preview(input.businessDate, input.openingCash);
    const actualCash = new Prisma.Decimal(input.actualCash);
    const variance = actualCash.minus(preview.expectedCash);
    if (!variance.isZero() && !input.varianceNote?.trim()) throw new AppError('A variance explanation is required.', 422, 'VARIANCE_NOTE_REQUIRED');
    try {
      return await prisma.$transaction(async (tx) => {
        await lockBusinessDay(tx, input.businessDate);
        // Recalculate after acquiring the lock. Settlement/refund/expense
        // writers acquire this same lock before their closed-day check.
        const lockedPreview = await this.preview(input.businessDate, input.openingCash);
        const lockedActualCash = new Prisma.Decimal(input.actualCash);
        const lockedVariance = lockedActualCash.minus(lockedPreview.expectedCash);
        if (!lockedVariance.isZero() && !input.varianceNote?.trim()) throw new AppError('A variance explanation is required.', 422, 'VARIANCE_NOTE_REQUIRED');
        const existing = await tx.dailyClose.findUnique({ where: { businessDate: preview.businessDate } });
        if (existing) throw new AppError('This business day is already closed.', 409, 'DAY_ALREADY_CLOSED');
        const result = await tx.dailyClose.create({ data: { ...lockedPreview, actualCash: lockedActualCash, variance: lockedVariance, varianceNote: lockedVariance.isZero() ? null : input.varianceNote!.trim(), closedBy } });
        await AuditService.logInTransaction(tx, { userId: closedBy, action: 'daily_close.created', resource: 'daily_close', resourceId: result.id, afterData: { businessDate: input.businessDate, expectedCash: lockedPreview.expectedCash.toString(), actualCash: lockedActualCash.toString(), variance: lockedVariance.toString() } });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034' || (error as { code?: string }).code === 'P2002') throw new AppError('This business day was closed concurrently. Refresh and retry.', 409, 'DAY_CLOSE_CONFLICT');
      throw error;
    }
  }
}
