import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://nslv_test:test@localhost:5432/nslv_test?schema=public',
      JWT_ACCESS_SECRET: 'test-access-secret-not-for-production',
      JWT_REFRESH_SECRET: 'test-refresh-secret-not-for-production',
    },
  },
});
