// ============================================
// NS LUXURY VILLA — Express Server Entrypoint
// Production server configuration & lifecycle
// ============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config, prisma } from './config';
import routes from './routes';
import { errorHandler } from './middleware/error';

const app = express();

// Behind a trusted reverse proxy, preserve the real client IP for
// rate limiting and audit logging. (1 hop — adjust if nested proxies.)
app.set('trust proxy', config.isProd ? 1 : false);

// Simple request logging (method, path, status, duration)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Security Headers (Helmet)
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
  // Let load-balancer/orchestrator health checks hit /health without burning quota.
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

// 404 Route Handler
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

// Start Server
const server = app.listen(config.port, config.host, () => {
  if (!process.env['NODE_ENV']) {
    console.warn('[WARN] NODE_ENV is not set — defaulting to development. Set NODE_ENV=production in production.');
  }
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

// Graceful Shutdown
const SHUTDOWN_TIMEOUT_MS = 10_000;

const stopServer = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    // Force-close keep-alive connections if graceful close drags on.
    const forceTimer = setTimeout(() => {
      console.warn('[SYSTEM] Shutdown timeout reached — force-closing connections.');
      server.closeAllConnections();
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
process.on('unhandledRejection', (reason) => {
  console.error('[SYSTEM] Unhandled promise rejection:', reason);
  void gracefulShutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  console.error('[SYSTEM] Uncaught exception:', error);
  void gracefulShutdown('uncaughtException', 1);
});

export default app;
