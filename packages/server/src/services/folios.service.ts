// ============================================
// NS LUXURY VILLA — Folio Service
// Central Folio charges, items, and balance calculation
// ============================================

import { prisma } from '../config';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/error';

export const FOLIO_CHARGE_TYPES = ['ACCOMMODATION', 'RESTAURANT', 'BAR', 'POOL', 'SERVICE', 'DISCOUNT', 'TAX'] as const;

export interface AddFolioChargeDTO {
  folioId: string;
  type: string; // ACCOMMODATION | RESTAURANT | BAR | POOL | SERVICE | DISCOUNT | TAX
  description: string;
  amount: number;
  quantity?: number;
  unitPrice: number;
  department: string;
  referenceId?: string;
  referenceType?: string;
  postedBy: string;
}

export class FolioService {
  /** Derive the balance from posted, non-voided ledger items; never trust the cache alone. */
  static async calculateFolioBalance(folioId: string): Promise<Prisma.Decimal> {
    const result = await prisma.folioItem.aggregate({
      where: { folioId, voidedAt: null },
      _sum: { amount: true },
    });
    return new Prisma.Decimal(result._sum.amount || 0);
  }

  /** Detect cache drift without rewriting any historical transaction. */
  static async reconcileFolio(folioId: string) {
    const folio = await prisma.folio.findUnique({ where: { id: folioId } });
    if (!folio) throw new AppError('Folio not found.', 404, 'FOLIO_NOT_FOUND');
    const calculatedBalance = await this.calculateFolioBalance(folioId);
    const storedBalance = new Prisma.Decimal(folio.balance);
    return {
      folioId,
      storedBalance: storedBalance.toFixed(2),
      calculatedBalance: calculatedBalance.toFixed(2),
      difference: calculatedBalance.minus(storedBalance).toFixed(2),
      isReconciled: calculatedBalance.equals(storedBalance),
    };
  }

  /** Get Folio by ID or reservationId */
  static async getFolio(idOrReservationId: string) {
    const folio = await prisma.folio.findFirst({
      where: {
        OR: [{ id: idOrReservationId }, { reservationId: idOrReservationId }],
      },
      include: {
        guest: true,
        reservation: {
          include: { room: { include: { roomType: true } } },
        },
        items: {
          orderBy: { postedAt: 'desc' },
        },
        payments: {
          orderBy: { processedAt: 'desc' },
        },
      },
    });

    return folio;
  }

  /** Post charge to folio */
  static async addCharge(data: AddFolioChargeDTO) {
    if (!FOLIO_CHARGE_TYPES.includes(data.type as (typeof FOLIO_CHARGE_TYPES)[number])) {
      throw new Error(`Invalid charge type "${data.type}". Allowed: ${FOLIO_CHARGE_TYPES.join(', ')}.`);
    }
    if (!data.description || String(data.description).trim().length === 0) {
      throw new Error('Charge description is required.');
    }
    if (String(data.description).length > 500) {
      throw new Error('Charge description is too long (max 500 characters).');
    }
    const amount = Number(data.amount);
    const unitPrice = Number(data.unitPrice ?? 0);
    const quantity = Number(data.quantity ?? 1);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Charge amount must be a positive number.');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('Unit price cannot be negative.');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Quantity must be at least 1.');
    }

    return prisma.$transaction(async (tx) => {
      const folio = await tx.folio.findUnique({ where: { id: data.folioId } });
      if (!folio) throw new Error('Folio not found');
      if (folio.status === 'CLOSED') throw new Error('Cannot add charge to a closed folio.');

      const decimalAmount = new Prisma.Decimal(amount);
      const decimalUnitPrice = new Prisma.Decimal(unitPrice);
      const item = await tx.folioItem.create({
        data: {
          folioId: data.folioId,
          type: data.type,
          description: data.description,
          amount: decimalAmount,
          quantity: data.quantity || 1,
          unitPrice: decimalUnitPrice,
          department: data.department,
          referenceId: data.referenceId,
          referenceType: data.referenceType,
          postedBy: data.postedBy,
        },
      });

      await tx.folio.update({
        where: { id: data.folioId },
        data: { balance: { increment: decimalAmount } },
      });
      await AuditService.logInTransaction(tx, {
        userId: data.postedBy,
        action: 'folio.charge_posted',
        resource: 'folio_item',
        resourceId: item.id,
        afterData: { folioId: data.folioId, type: data.type, amount: decimalAmount.toString(), department: data.department },
      });

      return item;
    });
  }

  /** Void folio charge */
  static async voidCharge(itemId: string, voidedBy: string, voidReason: string) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.folioItem.findUnique({ where: { id: itemId } });
      if (!item) throw new Error('Folio item not found');
      if (item.voidedAt) throw new Error('Item is already voided');

      const folio = await tx.folio.findUnique({ where: { id: item.folioId } });
      if (!folio) throw new AppError('Folio not found.', 404, 'FOLIO_NOT_FOUND');
      if (folio.status !== 'OPEN') throw new AppError('Cannot void an item on a closed folio.', 409, 'CLOSED_FOLIO');

      const updatedItem = await tx.folioItem.update({
        where: { id: itemId },
        data: {
          voidedAt: new Date(),
          voidedBy,
          voidReason,
        },
      });

      await tx.folio.update({
        where: { id: item.folioId },
        data: { balance: { decrement: item.amount } },
      });
      await AuditService.logInTransaction(tx, {
        userId: voidedBy,
        action: 'folio.charge_voided',
        resource: 'folio_item',
        resourceId: item.id,
        beforeData: { folioId: item.folioId, amount: item.amount.toString(), type: item.type },
        afterData: { voidReason },
      });

      return updatedItem;
    });
  }
}
