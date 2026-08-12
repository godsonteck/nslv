import { prisma } from '../config/database';
import { AuditService } from './audit.service';

export class CategoryService {
  /**
   * List all categories by type
   */
  static async listByType(type: string) {
    return prisma.itemCategory.findMany({
      where: { type, isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get all categories (with optional filtering)
   */
  static async listAll(filters?: { type?: string; includeInactive?: boolean }) {
    return prisma.itemCategory.findMany({
      where: {
        ...(filters?.type && { type: filters.type }),
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
