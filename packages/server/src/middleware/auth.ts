// ============================================
// NS LUXURY VILLA — Authentication Middleware
// JWT verification and user context injection
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, prisma } from '../config';
import type { PermissionCode } from '@nslv/shared';

/** Decoded JWT payload */
export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  roles: string[];
  permissions: PermissionCode[];
  iat: number;
  exp: number;
}

/** Extended Request with authenticated user context */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

/**
 * Middleware: Verify JWT access token from Authorization header.
 * Attaches user context to request on success.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;

    // Attach user context
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please log in again.',
        },
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token.',
      },
    });
  }
}

/**
 * Middleware: Check if the authenticated user has the required permission(s).
 * Must be used AFTER authenticate middleware.
 *
 * @example router.get('/users', authenticate, requirePermission('users.view'), handler)
 */
export function requirePermission(...requiredPermissions: PermissionCode[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    const userPermissions = new Set(authReq.user.permissions);
    const hasAll = requiredPermissions.every((p) => userPermissions.has(p));

    if (!hasAll) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: Check if user has ANY of the listed permissions (OR logic).
 */
export function requireAnyPermission(...permissions: PermissionCode[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
      return;
    }

    const userPermissions = new Set(authReq.user.permissions);
    const hasAny = permissions.some((p) => userPermissions.has(p));

    if (!hasAny) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' },
      });
      return;
    }

    next();
  };
}

/**
 * Verify that the user's account is still active.
 * Called on sensitive operations to catch suspended/deactivated users mid-session.
 */
export async function verifyActiveUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.userId },
      select: { status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Your account is no longer active. Please contact an administrator.',
        },
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to verify account status.' },
    });
  }
}
