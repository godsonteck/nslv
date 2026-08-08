// ============================================
// NS LUXURY VILLA — API v1 Master Router
// /api/v1
// ============================================

import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import roleRoutes from './role.routes';
import auditRoutes from './audit.routes';
import healthRoutes from './health.routes';
import settingsRoutes from './settings.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/audit', auditRoutes);
router.use('/settings', settingsRoutes);

export default router;
