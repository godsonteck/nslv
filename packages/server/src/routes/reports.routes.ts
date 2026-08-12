// ============================================
// NS LUXURY VILLA — Reports & Dashboard Routes
// ============================================

import { Router } from 'express';
import { ReportService } from '../services/reports.service';
import { authenticate, requirePermission, verifyActiveUser } from '../middleware/auth';

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
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    const data = await ReportService.getComprehensiveReport(start, end);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
