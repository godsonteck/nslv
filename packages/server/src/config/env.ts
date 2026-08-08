// ============================================
// NS LUXURY VILLA — Environment Configuration
// Centralized config with validation
// ============================================

import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  // App
  nodeEnv: requireEnv('NODE_ENV', 'development'),
  isDev: (process.env['NODE_ENV'] ?? 'development') === 'development',
  isProd: process.env['NODE_ENV'] === 'production',

  // Server
  port: parseInt(requireEnv('SERVER_PORT', '3001'), 10),
  host: requireEnv('SERVER_HOST', 'localhost'),

  // Client
  clientUrl: requireEnv('CLIENT_URL', 'http://localhost:5173'),

  // JWT
  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessExpiry: requireEnv('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: requireEnv('JWT_REFRESH_EXPIRY', '7d'),
  },

  // Security
  bcryptRounds: parseInt(requireEnv('BCRYPT_ROUNDS', '12'), 10),
  rateLimitWindowMs: parseInt(requireEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  rateLimitMax: parseInt(requireEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  loginRateLimitMax: parseInt(requireEnv('LOGIN_RATE_LIMIT_MAX', '5'), 10),

  // CORS
  corsOrigins: requireEnv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3001')
    .split(',')
    .map((s) => s.trim()),

  // Villa
  villa: {
    name: requireEnv('VILLA_NAME', 'NS Luxury Villa'),
    currency: requireEnv('VILLA_CURRENCY', 'GHS'),
    timezone: requireEnv('VILLA_TIMEZONE', 'Africa/Accra'),
    country: requireEnv('VILLA_COUNTRY', 'Ghana'),
    phone: requireEnv('VILLA_PHONE', '+233 535 572 774'),
    email: requireEnv('VILLA_EMAIL', 'nsvilla4u@gmail.com'),
    address: requireEnv('VILLA_ADDRESS', 'VH-0102-0933, Torgbui Sapeh St, Ho, Ghana'),
    website: requireEnv('VILLA_WEBSITE', 'https://www.nsvilla.com'),
  },
} as const;
