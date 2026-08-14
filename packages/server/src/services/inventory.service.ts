// ============================================
// NS LUXURY VILLA — Inventory Service
// Tracks stock levels across departments with adjustments
// ============================================

import { prisma } from '../config';
import { AuditService } from './audit.service';
import { CategoryService } from './categories.service';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';

const makeSku = (prefix: string) => `${prefix.toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

export class InventoryService {
  static async listItems(filters?: { search?: string; category?: string; lowStockOnly?: boolean; includeInactive?: boolean }) {
    const where: any = {};
    if (!filters?.includeInactive) where.isActive = true;
    if (filters?.category) where.category = filters.category;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.lowStockOnly) where.quantity = { lte: prisma.inventoryItem.fields.minQuantity };

    const items = await prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' } });
    return items.map((i) => ({
      ...i,
      costPrice: i.costPrice !== null ? Number(i.costPrice) : null,
      lowStock: i.quantity <= i.minQuantity,
    }));
  }

  static async createItem(input: { sku?: string; name: string; category: string; unit: string; quantity?: number; minQuantity?: number; costPrice?: number | null; notes?: string }, createdBy?: string) {
    await CategoryService.assertConfiguredValue('INVENTORY', input.category);
    if (!input.name?.trim()) throw new Error('Item name is required.');
    if (!input.category?.trim()) throw new Error('Item category is required.');
    if (!input.unit?.trim()) throw new Error('Item unit is required.');
    const quantity = Math.max(0, Number(input.quantity || 0));
    if (!Number.isInteger(quantity)) throw new Error('Quantity must be a whole number.');

    const sku = input.sku?.trim() || makeSku(input.category.split(' ')[0] || 'ITM');
    const existing = await prisma.inventoryItem.findUnique({ where: { sku } });
    if (existing) throw new Error(`An item with SKU '${sku}' already exists.`);

    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          sku,
          name: input.name.trim(),
          category: input.category.trim(),
          unit: input.unit.trim(),
          quantity,
          minQuantity: Math.max(0, Number(input.minQuantity || 0)),
          costPrice: input.costPrice != null ? Number(input.costPrice) : null,
          notes: input.notes,
          createdBy,
        },
      });
      if (quantity > 0) {
        await tx.inventoryMovement.create({
          data: { inventoryItemId: item.id, type: 'OPENING_BALANCE', quantityChange: quantity, quantityBefore: 0, quantityAfter: quantity, reason: 'Initial stock balance', recordedBy: createdBy },
        });
      }
      await AuditService.logInTransaction(tx, { userId: createdBy, action: 'inventory.created', resource: 'inventory_item', resourceId: item.id, afterData: { sku: item.sku, quantity: item.quantity } });
      return item;
    });
  }

  static async updateItem(id: string, input: Partial<{ name: string; category: string; unit: string; minQuantity: number; costPrice: number | null; notes: string }>, updatedBy?: string) {
    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Inventory item not found.');

    if (input.category) await CategoryService.assertConfiguredValue('INVENTORY', input.category);
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        unit: input.unit,
        minQuantity: input.minQuantity !== undefined ? Math.max(0, Number(input.minQuantity)) : undefined,
        costPrice: input.costPrice !== undefined ? Number(input.costPrice) : undefined,
        notes: input.notes,
      },
    });
    if (updatedBy) await AuditService.log({ userId: updatedBy, action: 'inventory.updated', resource: 'inventory_item', resourceId: id, beforeData: existing as unknown as Record<string, unknown>, afterData: item as unknown as Record<string, unknown> });
    return item;
  }

  static async adjustStock(id: string, quantityChange: number, reason: string | undefined, updatedBy: string) {
    if (!Number.isInteger(quantityChange) || quantityChange === 0) throw new Error('Stock adjustment must be a non-zero whole number.');
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.inventoryItem.findUnique({ where: { id } });
        if (!existing) throw new Error('Inventory item not found.');
        if (!existing.isActive) throw new Error('Archived inventory items cannot be adjusted.');

        const newQuantity = existing.quantity + quantityChange;
        if (newQuantity < 0) throw new Error('Stock adjustment would result in a negative quantity.');
        const item = await tx.inventoryItem.update({ where: { id }, data: { quantity: newQuantity } });
        await tx.inventoryMovement.create({
          data: { inventoryItemId: id, type: quantityChange > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', quantityChange, quantityBefore: existing.quantity, quantityAfter: newQuantity, reason: reason?.trim() || null, recordedBy: updatedBy },
        });
        await AuditService.logInTransaction(tx, { userId: updatedBy, action: 'inventory.stock_adjusted', resource: 'inventory_item', resourceId: id, beforeData: { quantity: existing.quantity }, afterData: { quantity: item.quantity, quantityChange, reason } });
        return item;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') throw new Error('Inventory changed while this adjustment was being processed. Please retry.');
      throw error;
    }
  }

  static async deleteItem(id: string, deletedBy?: string) {
    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Inventory item not found.');
    // Preserve stock and financial history. "Delete" is an archive operation
    // for an operational item that may already be referenced by its ledger.
    await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
    if (deletedBy) await AuditService.log({ userId: deletedBy, action: 'inventory.archived', resource: 'inventory_item', resourceId: id, beforeData: { isActive: existing.isActive }, afterData: { isActive: false } });
    return { id, archived: true };
  }
}
