// ============================================
// NS LUXURY VILLA — API Service Functions
// Typed wrappers over apiFetch for all endpoints
// ============================================

import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';
import type { AuthUser, AuthTokens, LoginResponse } from '@nslv/shared';

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

  updateProfile: (body: Partial<AuthUser>) =>
    apiFetch<AuthUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }, token()),

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    apiFetch<void>(
      '/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      },
      token(),
    ),
};

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
    try {
      const data = await apiFetch<PaginatedResult<UserRecord>>(`/users?${qs}`, {}, token());
      console.log('[Staff Directory] Users loaded:', data);
      return { success: true, data };
    } catch (error) {
      console.error('[Staff Directory API Error]', error);
      throw error;
    }
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
    roleId: string;
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
    roleId: string;
  }>): Promise<UserRecord> =>
    apiFetch<UserRecord>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }, token()),

  remove: async (id: string): Promise<any> =>
    apiFetch<any>(`/users/${id}`, { method: 'DELETE' }, token()),
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

  create: async (body: { name: string; description?: string; permissionCodes: string[] }): Promise<RoleRecord> =>
    apiFetch<RoleRecord>('/roles', { method: 'POST', body: JSON.stringify(body) }, token()),

  update: async (id: string, body: { name?: string; description?: string; permissionCodes?: string[] }): Promise<RoleRecord> =>
    apiFetch<RoleRecord>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token()),

  remove: async (id: string): Promise<any> =>
    apiFetch<any>(`/roles/${id}`, { method: 'DELETE' }, token()),
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
  deviceInfo: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
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

// ──────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────
export interface NotificationRecord {
  id: string;
  userId: string;
  type: 'RESERVATION' | 'PAYMENT' | 'ALERT' | 'SYSTEM' | 'INFO';
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export const notificationsApi = {
  list: async (params?: {
    page?: number;
    pageSize?: number;
    isRead?: boolean;
    type?: string;
  }): Promise<{ success: true; data: PaginatedResult<NotificationRecord> }> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.isRead !== undefined) qs.set('isRead', String(params.isRead));
    if (params?.type) qs.set('type', params.type);
    const data = await apiFetch<PaginatedResult<NotificationRecord>>(`/notifications?${qs}`, {}, token());
    return { success: true, data };
  },

  getUnreadCount: async (): Promise<{ success: true; data: { unreadCount: number } }> => {
    const data = await apiFetch<{ unreadCount: number }>('/notifications/unread/count', {}, token());
    return { success: true, data };
  },

  markAsRead: async (id: string): Promise<NotificationRecord> =>
    apiFetch<NotificationRecord>(`/notifications/${id}/read`, { method: 'PATCH' }, token()),

  markAllAsRead: async (): Promise<any> =>
    apiFetch<any>('/notifications/mark-all-read', { method: 'PATCH' }, token()),

  delete: async (id: string): Promise<any> =>
    apiFetch<any>(`/notifications/${id}`, { method: 'DELETE' }, token()),
};

// ──────────────────────────────────────────
// Theme & Branding
// ──────────────────────────────────────────
export interface ThemeConfig {
  id?: string;
  villaName: string;
  villaTagline: string;
  logoUrl?: string;
  loginBgUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  textMuted: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;
  fontFamily: string;
  headingFont: string;
  customCss?: string;
  useCustomLogin: boolean;
  enableDarkMode: boolean;
}

export const themeApi = {
  getTheme: async (): Promise<{ success: true; data: ThemeConfig }> => {
    const data = await apiFetch<ThemeConfig>('/theme', {});
    return { success: true, data };
  },

  updateTheme: async (config: Partial<ThemeConfig>): Promise<{ success: true; data: ThemeConfig }> => {
    const data = await apiFetch<ThemeConfig>('/theme', {
      method: 'PUT',
      body: JSON.stringify(config),
    }, token());
    return { success: true, data };
  },

  resetTheme: async (): Promise<{ success: true; data: ThemeConfig }> => {
    const data = await apiFetch<ThemeConfig>('/theme/reset', {
      method: 'POST',
    }, token());
    return { success: true, data };
  },
};

// ──────────────────────────────────────────
// Categories
// ──────────────────────────────────────────
export interface ItemCategory {
  id: string;
  name: string;
  type: string;
  description?: string;
  color?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const categoriesApi = {
  listAll: async (params?: { type?: string; includeInactive?: boolean }): Promise<{ success: true; data: ItemCategory[] }> => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.includeInactive) qs.set('includeInactive', 'true');
    const data = await apiFetch<ItemCategory[]>(`/categories?${qs}`, {}, token());
    return { success: true, data };
  },

  listByType: async (type: string): Promise<{ success: true; data: ItemCategory[] }> => {
    const data = await apiFetch<ItemCategory[]>(`/categories/${type}`, {}, token());
    return { success: true, data };
  },

  create: async (body: { name: string; type: string; description?: string; color?: string; order?: number }): Promise<{ success: true; data: ItemCategory }> => {
    const data = await apiFetch<ItemCategory>('/categories', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token());
    return { success: true, data };
  },

  update: async (id: string, body: Partial<Omit<ItemCategory, 'id' | 'type' | 'createdAt' | 'updatedAt'>>): Promise<{ success: true; data: ItemCategory }> => {
    const data = await apiFetch<ItemCategory>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }, token());
    return { success: true, data };
  },

  delete: async (id: string): Promise<{ success: true }> => {
    await apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }, token());
    return { success: true };
  },

  reorder: async (updates: Array<{ id: string; order: number }>): Promise<{ success: true; data: ItemCategory[] }> => {
    const data = await apiFetch<ItemCategory[]>('/categories/reorder', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    }, token());
    return { success: true, data };
  },
};

// ──────────────────────────────────────────
// Rooms & Room Types
// ──────────────────────────────────────────
export const roomsApi = {
  getRoomTypes: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/rooms/types', {}, token());
    return { success: true, data };
  },
  createRoomType: async (body: any): Promise<any> =>
    apiFetch<any>('/rooms/types', { method: 'POST', body: JSON.stringify(body) }, token()),

  updateRoomType: async (id: string, body: any): Promise<any> =>
    apiFetch<any>(`/rooms/types/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),

  deleteRoomType: async (id: string): Promise<any> =>
    apiFetch<any>(`/rooms/types/${id}`, { method: 'DELETE' }, token()),

  getAmenities: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/rooms/amenities', {}, token());
    return { success: true, data };
  },
  createAmenity: async (body: { name: string; icon?: string; category?: string }): Promise<any> =>
    apiFetch<any>('/rooms/amenities', { method: 'POST', body: JSON.stringify(body) }, token()),
  updateAmenity: async (id: string, body: { name?: string; icon?: string; category?: string }): Promise<any> =>
    apiFetch<any>(`/rooms/amenities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),
  deleteAmenity: async (id: string): Promise<any> =>
    apiFetch<any>(`/rooms/amenities/${id}`, { method: 'DELETE' }, token()),

  getRooms: async (params?: { status?: string; roomTypeId?: string; search?: string }): Promise<{ success: true; data: any[] }> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.roomTypeId) qs.set('roomTypeId', params.roomTypeId);
    if (params?.search) qs.set('search', params.search);
    const data = await apiFetch<any[]>(`/rooms?${qs}`, {}, token());
    return { success: true, data };
  },

  createRoom: async (body: any): Promise<any> =>
    apiFetch<any>('/rooms', { method: 'POST', body: JSON.stringify(body) }, token()),

  updateRoom: async (id: string, body: any): Promise<any> =>
    apiFetch<any>(`/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),

  deleteRoom: async (id: string): Promise<any> =>
    apiFetch<any>(`/rooms/${id}`, { method: 'DELETE' }, token()),

  updateStatus: async (id: string, status: string, notes?: string): Promise<any> =>
    apiFetch<any>(`/rooms/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) }, token()),

  syncBookingStatuses: async (): Promise<{ success: true; data: { occupied: number; reserved: number } }> =>
    apiFetch<{ occupied: number; reserved: number }>('/rooms/sync-booking-statuses', { method: 'POST' }, token()).then((data) => ({ success: true, data })),
};

// ──────────────────────────────────────────
// Guests
// ──────────────────────────────────────────
export const guestsApi = {
  list: async (params?: { search?: string; isVip?: boolean }): Promise<{ success: true; data: any[] }> => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.isVip !== undefined) qs.set('isVip', String(params.isVip));
    const data = await apiFetch<any[]>(`/guests?${qs}`, {}, token());
    return { success: true, data };
  },
  getById: async (id: string): Promise<any> => apiFetch<any>(`/guests/${id}`, {}, token()),
  create: async (body: any): Promise<any> =>
    apiFetch<any>('/guests', { method: 'POST', body: JSON.stringify(body) }, token()),
  update: async (id: string, body: any): Promise<any> =>
    apiFetch<any>(`/guests/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),
};

// ──────────────────────────────────────────
// Reservations & Availability
// ──────────────────────────────────────────
export const reservationsApi = {
  checkAvailability: async (checkInDate: string, checkOutDate: string, roomTypeId?: string): Promise<{ success: true; data: any[] }> => {
    const qs = new URLSearchParams({ checkInDate, checkOutDate });
    if (roomTypeId) qs.set('roomTypeId', roomTypeId);
    const data = await apiFetch<any[]>(`/reservations/availability?${qs}`, {}, token());
    return { success: true, data };
  },
  list: async (params?: { status?: string; search?: string; roomId?: string }): Promise<{ success: true; data: any[] }> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    if (params?.roomId) qs.set('roomId', params.roomId);
    const data = await apiFetch<any[]>(`/reservations?${qs}`, {}, token());
    return { success: true, data };
  },
  create: async (body: any): Promise<any> =>
    apiFetch<any>('/reservations', { method: 'POST', body: JSON.stringify(body) }, token()),

  update: async (id: string, body: any): Promise<any> =>
    apiFetch<any>(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),

  createMulti: async (body: any): Promise<any> =>
    apiFetch<any>('/reservations/multi', { method: 'POST', body: JSON.stringify(body) }, token()),

  getParty: async (bookingId: string): Promise<any> =>
    apiFetch<any>(`/reservations/parties/${bookingId}`, {}, token()),

  addGuests: async (id: string, guestIds: string[]): Promise<any> =>
    apiFetch<any>(`/reservations/${id}/guests`, { method: 'POST', body: JSON.stringify({ guestIds }) }, token()),

  cancel: async (id: string, reason?: string): Promise<any> =>
    apiFetch<any>(`/reservations/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }, token()),

  markNoShow: async (id: string, reason?: string): Promise<any> =>
    apiFetch<any>(`/reservations/${id}/no-show`, { method: 'POST', body: JSON.stringify({ reason }) }, token()),

  deleteCancelled: async (id: string): Promise<any> =>
    apiFetch<any>(`/reservations/${id}`, { method: 'DELETE' }, token()),
};

// ──────────────────────────────────────────
// Stays (Check-In & Check-Out)
// ──────────────────────────────────────────
export const staysApi = {
  getActiveStays: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/stays/active', {}, token());
    return { success: true, data };
  },
  checkIn: async (body: { reservationId: string; idVerified?: boolean; idDocumentType?: string; idDocumentNumber?: string; notes?: string }): Promise<any> =>
    apiFetch<any>('/stays/check-in', { method: 'POST', body: JSON.stringify(body) }, token()),
  checkOut: async (body: { reservationId: string; roomCondition?: string; paymentMethod?: string; notes?: string }): Promise<any> =>
    apiFetch<any>('/stays/check-out', { method: 'POST', body: JSON.stringify(body) }, token()),
  getCheckoutPolicy: async (): Promise<{ success: true; data: { hourlyRate: number; checkoutTime: string } }> => {
    const data = await apiFetch<{ hourlyRate: number; checkoutTime: string }>('/stays/checkout-policy', {}, token());
    return { success: true, data };
  },
  recalculateLateFees: async (): Promise<{ success: true; data: { adjustedCount: number; hourlyRate: number; checkoutTime: string; totalCheckOuts: number } }> => {
    const data = await apiFetch<{ adjustedCount: number; hourlyRate: number; checkoutTime: string; totalCheckOuts: number }>('/stays/recalculate-late-fees', { method: 'POST' }, token());
    return { success: true, data };
  },
  getLateCheckouts: async (params?: { startDate?: string; endDate?: string; search?: string }): Promise<{
    success: true;
    data: {
      policy: { hourlyRate: number; checkoutTime: string };
      summary: {
        totalLateCheckouts: number;
        totalFeesBilled: number;
        totalRefunded: number;
        totalFeesCollected: number;
        avgDelayHours: number;
      };
      records: Array<{
        id: string;
        reservationId: string;
        confirmationNo: string;
        guestId: string;
        guestName: string;
        guestPhone: string;
        guestEmail: string;
        roomNumber: string;
        roomTypeName: string;
        checkInDate: string;
        scheduledCheckOutDate: string;
        actualCheckIn: string | null;
        actualCheckOut: string;
        deadline: string;
        hoursLate: number;
        feeAmount: number;
        refundedAmount: number;
        feeDescription: string;
        paymentMethod: string;
        checkedOutByName: string;
        checkedInByName: string;
        roomCondition: string;
        notes: string | null;
      }>;
    };
  }> => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.search) qs.set('search', params.search);
    const qStr = qs.toString() ? `?${qs.toString()}` : '';
    const data = await apiFetch<any>(`/stays/late-checkouts${qStr}`, {}, token());
    return { success: true, data };
  },
  deleteLateCheckout: async (id: string, reason?: string): Promise<{ success: true; data: any }> => {
    const data = await apiFetch<any>(`/stays/late-checkouts/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }, token());
    return { success: true, data };
  },
};

// ──────────────────────────────────────────
// Folios & Charges
// ──────────────────────────────────────────
export const foliosApi = {
  getFolio: async (idOrReservationId: string): Promise<any> =>
    apiFetch<any>(`/folios/${idOrReservationId}`, {}, token()),
  addCharge: async (folioId: string, body: { type: string; description: string; amount: number; quantity?: number; unitPrice: number; department: string }): Promise<any> =>
    apiFetch<any>(`/folios/${folioId}/charges`, { method: 'POST', body: JSON.stringify(body) }, token()),
  voidCharge: async (itemId: string, reason: string): Promise<any> =>
    apiFetch<any>(`/folios/items/${itemId}/void`, { method: 'POST', body: JSON.stringify({ reason }) }, token()),
};

// ──────────────────────────────────────────
// Payments
// ──────────────────────────────────────────
export const paymentsApi = {
  list: async (params?: { folioId?: string; reservationId?: string; guestId?: string }): Promise<{ success: true; data: any[] }> => {
    const qs = new URLSearchParams();
    if (params?.folioId) qs.set('folioId', params.folioId);
    if (params?.reservationId) qs.set('reservationId', params.reservationId);
    if (params?.guestId) qs.set('guestId', params.guestId);
    const data = await apiFetch<any[]>(`/payments?${qs}`, {}, token());
    return { success: true, data };
  },
  processPayment: async (body: { folioId?: string; reservationId?: string; guestId?: string; amount: number; method: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER'; reference?: string; idempotencyKey: string; description?: string; paymentType?: 'PAYMENT' | 'DEPOSIT' }): Promise<any> =>
    apiFetch<any>('/payments', { method: 'POST', body: JSON.stringify(body) }, token()),
  refund: async (paymentId: string, body: { amount: number; method?: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER'; reference?: string; reason: string; idempotencyKey: string; allowClosedFolioReopen?: boolean }): Promise<any> =>
    apiFetch<any>(`/payments/${paymentId}/refunds`, { method: 'POST', body: JSON.stringify(body) }, token()),
  approveRefund: async (refundId: string): Promise<any> =>
    apiFetch<any>(`/payments/${refundId}/approve-refund`, { method: 'POST' }, token()),
  rejectRefund: async (refundId: string, reason?: string): Promise<any> =>
    apiFetch<any>(`/payments/${refundId}/reject-refund`, { method: 'POST', body: JSON.stringify({ reason }) }, token()),
};

// ──────────────────────────────────────────
// POS (Restaurant, Bar, Pool)
// ──────────────────────────────────────────
export const posApi = {
  // Restaurant
  getRestaurantItems: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/pos/restaurant/items', {}, token());
    return { success: true, data };
  },
  getRestaurantOrders: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/pos/restaurant/orders', {}, token());
    return { success: true, data };
  },
  createRestaurantOrder: async (body: any): Promise<any> => apiFetch<any>('/pos/restaurant/orders', { method: 'POST', body: JSON.stringify(body) }, token()),
  createRestaurantItem: async (body: any): Promise<any> => apiFetch<any>('/pos/restaurant/items', { method: 'POST', body: JSON.stringify(body) }, token()),
  updateRestaurantItem: async (id: string, body: any): Promise<any> => apiFetch<any>(`/pos/restaurant/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),
  toggleRestaurantItem: async (id: string, isAvailable: boolean): Promise<any> => apiFetch<any>(`/pos/restaurant/items/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ isAvailable }) }, token()),
  deleteRestaurantItem: async (id: string): Promise<any> => apiFetch<any>(`/pos/restaurant/items/${id}`, { method: 'DELETE' }, token()),

  // Bar
  getBarItems: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/pos/bar/items', {}, token());
    return { success: true, data };
  },
  getBarOrders: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/pos/bar/orders', {}, token());
    return { success: true, data };
  },
  createBarOrder: async (body: any): Promise<any> => apiFetch<any>('/pos/bar/orders', { method: 'POST', body: JSON.stringify(body) }, token()),
  createBarItem: async (body: any): Promise<any> => apiFetch<any>('/pos/bar/items', { method: 'POST', body: JSON.stringify(body) }, token()),
  updateBarItem: async (id: string, body: any): Promise<any> => apiFetch<any>(`/pos/bar/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),
  toggleBarItem: async (id: string, isAvailable: boolean): Promise<any> => apiFetch<any>(`/pos/bar/items/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ isAvailable }) }, token()),
  deleteBarItem: async (id: string): Promise<any> => apiFetch<any>(`/pos/bar/items/${id}`, { method: 'DELETE' }, token()),

  // Pool
  getPoolAttendance: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/pos/pool/attendance', {}, token());
    return { success: true, data };
  },
  createPoolAttendance: async (body: { visitorName: string; phone?: string; partySize: number; notes?: string }): Promise<any> =>
    apiFetch<any>('/pos/pool/attendance', { method: 'POST', body: JSON.stringify(body) }, token()),
  getPoolServices: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/pos/pool/services', {}, token());
    return { success: true, data };
  },
  createPoolService: async (body: any): Promise<any> => apiFetch<any>('/pos/pool/services', { method: 'POST', body: JSON.stringify(body) }, token()),
  updatePoolService: async (id: string, body: any): Promise<any> => apiFetch<any>(`/pos/pool/services/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),
  togglePoolService: async (id: string, isAvailable: boolean): Promise<any> => apiFetch<any>(`/pos/pool/services/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ isAvailable }) }, token()),
  deletePoolService: async (id: string): Promise<any> => apiFetch<any>(`/pos/pool/services/${id}`, { method: 'DELETE' }, token()),
  getPoolTransactions: async (): Promise<{ success: true; data: any[] }> => {
    const data = await apiFetch<any[]>('/pos/pool/transactions', {}, token());
    return { success: true, data };
  },
  createPoolTransaction: async (body: any): Promise<any> => apiFetch<any>('/pos/pool/transactions', { method: 'POST', body: JSON.stringify(body) }, token()),
};

// ──────────────────────────────────────────
// Expenses
// ──────────────────────────────────────────
export interface ExpenseRecord {
  id: string;
  expenseNo: string;
  category: string;
  description: string;
  amount: number | string;
  incurredOn: string;
  paymentMethod: string | null;
  vendor: string | null;
  receiptRef: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const expensesApi = {
  list: async (params?: {
    status?: string;
    category?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: true; data: { items: ExpenseRecord[]; total: number } }> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    const data = await apiFetch<{ items: ExpenseRecord[]; total: number }>(`/expenses?${qs}`, {}, token());
    return { success: true, data };
  },

  create: async (body: {
    category: string;
    description: string;
    amount: number;
    incurredOn?: string;
    paymentMethod?: string;
    vendor?: string;
    receiptRef?: string;
    notes?: string;
  }): Promise<ExpenseRecord> =>
    apiFetch<ExpenseRecord>('/expenses', { method: 'POST', body: JSON.stringify(body) }, token()),

  update: async (id: string, body: Partial<{ category: string; description: string; amount: number; incurredOn?: string; paymentMethod?: string; vendor?: string; receiptRef?: string; notes?: string }>): Promise<ExpenseRecord> =>
    apiFetch<ExpenseRecord>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token()),

  setStatus: async (id: string, status: string): Promise<ExpenseRecord> =>
    apiFetch<ExpenseRecord>(`/expenses/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token()),

  remove: async (id: string): Promise<any> =>
    apiFetch<any>(`/expenses/${id}`, { method: 'DELETE' }, token()),
};

// ──────────────────────────────────────────
// Inventory
// ──────────────────────────────────────────
export interface InventoryItemRecord {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  costPrice: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lowStock: boolean;
}

export const inventoryApi = {
  list: async (params?: {
    search?: string;
    category?: string;
    lowStockOnly?: boolean;
    includeInactive?: boolean;
  }): Promise<{ success: true; data: InventoryItemRecord[] }> => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category) qs.set('category', params.category);
    if (params?.lowStockOnly !== undefined) qs.set('lowStockOnly', String(params.lowStockOnly));
    if (params?.includeInactive !== undefined) qs.set('includeInactive', String(params.includeInactive));
    const data = await apiFetch<InventoryItemRecord[]>(`/inventory?${qs}`, {}, token());
    return { success: true, data };
  },

  create: async (body: {
    sku?: string;
    name: string;
    category: string;
    unit: string;
    quantity?: number;
    minQuantity?: number;
    costPrice?: number | null;
    notes?: string;
  }): Promise<InventoryItemRecord> =>
    apiFetch<InventoryItemRecord>('/inventory', { method: 'POST', body: JSON.stringify(body) }, token()),

  update: async (id: string, body: Partial<{ name: string; category: string; unit: string; minQuantity: number; costPrice: number | null; notes: string }>): Promise<InventoryItemRecord> =>
    apiFetch<InventoryItemRecord>(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token()),

  adjustStock: async (id: string, quantityChange: number, reason?: string): Promise<InventoryItemRecord> =>
    apiFetch<InventoryItemRecord>(`/inventory/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ quantityChange, reason }) }, token()),

  remove: async (id: string): Promise<any> =>
    apiFetch<any>(`/inventory/${id}`, { method: 'DELETE' }, token()),
};

// ──────────────────────────────────────────
// Reports & Dashboard
// ──────────────────────────────────────────
export const reportsApi = {
  getDashboardMetrics: async (): Promise<any> => apiFetch<any>('/reports/dashboard', {}, token()),
  getComprehensiveReport: async (startDate?: string, endDate?: string): Promise<{ success: true; data: any }> => {
    const qs = new URLSearchParams();
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    const data = await apiFetch<any>(`/reports/comprehensive?${qs}`, {}, token());
    return { success: true, data };
  },
};

// ──────────────────────────────────────────
// Events
// ──────────────────────────────────────────
export interface EventSpaceRecord {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number;
  pricePerHour: number;
  isActive: boolean;
  _count?: { bookings: number };
  createdAt: string;
  updatedAt: string;
}

export interface EventBookingRecord {
  id: string;
  title: string;
  description: string | null;
  eventSpaceId: string | null;
  eventSpace?: EventSpaceRecord | null;
  startAt: string;
  endAt: string;
  status: 'PLANNED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  guestCount: number;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const eventsApi = {
  list: async (params?: { from?: string; to?: string }): Promise<EventBookingRecord[]> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    return apiFetch<EventBookingRecord[]>(`/events?${qs}`, {}, token());
  },

  get: (id: string): Promise<EventBookingRecord> => apiFetch<EventBookingRecord>(`/events/${id}`, {}, token()),

  create: (body: Partial<EventBookingRecord> & { title: string; startAt: string; endAt: string }): Promise<EventBookingRecord> =>
    apiFetch<EventBookingRecord>('/events', { method: 'POST', body: JSON.stringify(body) }, token()),

  update: (id: string, body: Partial<EventBookingRecord>): Promise<EventBookingRecord> =>
    apiFetch<EventBookingRecord>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),

  cancel: (id: string): Promise<EventBookingRecord> =>
    apiFetch<EventBookingRecord>(`/events/${id}/cancel`, { method: 'POST' }, token()),

  remove: (id: string): Promise<any> => apiFetch<any>(`/events/${id}`, { method: 'DELETE' }, token()),

  spaces: (): Promise<EventSpaceRecord[]> => apiFetch<EventSpaceRecord[]>('/events/spaces', {}, token()),

  createSpace: (body: { name: string; description?: string; location?: string; capacity?: number; pricePerHour?: number; isActive?: boolean }): Promise<EventSpaceRecord> =>
    apiFetch<EventSpaceRecord>('/events/spaces', { method: 'POST', body: JSON.stringify(body) }, token()),

  updateSpace: (id: string, body: Partial<{ name: string; description?: string; location?: string; capacity?: number; pricePerHour?: number; isActive?: boolean }>): Promise<EventSpaceRecord> =>
    apiFetch<EventSpaceRecord>(`/events/spaces/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token()),

  deleteSpace: (id: string): Promise<any> => apiFetch<any>(`/events/spaces/${id}`, { method: 'DELETE' }, token()),
};

// ──────────────────────────────────────────
// System Administration
// ──────────────────────────────────────────
export interface SystemResetResult {
  counts: Record<string, number>;
  resetAt: string;
}

export const systemApi = {
  reset: (confirmText: string, password: string): Promise<SystemResetResult> =>
    apiFetch<SystemResetResult>('/system/reset', {
      method: 'POST',
      body: JSON.stringify({ confirmText, password }),
    }, token()),
};
