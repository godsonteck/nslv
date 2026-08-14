// ============================================
// NS LUXURY VILLA — Expense Service
// Records, approves and reports operational expenses
// ============================================

import { prisma } from '../config';
import { randomBytes } from 'node:crypto';
import { AuditService } from './audit.service';
import { CategoryService } from './categories.service';
import { DailyCloseService } from './daily-close.service';

const makeExpenseNo = () => `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;

export class ExpenseService {
  static async listExpenses(filters?: { status?: string; category?: string; search?: string; startDate?: string; endDate?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;
    if (filters?.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { vendor: { contains: filters.search, mode: 'insensitive' } },
        { expenseNo: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.startDate || filters?.endDate) {
      where.incurredOn = {};
      if (filters?.startDate) where.incurredOn.gte = new Date(filters.startDate);
      if (filters?.endDate) where.incurredOn.lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { incurredOn: 'desc' } }),
      prisma.expense.count({ where }),
    ]);
    return { items, total };
  }

  static async createExpense(input: { category: string; description: string; amount: number; incurredOn?: string; paymentMethod?: string; vendor?: string; receiptRef?: string; notes?: string }, createdBy: string) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Expense amount must be greater than zero.');
    if (!input.description?.trim()) throw new Error('Expense description is required.');

    await CategoryService.assertConfiguredValue('EXPENDITURE', input.category);

    const incurredOn = input.incurredOn ? new Date(input.incurredOn) : new Date();
    await DailyCloseService.assertBusinessDayOpen(incurredOn);
    const expense = await prisma.expense.create({
      data: {
        expenseNo: makeExpenseNo(),
        category: input.category,
        description: input.description.trim(),
        amount,
        incurredOn,
        paymentMethod: input.paymentMethod,
        vendor: input.vendor,
        receiptRef: input.receiptRef,
        notes: input.notes,
        createdBy,
      },
    });
    await AuditService.log({ userId: createdBy, action: 'expense.created', resource: 'expense', resourceId: expense.id, afterData: expense as unknown as Record<string, unknown> });
    return expense;
  }

  static async updateExpense(id: string, input: Partial<{ category: string; description: string; amount: number; incurredOn?: string; paymentMethod?: string; vendor?: string; receiptRef?: string; notes?: string }>, updatedBy: string) {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new Error('Expense not found.');
    if (existing.status === 'APPROVED') throw new Error('Approved expenses cannot be edited.');
    await DailyCloseService.assertBusinessDayOpen(input.incurredOn ? new Date(input.incurredOn) : existing.incurredOn);
    if (input.category) await CategoryService.assertConfiguredValue('EXPENDITURE', input.category);

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        category: input.category,
        description: input.description,
        amount: input.amount !== undefined ? Number(input.amount) : undefined,
        incurredOn: input.incurredOn ? new Date(input.incurredOn) : undefined,
        paymentMethod: input.paymentMethod,
        vendor: input.vendor,
        receiptRef: input.receiptRef,
        notes: input.notes,
      },
    });
    await AuditService.log({ userId: updatedBy, action: 'expense.updated', resource: 'expense', resourceId: id, beforeData: existing as unknown as Record<string, unknown>, afterData: expense as unknown as Record<string, unknown> });
    return expense;
  }

  static async setStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED', approvedBy: string) {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new Error('Expense not found.');
    if (existing.status === 'APPROVED') throw new Error('Approved expenses are immutable. Record a correcting expense instead.');
    await DailyCloseService.assertBusinessDayOpen(existing.incurredOn);

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        status,
        approvedBy: status === 'APPROVED' ? approvedBy : null,
        approvedAt: status === 'APPROVED' ? new Date() : null,
      },
    });
    await AuditService.log({ userId: approvedBy, action: `expense.${status.toLowerCase()}`, resource: 'expense', resourceId: id, beforeData: existing as unknown as Record<string, unknown>, afterData: expense as unknown as Record<string, unknown> });
    return expense;
  }

  static async deleteExpense(id: string, deletedBy: string) {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new Error('Expense not found.');
    if (existing.status === 'APPROVED') throw new Error('Approved expenses cannot be deleted.');
    await DailyCloseService.assertBusinessDayOpen(existing.incurredOn);

    await prisma.expense.delete({ where: { id } });
    await AuditService.log({ userId: deletedBy, action: 'expense.deleted', resource: 'expense', resourceId: id, beforeData: existing as unknown as Record<string, unknown> });
    return { id, deleted: true };
  }
}
