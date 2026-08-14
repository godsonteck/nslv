import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/services/audit.service', () => ({ AuditService: { logInTransaction: vi.fn() } }));
import { RecipeService } from '../src/services/recipes.service';

const recipe = { id: 'recipe-1', name: 'Jollof Chicken', items: [{ id: 'rice-line', quantity: 0.3, conversionFactor: 1000, inventoryItem: { id: 'rice', name: 'Rice', quantity: 1000, isActive: true } }] };

describe('recipe inventory consumption', () => {
  it('uses configured conversion and sale quantity in immutable movement', async () => {
    const tx: any = { recipe: { findFirst: vi.fn().mockResolvedValue(recipe) }, inventoryMovement: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, inventoryItem: { update: vi.fn() } };
    await RecipeService.consumeForSale(tx, 'RESTAURANT', 'menu-1', 'order-1', 2, 'user-1');
    expect(tx.inventoryItem.update).toHaveBeenCalledWith({ where: { id: 'rice' }, data: { quantity: 400 } });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantityChange: -600, quantityBefore: 1000, quantityAfter: 400, referenceId: 'order-1' }) }));
  });

  it('does not deduct again when finalisation is replayed', async () => {
    const tx: any = { recipe: { findFirst: vi.fn().mockResolvedValue(recipe) }, inventoryMovement: { findUnique: vi.fn().mockResolvedValue({ id: 'existing' }), create: vi.fn() }, inventoryItem: { update: vi.fn() } };
    await RecipeService.consumeForSale(tx, 'RESTAURANT', 'menu-1', 'order-1', 1, 'user-1');
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
  });

  it('fails the sale transaction before a negative stock movement is written', async () => {
    const tx: any = { recipe: { findFirst: vi.fn().mockResolvedValue({ ...recipe, items: [{ ...recipe.items[0], inventoryItem: { ...recipe.items[0].inventoryItem, quantity: 100 } }] }) }, inventoryMovement: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, inventoryItem: { update: vi.fn() } };
    await expect(RecipeService.consumeForSale(tx, 'RESTAURANT', 'menu-1', 'order-1', 1, 'user-1')).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
  });

  it('does nothing for an item with no active recipe', async () => {
    const tx: any = { recipe: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(RecipeService.consumeForSale(tx, 'POOL', 'service-1', 'sale-1', 1, 'user-1')).resolves.toMatchObject({ consumed: false });
  });
});
