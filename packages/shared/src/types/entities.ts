// ============================================
// NS LUXURY VILLA — Core Entity Types
// TypeScript interfaces for all system entities
// ============================================

import type { UserStatus, Department, RoomStatus, ReservationStatus, PaymentStatus, PaymentMethod, FolioItemType, BookingSource, IdDocumentType } from '../constants/enums';
import type { PermissionCode } from '../constants/permissions';

// ──────────────────────────────────────────
// Auth & Users
// ──────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** User with role and permission info (returned after auth) */
export interface AuthUser extends User {
  roles: RoleSummary[];
  permissions: PermissionCode[];
}

/** Minimal role info attached to a user */
export interface RoleSummary {
  id: string;
  name: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  permissions?: PermissionCode[];
}

export interface Permission {
  id: string;
  code: PermissionCode;
  module: string;
  action: string;
  description: string;
}

export interface Session {
  id: string;
  userId: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  expiresAt: string;
  createdAt: string;
}

// ──────────────────────────────────────────
// Audit
// ──────────────────────────────────────────

export interface AuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────
// System Settings
// ──────────────────────────────────────────

export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  category: string;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

// ──────────────────────────────────────────
// Staff (extended user view for management)
// ──────────────────────────────────────────

export interface StaffMember extends User {
  roles: RoleSummary[];
  department: Department | null;
}

// ──────────────────────────────────────────
// Room Types & Rooms
// ──────────────────────────────────────────

export interface RoomAmenity {
  id: string;
  name: string;
  icon: string | null;
  category: string | null;
  createdAt: string;
}

export interface RoomType {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  maxAdults: number;
  maxChildren: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  amenities?: RoomAmenity[];
  rooms?: Room[];
  _count?: { rooms: number };
}

export interface Room {
  id: string;
  number: string;
  name: string | null;
  roomTypeId: string;
  roomType?: RoomType;
  floor: number | null;
  status: RoomStatus;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { reservations: number };
}

// ──────────────────────────────────────────
// Guests
// ──────────────────────────────────────────

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  idDocumentType: IdDocumentType | null;
  idDocumentNumber: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  preferences: string | null;
  notes: string | null;
  isVip: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { reservations: number; checkIns: number };
}

// ──────────────────────────────────────────
// Reservations
// ──────────────────────────────────────────

export interface ReservationGuest {
  id: string;
  reservationId: string;
  guestId: string;
  guest?: Guest;
  isPrimary: boolean;
  createdAt: string;
}

export interface Reservation {
  id: string;
  confirmationNo: string;
  roomId: string;
  room?: Room;
  status: ReservationStatus;
  source: BookingSource;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  baseRate: number;
  discountAmount: number;
  taxAmount: number;
  depositAmount: number;
  totalAmount: number;
  specialRequests: string | null;
  notes: string | null;
  createdBy: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  guests?: ReservationGuest[];
  _count?: { checkIns: number; checkOuts: number; folios: number; payments: number };
}

// ──────────────────────────────────────────
// Check-in / Check-out
// ──────────────────────────────────────────

export interface CheckIn {
  id: string;
  reservationId: string;
  reservation?: Reservation;
  roomId: string;
  room?: Room;
  guestId: string;
  guest?: Guest;
  checkedInBy: string;
  actualCheckIn: string;
  idVerified: boolean;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CheckOut {
  id: string;
  reservationId: string;
  reservation?: Reservation;
  roomId: string;
  room?: Room;
  guestId: string;
  guest?: Guest;
  checkedOutBy: string;
  actualCheckOut: string;
  roomCondition: 'DIRTY' | 'CLEAN' | 'DAMAGED';
  finalBalance: number;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────
// Guest Folios & Payments
// ──────────────────────────────────────────

export interface Folio {
  id: string;
  reservationId: string;
  reservation?: Reservation;
  guestId: string;
  guest?: Guest;
  status: 'OPEN' | 'CLOSED' | 'DISPUTED';
  balance: number;
  createdAt: string;
  closedAt: string | null;
  items?: FolioItem[];
  _count?: { items: number; payments: number };
}

export interface FolioItem {
  id: string;
  folioId: string;
  type: FolioItemType;
  description: string;
  amount: number;
  quantity: number;
  unitPrice: number;
  department: Department;
  referenceId: string | null;
  referenceType: string | null;
  postedBy: string;
  postedAt: string;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
}

export interface Payment {
  id: string;
  reservationId: string | null;
  guestId: string | null;
  folioId: string | null;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  status: PaymentStatus;
  type: 'PAYMENT' | 'REFUND' | 'DEPOSIT' | 'ADJUSTMENT';
  description: string | null;
  processedBy: string;
  processedAt: string;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt: string;
  reservation?: Reservation | null;
  guest?: Guest | null;
  folio?: Folio | null;
}

// ──────────────────────────────────────────
// API Response Types
// ──────────────────────────────────────────

/** Standard API success response */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/** Standard API error response */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Auth tokens returned on login */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Login response */
export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
  requiresTwoFactor?: boolean;
}

/** 2FA setup response */
export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

// ──────────────────────────────────────────
// Query/Filter Types
// ──────────────────────────────────────────

/** Base pagination params */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Audit log query filters */
export interface AuditLogFilters extends PaginationParams {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
}

/** User query filters */
export interface UserFilters extends PaginationParams {
  status?: UserStatus;
  role?: string;
  search?: string;
}

/** Room query filters */
export interface RoomFilters extends PaginationParams {
  status?: RoomStatus;
  roomTypeId?: string;
  floor?: number;
  search?: string;
}

/** RoomType query filters */
export interface RoomTypeFilters extends PaginationParams {
  isActive?: boolean;
  search?: string;
}

/** Guest query filters */
export interface GuestFilters extends PaginationParams {
  search?: string;
  isVip?: boolean;
  country?: string;
}

/** Reservation query filters */
export interface ReservationFilters extends PaginationParams {
  status?: ReservationStatus;
  roomId?: string;
  guestId?: string;
  checkInFrom?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  checkOutTo?: string;
  source?: BookingSource;
  search?: string;
}

/** Payment query filters */
export interface PaymentFilters extends PaginationParams {
  status?: PaymentStatus;
  method?: PaymentMethod;
  reservationId?: string;
  guestId?: string;
  startDate?: string;
  endDate?: string;
}

/** Folio query filters */
export interface FolioFilters extends PaginationParams {
  status?: 'OPEN' | 'CLOSED' | 'DISPUTED';
  reservationId?: string;
  guestId?: string;
}
