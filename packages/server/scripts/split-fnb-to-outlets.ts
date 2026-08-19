// ============================================
// NS LUXURY VILLA — Role split script
// Removes the combined F&B role and splits its users into the separate
// Restaurant and Bar outlet roles (which are also created/ensured here).
// Safe to run more than once.
// ============================================

import { PrismaClient } from '@prisma/client';
import { SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS } from '@nslv/shared';

const prisma = new PrismaClient();

async function ensureRole(name: string) {
  const role = await prisma.role.upsert({
    where: { name },
    update: { isSystem: true },
    create: { name, description: `System defined ${name} role`, isSystem: true },
  });
  const perms = DEFAULT_ROLE_PERMISSIONS[name as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [];
  const permissionIds = await prisma.permission.findMany({
    where: { code: { in: perms } },
    select: { id: true },
  });
  const rolePermissionData = permissionIds.map((p) => ({ roleId: role.id, permissionId: p.id }));
  if (rolePermissionData.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { in: permissionIds.map((p) => p.id) } } });
    await prisma.rolePermission.createMany({ data: rolePermissionData, skipDuplicates: true });
  }
  return role;
}

async function main() {
  const restaurant = await ensureRole(SYSTEM_ROLES.RESTAURANT);
  const bar = await ensureRole(SYSTEM_ROLES.BAR);
  console.log(`Ensured role "${restaurant.name}" (${restaurant.id}) and "${bar.name}" (${bar.id}) with default outlet permissions.`);

  const fnb = await prisma.role.findUnique({ where: { name: 'F&B' } });
  if (!fnb) {
    console.log('No F&B role found — nothing to migrate.');
    return;
  }

  const fnbUsers = await prisma.userRole.findMany({ where: { roleId: fnb.id }, select: { userId: true } });
  let reassigned = 0;
  for (const { userId } of fnbUsers) {
    for (const target of [restaurant, bar]) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: target.id } },
        update: {},
        create: { userId, roleId: target.id },
      });
      reassigned += 1;
    }
  }
  console.log(`Reassigned ${fnbUsers.length} F&B user(s) to Restaurant + Bar (${reassigned} assignments).`);

  await prisma.rolePermission.deleteMany({ where: { roleId: fnb.id } });
  await prisma.userRole.deleteMany({ where: { roleId: fnb.id } });
  await prisma.role.delete({ where: { id: fnb.id } });
  console.log('Deleted the F&B role.');
}

main()
  .catch((e) => {
    console.error('Split failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });