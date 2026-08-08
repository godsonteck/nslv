// ============================================
// NS LUXURY VILLA — Prisma Database Client
// Singleton pattern for connection management
// ============================================

import { PrismaClient } from '@prisma/client';
import { config } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (config.isDev) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
