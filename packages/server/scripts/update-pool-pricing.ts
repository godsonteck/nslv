// ============================================
// NS LUXURY VILLA — Pool pricing update
// Applies the current pool price list:
//   Day Pass — Adult    GHS 50
//   Night Pass — Adult  GHS 90
//   Day Pass — Child    GHS 30
//   Night Pass — Child  GHS 45
//   Pool Towel Rental   GHS 10 (free for children)
// Retires the old cabana / snack / beverage services. Services that already
// have transactions are archived (kept for history) rather than deleted.
// Safe to run more than once.
// ============================================

import { Prisma } from '@prisma/client';
import { prisma } from '../src/config';

const services = [
  { name: 'Day Pass — Adult', category: 'DAY_PASS', description: 'Full day pool & deck access', price: 50 },
  { name: 'Night Pass — Adult', category: 'NIGHT_PASS', description: 'Evening pool & deck access', price: 90 },
  { name: 'Day Pass — Child', category: 'DAY_PASS', description: 'Full day pool access for guests under 12', price: 30 },
  { name: 'Night Pass — Child', category: 'NIGHT_PASS', description: 'Evening pool access for guests under 12', price: 45 },
  { name: 'Pool Towel Rental', category: 'TOWEL_RENTAL', description: 'Fresh pool towel — GHS 10 per adult; free for children', price: 10 },
];

const retiredNames = [
  'Private Cabana Rental',
  'Fruit Platter',
  'Poolside Burger',
  'Fresh Coconut Water',
  'Virgin Piña Colada',
];

const poolCategories = [
  { name: 'DAY_PASS', description: 'Standard day pass', color: '#00A86B', order: 1 },
  { name: 'NIGHT_PASS', description: 'Evening pool pass', color: '#4C51BF', order: 2 },
  { name: 'TOWEL_RENTAL', description: 'Pool towel rental', color: '#A855F6', order: 3 },
];

async function main() {
  for (const svc of services) {
    const price = new Prisma.Decimal(svc.price);
    await prisma.poolService.upsert({
      where: { name: svc.name },
      update: { category: svc.category, description: svc.description, price, isAvailable: true },
      create: { name: svc.name, category: svc.category, description: svc.description, price },
    });
    console.log(`✓ ${svc.name} → GHS ${svc.price.toFixed(2)} [${svc.category}]`);
  }

  for (const cat of poolCategories) {
    await prisma.itemCategory.upsert({
      where: { name_type: { name: cat.name, type: 'POOL' } },
      update: { description: cat.description, color: cat.color, order: cat.order, isActive: true },
      create: { ...cat, type: 'POOL', isActive: true },
    });
  }

  for (const name of retiredNames) {
    const svc = await prisma.poolService.findUnique({
      where: { name },
      include: { _count: { select: { transactions: true } } },
    });
    if (!svc) continue;
    if (svc._count.transactions > 0) {
      await prisma.poolService.update({ where: { id: svc.id }, data: { isAvailable: false } });
      console.log(`↳ Archived (has ${svc._count.transactions} transaction(s), kept for history): ${name}`);
    } else {
      await prisma.poolService.delete({ where: { id: svc.id } });
      console.log(`↳ Removed: ${name}`);
    }
  }

  // Drop now-unused pool categories so menus no longer offer retired types.
  for (const name of ['CABANA_RENTAL', 'POOL_SNACKS', 'BEVERAGES']) {
    const stillUsed = await prisma.poolService.count({ where: { category: name } });
    if (stillUsed > 0) continue;
    const deleted = await prisma.itemCategory.deleteMany({ where: { name, type: 'POOL' } });
    if (deleted.count > 0) console.log(`↳ Removed unused pool category: ${name}`);
  }

  const current = await prisma.poolService.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  console.log('\nCurrent pool services:');
  for (const s of current) {
    console.log(`  ${s.isAvailable ? '•' : '○'} ${s.name} — GHS ${Number(s.price).toFixed(2)} [${s.category}]`);
  }
}

main()
  .catch((e) => {
    console.error('Pool pricing update failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
