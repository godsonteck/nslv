// ============================================
// NS LUXURY VILLA — Status Enums
// Centralized status definitions for all entities
// ============================================

/** User account status */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

/** Room availability/operational status */
export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  OCCUPIED = 'OCCUPIED',
  DIRTY = 'DIRTY',
  CLEANING = 'CLEANING',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

/** Reservation lifecycle status */
export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

/** Payment completion status */
export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

/** Accepted payment methods */
export enum PaymentMethod {
  CASH = 'CASH',
  MOBILE_MONEY = 'MOBILE_MONEY',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  ROOM_CHARGE = 'ROOM_CHARGE',
  OTHER = 'OTHER',
}

/** Restaurant/Bar order status */
export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Expense approval status */
export enum ExpenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

/** Folio item type — what generated the charge */
export enum FolioItemType {
  ACCOMMODATION = 'ACCOMMODATION',
  RESTAURANT = 'RESTAURANT',
  BAR = 'BAR',
  POOL = 'POOL',
  SERVICE = 'SERVICE',
  DISCOUNT = 'DISCOUNT',
  TAX = 'TAX',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  DEPOSIT = 'DEPOSIT',
}

/** Inventory transaction type */
export enum InventoryTransactionType {
  STOCK_IN = 'STOCK_IN',
  STOCK_OUT = 'STOCK_OUT',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
  WASTE = 'WASTE',
}

/** Pool entry type */
export enum PoolEntryType {
  GUEST = 'GUEST',
  EXTERNAL_VISITOR = 'EXTERNAL_VISITOR',
}

/** Notification priority */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/** Booking source */
export enum BookingSource {
  WALK_IN = 'WALK_IN',
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  WEBSITE = 'WEBSITE',
  WHATSAPP = 'WHATSAPP',
  OTA = 'OTA',
  REFERRAL = 'REFERRAL',
  OTHER = 'OTHER',
}

/** ID document types for guest registration */
export enum IdDocumentType {
  PASSPORT = 'PASSPORT',
  NATIONAL_ID = 'NATIONAL_ID',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  VOTER_ID = 'VOTER_ID',
  GHANA_CARD = 'GHANA_CARD',
  OTHER = 'OTHER',
}

/** Sync operation status */
export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCING = 'SYNCING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CONFLICT = 'CONFLICT',
}

/** Department classification */
export enum Department {
  FRONT_DESK = 'FRONT_DESK',
  RESTAURANT = 'RESTAURANT',
  BAR = 'BAR',
  POOL = 'POOL',
  HOUSEKEEPING = 'HOUSEKEEPING',
  MAINTENANCE = 'MAINTENANCE',
  MANAGEMENT = 'MANAGEMENT',
  ADMINISTRATION = 'ADMINISTRATION',
}
