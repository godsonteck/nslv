// ============================================
// NS LUXURY VILLA — Validation Schemas
// Zod schemas shared between client and server
// ============================================

import { z } from 'zod';

// ──────────────────────────────────────────
// Common Validators
// ──────────────────────────────────────────

/** Strong password: min 8 chars, uppercase, lowercase, number, special char */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .max(255)
  .transform((v) => v.toLowerCase().trim());

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must not exceed 50 characters')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, hyphens, and underscores')
  .transform((v) => v.toLowerCase().trim());

export const phoneSchema = z
  .string()
  .regex(/^\+?[0-9\s-]{7,20}$/, 'Please enter a valid phone number')
  .optional()
  .nullable();

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must not exceed 100 characters')
  .trim();

export const uuidSchema = z.string().uuid('Invalid ID format');

// ──────────────────────────────────────────
// Auth Schemas
// ──────────────────────────────────────────

export const loginSchema = z.object({
  login: z
    .string()
    .min(1, 'Email or username is required')
    .max(255)
    .trim(),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().length(6, 'Code must be 6 digits').optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const totpVerifySchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

// ──────────────────────────────────────────
// User Management Schemas
// ──────────────────────────────────────────

export const createUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  roleId: uuidSchema,
});

export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema,
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  roleId: uuidSchema.optional(),
});

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema,
  avatarUrl: z
    .string()
    .max(2_000_000, 'Avatar image must be smaller than 2MB')
    .optional()
    .nullable(),
});

// ──────────────────────────────────────────
// Role Management Schemas
// ──────────────────────────────────────────

export const createRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters').max(50).trim(),
  description: z.string().max(255).optional().nullable(),
  permissionCodes: z.array(z.string()).min(1, 'At least one permission must be assigned'),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  description: z.string().max(255).optional().nullable(),
  permissionCodes: z.array(z.string()).optional(),
});

// ──────────────────────────────────────────
// System Settings Schemas
// ──────────────────────────────────────────

export const updateSettingSchema = z.object({
  value: z.unknown(),
});

// ──────────────────────────────────────────
// Domain Schemas — write endpoints across the API
// ──────────────────────────────────────────

const positiveNumber = z.coerce.number({ invalid_type_error: 'Must be a number' }).positive('Must be greater than zero');
const nonNegativeNumber = z.coerce.number({ invalid_type_error: 'Must be a number' }).nonnegative('Cannot be negative');
const wholeNumber = z.coerce.number({ invalid_type_error: 'Must be a number' }).int('Must be a whole number').nonnegative('Cannot be negative');
const positiveInt = z.coerce.number({ invalid_type_error: 'Must be a number' }).int('Must be a whole number').positive('Must be at least 1');
const isoDateString = z.string().min(1, 'A date is required').max(40);
const optionalString = z.string().max(2000).trim().optional().nullable();

// ── Rooms ──
export const createRoomTypeSchema = z.object({
  name: nameSchema,
  description: optionalString,
  basePrice: positiveNumber,
  maxAdults: wholeNumber.optional(),
  maxChildren: wholeNumber.optional(),
  amenityIds: z.array(uuidSchema).optional(),
});
export const updateRoomTypeSchema = createRoomTypeSchema.partial();

export const createRoomSchema = z.object({
  number: z.string().min(1, 'Room number is required').max(20).trim(),
  name: z.string().max(100).trim().optional(),
  roomTypeId: uuidSchema,
  floor: wholeNumber.optional(),
  notes: optionalString,
});
// Updates distinguish an omitted property (leave unchanged) from a deliberate
// clear (store null). Create validation intentionally remains stricter.
export const updateRoomSchema = z.object({
  number: z.string().min(1, 'Room number is required').max(20).trim().optional(),
  name: z.string().max(100).trim().nullable().optional(),
  roomTypeId: uuidSchema.optional(),
  floor: wholeNumber.nullable().optional(),
  notes: optionalString,
});

export const updateRoomStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE']),
  notes: z.string().max(500).trim().optional(),
});

// ── Guests ──
export const createGuestSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema.optional().nullable(),
  phone: phoneSchema,
  address: optionalString,
  city: optionalString,
  country: optionalString,
  idDocumentType: z.string().max(50).trim().optional(),
  idDocumentNumber: z.string().max(100).trim().optional(),
  dateOfBirth: isoDateString.optional(),
  nationality: optionalString,
  preferences: optionalString,
  notes: optionalString,
  isVip: z.boolean().optional(),
});
export const updateGuestSchema = createGuestSchema.partial();

// ── Stays ──
export const checkInSchema = z.object({
  reservationId: uuidSchema,
  idVerified: z.boolean().optional(),
  idDocumentType: z.string().max(50).trim().optional(),
  idDocumentNumber: z.string().max(100).trim().optional(),
  notes: optionalString,
});
export const checkOutSchema = z.object({
  reservationId: uuidSchema,
  roomCondition: z.enum(['DIRTY', 'CLEAN', 'DAMAGED']).optional(),
  paymentMethod: z.string().max(50).optional(),
  notes: optionalString,
});

// ── Payments ──
export const processPaymentSchema = z.object({
  folioId: uuidSchema.optional(),
  reservationId: uuidSchema.optional(),
  guestId: uuidSchema.optional(),
  amount: positiveNumber,
  currency: z.string().max(10).optional(),
  method: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER']),
  reference: z.string().max(100).trim().optional(),
  // Every write to the payments ledger must be retry-safe.  This is required
  // rather than optional so a repeated browser submission cannot become a
  // second settlement entry.
  idempotencyKey: uuidSchema,
  description: z.string().max(500).trim().optional(),
});

export const refundPaymentSchema = z.object({
  amount: positiveNumber,
  method: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER']).optional(),
  reference: z.string().max(100).trim().optional(),
  reason: z.string().min(3, 'A refund reason is required').max(500).trim(),
  idempotencyKey: uuidSchema,
});

// ── POS ──
const paymentMethodEnum = z.enum(['ROOM_CHARGE', 'CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER']);
export const createPOSItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100).trim(),
  category: z.string().min(1, 'Category is required').max(50).trim(),
  price: positiveNumber,
  description: optionalString,
});
export const updatePOSItemSchema = createPOSItemSchema.partial();
export const setAvailabilitySchema = z.object({
  isAvailable: z.boolean().default(true),
});

export const createOrderSchema = z.object({
  guestId: uuidSchema.optional(),
  roomId: uuidSchema.optional(),
  tableNo: z.string().max(20).trim().optional(),
  paymentMethod: paymentMethodEnum,
  notes: optionalString,
  idempotencyKey: uuidSchema,
  items: z
    .array(z.object({ itemId: uuidSchema, quantity: positiveInt, notes: optionalString }))
    .min(1, 'At least one item is required'),
});

export const createPoolAttendanceSchema = z.object({
  visitorName: z.string().min(1, 'Visitor name is required').max(100).trim(),
  phone: z.string().max(20).optional(),
  partySize: positiveInt,
  notes: optionalString,
});

export const createPoolTransactionSchema = z.object({
  guestId: uuidSchema.optional(),
  roomId: uuidSchema.optional(),
  serviceId: uuidSchema,
  quantity: positiveInt,
  paymentMethod: paymentMethodEnum,
  notes: optionalString,
  idempotencyKey: uuidSchema,
});

// ── Reservations ──
const reservationCommon = {
  checkInDate: isoDateString,
  checkOutDate: isoDateString,
  source: z.string().max(50).trim().optional(),
  specialRequests: optionalString,
  notes: optionalString,
};
export const createReservationSchema = z.object({
  ...reservationCommon,
  guestId: uuidSchema,
  roomId: uuidSchema,
  adults: wholeNumber.optional(),
  children: wholeNumber.optional(),
  baseRate: positiveNumber.optional(),
  discountAmount: nonNegativeNumber.optional(),
  taxAmount: nonNegativeNumber.optional(),
  depositAmount: nonNegativeNumber.optional(),
  bookingId: uuidSchema.optional(),
  additionalGuestIds: z.array(uuidSchema).optional(),
});
export const createMultiReservationSchema = z.object({
  ...reservationCommon,
  rooms: z
    .array(
      z.object({
        roomId: uuidSchema,
        guestId: uuidSchema,
        adults: wholeNumber.optional(),
        children: wholeNumber.optional(),
        additionalGuestIds: z.array(uuidSchema).optional(),
      }),
    )
    .min(1, 'At least one room is required'),
});
export const attachGuestsSchema = z.object({
  guestIds: z.array(uuidSchema).min(1, 'At least one guest is required'),
});
export const cancelReservationSchema = z.object({
  reason: z.string().max(500).trim().optional(),
});

// ── Folios ──
export const createFolioChargeSchema = z.object({
  type: z.enum(['ACCOMMODATION', 'RESTAURANT', 'BAR', 'POOL', 'SERVICE', 'DISCOUNT', 'TAX']),
  description: z.string().min(1, 'Description is required').max(500).trim(),
  amount: positiveNumber,
  quantity: positiveInt.optional(),
  unitPrice: nonNegativeNumber,
  department: z.string().min(1, 'Department is required').max(50).trim(),
  referenceId: z.string().max(100).optional(),
  referenceType: z.string().max(50).optional(),
});
export const voidFolioChargeSchema = z.object({
  reason: z.string().max(500).trim().optional(),
});

// ── Expenses ──
export const createExpenseSchema = z.object({
  category: z.string().min(1, 'Category is required').max(50).trim(),
  description: z.string().min(1, 'Description is required').max(500).trim(),
  amount: positiveNumber,
  incurredOn: isoDateString.optional(),
  paymentMethod: z.string().max(50).optional(),
  vendor: z.string().max(100).trim().optional(),
  receiptRef: z.string().max(100).trim().optional(),
  notes: optionalString,
});
export const updateExpenseSchema = createExpenseSchema.partial();
export const setStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
});

// ── Inventory ──
export const createInventoryItemSchema = z.object({
  sku: z.string().max(100).trim().optional(),
  name: z.string().min(1, 'Item name is required').max(100).trim(),
  category: z.string().min(1, 'Category is required').max(50).trim(),
  unit: z.string().min(1, 'Unit is required').max(30).trim(),
  quantity: wholeNumber.optional(),
  minQuantity: wholeNumber.optional(),
  costPrice: z.coerce.number().nonnegative().nullable().optional(),
  notes: optionalString,
});
export const updateInventoryItemSchema = createInventoryItemSchema.partial();
export const adjustStockSchema = z.object({
  quantityChange: z.coerce.number({ invalid_type_error: 'Must be a number' }).int('Must be a whole number').refine((v) => v !== 0, 'Cannot be zero'),
  reason: z.string().max(500).trim().optional(),
});

// ── Events ──
export const createEventSpaceSchema = z.object({
  name: z.string().min(1, 'Space name is required').max(100).trim(),
  description: optionalString,
  location: z.string().max(100).trim().optional(),
  capacity: positiveInt.optional(),
  pricePerHour: nonNegativeNumber.optional(),
  isActive: z.boolean().optional(),
});
export const updateEventSpaceSchema = createEventSpaceSchema.partial();

export const createEventBookingSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(120).trim(),
  description: optionalString,
  eventSpaceId: uuidSchema.nullable().optional(),
  startAt: isoDateString,
  endAt: isoDateString,
  status: z.enum(['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  guestCount: wholeNumber.optional(),
  contactName: z.string().max(100).trim().optional(),
  contactPhone: z.string().max(30).optional(),
  contactEmail: emailSchema.optional().nullable(),
  notes: optionalString,
});
export const updateEventBookingSchema = createEventBookingSchema.partial();

// ── System ──
export const resetSystemSchema = z.object({
  confirmText: z.literal('RESET', { invalid_type_error: 'Type RESET to confirm' }),
  password: z.string().min(1, 'Your password is required'),
});

// ── Imports ──
export const runImportSchema = z.object({
  target: z.enum(['MENU', 'BAR', 'POOL', 'INVENTORY', 'STOCK']),
  columns: z.array(z.string().max(100)),
  rows: z.array(z.array(z.string().max(500))),
  mapping: z
    .object({
      name: z.string().optional(),
      price: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      sku: z.string().optional(),
      unit: z.string().optional(),
      quantity: z.string().optional(),
      minQuantity: z.string().optional(),
      costPrice: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  defaults: z
    .object({
      category: z.string().optional(),
      unit: z.string().optional(),
      quantity: z.string().optional(),
      minQuantity: z.string().optional(),
      costPrice: z.string().optional(),
    })
    .optional(),
});

// ──────────────────────────────────────────
// Pagination Schema
// ──────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const auditLogFilterSchema = paginationSchema.extend({
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const userFilterSchema = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  role: z.string().optional(),
  search: z.string().optional(),
});

// ──────────────────────────────────────────
// Type Inference Helpers
// ──────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
