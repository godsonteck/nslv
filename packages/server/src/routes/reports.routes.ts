// ============================================
// NS LUXURY VILLA — Reports & Dashboard Routes
// ============================================

import { Router } from 'express';
import { ReportService } from '../services/reports.service';
import { DailyCloseService } from '../services/daily-close.service';
import { authenticate, requirePermission, verifyActiveUser } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { dailyCloseSchema } from '@nslv/shared';

const router = Router();
router.use(authenticate, verifyActiveUser);

// Get Dashboard Overview Metrics
router.get('/dashboard', requirePermission('dashboard.view'), async (_req, res, next) => {
  try {
    const data = await ReportService.getDashboardMetrics();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Get Comprehensive Financial / Operational Report
router.get('/comprehensive', requirePermission('reports.view'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    // Client sends YYYY-MM-DD. Parse start as start-of-day and end as end-of-day
    // so `lte` covers the full end date instead of excluding it. Full ISO
    // timestamps (from other callers) are parsed as-is.
    const parseBound = (value: string, boundary: 'start' | 'end') => {
      if (!value) return undefined;
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}${boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`
        : value;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? undefined : d;
    };
    const data = await ReportService.getComprehensiveReport(
      parseBound(String(startDate ?? ''), 'start'),
      parseBound(String(endDate ?? ''), 'end'),
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/daily-close/preview', requirePermission('reports.financial'), async (req, res, next) => {
  try {
    const data = await DailyCloseService.preview(String(req.query.businessDate || ''));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.post('/daily-close', requirePermission('reports.financial'), validateBody(dailyCloseSchema), async (req, res, next) => {
  try {
    const data = await DailyCloseService.close(req.body, (req as AuthenticatedRequest).user.userId);
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

export default router;
