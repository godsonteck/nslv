/* Runs only against an explicitly supplied disposable database. */
const { spawnSync } = require('node:child_process');
const url = process.env.TEST_DATABASE_URL;
if (!url || !/nslv(_|-)?test/i.test(url)) {
  console.error('Refusing to run: TEST_DATABASE_URL must name an isolated nslv_test database.');
  process.exit(2);
}
for (const args of [
  ['prisma', 'migrate', 'deploy', '--schema=packages/server/prisma/schema.prisma'],
  ['vitest', 'run', '--config', 'packages/server/vitest.config.ts', '--dir', 'packages/server/tests/integration'],
]) {
  const result = spawnSync('npx.cmd', args, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
  if (result.status !== 0) process.exit(result.status || 1);
}
