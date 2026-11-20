// ============================================
// NS LUXURY VILLA — Guest Account Service
// Email/password accounts for the public booking site.
// ============================================

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma, config } from '../config';
import { AppError } from '../middleware/error';
import { AuthService } from './auth.service';
import { MessagingService } from './messaging.service';

type GuestAccountWithGuest = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  status: string;
  createdAt: Date;
  guest?: { firstName: string; lastName: string | null; phone: string | null } | null;
};

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function expiryToSeconds(expiry: string): number {
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

function refreshExpiryDate(): Date {
  return new Date(Date.now() + expiryToSeconds(config.jwt.refreshExpiry) * 1000);
}

function appUrl(path: string): string {
  const base = config.clientUrl.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export class GuestAuthService {
  static sanitize(account: GuestAccountWithGuest | null) {
    if (!account) return null;
    return {
      id: account.id,
      email: account.email,
      emailVerified: !!account.emailVerifiedAt,
      status: account.status,
      firstName: account.guest?.firstName || '',
      lastName: account.guest?.lastName || '',
      phone: account.guest?.phone || null,
      createdAt: account.createdAt.toISOString(),
    };
  }

  private static generateTokens(account: { id: string; email: string }) {
    const accessToken = jwt.sign(
      {
        guestAccountId: account.id,
        email: account.email,
        tokenType: 'GUEST',
      },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiry } as jwt.SignOptions,
    );

    const refreshToken = jwt.sign(
      { guestAccountId: account.id, tokenType: 'GUEST_REFRESH' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiry } as jwt.SignOptions,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: expiryToSeconds(config.jwt.accessExpiry),
    };
  }

  /** Store a hashed refresh token so a logout can revoke the session. */
  private static async createSession(
    guestAccountId: string,
    refreshToken: string,
    ipAddress?: string,
    deviceInfo?: string,
  ) {
    await prisma.guestSession.create({
      data: {
        guestAccountId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiryDate(),
        ipAddress: ipAddress || null,
        deviceInfo: deviceInfo || null,
      },
    });
  }

  private static async issueToken(guestAccountId: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET', ttlMs: number) {
    const raw = crypto.randomBytes(32).toString('hex');
    await prisma.guestAuthToken.updateMany({
      where: { guestAccountId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.guestAuthToken.create({
      data: {
        guestAccountId,
        type,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return raw;
  }

  /** Queue the verification email. In mock mode it is visible in the outbox. */
  static async sendVerificationEmail(guestAccountId: string, email: string, firstName: string) {
    const token = await this.issueToken(guestAccountId, 'EMAIL_VERIFY', EMAIL_VERIFY_TTL_MS);
    const link = appUrl(`/guest/verify?token=${token}`);
    await MessagingService.queueEmail({
      recipient: email,
      subject: 'Verify your NS Villa guest account',
      template: 'GUEST_VERIFY_EMAIL',
      body: `Hello ${firstName || 'there'},\n\nWelcome to NS Luxury Villa. Verify your email address to secure your guest account:\n\n${link}\n\nThis link expires in 24 hours.\n\n— NS Luxury Villa`,
      payload: { link },
      relatedType: 'guest_account',
      relatedId: guestAccountId,
    });
    return token;
  }

  /** Create an account for an existing guest, or return the existing account. */
  static async createAccountForGuest(params: {
    guestId: string;
    email: string;
    password: string;
    firstName: string;
  }) {
    const normalizedEmail = params.email.toLowerCase().trim();
    const existing = await prisma.guestAccount.findUnique({
      where: { email: normalizedEmail },
      include: { guest: true },
    });
    if (existing) return existing;

    const passwordHash = await AuthService.hashPassword(params.password);
    const account = await prisma.guestAccount.create({
      data: { guestId: params.guestId, email: normalizedEmail, passwordHash },
      include: { guest: true },
    });
    await this.sendVerificationEmail(account.id, account.email, params.firstName);
    return account;
  }

  static async register(params: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    ipAddress?: string;
    deviceInfo?: string;
  }) {
    const email = params.email.toLowerCase().trim();

    const existingAccount = await prisma.guestAccount.findUnique({ where: { email } });
    if (existingAccount) {
      throw new AppError('An account with this email already exists. Please sign in instead.', 409, 'GUEST_ACCOUNT_EXISTS');
    }

    let guest = await prisma.guest.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { account: true },
    });
    if (guest?.account) {
      throw new AppError('An account with this email already exists. Please sign in instead.', 409, 'GUEST_ACCOUNT_EXISTS');
    }
    // A guest record without an account can already hold past reservations from
    // a booking made without signing up. Creating the account here is fine, but
    // it stays locked until the address is verified.
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          firstName: params.firstName.trim(),
          lastName: params.lastName.trim(),
          email,
          phone: params.phone.trim(),
        },
        include: { account: true },
      });
    }

    const passwordHash = await AuthService.hashPassword(params.password);
    const account = await prisma.guestAccount.create({
      data: { guestId: guest.id, email, passwordHash },
      include: { guest: true },
    });

    await this.sendVerificationEmail(account.id, account.email, account.guest.firstName);

    // No session before the inbox is proven. Otherwise anyone who knows a past
    // guest's email could register and read that guest's stays.
    return { account: this.sanitize(account), tokens: null, requiresVerification: true };
  }

  static async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    deviceInfo?: string;
  }) {
    const email = params.email.toLowerCase().trim();
    const account = await prisma.guestAccount.findUnique({
      where: { email },
      include: { guest: true },
    });
    if (!account) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }
    if (account.status !== 'ACTIVE') {
      throw new AppError('This account has been disabled. Please contact the villa.', 403, 'ACCOUNT_INACTIVE');
    }

    const valid = await AuthService.verifyPassword(account.passwordHash, params.password);
    if (!valid) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!account.emailVerifiedAt) {
      throw new AppError(
        'Verify your email address before signing in. Open the verification link we sent you.',
        403,
        'EMAIL_NOT_VERIFIED',
      );
    }

    const tokens = this.generateTokens(account);
    await this.createSession(account.id, tokens.refreshToken, params.ipAddress, params.deviceInfo);
    await prisma.guestAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });

    return { account: this.sanitize(account), tokens };
  }

  static async refresh(refreshToken: string, ipAddress?: string, deviceInfo?: string) {
    let payload: { guestAccountId?: string; tokenType?: string };
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as typeof payload;
    } catch {
      throw new AppError('Your session has expired. Please sign in again.', 401, 'INVALID_REFRESH_TOKEN');
    }
    if (payload.tokenType !== 'GUEST_REFRESH' || !payload.guestAccountId) {
      throw new AppError('Invalid refresh token.', 401, 'INVALID_REFRESH_TOKEN');
    }

    const session = await prisma.guestSession.findFirst({
      where: {
        guestAccountId: payload.guestAccountId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) {
      throw new AppError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED');
    }

    const account = await prisma.guestAccount.findUnique({
      where: { id: payload.guestAccountId },
      include: { guest: true },
    });
    if (!account || account.status !== 'ACTIVE') {
      throw new AppError('This account is unavailable.', 403, 'ACCOUNT_INACTIVE');
    }

    // Rotate the refresh token: the old session can never be replayed.
    await prisma.guestSession.delete({ where: { id: session.id } });
    const tokens = this.generateTokens(account);
    await this.createSession(account.id, tokens.refreshToken, ipAddress, deviceInfo);

    return { account: this.sanitize(account), tokens };
  }

  static async logout(refreshToken?: string) {
    if (!refreshToken) return;
    try {
      await prisma.guestSession.deleteMany({ where: { refreshTokenHash: hashToken(refreshToken) } });
    } catch {
      // Logout is idempotent.
    }
  }

  static async me(guestAccountId: string) {
    const account = await prisma.guestAccount.findUnique({
      where: { id: guestAccountId },
      include: { guest: true },
    });
    if (!account) throw new AppError('Guest account not found.', 404, 'GUEST_ACCOUNT_NOT_FOUND');
    return this.sanitize(account);
  }

  /** Re-issue a verification email. Always reports success so it cannot enumerate accounts. */
  static async resendVerification(emailInput: string) {
    const email = emailInput.toLowerCase().trim();
    const account = await prisma.guestAccount.findUnique({ where: { email }, include: { guest: true } });
    if (!account || account.status !== 'ACTIVE' || account.emailVerifiedAt) return { sent: true };
    await this.sendVerificationEmail(account.id, account.email, account.guest?.firstName || 'there');
    return { sent: true };
  }

  static async verifyEmail(rawToken: string) {
    const token = await prisma.guestAuthToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { guestAccount: true },
    });
    if (!token || token.type !== 'EMAIL_VERIFY' || token.usedAt || token.expiresAt <= new Date()) {
      throw new AppError('This verification link is invalid or has expired.', 400, 'INVALID_VERIFICATION_TOKEN');
    }
    await prisma.$transaction([
      prisma.guestAuthToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      prisma.guestAccount.update({ where: { id: token.guestAccountId }, data: { emailVerifiedAt: new Date() } }),
    ]);
    return { verified: true };
  }

  static async forgotPassword(emailInput: string) {
    const email = emailInput.toLowerCase().trim();
    const account = await prisma.guestAccount.findUnique({ where: { email }, include: { guest: true } });
    // Always return the same response so the endpoint cannot be used to discover accounts.
    if (!account || account.status !== 'ACTIVE') return { sent: true };

    const rawToken = await this.issueToken(account.id, 'PASSWORD_RESET', PASSWORD_RESET_TTL_MS);
    const link = appUrl(`/guest/reset?token=${rawToken}`);
    await MessagingService.queueEmail({
      recipient: account.email,
      subject: 'Reset your NS Villa guest password',
      template: 'GUEST_PASSWORD_RESET',
      body: `Hello ${account.guest.firstName || 'there'},\n\nWe received a request to reset your NS Villa guest password. Use this link to choose a new password:\n\n${link}\n\nThis link expires in 1 hour. If you did not request a reset, you can ignore this email.\n\n— NS Luxury Villa`,
      payload: { link },
      relatedType: 'guest_account',
      relatedId: account.id,
    });
    return { sent: true };
  }

  static async resetPassword(rawToken: string, password: string) {
    const token = await prisma.guestAuthToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!token || token.type !== 'PASSWORD_RESET' || token.usedAt || token.expiresAt <= new Date()) {
      throw new AppError('This reset link is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
    }

    const passwordHash = await AuthService.hashPassword(password);
    await prisma.$transaction([
      prisma.guestAuthToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      prisma.guestAccount.update({ where: { id: token.guestAccountId }, data: { passwordHash } }),
      prisma.guestSession.deleteMany({ where: { guestAccountId: token.guestAccountId } }),
    ]);
    return { reset: true };
  }
}
