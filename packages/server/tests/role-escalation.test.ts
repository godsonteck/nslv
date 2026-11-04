import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  roleFindMany: vi.fn(),
  roleFindUnique: vi.fn(),
  userRoleFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../src/config', () => ({
  prisma: {
    role: { findMany: mocks.roleFindMany, findUnique: mocks.roleFindUnique },
    userRole: { findMany: mocks.userRoleFindMany },
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../src/services/audit.service', () => ({
  AuditService: { log: vi.fn(), logInTransaction: vi.fn() },
}));

import { UserService } from '../src/services/user.service';

const role = (name: string, permissions: string[]) => ({
  id: name.toLowerCase(),
  name,
  isSystem: true,
  rolePermissions: permissions.map((code) => ({ permission: { code } })),
});

const actorRole = (name: string, permissions: string[]) => ({
  role: {
    name,
    rolePermissions: permissions.map((code) => ({ permission: { code } })),
  },
});

const createInput = {
  email: 'new@nsvilla.com',
  username: 'newuser',
  password: 'Str0ng!Passw0rd',
  firstName: 'New',
  lastName: 'User',
  roleIds: ['manager'],
};

describe('role assignment cannot escalate privileges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue(null);
  });

  it('refuses a non-admin creating a user with the Admin role', async () => {
    mocks.roleFindMany.mockResolvedValue([role('Admin', ['users.create', 'roles.manage'])]);
    mocks.userRoleFindMany.mockResolvedValue([actorRole('Manager', ['users.create'])]);

    await expect(
      UserService.createUser({ ...createInput, roleIds: ['admin'] }, 'actor-1'),
    ).rejects.toMatchObject({ code: 'ROLE_ESCALATION', statusCode: 403 });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses a role that grants permissions the actor does not hold', async () => {
    mocks.roleFindMany.mockResolvedValue([role('Manager', ['users.create', 'payments.refund'])]);
    mocks.userRoleFindMany.mockResolvedValue([actorRole('Reception', ['users.create'])]);

    await expect(UserService.createUser(createInput, 'actor-1')).rejects.toMatchObject({
      code: 'ROLE_ESCALATION',
      statusCode: 403,
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses a non-admin editing the Admin role', async () => {
    mocks.roleFindUnique.mockResolvedValue({ id: 'admin', name: 'Admin', isSystem: true });
    mocks.userRoleFindMany.mockResolvedValue([actorRole('Manager', ['roles.manage'])]);

    await expect(
      UserService.updateRole('admin', { permissionCodes: ['users.create'] }, 'actor-1'),
    ).rejects.toMatchObject({ code: 'ROLE_ESCALATION', statusCode: 403 });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('refuses granting a permission the actor does not hold', async () => {
    mocks.roleFindUnique.mockResolvedValue({ id: 'manager', name: 'Manager', isSystem: true });
    mocks.userRoleFindMany.mockResolvedValue([actorRole('Manager', ['roles.manage'])]);

    await expect(
      UserService.updateRole('manager', { permissionCodes: ['roles.manage', 'users.delete'] }, 'actor-1'),
    ).rejects.toMatchObject({ code: 'PERMISSION_ESCALATION', statusCode: 403 });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
