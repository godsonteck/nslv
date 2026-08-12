// ============================================
// NS LUXURY VILLA — Express Server Entrypoint
// Production server configuration & lifecycle (Vercel Serverless Ready)
// ============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { config, prisma } from './config';
import routes from './routes';
import { errorHandler } from './middleware/error';

const app = express();

// Trust proxy hops
app.set('trust proxy', config.trustProxy);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: config.isProd,
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl.endsWith('/health'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
});
app.use('/api/', globalLimiter);

const loginLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'LOGIN_RATE_LIMIT_EXCEEDED', message: 'Too many sign-in attempts. Please try again later.' },
  },
});
app.use('/api/v1/auth/login', loginLimiter);

// Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Mount API v1 Routes
app.use('/api/v1', routes);

// Serve built client app in production standalone mode
const clientDist = path.resolve(__dirname, '../../client/dist');
const serveClient = config.isProd && fs.existsSync(clientDist);
if (serveClient) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 404 Route Handler for API endpoints
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
    },
  });
});

// Global Error Handler
app.use(errorHandler);

// Start standalone HTTP server only when NOT in Vercel Serverless environment
let server: any;
if (!process.env.VERCEL) {
  server = app.listen(config.port, config.host, () => {
    console.log(`
=====================================================
🏨  NS LUXURY VILLA MANAGEMENT SYSTEM — API SERVER  🏨
=====================================================
  Status:      ONLINE
  Environment: ${config.nodeEnv}
  Host:        http://${config.host}:${config.port}
  API Base:    http://${config.host}:${config.port}/api/v1
  Timezone:    ${config.villa.timezone}
=====================================================
    `);
  });
}

// Graceful Shutdown
const SHUTDOWN_TIMEOUT_MS = 10_000;

const stopServer = async (): Promise<void> => {
  if (!server) return;
  await new Promise<void>((resolve) => {
    const forceTimer = setTimeout(() => {
      console.warn('[SYSTEM] Shutdown timeout reached — force-closing connections.');
      server.closeAllConnections?.();
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    server.close(async () => {
      clearTimeout(forceTimer);
      console.log('[SYSTEM] HTTP server closed.');
      await prisma.$disconnect();
      console.log('[SYSTEM] Database connections closed.');
      resolve();
    });
  });
};

const gracefulShutdown = async (signal: string, exitCode = 0) => {
  console.log(`\n[SYSTEM] Received ${signal}. Starting graceful shutdown...`);
  try {
    await stopServer();
  } catch (error) {
    console.error('[SYSTEM] Error during shutdown:', error);
  }
  process.exit(exitCode);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
