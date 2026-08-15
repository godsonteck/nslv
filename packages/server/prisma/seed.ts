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

  // 1. Seed Permissions using createMany (skipDuplicates)
  console.log('📦 Seeding permissions...');
  const permissionData = ALL_PERMISSION_CODES.map((code) => {
    const module = code.split('.')[0] || 'general';
    const action = code.split('.')[1] || 'access';
    const description = PERMISSION_DESCRIPTIONS[code] || code;
    return { code, module, action, description };
  });

  await prisma.permission.createMany({
    data: permissionData,
    skipDuplicates: true,
  });

  const allPermissions = await prisma.permission.findMany();
  const permMap = new Map(allPermissions.map((p) => [p.code, p.id]));

  // 2. Seed System Roles & RolePermissions
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
    const rolePermissionData = assignedPermissions
      .map((code) => {
        const permissionId = permMap.get(code);
        return permissionId ? { roleId: role.id, permissionId } : null;
      })
      .filter((item): item is { roleId: string; permissionId: string } => item !== null);

    if (rolePermissionData.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolePermissionData,
        skipDuplicates: true,
      });
    }
  }

  // 2b. Consolidate legacy outlet roles into F&B
  console.log('🍽️ Consolidating legacy outlet roles into F&B...');
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
    }
  }

  // 3. Seed default system settings
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
    { key: 'villa.tax_rate', value: '0', category: 'financial', description: 'Tax rate percentage' },
    { key: 'villa.checkin_time', value: '14:00', category: 'operations', description: 'Standard check-in time' },
    { key: 'villa.checkout_time', value: '12:00', category: 'operations', description: 'Standard check-out time' },
    { key: 'financial.service_charge_rate', value: '0', category: 'financial', description: 'Service charge percentage' },
    { key: 'financial.late_checkout_fee', value: '0', category: 'financial', description: 'Fee automatically added to the folio when checkout is after 12:00 PM' },
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

  await prisma.systemSetting.createMany({
    data: defaultSettings.map((s) => ({ ...s, value: JSON.stringify(s.value) })),
    skipDuplicates: true,
  });

  // 3b. Seed default expenditure categories
  console.log('🏷️ Seeding default expenditure categories...');
  const defaultExpenseCategories = [
    { name: 'UTILITIES', type: 'EXPENDITURE', description: 'Electricity, water, gas, internet & telecom' },
    { name: 'SUPPLIES', type: 'EXPENDITURE', description: 'Guest amenities, cleaning chemicals & paper products' },
    { name: 'MAINTENANCE', type: 'EXPENDITURE', description: 'Repairs, hardware, plumbing & electrical fittings' },
    { name: 'STAFF', type: 'EXPENDITURE', description: 'Wages, overtime, uniforms & staff welfare' },
    { name: 'MARKETING', type: 'EXPENDITURE', description: 'Advertising, social media, print & promotional items' },
    { name: 'FOOD', type: 'EXPENDITURE', description: 'Raw food items, produce, meat & ingredients' },
    { name: 'BEVERAGES', type: 'EXPENDITURE', description: 'Alcoholic & non-alcoholic beverages stock' },
    { name: 'OTHER', type: 'EXPENDITURE', description: 'Miscellaneous operational expenses' },
  ];
  await prisma.itemCategory.createMany({
    data: defaultExpenseCategories,
    skipDuplicates: true,
  });

  // 4. Seed room amenities
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
  await prisma.roomAmenity.createMany({
    data: amenityNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const dbAmenities = await prisma.roomAmenity.findMany();
  const amenityMap = new Map(dbAmenities.map((a) => [a.name, a.id]));

  // 5. Seed room types & rooms
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

    const roomTypeAmenityData = def.amenities
      .map((aName) => {
        const amenityId = amenityMap.get(aName);
        return amenityId ? { roomTypeId: rt.id, amenityId } : null;
      })
      .filter((item): item is { roomTypeId: string; amenityId: string } => item !== null);

    if (roomTypeAmenityData.length > 0) {
      await prisma.roomTypeAmenity.createMany({
        data: roomTypeAmenityData,
        skipDuplicates: true,
      });
    }
  }

  const allRoomTypes = await prisma.roomType.findMany();
  const roomTypeMap = new Map(allRoomTypes.map((rt) => [rt.name, rt.id]));

  const roomDefs: { number: string; type: string; floor: number }[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ number: `A${i + 1}`, type: 'Apartment', floor: 0 })),
    ...Array.from({ length: 2 }, (_, i) => ({ number: `B${i + 5}`, type: 'Studio Large', floor: 1 })),
    ...Array.from({ length: 6 }, (_, i) => ({ number: `B${i + 7}`, type: 'Studio Medium', floor: 1 })),
  ];

  const roomData = roomDefs
    .map((def) => {
      const typeId = roomTypeMap.get(def.type);
      return typeId
        ? {
            number: def.number,
            name: `${def.type} ${def.number}`,
            roomTypeId: typeId,
            floor: def.floor,
            status: 'AVAILABLE',
          }
        : null;
    })
    .filter((item): item is { number: string; name: string; roomTypeId: string; floor: number; status: string } => item !== null);

  if (roomData.length > 0) {
    await prisma.room.createMany({
      data: roomData,
      skipDuplicates: true,
    });
  }

  // 6. Seed POS menus using createMany
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
  await prisma.restaurantItem.createMany({ data: restaurantItems, skipDuplicates: true });

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
  await prisma.barItem.createMany({ data: barItems, skipDuplicates: true });

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
  await prisma.poolService.createMany({ data: poolServices, skipDuplicates: true });

  console.log('🎉 Seeding event spaces...');
  const eventSpaces = [
    { name: 'Poolside Deck', location: 'Ground floor by the pool', capacity: 80 },
    { name: 'Restaurant Terrace', location: 'Open-air restaurant level', capacity: 50 },
    { name: 'Garden Lawn', location: 'Front garden', capacity: 120 },
    { name: 'Conference Room', location: 'Main building, first floor', capacity: 30 },
  ];
  await prisma.eventSpace.createMany({ data: eventSpaces, skipDuplicates: true });

  // 7. Create administrator account
  console.log('👤 Creating initial administrator...');
  const adminEmail = process.env['ADMIN_DEFAULT_EMAIL']?.trim().toLowerCase();
  const adminUsername = process.env['ADMIN_DEFAULT_USERNAME']?.trim();
  const adminPassword = process.env['ADMIN_DEFAULT_PASSWORD'];
  const adminRole = await prisma.role.findUnique({ where: { name: SYSTEM_ROLES.ADMIN } });
  if (!adminRole) throw new Error('Admin role not found during seed.');

  // Bootstrapping must be explicit. A seed rerun must never reset an existing
  // administrator's password or silently create a predictable account.
  let adminUser = adminEmail ? await prisma.user.findUnique({ where: { email: adminEmail } }) : null;
  if (!adminUser) {
    if (!adminEmail || !adminUsername || !adminPassword) {
      throw new Error(
        'ADMIN_DEFAULT_EMAIL, ADMIN_DEFAULT_USERNAME, and ADMIN_DEFAULT_PASSWORD are required to create the initial administrator.',
      );
    }
    if (adminPassword.length < 12) {
      throw new Error('ADMIN_DEFAULT_PASSWORD must be at least 12 characters long.');
    }
    const usernameOwner = await prisma.user.findUnique({ where: { username: adminUsername } });
    if (usernameOwner) {
      throw new Error('ADMIN_DEFAULT_USERNAME is already assigned to a different account.');
    }
    const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
    adminUser = await prisma.user.create({
      data: {
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      status: 'ACTIVE',
      mustChangePassword: true,
      },
    });
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  console.log('✅ Database seed completed successfully!');
  console.log(`Administrator account ready: ${adminUser.email}`);
}

main()
  .catch((e) => {
    console.error('❌ Database seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
