// ============================================
// NS LUXURY VILLA — Guest (public site) Authentication
// Separate token audience from staff JWTs.
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface GuestJwtPayload {
  guestAccountId: string;
  email: string;
  tokenType: 'GUEST';
  iat: number;
  exp: number;
}

export interface GuestAuthenticatedRequest extends Request {
  guest: GuestJwtPayload;
}

export function authenticateGuest(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please sign in to view your bookings.' },
    });
    return;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), config.jwt.accessSecret) as GuestJwtPayload;
    if (payload.tokenType !== 'GUEST' || !payload.guestAccountId) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid guest session.' },
      });
      return;
    }
    (req as GuestAuthenticatedRequest).guest = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Your session has expired. Please sign in again.' },
      });
      return;
    }
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid guest session.' },
    });
  }
}
