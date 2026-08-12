// ============================================
// NS LUXURY VILLA — Folio Service
// Central Folio charges, items, and balance calculation
// ============================================

import { prisma } from '../config';

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

      const item = await tx.folioItem.create({
        data: {
          folioId: data.folioId,
          type: data.type,
          description: data.description,
          amount: data.amount,
          quantity: data.quantity || 1,
          unitPrice: data.unitPrice,
          department: data.department,
          referenceId: data.referenceId,
          referenceType: data.referenceType,
          postedBy: data.postedBy,
        },
      });

      // Update folio balance
      const newBalance = Number(folio.balance) + data.amount;
      await tx.folio.update({
        where: { id: data.folioId },
        data: { balance: newBalance },
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

      const updatedItem = await tx.folioItem.update({
        where: { id: itemId },
        data: {
          voidedAt: new Date(),
          voidedBy,
          voidReason,
        },
      });

      const folio = await tx.folio.findUnique({ where: { id: item.folioId } });
      if (folio) {
        const newBalance = Number(folio.balance) - Number(item.amount);
        await tx.folio.update({
          where: { id: item.folioId },
          data: { balance: newBalance },
        });
      }

      return updatedItem;
    });
  }
}
