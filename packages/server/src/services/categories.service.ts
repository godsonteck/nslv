import { prisma } from '../config/database';
import { AuditService } from './audit.service';

export const DEFAULT_CATEGORY_SEEDS: Record<string, Array<{ name: string; description: string }>> = {
  EXPENDITURE: [
    { name: 'UTILITIES', description: 'Electricity, water, gas, internet & telecom' },
    { name: 'SUPPLIES', description: 'Guest amenities, cleaning chemicals & paper products' },
    { name: 'MAINTENANCE', description: 'Repairs, hardware, plumbing & electrical fittings' },
    { name: 'STAFF', description: 'Wages, overtime, uniforms & staff welfare' },
    { name: 'MARKETING', description: 'Advertising, social media, print & promotional items' },
    { name: 'FOOD', description: 'Raw food items, produce, meat & ingredients' },
    { name: 'BEVERAGES', description: 'Alcoholic & non-alcoholic beverages stock' },
    { name: 'OTHER', description: 'Miscellaneous operational expenses' },
  ],
  INVENTORY: [
    { name: 'HOUSEKEEPING', description: 'Guestroom and linen inventory' },
    { name: 'FOOD', description: 'Kitchen and restaurant stock' },
    { name: 'BEVERAGES', description: 'Bar beverage inventory' },
    { name: 'MAINTENANCE', description: 'Repair tools and spare parts' },
    { name: 'OFFICE', description: 'Office supplies and admin resources' },
    { name: 'OTHER', description: 'Miscellaneous inventory items' },
  ],
  RESTAURANT: [
    { name: 'APPETIZERS', description: 'Small plates and starters' },
    { name: 'MAINS', description: 'Main course dishes' },
    { name: 'DESSERTS', description: 'Desserts and sweet items' },
    { name: 'BEVERAGES', description: 'Non-alcoholic and specialty drinks' },
    { name: 'SPECIALS', description: 'Chef specials and featured items' },
  ],
  BAR: [
    { name: 'BEERS', description: 'Beer and malt selections' },
    { name: 'WINES', description: 'Wine and sparkling selections' },
    { name: 'SPIRITS', description: 'Spirits and mixed drinks' },
    { name: 'SOFT_DRINKS', description: 'Non-alcoholic beverage choices' },
    { name: 'COCKTAILS', description: 'House cocktails and signature mixes' },
  ],
  POOL: [
    { name: 'POOL_TREATMENT', description: 'Chlorine, water treatment and chemicals' },
    { name: 'LIFEGUARD', description: 'Pool team and safety supplies' },
    { name: 'EQUIPMENT', description: 'Pool service and equipment items' },
    { name: 'GUEST_AMENITIES', description: 'Poolside guest supplies' },
    { name: 'OTHER', description: 'Other pool operational items' },
  ],
  ROOM_TYPE: [
    { name: 'STUDIO', description: 'Standard studio room category' },
    { name: 'DELUXE', description: 'Deluxe room option' },
    { name: 'SUITE', description: 'Suite and premium accommodation' },
    { name: 'APARTMENT', description: 'Apartment-style accommodation' },
  ],
};

export const getDefaultCategorySeeds = (type?: string) => {
  const normalizedType = (type ?? '').toUpperCase();
  if (!normalizedType) {
    return Object.entries(DEFAULT_CATEGORY_SEEDS).flatMap(([categoryType, items]) =>
      items.map((item) => ({ ...item, type: categoryType, color: '#174b59' }))
    );
  }

  const items = DEFAULT_CATEGORY_SEEDS[normalizedType] ?? [];
  return items.map((item) => ({ ...item, type: normalizedType, color: '#174b59' }));
};

export class CategoryService {
  static async ensureDefaultCategories(type?: string) {
    const seeds = getDefaultCategorySeeds(type);
    if (seeds.length === 0) return [];

    const targetType = (type ?? '').toUpperCase();
    const where = targetType ? { type: targetType } : {};
    const existingCount = await prisma.itemCategory.count({ where });
    if (existingCount > 0) return [];

    const rows = await Promise.all(
      seeds.map((seed) =>
        prisma.itemCategory.upsert({
          where: { name_type: { name: seed.name, type: seed.type } },
          update: {},
          create: {
            name: seed.name,
            type: seed.type,
            description: seed.description,
            color: seed.color,
            order: 0,
            isActive: true,
          },
        })
      )
    );

    return rows;
  }

  /**
   * List all categories by type
   */
  static async listByType(type: string) {
    await this.ensureDefaultCategories(type);
    return prisma.itemCategory.findMany({
      where: { type, isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get all categories (with optional filtering)
   */
  static async listAll(filters?: { type?: string; includeInactive?: boolean }) {
    const requestedType = filters?.type ? String(filters.type).toUpperCase() : undefined;
    await this.ensureDefaultCategories(requestedType);
    return prisma.itemCategory.findMany({
      where: {
        ...(requestedType && { type: requestedType }),
        ...(filters?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ type: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get category by ID
   */
  static async getById(id: string) {
    return prisma.itemCategory.findUnique({ where: { id } });
  }

  /**
   * Ensures a catalog value is one the Administrator has configured. Existing
   * installations that have not created any categories of this type retain
   * their legacy values until the first managed category is added.
   */
  static async assertConfiguredValue(type: string, name: string) {
    const normalizedType = type.toUpperCase();
    const configuredCount = await prisma.itemCategory.count({ where: { type: normalizedType } });
    if (configuredCount === 0) return;

    const category = await prisma.itemCategory.findFirst({
      where: { type: normalizedType, name, isActive: true },
    });
    if (!category) {
      throw new Error(`Select an active ${normalizedType.toLowerCase()} category configured by an administrator.`);
    }
  }

  /**
   * Create new category
   */
  static async create(
    data: {
      name: string;
      type: string;
      description?: string;
      color?: string;
      order?: number;
    },
    userId: string
  ) {
    const category = await prisma.itemCategory.create({
      data: {
        name: data.name.trim(),
        type: data.type.toUpperCase(),
        description: data.description?.trim(),
        color: data.color,
        order: data.order ?? 0,
        isActive: true,
      },
    });

    await AuditService.log({
      userId,
      action: 'CATEGORY_CREATED',
      resource: 'ItemCategory',
      resourceId: category.id,
      afterData: category as any,
    });

    return category;
  }

  /**
   * Update category
   */
  static async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      order?: number;
      isActive?: boolean;
    },
    userId: string
  ) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Category not found');

    const updated = await prisma.itemCategory.update({
      where: { id },
      data: {
        name: data.name?.trim() ?? existing.name,
        description: data.description !== undefined ? data.description.trim() : existing.description,
        color: data.color ?? existing.color,
        order: data.order ?? existing.order,
        isActive: data.isActive ?? existing.isActive,
      },
    });

    await AuditService.log({
      userId,
      action: 'CATEGORY_UPDATED',
      resource: 'ItemCategory',
      resourceId: id,
      beforeData: existing as any,
      afterData: updated as any,
    });

    return updated;
  }

  /**
   * Delete category (soft delete - mark as inactive)
   */
  static async delete(id: string, userId: string) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Category not found');

    const updated = await prisma.itemCategory.update({
      where: { id },
      data: { isActive: false },
    });

    await AuditService.log({
      userId,
      action: 'CATEGORY_DELETED',
      resource: 'ItemCategory',
      resourceId: id,
      beforeData: existing as any,
      afterData: updated as any,
    });

    return updated;
  }

  /**
   * Reorder categories
   */
  static async reorder(
    updates: Array<{ id: string; order: number }>,
    userId: string
  ) {
    const results = await Promise.all(
      updates.map((u) =>
        prisma.itemCategory.update({
          where: { id: u.id },
          data: { order: u.order },
        })
      )
    );

    await AuditService.log({
      userId,
      action: 'CATEGORIES_REORDERED',
      resource: 'ItemCategory',
      afterData: { count: updates.length },
    });

    return results;
  }
}
