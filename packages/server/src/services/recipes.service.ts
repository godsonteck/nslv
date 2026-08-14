import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error';
import { AuditService } from './audit.service';

export type SellableKind = 'RESTAURANT' | 'BAR' | 'POOL';
type RecipeInput = { name: string; isActive?: boolean; items: Array<{ inventoryItemId: string; quantity: number; unit: string; conversionFactor?: number }> };

const ownerField = (kind: SellableKind) => kind === 'RESTAURANT' ? 'restaurantItemId' : kind === 'BAR' ? 'barItemId' : 'poolServiceId';

export class RecipeService {
  static async replaceRecipe(tx: Prisma.TransactionClient, kind: SellableKind, sellableId: string, input: RecipeInput, updatedBy: string) {
    if (!input.name?.trim() || !input.items?.length) throw new AppError('A recipe name and at least one ingredient are required.', 422, 'INVALID_RECIPE');
    if (new Set(input.items.map(item => item.inventoryItemId)).size !== input.items.length) throw new AppError('Each inventory ingredient may appear only once.', 422, 'DUPLICATE_RECIPE_INGREDIENT');
    for (const item of input.items) {
      const consumed = new Prisma.Decimal(item.quantity).mul(item.conversionFactor ?? 1);
      if (!item.unit?.trim() || !consumed.gt(0) || !consumed.isInteger()) {
        throw new AppError('Recipe consumption must convert exactly to a positive whole inventory base unit.', 422, 'INVALID_RECIPE_QUANTITY');
      }
    }
    const inventory = await tx.inventoryItem.findMany({ where: { id: { in: input.items.map(item => item.inventoryItemId) }, isActive: true }, select: { id: true } });
    if (inventory.length !== input.items.length) throw new AppError('One or more recipe ingredients are unavailable.', 422, 'INVALID_RECIPE_INGREDIENT');
    await tx.recipe.updateMany({ where: { [ownerField(kind)]: sellableId, isActive: true }, data: { isActive: false } });
    const recipe = await tx.recipe.create({ data: {
      [ownerField(kind)]: sellableId, name: input.name.trim(), isActive: input.isActive ?? true,
      items: { create: input.items.map(item => ({ inventoryItemId: item.inventoryItemId, quantity: item.quantity, unit: item.unit.trim(), conversionFactor: item.conversionFactor ?? 1 })) },
    }, include: { items: { include: { inventoryItem: true } } } });
    await AuditService.logInTransaction(tx, { userId: updatedBy, action: 'recipe.replaced', resource: 'recipe', resourceId: recipe.id, afterData: { kind, sellableId, ingredientCount: recipe.items.length } });
    return recipe;
  }

  static async consumeForSale(tx: Prisma.TransactionClient, kind: SellableKind, sellableId: string, saleId: string, saleQuantity: number, recordedBy: string) {
    const recipe = await tx.recipe.findFirst({ where: { [ownerField(kind)]: sellableId, isActive: true }, include: { items: { include: { inventoryItem: true } } }, orderBy: { createdAt: 'desc' } });
    if (!recipe) return { consumed: false, recipeId: null };
    for (const recipeItem of recipe.items) {
      const change = new Prisma.Decimal(recipeItem.quantity).mul(recipeItem.conversionFactor).mul(saleQuantity);
      if (!change.isInteger() || change.lte(0)) throw new AppError('Recipe conversion produced an invalid inventory quantity.', 422, 'INVALID_RECIPE_QUANTITY');
      const units = change.toNumber();
      // The unique sale/recipe-item key makes finalisation replay-safe.
      const existing = await tx.inventoryMovement.findUnique({ where: { referenceId_recipeItemId: { referenceId: saleId, recipeItemId: recipeItem.id } } });
      if (existing) continue;
      const stock = recipeItem.inventoryItem;
      if (!stock.isActive || stock.quantity < units) throw new AppError(`Insufficient stock for ${stock.name}.`, 409, 'INSUFFICIENT_STOCK');
      const after = stock.quantity - units;
      await tx.inventoryItem.update({ where: { id: stock.id }, data: { quantity: after } });
      await tx.inventoryMovement.create({ data: { inventoryItemId: stock.id, type: 'SALE_CONSUMPTION', quantityChange: -units, quantityBefore: stock.quantity, quantityAfter: after, reason: `Recipe ${recipe.name}`, recordedBy, referenceId: saleId, referenceType: `${kind}_SALE`, recipeItemId: recipeItem.id } });
    }
    await AuditService.logInTransaction(tx, { userId: recordedBy, action: 'inventory.recipe_consumed', resource: 'recipe', resourceId: recipe.id, afterData: { kind, sellableId, saleId, saleQuantity } });
    return { consumed: true, recipeId: recipe.id };
  }
}
