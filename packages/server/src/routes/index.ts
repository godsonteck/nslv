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
import themeRoutes from './theme.routes';
import roomsRoutes from './rooms.routes';
import guestsRoutes from './guests.routes';
import reservationsRoutes from './reservations.routes';
import staysRoutes from './stays.routes';
import foliosRoutes from './folios.routes';
import paymentsRoutes from './payments.routes';
import posRoutes from './pos.routes';
import expensesRoutes from './expenses.routes';
import inventoryRoutes from './inventory.routes';
import reportsRoutes from './reports.routes';
import eventsRoutes from './events.routes';

import systemRoutes from './system.routes';
import notificationsRoutes from './notifications.routes';
import categoriesRoutes from './categories.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/audit', auditRoutes);
router.use('/settings', settingsRoutes);
router.use('/theme', themeRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/rooms', roomsRoutes);
router.use('/guests', guestsRoutes);
router.use('/reservations', reservationsRoutes);
router.use('/stays', staysRoutes);
router.use('/folios', foliosRoutes);
router.use('/payments', paymentsRoutes);
router.use('/pos', posRoutes);
router.use('/expenses', expensesRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/reports', reportsRoutes);
router.use('/events', eventsRoutes);
router.use('/system', systemRoutes);

export default router;

