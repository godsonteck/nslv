// ============================================
// NS LUXURY VILLA — User Management Service
// Handles user CRUD, roles, permissions, staff
// ============================================

import { prisma } from '../config';
import { AppError } from '../middleware/error';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import type { CreateUserInput, UpdateUserInput } from '@nslv/shared';

export class UserService {
  /**
   * Create a new user account (Admin only)
   */
  static async createUser(input: CreateUserInput, createdByUserId: string) {
    // Check email uniqueness
    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingEmail) {
      throw new AppError('A user with this email already exists.', 409, 'EMAIL_EXISTS');
    }

    // Check username uniqueness
    const existingUsername = await prisma.user.findUnique({
      where: { username: input.username },
    });
    if (existingUsername) {
      throw new AppError('A user with this username already exists.', 409, 'USERNAME_EXISTS');
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(input.password);

    // Create user in transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          username: input.username,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone || null,
        },
      });

      // Assign roles
      for (const roleId of input.roleIds) {
        await tx.userRole.create({
          data: {
            userId: newUser.id,
            roleId,
            assignedBy: createdByUserId,
          },
        });
      }

      return newUser;
    });

    await AuditService.log({
      userId: createdByUserId,
      action: 'user.created',
      resource: 'user',
      resourceId: user.id,
      afterData: { email: user.email, username: user.username, roleIds: input.roleIds },
    });

    return this.getUserById(user.id);
  }

  /**
   * Get user by ID with roles & permissions
   */
  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const { roles, permissions } = await AuthService.getUserRolesAndPermissions(user.id);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      status: user.status as any,
      totpEnabled: user.totpEnabled,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      roles,
      permissions,
    };
  }

  /**
   * Update user details or roles
   */
  static async updateUser(id: string, input: UpdateUserInput, updatedByUserId: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const beforeData = {
      email: existing.email,
      firstName: existing.firstName,
      lastName: existing.lastName,
      phone: existing.phone,
      status: existing.status,
    };

    await prisma.$transaction(async (tx) => {
      // Update core info
      await tx.user.update({
        where: { id },
        data: {
          ...(input.email ? { email: input.email } : {}),
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName ? { lastName: input.lastName } : {}),
          phone: input.phone !== undefined ? input.phone : existing.phone,
          ...(input.status ? { status: input.status } : {}),
        },
      });

      // Update roles if provided
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        for (const roleId of input.roleIds) {
          await tx.userRole.create({
            data: {
              userId: id,
              roleId,
              assignedBy: updatedByUserId,
            },
          });
        }
      }
    });

    await AuditService.log({
      userId: updatedByUserId,
      action: 'user.updated',
      resource: 'user',
      resourceId: id,
      beforeData,
      afterData: input as Record<string, unknown>,
    });

    return this.getUserById(id);
  }

  /**
   * List users with pagination and search
   */
  static async listUsers(filters: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (filters.status) {
      where['status'] = filters.status;
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      where['OR'] = [
        { email: { contains: q } },
        { username: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
      status: u.status,
      totpEnabled: u.totpEnabled,
      lastLoginAt: u.lastLoginAt?.toISOString() || null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      roles: u.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
    }));

    return {
      items: formatted,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * List all roles with permission count
   */
  static async listRoles() {
    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      createdAt: r.createdAt.toISOString(),
      permissions: r.rolePermissions.map((rp) => rp.permission.code),
    }));
  }
}
