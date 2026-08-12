// ============================================
// NS LUXURY VILLA — Auth Routes
// /api/v1/auth
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  loginSchema,
  refreshTokenSchema,
  totpVerifySchema,
  changePasswordSchema,
  updateProfileSchema,
} from '@nslv/shared';

const router = Router();

/**
 * POST /api/v1/auth/login
 * User login with credentials (+ optional 2FA code)
 */
router.post(
  '/login',
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ipAddress = (req.ip as string) || req.socket.remoteAddress || '';
      const deviceInfo = req.headers['user-agent'] || '';

      const result = await AuthService.login({
        ...req.body,
        ipAddress,
        deviceInfo,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await AuthService.refreshToken(req.body.refreshToken);
      res.status(200).json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/auth/logout
 * Invalidate session refresh token
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const refreshToken = req.body.refreshToken;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    await AuthService.logout(refreshToken, userId);

    res.status(200).json({
      success: true,
      message: 'Successfully logged out.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await AuthService.getProfile(authReq.user.userId);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/** Update the current user's own profile (name, username, phone, avatar). */
router.patch(
  '/me',
  authenticate,
  validateBody(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await AuthService.updateProfile(authReq.user.userId, req.body);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  },
);

/** Change the current user's password and invalidate existing sessions. */
router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      await AuthService.changePassword(authReq.user.userId, req.body);
      res.status(200).json({ success: true, message: 'Password changed. Please sign in again.' });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/auth/2fa/setup
 * Initiate 2FA setup (returns QR code)
 */
router.post('/2fa/setup', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await AuthService.setup2FA(authReq.user.userId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/verify
 * Verify code & enable 2FA
 */
router.post(
  '/2fa/verify',
  authenticate,
  validateBody(totpVerifySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await AuthService.verifyAndEnable2FA(authReq.user.userId, req.body.code);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
