// ============================================
// NS LUXURY VILLA — User Management Service
// Handles user CRUD, roles, permissions, staff
// ============================================

import { prisma } from '../config';
import { AppError } from '../middleware/error';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { SYSTEM_ROLES, type CreateUserInput, type UpdateUserInput } from '@nslv/shared';

const ADMIN_ROLE_NAME = 'Admin';

export class UserService {
  /**
   * Create a new user account (Admin only)
   */
  static async createUser(input: CreateUserInput, createdByUserId: string) {
    const rawRoleIds = input.roleIds && input.roleIds.length > 0
      ? input.roleIds
      : input.roleId
        ? [input.roleId]
        : [];

    const roleIdsToAssign = Array.from(new Set(rawRoleIds));
    if (roleIdsToAssign.length === 0) {
      throw new AppError('At least one role must be assigned to the user.', 400, 'ROLE_REQUIRED');
    }

    const assignedRoles = await prisma.role.findMany({
      where: { id: { in: roleIdsToAssign } },
      select: { id: true, name: true, isSystem: true },
    });

    if (assignedRoles.length !== roleIdsToAssign.length) {
      throw new AppError('One or more selected roles were not found.', 400, 'INVALID_ROLE');
    }

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

      // Assign all roles
      for (const rId of roleIdsToAssign) {
        await tx.userRole.create({
          data: {
            userId: newUser.id,
            roleId: rId,
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
      afterData: { email: user.email, username: user.username, roleIds: roleIdsToAssign },
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

    const hasRoleUpdate = input.roleIds !== undefined || input.roleId !== undefined;
    const rawRoleIds = input.roleIds !== undefined
      ? input.roleIds
      : input.roleId
        ? [input.roleId]
        : undefined;

    const roleIdsToAssign = rawRoleIds ? Array.from(new Set(rawRoleIds)) : undefined;

    if (roleIdsToAssign !== undefined) {
      if (roleIdsToAssign.length === 0) {
        throw new AppError('A user must have at least one assigned role.', 400, 'ROLE_REQUIRED');
      }
      const assignedRoles = await prisma.role.findMany({
        where: { id: { in: roleIdsToAssign } },
        select: { id: true, name: true },
      });
      if (assignedRoles.length !== roleIdsToAssign.length) {
        throw new AppError('One or more selected roles were not found.', 400, 'INVALID_ROLE');
      }
    }

    await prisma.$transaction(async (tx) => {
      const adminRole = await tx.role.findUnique({ where: { name: ADMIN_ROLE_NAME } });
      const targetRoles = await tx.userRole.findMany({ where: { userId: id } });
      const currentlyAdmin = !!adminRole && targetRoles.some((role) => role.roleId === adminRole.id);
      const willRemainAdmin = !adminRole || !roleIdsToAssign || roleIdsToAssign.includes(adminRole.id);
      const willRemainActive = input.status === undefined || input.status === 'ACTIVE';

      if (currentlyAdmin && (!willRemainAdmin || !willRemainActive)) {
        const activeAdminCount = await tx.user.count({
          where: {
            status: 'ACTIVE',
            userRoles: { some: { role: { name: ADMIN_ROLE_NAME } } },
          },
        });
        if (activeAdminCount <= 1) {
          throw new AppError('The final active administrator cannot be deactivated or stripped of the Admin role.', 409, 'LAST_ADMIN_PROTECTED');
        }
      }
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
      if (roleIdsToAssign) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        for (const rId of roleIdsToAssign) {
          await tx.userRole.create({
            data: {
              userId: id,
              roleId: rId,
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

    if (input.status && input.status !== 'ACTIVE') {
      await AuditService.log({
        userId: updatedByUserId,
        action: 'account.disabled',
        resource: 'user',
        resourceId: id,
        afterData: { status: input.status },
      });
    }

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
        _count: { select: { userRoles: true } },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.userRoles,
      createdAt: r.createdAt.toISOString(),
      permissions: r.rolePermissions.map((rp) => ({
        permissionId: rp.permissionId,
        permission: {
          id: rp.permission.id,
          code: rp.permission.code,
          action: rp.permission.action,
          module: rp.permission.module,
          description: rp.permission.description,
        },
      })),
    }));
  }

  /**
   * List all permissions from the database
   */
  static async listPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * Create a new role with permissions
   */
  static async createRole(input: { name: string; description?: string | null; permissionCodes: string[] }, createdByUserId: string) {
    void input;
    void createdByUserId;
    throw new AppError('NS Luxury Villa uses the four official system roles. Configure their permissions instead of creating a new role.', 400, 'SYSTEM_ROLES_ONLY');
  }

  /**
   * Update a role's details or permission set
   */
  static async updateRole(id: string, input: { name?: string; description?: string | null; permissionCodes?: string[] }, updatedByUserId: string) {
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) throw new AppError('Role not found.', 404, 'ROLE_NOT_FOUND');
    if (!existing.isSystem || !Object.values(SYSTEM_ROLES).includes(existing.name as typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES])) {
      throw new AppError('Only the four official system roles can be configured.', 400, 'SYSTEM_ROLES_ONLY');
    }
    if (input.name && input.name !== existing.name) {
      throw new AppError('Official system role names cannot be changed.', 400, 'SYSTEM_ROLE_NAME_IMMUTABLE');
    }

    if (input.name && input.name !== existing.name) {
      const dup = await prisma.role.findFirst({ where: { name: input.name, id: { not: id } } });
      if (dup) throw new AppError('A role with this name already exists.', 409, 'ROLE_EXISTS');
    }

    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: { name: input.name, description: input.description !== undefined ? input.description : existing.description },
      });

      if (input.permissionCodes) {
        const permissionIds = await this.resolvePermissionIds(input.permissionCodes);
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        for (const permissionId of permissionIds) {
          await tx.rolePermission.create({ data: { roleId: id, permissionId } });
        }
      }
    });

    await AuditService.log({
      userId: updatedByUserId,
      action: 'role.updated',
      resource: 'role',
      resourceId: id,
      beforeData: { name: existing.name },
      afterData: input,
    });

    return this.listRoles().then((roles) => roles.find((r) => r.id === id));
  }

  /**
   * Delete a non-system role
   */
  static async deleteRole(id: string, deletedByUserId: string) {
    const existing = await prisma.role.findUnique({ where: { id }, include: { userRoles: { take: 1 } } });
    if (!existing) throw new AppError('Role not found.', 404, 'ROLE_NOT_FOUND');
    if (existing.isSystem) throw new AppError('System roles cannot be deleted.', 400, 'SYSTEM_ROLE');
    if (existing.userRoles.length > 0) throw new AppError('Role is assigned to users and cannot be deleted.', 409, 'ROLE_IN_USE');

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
    });

    await AuditService.log({
      userId: deletedByUserId,
      action: 'role.deleted',
      resource: 'role',
      resourceId: id,
      beforeData: { name: existing.name },
    });

    return { id, deleted: true };
  }

  /**
   * Delete (hard) a non-admin user
   */
  static async deleteUser(id: string, deletedByUserId: string) {
    const target = await prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!target) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');

    const hasAdmin = target.userRoles.some((ur) => ur.role.name === 'Admin');
    if (hasAdmin) throw new AppError('Admin accounts cannot be deleted.', 400, 'ADMIN_DELETE_FORBIDDEN');
    if (id === deletedByUserId) throw new AppError('You cannot delete your own account.', 400, 'SELF_DELETE_FORBIDDEN');

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    await AuditService.log({
      userId: deletedByUserId,
      action: 'user.deleted',
      resource: 'user',
      resourceId: id,
      beforeData: { email: target.email, username: target.username },
    });

    return { id, deleted: true };
  }

  private static async resolvePermissionIds(codes: string[]) {
    const perms = await prisma.permission.findMany({ where: { code: { in: codes } } });
    if (perms.length !== codes.length) {
      const found = new Set(perms.map((p) => p.code));
      const missing = codes.filter((c) => !found.has(c));
      throw new AppError(`Unknown permission code(s): ${missing.join(', ')}`, 400, 'UNKNOWN_PERMISSION');
    }
    return perms.map((p) => p.id);
  }
}
