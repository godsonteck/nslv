import { beforeEach, describe, expect, it } from 'vitest';
import type { UserStatus } from '@nslv/shared';
import { useAuthStore } from './authStore';

describe('authStore admin access', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        email: 'admin@nslv.test',
        username: 'admin',
        firstName: 'System',
        lastName: 'Admin',
        phone: null,
        avatarUrl: null,
        status: 'ACTIVE' as UserStatus,
        totpEnabled: false,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        roles: [{ id: 'role-admin', name: 'Admin' }],
        permissions: [],
      },
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      },
      isAuthenticated: true,
    });
  });

  it('grants full access to admins even when the permissions list is empty', () => {
    expect(useAuthStore.getState().hasPermission('categories.manage')).toBe(true);
    expect(useAuthStore.getState().hasPermission('categories.view')).toBe(true);
  });
});
