// ============================================
// NS LUXURY VILLA — Cash Register / Float Service
// Tracks daily opening cash, inflows, and outflows for front desk
// ============================================

import { prisma } from '../config';
import { CashEntryType, Prisma } from '@prisma/client';
import { AppError } from '../middleware/error';
import { AuditService } from './audit.service';
import { CategoryService } from './categories.service';

export class CashRegisterService {
  static async getOrCreateRegister(businessDate: string) {
    const date = new Date(`${businessDate.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new AppError('Invalid business date.', 422, 'INVALID_DATE');

    const existing = await prisma.cashRegister.findUnique({ where: { businessDate: date } });
    if (existing) return existing;

    return prisma.cashRegister.create({
      data: { businessDate: date, openingCash: 0 },
    });
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

  static async addEntry(input: {
    businessDate: string;
    type: 'INFLOW' | 'OUTFLOW';
    amount: number;
    description: string;
    category?: string;
    recipient?: string;
    receiptRef?: string;
  }, userId: string) {
    const date = new Date(`${input.businessDate.slice(0, 10)}T00:00:00.000Z`);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Amount must be greater than zero.', 422, 'INVALID_AMOUNT');
    if (!input.description?.trim()) throw new AppError('Description is required.', 422, 'DESCRIPTION_REQUIRED');
    if (input.type === 'OUTFLOW' && !input.category?.trim()) throw new AppError('Category is required for outflows.', 422, 'CATEGORY_REQUIRED');

    if (input.category) await CategoryService.assertConfiguredValue('CASH_REGISTER', input.category);

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
    const register = await this.listEntries(businessDate);
    if (!register) return null;

    const opening = register.openingCash.toNumber();
    let inflows = 0;
    let outflows = 0;
    const byCategory: Record<string, number> = {};

    for (const e of register.entries) {
      const amt = e.amount.toNumber();
      if (e.type === 'OPENING') continue;
      if (e.type === 'INFLOW') inflows += amt;
      if (e.type === 'OUTFLOW') {
        outflows += amt;
        const cat = e.category || 'UNCATEGORIZED';
        byCategory[cat] = (byCategory[cat] || 0) + amt;
      }
    }

    return {
      businessDate: register.businessDate,
      openingCash: opening,
      inflows,
      outflows,
      netCash: opening + inflows - outflows,
      entries: register.entries,
      byCategory,
    };
  }

  static async deleteEntry(entryId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.cashRegisterEntry.findUnique({ where: { id: entryId } });
      if (!entry) throw new AppError('Entry not found.', 404, 'NOT_FOUND');
      if (entry.type === 'OPENING') throw new AppError('Cannot delete opening entry. Reset opening cash instead.', 422, 'CANNOT_DELETE_OPENING');

      await CashRegisterService.lockRegister(tx, entry.cashRegisterId ? (await tx.cashRegister.findUnique({ where: { id: entry.cashRegisterId }, select: { businessDate: true } }))?.businessDate || new Date() : new Date());

      await tx.cashRegisterEntry.delete({ where: { id: entryId } });
      await AuditService.logInTransaction(tx, { userId, action: 'cash_register.entry_deleted', resource: 'cash_register_entry', resourceId: entryId });
      return { id: entryId, deleted: true };
    });
  }

  private static async lockRegister(tx: { $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> }, date: Date) {
    if (tx.$executeRaw) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${date.toISOString()}))`;
  }
}
