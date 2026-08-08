// ============================================
// NS LUXURY VILLA — API Service Functions
// Typed wrappers over apiFetch for all endpoints
// ============================================

import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

/** Get auth token from Zustand store */
const token = () => useAuthStore.getState().tokens?.accessToken ?? null;

// ──────────────────────────────────────────
// Auth
// ──────────────────────────────────────────
export const authApi = {
  login: (login: string, password: string, totpCode?: string) =>
    apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password, ...(totpCode ? { totpCode } : {}) }),
    }),

  refresh: (refreshToken: string) =>
    apiFetch<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    apiFetch<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }, token()),

  me: () => apiFetch<AuthUser>('/auth/me', {}, token()),
};

// ──────────────────────────────────────────
// Inline types (avoid circular shared imports)
// ──────────────────────────────────────────
interface AuthUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
  requiresTotp?: boolean;
}

// ──────────────────────────────────────────
// Users
// ──────────────────────────────────────────
export interface UserRecord {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: { id: string; name: string }[];
}

interface PaginatedResult<T> {
  data?: T[];
  items?: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const usersApi = {
  list: async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }): Promise<{ success: true; data: PaginatedResult<UserRecord> }> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const data = await apiFetch<PaginatedResult<UserRecord>>(`/users?${qs}`, {}, token());
    return { success: true, data };
  },

  getById: async (id: string): Promise<UserRecord> =>
    apiFetch<UserRecord>(`/users/${id}`, {}, token()),

  create: async (input: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    roleIds: string[];
  }): Promise<UserRecord> =>
    apiFetch<UserRecord>('/users', {
      method: 'POST',
      body: JSON.stringify(input),
    }, token()),

  update: async (id: string, input: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    status: string;
    roleIds: string[];
  }>): Promise<UserRecord> =>
    apiFetch<UserRecord>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }, token()),
};

// ──────────────────────────────────────────
// Roles
// ──────────────────────────────────────────
export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{
    permissionId: string;
    permission: { id: string; code: string; action: string; module: string; description: string | null };
  }>;
}

export interface PermissionRecord {
  id: string;
  code: string;
  action: string;
  module: string;
  description: string | null;
}

export const rolesApi = {
  list: async (): Promise<{ success: true; data: RoleRecord[] }> => {
    const data = await apiFetch<RoleRecord[]>('/roles', {}, token());
    return { success: true, data };
  },

  permissions: async (): Promise<{ success: true; data: { permissions: PermissionRecord[]; modules: string[] } }> => {
    const data = await apiFetch<{ permissions: PermissionRecord[]; modules: string[] }>('/roles/permissions', {}, token());
    return { success: true, data };
  },
};

// ──────────────────────────────────────────
// Settings
// ──────────────────────────────────────────
export interface SettingRecord {
  key: string;
  value: unknown;
  dataType: string;
  description: string | null;
  isPublic: boolean;
}

export const settingsApi = {
  list: async (): Promise<{ success: true; data: SettingRecord[] }> => {
    const data = await apiFetch<SettingRecord[]>('/settings', {}, token());
    return { success: true, data };
  },

  update: async (key: string, value: unknown): Promise<SettingRecord> =>
    apiFetch<SettingRecord>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }, token()),

  bulkUpdate: async (settingsMap: Record<string, unknown>): Promise<SettingRecord[]> =>
    apiFetch<SettingRecord[]>('/settings/bulk', {
      method: 'POST',
      body: JSON.stringify(settingsMap),
    }, token()),
};

// ──────────────────────────────────────────
// Audit Logs
// ──────────────────────────────────────────
export interface AuditLogRecord {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; username: string } | null;
}

export const auditApi = {
  list: async (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: true; data: PaginatedResult<AuditLogRecord> }> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.userId) qs.set('userId', params.userId);
    if (params?.action) qs.set('action', params.action);
    if (params?.resource) qs.set('resource', params.resource);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    const data = await apiFetch<PaginatedResult<AuditLogRecord>>(`/audit?${qs}`, {}, token());
    return { success: true, data };
  },
};
