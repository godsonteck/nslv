// One-off sync: move pool management from the F&B role to the Reception role.
// Reception only needs 'pool.view' to record attendance & view pool details.
// They DO NOT get 'pool.manage', 'pool.incidents', or 'pool.payments' which prevents access to Menus & POS.
//
// Run against any environment by pointing DATABASE_URL at it, e.g.
//   npx tsx scripts/move-pool-to-reception.ts
//   DATABASE_URL=<neon> npx tsx scripts/move-pool-to-reception.ts

import { PrismaClient } from '@prisma/client';
import { SYSTEM_ROLES } from '@nslv/shared';

const ALL_POOL_PERMS = ['pool.view', 'pool.manage', 'pool.incidents', 'pool.payments'];
const RECEPTION_POOL_PERMS = ['pool.view'];
// Front-office staff have no need for the admin "Categories" page.
const RECEPTION_REMOVED_PERMS = ['categories.view'];

const prisma = new PrismaClient();

async function main() {
  const fnb = await prisma.role.findUnique({ where: { name: SYSTEM_ROLES.FNB } });
  const rec = await prisma.role.findUnique({ where: { name: SYSTEM_ROLES.RECEPTION } });
  if (!fnb || !rec) {
    console.error('Roles not found:', { fnb: Boolean(fnb), reception: Boolean(rec) });
    process.exit(1);
  }

  // 1. Get pool permission IDs from the DB
  const poolPerms = await prisma.permission.findMany({ where: { code: { in: ALL_POOL_PERMS } } });
  const allIds = poolPerms.map((p) => p.id);
  const byCode = new Map(poolPerms.map((p) => [p.code, p.id]));

  // 2. Remove ALL pool permissions from F&B
  const removedFromFnb = await prisma.rolePermission.deleteMany({
    where: { roleId: fnb.id, permissionId: { in: allIds } },
  });
  console.log(`Removed ${removedFromFnb.count} pool permission(s) from "${fnb.name}"`);

  // 3. Remove non-reception pool permissions from Reception (keep only pool.view)
  const nonRecPoolPerms = ALL_POOL_PERMS.filter(p => !RECEPTION_POOL_PERMS.includes(p));
  const nonRecIds = poolPerms.filter(p => nonRecPoolPerms.includes(p.code)).map(p => p.id);
  const removedFromRec = await prisma.rolePermission.deleteMany({
    where: { roleId: rec.id, permissionId: { in: nonRecIds } },
  });
  console.log(`Removed ${removedFromRec.count} unauthorized pool permission(s) from "${rec.name}"`);

  // 3b. Remove admin-only permissions Reception does not need (e.g. Categories)
  const removedAdmin = await prisma.rolePermission.deleteMany({
    where: {
      roleId: rec.id,
      permission: { code: { in: RECEPTION_REMOVED_PERMS } },
    },
  });
  if (removedAdmin.count > 0) {
    console.log(`Removed ${removedAdmin.count} admin-only permission(s) from "${rec.name}"`);
  }

  // 4. Ensure Reception has the required pool permissions
  let added = 0;
  for (const code of RECEPTION_POOL_PERMS) {
    const pid = byCode.get(code);
    if (!pid) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: rec.id, permissionId: pid } },
      update: {},
      create: { roleId: rec.id, permissionId: pid },
    });
    added++;
  }
  console.log(`Ensured ${added} required pool permission(s) on "${rec.name}"`);

  // 5. Verification output
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