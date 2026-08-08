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
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
});
app.use('/api/', globalLimiter);

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
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[SYSTEM] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[SYSTEM] HTTP server closed.');
    await prisma.$disconnect();
    console.log('[SYSTEM] Database connections closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
