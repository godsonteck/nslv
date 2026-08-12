// ============================================
// NS LUXURY VILLA — Health & System Routes
// /api/v1/health
// ============================================

import { Router, Request, Response } from 'express';
import { prisma, config } from '../config';

const router = Router();

/**
 * GET /api/v1/health
 * System health check (Database ping, uptime, env status)
 */
router.get('/', async (_req: Request, res: Response) => {
  let databaseAvailable = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseAvailable = true;
  } catch {
    databaseAvailable = false;
  }

  res.status(databaseAvailable ? 200 : 503).json({
    success: databaseAvailable,
    data: {
      status: databaseAvailable ? 'ONLINE' : 'DEGRADED',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: { database: databaseAvailable ? 'AVAILABLE' : 'UNAVAILABLE' },
    },
  });
});

export default router;
