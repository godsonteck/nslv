// ============================================
// NS LUXURY VILLA — Authentication Service
// Password hashing, JWTs, TOTP 2FA, Sessions
// ============================================

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma, config } from '../config';
import { AppError } from '../middleware/error';
import { AuditService } from './audit.service';
import type { JwtPayload } from '../middleware/auth';
import type { PermissionCode } from '@nslv/shared';
import type { ChangePasswordInput, UpdateProfileInput } from '@nslv/shared';

export class AuthService {
  /**
   * Hash password securely with Argon2id
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(hash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch {
      return false;
    }
  }

  /**
   * Fetch all roles and permissions for a user
   */
  static async getUserRolesAndPermissions(userId: string) {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const roles = userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
    }));

    const permissionSet = new Set<PermissionCode>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.code as PermissionCode);
      }
    }

    return {
      roles,
      permissions: Array.from(permissionSet),
    };
  }

  /**
   * Parse an expiry string like '15m', '1h', '7d' (or raw seconds) into seconds.
   */
  private static expiryToSeconds(expiry: string): number {
    const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(expiry.trim());
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    switch ((match[2] || 's').toLowerCase()) {
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return value;
    }
  }

  /**
   * Generate access token and refresh token
   */
  static generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign({ userId: payload.userId }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiry,
    } as jwt.SignOptions);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.expiryToSeconds(config.jwt.accessExpiry),
    };
  }

  /**
   * Login user with email/username + password
   */
  static async login(params: {
    login: string;
    password: string;
    totpCode?: string;
    ipAddress?: string;
    deviceInfo?: string;
  }) {
    const loginNormalized = params.login.toLowerCase().trim();

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: loginNormalized }, { username: loginNormalized }],
      },
    });

    if (!user) {
      await AuditService.log({
        action: 'auth.login_failed',
        resource: 'user',
        afterData: { loginAttempt: params.login, reason: 'User not found' },
        ipAddress: params.ipAddress,
        deviceInfo: params.deviceInfo,
      });
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Your account has been suspended or deactivated.', 403, 'ACCOUNT_INACTIVE');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(user.passwordHash, params.password);
    if (!isPasswordValid) {
      await AuditService.log({
        userId: user.id,
        action: 'auth.login_failed',
        resource: 'user',
        afterData: { reason: 'Incorrect password' },
        ipAddress: params.ipAddress,
        deviceInfo: params.deviceInfo,
      });
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    // Check 2FA if enabled
    if (user.totpEnabled) {
      if (!params.totpCode) {
        return {
          requiresTwoFactor: true,
        };
      }

      if (!user.totpSecret) {
        throw new AppError('2FA configuration error.', 500, 'TOTP_CONFIG_ERROR');
      }

      const isValidTotp = authenticator.verify({
        token: params.totpCode,
        secret: user.totpSecret,
      });

      if (!isValidTotp) {
        await AuditService.log({
          userId: user.id,
          action: 'auth.totp_failed',
          resource: 'user',
          ipAddress: params.ipAddress,
          deviceInfo: params.deviceInfo,
        });
        throw new AppError('Invalid 2FA code.', 401, 'INVALID_TOTP');
      }
    }

    // Get roles & permissions
    const { roles, permissions } = await this.getUserRolesAndPermissions(user.id);

    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      username: user.username,
      roles: roles.map((r) => r.name),
      permissions,
    });

    // Hash refresh token for session storage
    const refreshTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');

    // Create active session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        deviceInfo: params.deviceInfo || null,
        ipAddress: params.ipAddress || null,
        expiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log successful login
    await AuditService.log({
      userId: user.id,
      action: 'auth.login_success',
      resource: 'user',
      ipAddress: params.ipAddress,
      deviceInfo: params.deviceInfo,
    });

    return {
      user: {
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
      },
      tokens,
    };
  }

  /**
   * Refresh access token using valid refresh token
   */
  static async refreshToken(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };
      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      const session = await prisma.session.findFirst({
        where: {
          userId: payload.userId,
          refreshTokenHash,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!session || !session.user || session.user.status !== 'ACTIVE') {
        throw new AppError('Invalid or expired refresh token session.', 401, 'INVALID_SESSION');
      }

      const { roles, permissions } = await this.getUserRolesAndPermissions(session.user.id);

      const tokens = this.generateTokens({
        userId: session.user.id,
        email: session.user.email,
        username: session.user.username,
        roles: roles.map((r) => r.name),
        permissions,
      });

      // Rotate refresh token
      const newRefreshTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
      await prisma.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: newRefreshTokenHash },
      });

      return tokens;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_TOKEN');
    }
  }

  /**
   * Logout session
   */
  static async logout(refreshToken: string, userId?: string) {
    if (refreshToken) {
      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await prisma.session.deleteMany({
        where: { refreshTokenHash },
      });
    }

    if (userId) {
      await AuditService.log({
        userId,
        action: 'auth.logout',
        resource: 'user',
      });
    }
  }

  /** Change password and invalidate every refresh session for the account. */
  static async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('Account is not available.', 403, 'ACCOUNT_INACTIVE');
    }
    if (!(await this.verifyPassword(user.passwordHash, input.currentPassword))) {
      await AuditService.log({ userId, action: 'auth.password_change_failed', resource: 'user' });
      throw new AppError('Current password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await this.hashPassword(input.newPassword), mustChangePassword: false },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);
    await AuditService.log({ userId, action: 'auth.password_changed', resource: 'user' });
  }

  /**
   * Setup 2FA (TOTP)
   */
  static async setup2FA(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, config.villa.name, secret);
    const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);

    // Save temporary secret
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });

    return {
      secret,
      qrCodeUrl,
    };
  }

  /**
   * Verify & enable 2FA
   */
  static async verifyAndEnable2FA(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new AppError('2FA setup not initiated.', 400, 'TOTP_NOT_INITIATED');
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.totpSecret,
    });

    if (!isValid) {
      throw new AppError('Invalid 2FA code. Please try again.', 400, 'INVALID_TOTP');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });

    await AuditService.log({
      userId,
      action: 'auth.2fa_enabled',
      resource: 'user',
    });

    return { message: '2FA successfully enabled.' };
  }

  /**
   * Get the current user's full profile with roles & permissions
   */
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const { roles, permissions } = await this.getUserRolesAndPermissions(user.id);

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

  /** Update the current user's own profile (name, username, phone, avatar). */
  static async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('Account is not available.', 403, 'ACCOUNT_INACTIVE');
    }

    if (input.username && input.username !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username: input.username } });
      if (existing) {
        throw new AppError('This username is already in use.', 409, 'USERNAME_EXISTS');
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.username ? { username: input.username } : {}),
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });

    await AuditService.log({
      userId,
      action: 'auth.profile_updated',
      resource: 'user',
      beforeData: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phone: user.phone,
        hasAvatar: !!user.avatarUrl,
      },
      afterData: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        username: updated.username,
        phone: updated.phone,
        hasAvatar: !!updated.avatarUrl,
      },
    });

    return this.getProfile(userId);
  }
}
