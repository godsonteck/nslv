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
  let dbStatus = 'DISCONNECTED';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'CONNECTED';
  } catch (error) {
    dbStatus = `ERROR: ${(error as Error).message}`;
  }

  res.status(200).json({
    success: true,
    data: {
      status: 'ONLINE',
      system: config.villa.name,
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbStatus,
      environment: config.nodeEnv,
      timezone: config.villa.timezone,
    },
  });
});

export default router;
