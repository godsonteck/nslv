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
