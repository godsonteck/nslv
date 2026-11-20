// ============================================
// NS LUXURY VILLA — Guest Account Routes
// Public site authentication (separate from staff auth).
// ============================================

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { GuestAuthService } from '../services/guest-auth.service';
import { authenticateGuest, GuestAuthenticatedRequest } from '../middleware/guest-auth';
import { validateBody } from '../middleware/validate';
import {
  guestForgotPasswordSchema,
  guestLoginSchema,
  guestRefreshTokenSchema,
  guestRegisterSchema,
  guestResetPasswordSchema,
  guestVerifyEmailSchema,
} from '@nslv/shared';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many attempts. Please try again later.' } },
});

router.post('/register', authLimiter, validateBody(guestRegisterSchema), async (req, res, next) => {
  try {
    const data = await GuestAuthService.register({
      ...req.body,
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/login', authLimiter, validateBody(guestLoginSchema), async (req, res, next) => {
  try {
    const data = await GuestAuthService.login({
      ...req.body,
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', validateBody(guestRefreshTokenSchema), async (req, res, next) => {
  try {
    const data = await GuestAuthService.refresh(req.body.refreshToken, req.ip, req.headers['user-agent']);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    await GuestAuthService.logout(req.body?.refreshToken);
    res.json({ success: true, data: { loggedOut: true } });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticateGuest, async (req, res, next) => {
  try {
    const data = await GuestAuthService.me((req as GuestAuthenticatedRequest).guest.guestAccountId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-email', validateBody(guestVerifyEmailSchema), async (req, res, next) => {
  try {
    const data = await GuestAuthService.verifyEmail(req.body.token);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/resend-verification', authLimiter, validateBody(guestForgotPasswordSchema), async (req, res, next) => {
  try {
    const data = await GuestAuthService.resendVerification(req.body.email);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', authLimiter, validateBody(guestForgotPasswordSchema), async (req, res, next) => {
  try {
    const data = await GuestAuthService.forgotPassword(req.body.email);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', validateBody(guestResetPasswordSchema), async (req, res, next) => {
  try {
    const data = await GuestAuthService.resetPassword(req.body.token, req.body.password);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
