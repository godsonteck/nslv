// One-off sync: move pool management from the F&B role to the Reception role.
// Run against any environment by pointing DATABASE_URL at it, e.g.
//   npx tsx scripts/move-pool-to-reception.ts
//   DATABASE_URL=<neon> npx tsx scripts/move-pool-to-reception.ts

import { PrismaClient } from '@prisma/client';
import { SYSTEM_ROLES } from '@nslv/shared';

const POOL_PERMS = ['pool.view', 'pool.manage', 'pool.incidents', 'pool.payments'];

const prisma = new PrismaClient();

async function main() {
  const fnb = await prisma.role.findUnique({ where: { name: SYSTEM_ROLES.FNB } });
  const rec = await prisma.role.findUnique({ where: { name: SYSTEM_ROLES.RECEPTION } });
  if (!fnb || !rec) {
    console.error('Roles not found:', { fnb: Boolean(fnb), reception: Boolean(rec) });
    process.exit(1);
  }

  const poolPerms = await prisma.permission.findMany({ where: { code: { in: POOL_PERMS } } });
  const ids = poolPerms.map((p) => p.id);
  const byCode = new Map(poolPerms.map((p) => [p.code, p.id]));

  const removed = await prisma.rolePermission.deleteMany({
    where: { roleId: fnb.id, permissionId: { in: ids } },
  });
  console.log(`Removed ${removed.count} pool permission(s) from "${fnb.name}"`);

  let added = 0;
  for (const code of POOL_PERMS) {
    const pid = byCode.get(code);
    if (!pid) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: rec.id, permissionId: pid } },
      update: {},
      create: { roleId: rec.id, permissionId: pid },
    });
    added++;
  }
  console.log(`Added ${added} pool permission(s) to "${rec.name}"`);

  const fnbCodes = (await prisma.rolePermission.findMany({ where: { roleId: fnb.id }, include: { permission: true } })).map((rp) => rp.permission.code);
  const recPool = (await prisma.rolePermission.findMany({ where: { roleId: rec.id }, include: { permission: true } }))
    .map((rp) => rp.permission.code)
    .filter((code) => code.startsWith('pool.'));
  console.log(`"${fnb.name}" now holds: ${fnbCodes.length ? fnbCodes.join(', ') : '(none)'}`);
  console.log(`"${rec.name}" pool permissions: ${recPool.length ? recPool.join(', ') : '(none)'}`);
}

main()
  .catch((e) => {
    console.error('SYNC FAILED:', e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());