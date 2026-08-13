// ============================================
// NS LUXURY VILLA — Auth State Store (Zustand)
// Manages authenticated user state & tokens
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, AuthTokens, PermissionCode } from '@nslv/shared';
import { apiFetch } from '../services/api';

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: AuthUser, tokens: AuthTokens) => void;
  logout: () => Promise<void>;
  hasPermission: (permission: PermissionCode) => boolean;
  hasRole: (roleName: string) => boolean;
  updateUser: (partialUser: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      setAuth: (user, tokens) => {
        set({ user, tokens, isAuthenticated: true });
      },

      logout: async () => {
        const { tokens } = get();
        if (tokens?.refreshToken) {
          try {
            await apiFetch('/auth/logout', {
              method: 'POST',
              body: JSON.stringify({ refreshToken: tokens.refreshToken }),
            });
          } catch {
            // Ignore server logout errors on local state clear
          }
        }
        set({ user: null, tokens: null, isAuthenticated: false });
      },

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        const isAdmin = user.roles.some((role) => role.name.toLowerCase() === 'admin');
        if (isAdmin) return true;
        return user.permissions.includes(permission);
      },

      hasRole: (roleName) => {
        const { user } = get();
        if (!user) return false;
        return user.roles.some((r) => r.name.toLowerCase() === roleName.toLowerCase());
      },

      updateUser: (partialUser) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...partialUser } });
        }
      },
    }),
    {
      name: 'nslv-auth-storage',
    },
  ),
);
