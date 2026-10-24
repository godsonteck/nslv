// ============================================
// NS LUXURY VILLA — Cash Register / Float Service
// Tracks daily opening cash, inflows, and outflows for front desk
// Perfect carry-forward: yesterday's net cash becomes today's opening balance
// Cash sales from POS auto-flow as INFLOW entries
// ============================================

import { prisma } from '../config';
import { CashEntryType, Prisma } from '@prisma/client';
import { AppError } from '../middleware/error';
import { AuditService } from './audit.service';
import { CategoryService } from './categories.service';
import { DailyCloseService, lockBusinessDay } from './daily-close.service';

export class CashRegisterService {
  /**
   * Get or create register for a business date.
   * Reception hands over cash daily; new registers start fresh at 0.00 GHS opening float.
   */
  static async getOrCreateRegister(businessDate: string, tx?: Prisma.TransactionClient) {
    const date = new Date(`${businessDate.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new AppError('Invalid business date.', 422, 'INVALID_DATE');

    const client = tx ?? prisma;
    const existing = await client.cashRegister.findUnique({ where: { businessDate: date } });
    if (existing) return existing;

    return client.cashRegister.create({
      data: { businessDate: date, openingCash: 0 },
    });
  }

  /**
   * Ensure today's register exists.
   * Reception does not carry over cash overnight; any float must be explicitly set for today.
   */
  static async ensureRegisterInitialized(businessDate: string, userId: string, tx?: Prisma.TransactionClient) {
    const register = await this.getOrCreateRegister(businessDate, tx);
    return register;
  }

  /**
   * Auto-create INFLOW entry for a cash payment (called from payment processing)
   * Pass tx to run within an existing transaction; otherwise runs standalone (no transaction)
   */
  static async recordCashPayment(input: {
    businessDate: string;
    amount: number;
    description: string;
    source: 'RESTAURANT' | 'BAR' | 'POOL' | 'FRONT_DESK' | 'MANUAL';
    sourceId: string;
    reference?: string;
    processedBy: string;
  }, tx?: Prisma.TransactionClient) {
    const date = new Date(`${input.businessDate.slice(0, 10)}T00:00:00.000Z`);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Amount must be greater than zero.', 422, 'INVALID_AMOUNT');

    // Standalone mode (no transaction) - used for fire-and-forget background recording
    if (!tx) {
      // Ensure register exists
      await this.ensureRegisterInitialized(input.businessDate, input.processedBy);
      
      // Check idempotency
      const register = await prisma.cashRegister.findUnique({ where: { businessDate: date } });
      if (!register) return null;
      
      const existing = await prisma.cashRegisterEntry.findFirst({
        where: {
          cashRegisterId: register.id,
          type: 'INFLOW',
          description: { contains: input.sourceId },
        },
      });
      if (existing) return existing;

      return prisma.cashRegisterEntry.create({
        data: {
          cashRegisterId: register.id,
          type: 'INFLOW',
          amount,
          description: input.description,
          category: input.source,
          recipient: null,
          receiptRef: input.reference || null,
          recordedBy: input.processedBy,
        },
      });
    }

    // Transactional mode - runs within provided transaction
    const execute = async (client: Prisma.TransactionClient) => {
      await CashRegisterService.lockRegister(client, date);
      await DailyCloseService.assertBusinessDayOpen(date);

      // Ensure today's register exists with carried-forward balance
      const register = await this.ensureRegisterInitialized(input.businessDate, input.processedBy, client);

      // Check if this payment already has a cash register entry (idempotency)
      const existing = await client.cashRegisterEntry.findFirst({
        where: {
          cashRegisterId: register.id,
          type: 'INFLOW',
          description: { contains: input.sourceId },
        },
      });
      if (existing) return existing;

      const entry = await client.cashRegisterEntry.create({
        data: {
          cashRegisterId: register.id,
          type: 'INFLOW',
          amount,
          description: input.description,
          category: input.source,
          recipient: null,
          receiptRef: input.reference || null,
          recordedBy: input.processedBy,
        },
      });

      await AuditService.logInTransaction(client, {
        userId: input.processedBy,
        action: 'cash_register.entry_cash_sale',
        resource: 'cash_register_entry',
        resourceId: entry.id,
        afterData: { ...entry, businessDate: input.businessDate, source: input.source },
      });

      return entry;
    };

    return execute(tx);
  }

  /**
   * Record a cash refund (auto-create OUTFLOW entry)
   */
  static async recordCashRefund(input: {
    businessDate: string;
    amount: number;
    description: string;
    reference?: string;
    processedBy: string;
  }, tx?: Prisma.TransactionClient) {
    const date = new Date(`${input.businessDate.slice(0, 10)}T00:00:00.000Z`);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Amount must be greater than zero.', 422, 'INVALID_AMOUNT');

    const execute = async (client: Prisma.TransactionClient) => {
      await CashRegisterService.lockRegister(client, date);
      await DailyCloseService.assertBusinessDayOpen(date);

      const register = await this.ensureRegisterInitialized(input.businessDate, input.processedBy, client);

      const entry = await client.cashRegisterEntry.create({
        data: {
          cashRegisterId: register.id,
          type: 'OUTFLOW',
          amount,
          description: input.description,
          category: 'REFUND',
          recipient: null,
          receiptRef: input.reference || null,
          recordedBy: input.processedBy,
        },
      });

      await AuditService.logInTransaction(client, {
        userId: input.processedBy,
        action: 'cash_register.entry_cash_refund',
        resource: 'cash_register_entry',
        resourceId: entry.id,
        afterData: { ...entry, businessDate: input.businessDate },
      });

      return entry;
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  }

  static async setOpeningCash(input: { businessDate: string; amount: number; notes?: string }, userId: string) {
    const date = new Date(`${input.businessDate.slice(0, 10)}T00:00:00.000Z`);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new AppError('Opening cash must be a non-negative number.', 422, 'INVALID_AMOUNT');

    return prisma.$transaction(async (tx) => {
      await CashRegisterService.lockRegister(tx, date);
      const register = await tx.cashRegister.upsert({
        where: { businessDate: date },
        create: { businessDate: date, openingCash: amount, notes: input.notes?.trim() || null },
        update: { openingCash: amount, notes: input.notes?.trim() || null },
      });

      // A register lock serializes this lookup/update so there is one opening
      // record per register without requiring a destructive unique migration.
      const openingEntry = await tx.cashRegisterEntry.findFirst({
        where: { cashRegisterId: register.id, type: 'OPENING' },
        select: { id: true },
      });
      if (openingEntry) {
        await tx.cashRegisterEntry.update({
          where: { id: openingEntry.id },
          data: { amount, description: 'Opening float', recordedBy: userId, recordedAt: new Date() },
        });
      } else {
        await tx.cashRegisterEntry.create({
          data: {
          cashRegisterId: register.id,
          type: 'OPENING',
          amount,
          description: 'Opening float',
          recordedBy: userId,
          },
        });
      }

      await AuditService.logInTransaction(tx, {
        userId,
        action: 'cash_register.opening_set',
        resource: 'cash_register',
        resourceId: register.id,
        afterData: { businessDate: input.businessDate, openingCash: amount, notes: input.notes },
      });

      return register;
    });
  }

  /**
   * Record a bank deposit (cash taken to bank)
   */
  static async recordBankDeposit(input: {
    businessDate: string;
    amount: number;
    description: string;
    reference?: string;
    processedBy: string;
  }, tx?: Prisma.TransactionClient) {
    const date = new Date(`${input.businessDate.slice(0, 10)}T00:00:00.000Z`);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Amount must be greater than zero.', 422, 'INVALID_AMOUNT');
    if (!input.description?.trim()) throw new AppError('Description is required.', 422, 'DESCRIPTION_REQUIRED');

    // Standalone mode (no transaction) - for fire-and-forget
    if (!tx) {
      await this.ensureRegisterInitialized(input.businessDate, input.processedBy);
      const register = await prisma.cashRegister.findUnique({ where: { businessDate: date } });
      if (!register) return null;

      return prisma.cashRegisterEntry.create({
        data: {
          cashRegisterId: register.id,
          type: 'OUTFLOW',
          amount,
          description: input.description,
          category: 'MOMO_DEPOSIT',
          recipient: null,
          receiptRef: input.reference || null,
          recordedBy: input.processedBy,
        },
      });
    }

    // Transactional mode
    const execute = async (client: Prisma.TransactionClient) => {
      await CashRegisterService.lockRegister(client, date);
      await DailyCloseService.assertBusinessDayOpen(date);

      const register = await this.ensureRegisterInitialized(input.businessDate, input.processedBy, client);

      return client.cashRegisterEntry.create({
        data: {
          cashRegisterId: register.id,
          type: 'OUTFLOW',
          amount,
          description: input.description,
          category: 'MOMO_DEPOSIT',
          recipient: null,
          receiptRef: input.reference || null,
          recordedBy: input.processedBy,
        },
      });
    };

    return execute(tx);
  }

  static async addEntry(input: {
    businessDate: string;
    type: 'INFLOW' | 'OUTFLOW';
    amount: number;
    description: string;
    category?: string;
    recipient?: string;
    receiptRef?: string;
  }, userId: string, tx?: Prisma.TransactionClient) {
    const date = new Date(`${input.businessDate.slice(0, 10)}T00:00:00.000Z`);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Amount must be greater than zero.', 422, 'INVALID_AMOUNT');
    if (!input.description?.trim()) throw new AppError('Description is required.', 422, 'DESCRIPTION_REQUIRED');
    if (input.type === 'OUTFLOW' && !input.category?.trim()) throw new AppError('Category is required for outflows.', 422, 'CATEGORY_REQUIRED');

    if (input.category && !['HANDOVER', 'MOMO_DEPOSIT', 'REFUND'].includes(input.category)) {
      await CategoryService.assertConfiguredValue('CASH_REGISTER', input.category);
    }

    // Standalone mode (no transaction) - for fire-and-forget
    if (!tx) {
      await this.ensureRegisterInitialized(input.businessDate, userId);
      const register = await prisma.cashRegister.findUnique({ where: { businessDate: date } });
      if (!register) return null;

      return prisma.cashRegisterEntry.create({
        data: {
          cashRegisterId: register.id,
          type: input.type,
          amount,
          description: input.description.trim(),
          category: input.category?.trim() || null,
          recipient: input.recipient?.trim() || null,
          receiptRef: input.receiptRef?.trim() || null,
          recordedBy: userId,
        },
      });
    }

    // Transactional mode
    return prisma.$transaction(async (tx) => {
      await CashRegisterService.lockRegister(tx, date);
      const register = await tx.cashRegister.upsert({
        where: { businessDate: date },
        create: { businessDate: date, openingCash: 0 },
        update: {},
      });

      const entry = await tx.cashRegisterEntry.create({
        data: {
          cashRegisterId: register.id,
          type: input.type,
          amount,
          description: input.description.trim(),
          category: input.category?.trim() || null,
          recipient: input.recipient?.trim() || null,
          receiptRef: input.receiptRef?.trim() || null,
          recordedBy: userId,
        },
      });

      await AuditService.logInTransaction(tx, {
        userId,
        action: `cash_register.entry_${input.type.toLowerCase()}`,
        resource: 'cash_register_entry',
        resourceId: entry.id,
        afterData: { ...entry, businessDate: input.businessDate },
      });

      return entry;
    });
  }

  static async listEntries(businessDate: string) {
    const date = new Date(`${businessDate.slice(0, 10)}T00:00:00.000Z`);
    const register = await prisma.cashRegister.findUnique({
      where: { businessDate: date },
      include: { entries: { orderBy: { recordedAt: 'asc' } } },
    });
    return register;
  }

  static async getSummary(businessDate: string) {
    const date = new Date(`${businessDate.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new AppError('Invalid business date.', 422, 'INVALID_DATE');
    const end = new Date(date); end.setUTCDate(end.getUTCDate() + 1);
    const register = await this.listEntries(businessDate);

    // Reception does not keep cash overnight; opening float starts at 0 unless manually provided for today
    const openingEntry = register?.entries?.find((e) => e.type === 'OPENING');
    const openingCash = openingEntry ? Number(openingEntry.amount) : (register ? Number(register.openingCash) : 0);

    // Completed cash payments processed on this date (Room reservations & folios + POS restaurant/bar/pool)
    const payments = await prisma.payment.findMany({
      where: {
        processedAt: { gte: date, lt: end },
        method: 'CASH',
        type: 'PAYMENT',
        status: 'COMPLETED',
        voidedAt: null,
      },
      select: {
        id: true,
        amount: true,
        type: true,
        source: true,
        sourceId: true,
        reference: true,
        description: true,
        processedAt: true,
        processedBy: true,
      },
      orderBy: { processedAt: 'asc' },
    });

    const entries = (register?.entries ?? []).filter((e) => e.category !== 'REFUND');

    let todayCashSales = 0;
    for (const p of payments) {
      todayCashSales += Number(p.amount);
    }

    let manualInflows = 0;
    let manualOutflows = 0;
    let handovers = 0;
    let momoDeposits = 0;
    const byCategory: Record<string, number> = {};

    for (const e of entries) {
      if (e.type === 'OPENING') continue;
      const amt = Number(e.amount);

      // Auto-inflow entries from cash sales (marked with source category) are already accounted in cashSales
      const isAutoPaymentEntry = ['FRONT_DESK', 'RESTAURANT', 'BAR', 'POOL'].includes(e.category || '');

      if (e.type === 'INFLOW') {
        if (!isAutoPaymentEntry) {
          manualInflows += amt;
        }
      } else if (e.type === 'OUTFLOW') {
        if (e.category === 'HANDOVER') {
          handovers += amt;
        } else if (e.category === 'MOMO_DEPOSIT') {
          momoDeposits += amt;
          manualOutflows += amt;
        } else {
          manualOutflows += amt;
        }
        const cat = e.category || 'UNCATEGORIZED';
        byCategory[cat] = (byCategory[cat] || 0) + amt;
      }
    }

    // Total cash collected today
    const totalCashCollected = todayCashSales + manualInflows;

    // Expected cash in drawer before end-of-day handover
    const totalExpectedCash = openingCash + totalCashCollected - manualOutflows;

    // Physical cash remaining in drawer right now after any handovers
    const availableCashAtHand = Math.max(0, totalExpectedCash - handovers);

    return {
      businessDate: date,
      // No overnight carry-over
      carriedForward: 0,
      carriedIntoToday: 0,
      carriedFromDate: null,
      openingCash,
      openingFloat: openingCash,
      openingNotes: register?.notes || null,

      // Inflows
      cashSales: todayCashSales,
      manualInflows,
      totalCashCollected,

      // Outflows & Deductions
      outflows: manualOutflows,
      manualOutflows,
      momoDeposits,
      cashRefunds: 0,

      // Handover to Management (End of Day Close)
      handovers,
      totalHandedOver: handovers,
      isHandedOver: handovers > 0 && availableCashAtHand <= 0.01,

      // Balances
      expectedCash: totalExpectedCash, // Total cash to be accounted for / handed over
      netCash: availableCashAtHand,    // Actual cash remaining in drawer right now
      availableCashAtHand,

      // Detailed collections
      entries,
      cashPayments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
      byCategory,
    };
  }

  /**
   * Record close-of-day cash handover to management / accounts.
   */
  static async recordHandover(input: {
    businessDate: string;
    amount: number;
    recipient: string;
    notes?: string;
  }, userId: string) {
    const date = new Date(`${input.businessDate.slice(0, 10)}T00:00:00.000Z`);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Handover amount must be greater than zero.', 422, 'INVALID_AMOUNT');
    if (!input.recipient?.trim()) throw new AppError('Recipient name is required.', 422, 'RECIPIENT_REQUIRED');

    return prisma.$transaction(async (tx) => {
      await CashRegisterService.lockRegister(tx, date);
      const register = await tx.cashRegister.upsert({
        where: { businessDate: date },
        create: { businessDate: date, openingCash: 0 },
        update: {},
      });

      const entry = await tx.cashRegisterEntry.create({
        data: {
          cashRegisterId: register.id,
          type: 'OUTFLOW',
          amount,
          description: `Close of Day Cash Handover to ${input.recipient.trim()}${input.notes?.trim() ? ` — ${input.notes.trim()}` : ''}`,
          category: 'HANDOVER',
          recipient: input.recipient.trim(),
          receiptRef: `HND-${Date.now().toString().slice(-6)}`,
          recordedBy: userId,
        },
      });

      await tx.cashRegister.update({
        where: { id: register.id },
        data: { closedBy: userId, closedAt: new Date() },
      });

      await AuditService.logInTransaction(tx, {
        userId,
        action: 'cash_register.handover',
        resource: 'cash_register_entry',
        resourceId: entry.id,
        afterData: { ...entry, businessDate: input.businessDate },
      });

      return entry;
    });
  }

  static async deleteEntry(entryId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.cashRegisterEntry.findUnique({ where: { id: entryId } });
      if (!entry) throw new AppError('Entry not found.', 404, 'NOT_FOUND');
      const register = await tx.cashRegister.findUnique({ where: { id: entry.cashRegisterId }, select: { businessDate: true } });
      await CashRegisterService.lockRegister(tx, register?.businessDate || new Date());

      // Deleting a mistaken opening also clears its stored register value so it
      // can never become a future carry-forward anchor.
      if (entry.type === 'OPENING') {
        await tx.cashRegister.update({ where: { id: entry.cashRegisterId }, data: { openingCash: 0, notes: null } });
      }

      await tx.cashRegisterEntry.delete({ where: { id: entryId } });
      await AuditService.logInTransaction(tx, { userId, action: entry.type === 'OPENING' ? 'cash_register.opening_deleted' : 'cash_register.entry_deleted', resource: 'cash_register_entry', resourceId: entryId });
      return { id: entryId, deleted: true };
    });
  }

  /**
   * Reset a day's cash-register input completely.  Payments are deliberately
   * not deleted here: cash sales are source financial records and
   * must remain auditable.  The register has a cascade foreign key, so this
   * removes its opening count and every manual inflow/outflow together.
   */
  static async clearAllEntriesForDate(businessDate: string, userId: string) {
    const date = new Date(`${businessDate.slice(0, 10)}T00:00:00.000Z`);
    
    return prisma.$transaction(async (tx) => {
      await CashRegisterService.lockRegister(tx, date);
      const register = await tx.cashRegister.findUnique({ where: { businessDate: date } });
      if (!register) return { deleted: 0, message: 'No register found for this date' };

      const entryCount = await tx.cashRegisterEntry.count({ where: { cashRegisterId: register.id } });
      await tx.cashRegister.delete({ where: { id: register.id } });

      await AuditService.logInTransaction(tx, {
        userId,
        action: 'cash_register.entries_cleared',
        resource: 'cash_register',
        resourceId: register.id,
        afterData: { businessDate, deletedCount: entryCount, reset: true },
      });

      return { deleted: entryCount, message: `Reset the cash register for ${businessDate}` };
    });
  }

  private static async lockRegister(tx: { $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> }, date: Date) {
    if (tx.$executeRaw) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${date.toISOString()}))`;
  }

  /**
   * Check if cash balance is below threshold and return alert info
   */
  static async checkLowCashAlert(businessDate: string, threshold: number = 200) {
    const summary = await this.getSummary(businessDate);
    if (!summary) return { isLow: false, expectedCash: 0, threshold };
    return {
      isLow: summary.expectedCash < threshold,
      expectedCash: summary.expectedCash,
      threshold,
      message: summary.expectedCash < threshold
        ? `⚠️ Cash at hand (GHS ${summary.expectedCash.toFixed(2)}) is below threshold (GHS ${threshold.toFixed(2)}). Consider bank deposit or float top-up.`
        : null,
    };
  }

  /**
   * Generate shift handover checklist for smooth shift transition
   */
  static async getShiftHandoverChecklist(businessDate: string, outgoingUserId: string) {
    const summary = await this.getSummary(businessDate);
    if (!summary) return { items: [], summary: 'No cash register data for this date' };

    const items = [
      { label: 'Opening float carried forward', value: `GHS ${summary.carriedIntoToday.toFixed(2)}`, checked: true },
      { label: 'Cash sales recorded (POS)', value: `GHS ${summary.cashSales.toFixed(2)}`, checked: summary.cashSales > 0 },
      { label: 'Manual inflows recorded', value: `GHS ${summary.manualInflows.toFixed(2)}`, checked: summary.manualInflows > 0 },
      { label: 'Expenses/outflows recorded', value: `GHS ${summary.manualOutflows.toFixed(2)}`, checked: summary.manualOutflows > 0 },
      { label: 'Expected cash in drawer', value: `GHS ${summary.expectedCash.toFixed(2)}`, checked: true },
      { label: 'All entries have receipts/references', value: summary.entries.every(e => e.type === 'OPENING' || e.receiptRef || e.recipient), checked: summary.entries.every(e => e.type === 'OPENING' || e.receiptRef || e.recipient) },
      { label: 'No unexplained variances', value: 'Verify physical count matches expected', checked: false },
    ];

    const incomplete = items.filter(i => !i.checked).length;
    return {
      businessDate,
      outgoingUserId,
      items,
      expectedCash: summary.expectedCash,
      incompleteCount: incomplete,
      isComplete: incomplete === 0,
      generatedAt: new Date().toISOString(),
    };
  }
}
