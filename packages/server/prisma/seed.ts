// ============================================
// NS LUXURY VILLA — Database Seed Script
// Populates system permissions, roles, settings, and the configured initial administrator
// ============================================

import dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import {
  ALL_PERMISSION_CODES,
  PERMISSION_DESCRIPTIONS,
  SYSTEM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
} from '@nslv/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for NS Luxury Villa Management System...');

  // 1. Seed Permissions
  console.log('📦 Seeding permissions...');
  for (const code of ALL_PERMISSION_CODES) {
    const module = code.split('.')[0] || 'general';
    const action = code.split('.')[1] || 'access';
    const description = PERMISSION_DESCRIPTIONS[code] || code;

    await prisma.permission.upsert({
      where: { code },
      update: { description, module, action },
      create: { code, module, action, description },
    });
  }

  // 2. Seed System Roles
  console.log('👥 Seeding system roles...');
  for (const roleName of Object.values(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { isSystem: true },
      create: {
        name: roleName,
        description: `System defined ${roleName} role`,
        isSystem: true,
      },
    });

    const assignedPermissions = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
    for (const code of assignedPermissions) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    // Remove any permissions on this system role that are no longer in its
    // default set (e.g. deprecated grants). Keeps the seeded roles in sync
    // with DEFAULT_ROLE_PERMISSIONS across upgrades.
    const wantedCodes = new Set(assignedPermissions);
    const stale = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    });
    for (const rp of stale) {
      if (!wantedCodes.has(rp.permission.code as never)) {
        await prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId: role.id, permissionId: rp.permissionId } } });
        console.log(`  ↳ Removed ${rp.permission.code} from ${roleName}`);
      }
    }
  }

  // 2b. Consolidate legacy Restaurant / Bar / Pool roles into the single F&B role.
  // All users who held an outlet role are merged onto F&B, then the role, its
  // permission links and its user links are removed.
  console.log('🍽️ Consolidating legacy outlet roles into the F&B role...');
  const fnbRole = await prisma.role.findUnique({ where: { name: SYSTEM_ROLES.FNB } });
  if (fnbRole) {
    for (const legacyName of ['Restaurant', 'Bar', 'Pool']) {
      const legacy = await prisma.role.findUnique({ where: { name: legacyName } });
      if (!legacy) continue;
      const legacyUsers = await prisma.userRole.findMany({ where: { roleId: legacy.id } });
      for (const ur of legacyUsers) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: ur.userId, roleId: fnbRole.id } },
          update: {},
          create: { userId: ur.userId, roleId: fnbRole.id },
        });
      }
      await prisma.rolePermission.deleteMany({ where: { roleId: legacy.id } });
      await prisma.userRole.deleteMany({ where: { roleId: legacy.id } });
      await prisma.role.delete({ where: { id: legacy.id } });
      console.log(`  ↳ Merged ${legacyUsers.length} user(s) from ${legacyName} into ${SYSTEM_ROLES.FNB} and removed the role`);
    }
  }

  // 3. Seed default system settings only.
  // No operational, guest, reservation, room, POS, or financial records are seeded.
  console.log('⚙️ Seeding default system settings...');
  const env = process.env;
  const defaultSettings = [
    { key: 'villa.name', value: env['VILLA_NAME'] || 'NS Luxury Villa', category: 'villa', description: 'Property name' },
    { key: 'villa.address', value: env['VILLA_ADDRESS'] || '', category: 'villa', description: 'Street address' },
    { key: 'villa.phone', value: env['VILLA_PHONE'] || '', category: 'villa', description: 'Main contact phone' },
    { key: 'villa.email', value: env['VILLA_EMAIL'] || '', category: 'villa', description: 'Main contact email' },
    { key: 'villa.website', value: env['VILLA_WEBSITE'] || '', category: 'villa', description: 'Public website URL' },
    { key: 'villa.country', value: env['VILLA_COUNTRY'] || 'Ghana', category: 'villa', description: 'Country of operation' },
    { key: 'villa.currency', value: env['VILLA_CURRENCY'] || 'GHS', category: 'financial', description: 'Primary currency' },
    { key: 'villa.tax_rate', value: '0', category: 'financial', description: 'Tax rate percentage; configure before production use' },
    { key: 'villa.checkin_time', value: '14:00', category: 'operations', description: 'Standard check-in time' },
    { key: 'villa.checkout_time', value: '11:00', category: 'operations', description: 'Standard check-out time' },
    { key: 'financial.service_charge_rate', value: '0', category: 'financial', description: 'Service charge percentage' },
    { key: 'financial.late_checkout_fee', value: '0', category: 'financial', description: 'Late check-out fee' },
    { key: 'financial.cancellation_policy_hours', value: '24', category: 'financial', description: 'Free cancellation window in hours' },
    { key: 'notifications.email_enabled', value: true, category: 'notifications', description: 'Send transactional emails' },
    { key: 'notifications.sms_enabled', value: false, category: 'notifications', description: 'Send SMS notifications' },
    { key: 'notifications.reservation_confirmation_email', value: true, category: 'notifications', description: 'Email confirmation on new booking' },
    { key: 'notifications.payment_receipt_email', value: true, category: 'notifications', description: 'Email receipt on payment' },
    { key: 'notifications.daily_report_email', value: false, category: 'notifications', description: 'Send daily summary to managers' },
    { key: 'notifications.low_inventory_alert_threshold', value: '5', category: 'notifications', description: 'Alert when stock falls below this level' },
    { key: 'security.session_timeout_minutes', value: '60', category: 'security', description: 'Idle session timeout in minutes' },
    { key: 'security.max_login_attempts', value: '5', category: 'security', description: 'Failed logins before temporary lockout' },
    { key: 'security.lockout_duration_minutes', value: '15', category: 'security', description: 'Lockout duration after failed logins' },
    { key: 'security.require_2fa_for_admins', value: true, category: 'security', description: 'Require two-factor auth for admin accounts' },
    { key: 'security.password_expiry_days', value: '90', category: 'security', description: 'Force password reset after this many days' },
    { key: 'security.audit_retention_days', value: '365', category: 'security', description: 'Audit log retention period in days' },
    { key: 'regional.timezone', value: env['VILLA_TIMEZONE'] || 'Africa/Accra', category: 'regional', description: 'System timezone' },
    { key: 'regional.date_format', value: 'DD/MM/YYYY', category: 'regional', description: 'Display date format' },
    { key: 'regional.currency_symbol', value: 'GH₵', category: 'regional', description: 'Currency symbol shown in reports' },
    { key: 'regional.phone_country_code', value: '+233', category: 'regional', description: 'Default phone country code' },
    { key: 'regional.country', value: env['VILLA_COUNTRY'] || 'Ghana', category: 'regional', description: 'Country' },
    { key: 'regional.language', value: 'en', category: 'regional', description: 'Default language' },
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: JSON.stringify(setting.value) },
      create: { ...setting, value: JSON.stringify(setting.value) },
    });
  }

  // 4. Seed reference & demo operational data.
  // Idempotent: only creates records that do not yet exist, so existing production
  // databases are left untouched (records are never modified or deleted).
  console.log('🏨 Seeding room amenities...');
  const amenityNames = [
    'Air Conditioning', 'King Size Bed', 'Queen Size Bed', 'En-suite Bathroom',
    'Rain Shower', 'Flat-screen TV', 'Nespresso Machine', 'Free Wi-Fi',
    'Ocean View', 'Garden View', 'Pool View', 'Private Balcony', 'Mini Bar',
    'Walk-in Closet', 'Bathrobe & Slippers', 'Molton Brown Toiletries',
    'Smart TV with Streaming', 'USB Charging Ports', 'Safe Box', '24/7 Room Service',
    'Bath Tub', 'Separate Living Room', 'Dining Table', 'Butler Service',
    'Private Pool', 'Outdoor Shower',
  ];
  const amenities: Record<string, string> = {};
  for (const name of amenityNames) {
    const a = await prisma.roomAmenity.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    amenities[name] = a.id;
  }

  console.log('🛏️ Seeding room types & rooms...');
  const roomTypeDefs = [
    {
      name: 'Apartment',
      description: 'Self-contained apartment with a separate living area and full amenities.',
      basePrice: 850,
      maxAdults: 4,
      maxChildren: 2,
      amenities: ['King Size Bed', 'Air Conditioning', 'En-suite Bathroom', 'Free Wi-Fi', 'Separate Living Room', 'Flat-screen TV', 'Safe Box', 'Mini Bar', 'Private Balcony', 'Dining Table'],
    },
    {
      name: 'Studio Large',
      description: 'Large studio unit with ample space and premium comfort.',
      basePrice: 600,
      maxAdults: 3,
      maxChildren: 1,
      amenities: ['Queen Size Bed', 'Air Conditioning', 'En-suite Bathroom', 'Free Wi-Fi', 'Flat-screen TV', 'Safe Box', 'Mini Bar', 'Private Balcony'],
    },
    {
      name: 'Studio Medium',
      description: 'Medium studio unit with a cosy layout and essential comforts.',
      basePrice: 500,
      maxAdults: 2,
      maxChildren: 1,
      amenities: ['Queen Size Bed', 'Air Conditioning', 'En-suite Bathroom', 'Free Wi-Fi', 'Flat-screen TV', 'Safe Box'],
    },
  ];

  const roomTypeIds: Record<string, string> = {};
  for (const def of roomTypeDefs) {
    const rt = await prisma.roomType.upsert({
      where: { name: def.name },
      update: {},
      create: {
        name: def.name,
        description: def.description,
        basePrice: def.basePrice,
        maxAdults: def.maxAdults,
        maxChildren: def.maxChildren,
        sortOrder: roomTypeDefs.indexOf(def),
      },
    });
    roomTypeIds[def.name] = rt.id;
    for (const aName of def.amenities) {
      const amenityId = amenities[aName];
      if (!amenityId) continue;
      await prisma.roomTypeAmenity.upsert({
        where: { roomTypeId_amenityId: { roomTypeId: rt.id, amenityId } },
        update: {},
        create: { roomTypeId: rt.id, amenityId },
      });
    }
  }

  const roomDefs: { number: string; type: string; floor: number }[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ number: `A${i + 1}`, type: 'Apartment', floor: 0 })),
    ...Array.from({ length: 2 }, (_, i) => ({ number: `B${i + 5}`, type: 'Studio Large', floor: 1 })),
    ...Array.from({ length: 6 }, (_, i) => ({ number: `B${i + 7}`, type: 'Studio Medium', floor: 1 })),
  ];

  for (const def of roomDefs) {
    const typeId = roomTypeIds[def.type];
    if (!typeId) continue;
    await prisma.room.upsert({
      where: { number: def.number },
      update: {},
      create: {
        number: def.number,
        name: `${def.type} ${def.number}`,
        roomTypeId: typeId,
        floor: def.floor,
        status: 'AVAILABLE',
      },
    });
  }

  console.log('🍽️ Seeding restaurant menu...');
  const restaurantItems = [
    { name: 'Grilled Prawns', category: 'STARTERS', description: 'Char-grilled tiger prawns, garlic butter, lime', price: 95 },
    { name: 'Chicken Suya', category: 'STARTERS', description: 'Spiced skewered chicken, yaji, onion salad', price: 65 },
    { name: 'Pumpkin Soup', category: 'STARTERS', description: 'Roasted pumpkin, coconut cream, pumpkin seeds', price: 55 },
    { name: 'Jollof Rice & Grilled Chicken', category: 'MAINS', description: 'Classic smoky jollof, grilled chicken, fried plantain', price: 140 },
    { name: 'Grilled Atlantic Sea Bass', category: 'MAINS', description: 'Whole sea bass, herb crust, lemon beurre blanc', price: 210 },
    { name: 'Beef Tenderloin', category: 'MAINS', description: '8oz tenderloin, truffle mash, red wine jus', price: 260 },
    { name: 'Garden Vegetable Stir-fry', category: 'MAINS', description: 'Seasonal vegetables, teriyaki glaze, jasmine rice', price: 110 },
    { name: 'Chocolate Fondant', category: 'DESSERTS', description: 'Warm fondant, vanilla ice cream, berries', price: 60 },
    { name: 'Mango Panna Cotta', category: 'DESSERTS', description: 'Silky panna cotta, fresh mango, mint', price: 50 },
    { name: 'Coconut Ice Cream', category: 'DESSERTS', description: 'House-made coconut ice cream, toasted coconut', price: 40 },
    { name: 'Fresh Orange Juice', category: 'BEVERAGES', description: 'Cold-pressed, no added sugar', price: 35 },
    { name: 'Passion Fruit Mocktail', category: 'BEVERAGES', description: 'Passion fruit, mint, sparkling water', price: 45 },
    { name: 'Earl Grey Tea', category: 'BEVERAGES', description: 'Loose leaf, brewed to order', price: 25 },
    { name: 'Chef’s Tasting Menu', category: 'SPECIALS', description: 'Seven course journey through Ghanaian coastal cuisine', price: 480 },
  ];
  for (const item of restaurantItems) {
    await prisma.restaurantItem.upsert({
      where: { name: item.name },
      update: { price: item.price, description: item.description, category: item.category },
      create: item,
    });
  }

  console.log('🥂 Seeding bar menu...');
  const barItems = [
    { name: 'NSV Sunset Spritz', category: 'COCKTAILS', description: 'Aperol, prosecco, blood orange', price: 90 },
    { name: 'Palm Wine Cooler', category: 'COCKTAILS', description: 'Fresh palm wine, lime, mint, crushed ice', price: 75 },
    { name: 'Dark & Stormy', category: 'COCKTAILS', description: 'Dark rum, ginger beer, lime', price: 85 },
    { name: 'Moët & Chandon Impérial', category: 'WINES', description: 'Brut champagne, 750ml', price: 750 },
    { name: 'South African Chenin Blanc', category: 'WINES', description: 'Crisp white, glass', price: 60 },
    { name: 'Club Premium Lager', category: 'BEERS', description: 'Ghanaian classic, 500ml', price: 35 },
    { name: 'Guinness Foreign Extra', category: 'BEERS', description: '500ml', price: 40 },
    { name: 'Baileys Irish Cream', category: 'SPIRITS', description: 'Single serve', price: 70 },
    { name: 'Hendricks Gin', category: 'SPIRITS', description: 'Cucumber & rose gin, tonic', price: 80 },
    { name: 'Johnnie Walker Black Label', category: 'SPIRITS', description: 'Single serve, neat or on ice', price: 95 },
    { name: 'Coca-Cola', category: 'SOFT_DRINKS', description: '330ml', price: 15 },
    { name: 'Sparkling Water', category: 'SOFT_DRINKS', description: '330ml', price: 15 },
    { name: 'Mixed Nuts', category: 'SNACKS', description: 'Roasted cashews, almonds, peanuts', price: 30 },
    { name: 'Plantain Chips', category: 'SNACKS', description: 'Salted, with spicy dip', price: 25 },
  ];
  for (const item of barItems) {
    await prisma.barItem.upsert({
      where: { name: item.name },
      update: { price: item.price, description: item.description, category: item.category },
      create: item,
    });
  }

  console.log('🏊 Seeding pool services...');
  const poolServices = [
    { name: 'Day Pass — Adult', category: 'DAY_PASS', description: 'Full day pool & deck access', price: 120 },
    { name: 'Day Pass — Child', category: 'DAY_PASS', description: 'Full day pool access for guests under 12', price: 60 },
    { name: 'Private Cabana Rental', category: 'CABANA_RENTAL', description: 'Shaded cabana with attendant, towels & fruit platter', price: 300 },
    { name: 'Pool Towel Rental', category: 'TOWEL_RENTAL', description: 'Fresh pool towel', price: 25 },
    { name: 'Fruit Platter', category: 'POOL_SNACKS', description: 'Seasonal tropical fruit, honey drizzle', price: 55 },
    { name: 'Poolside Burger', category: 'POOL_SNACKS', description: 'Beef patty, cheddar, fries', price: 90 },
    { name: 'Fresh Coconut Water', category: 'BEVERAGES', description: 'Chilled whole coconut', price: 35 },
    { name: 'Virgin Piña Colada', category: 'BEVERAGES', description: 'Pineapple, coconut cream, no alcohol', price: 50 },
  ];
  for (const svc of poolServices) {
    await prisma.poolService.upsert({
      where: { name: svc.name },
      update: { price: svc.price, description: svc.description, category: svc.category },
      create: svc,
    });
  }

  console.log('🎉 Seeding event spaces...');
  const eventSpaces = [
    { name: 'Poolside Deck', location: 'Ground floor by the pool', capacity: 80 },
    { name: 'Restaurant Terrace', location: 'Open-air restaurant level', capacity: 50 },
    { name: 'Garden Lawn', location: 'Front garden', capacity: 120 },
    { name: 'Conference Room', location: 'Main building, first floor', capacity: 30 },
  ];
  for (const sp of eventSpaces) {
    await prisma.eventSpace.upsert({
      where: { name: sp.name },
      update: { location: sp.location, capacity: sp.capacity },
      create: sp,
    });
  }

  // 5. Create the first administrator from explicit environment configuration.
  // A fresh production database must never receive a known default password.
  console.log('👤 Creating initial administrator...');
  const adminEmail = process.env['ADMIN_DEFAULT_EMAIL'];
  const adminUsername = process.env['ADMIN_DEFAULT_USERNAME'];
  const adminPassword = process.env['ADMIN_DEFAULT_PASSWORD'];

  if (!adminEmail || !adminUsername || !adminPassword) {
    throw new Error('ADMIN_DEFAULT_EMAIL, ADMIN_DEFAULT_USERNAME and ADMIN_DEFAULT_PASSWORD are required to seed the initial administrator.');
  }

  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const adminRole = await prisma.role.findUnique({ where: { name: SYSTEM_ROLES.ADMIN } });
  if (!adminRole) throw new Error('Admin role not found during seed.');

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { username: adminUsername, passwordHash, status: 'ACTIVE' },
    create: {
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      status: 'ACTIVE',
      mustChangePassword: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  console.log('✅ Database seed completed successfully!');
  console.log(`🔑 Default Admin: ${adminUsername} (${adminEmail})`);
}

main()
  .catch((e) => {
    console.error('❌ Database seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
