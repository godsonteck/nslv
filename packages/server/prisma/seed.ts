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
    { key: 'financial.late_checkout_fee', value: '50', category: 'financial', description: 'Late check-out fee per hour (GHS) applied when departure is after 12:00 PM' },
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
  const restaurantCategories = [
    ['BREAKFAST', 'Breakfast dishes', '#f59e0b', 0],
    ['BREAKFAST EXTRAS', 'Breakfast sides and extras', '#f59e0b', 1],
    ['SOUP STARTERS', 'Soups served as starters', '#16a4d4', 2],
    ['MEAT LOVERS', 'Spicy meat dishes', '#ef4444', 3],
    ['SNACKS', 'Light snacks and sandwiches', '#f97316', 4],
    ['SALAD', 'Fresh salads', '#22c55e', 5],
    ['PASTA', 'Pasta dishes', '#eab308', 6],
    ['PROTEINS', 'Protein portions only', '#8b5cf6', 7],
    ['SPECIAL RICE', 'Special fried rice dishes', '#84cc16', 8],
    ['BEEF', 'Beef dishes', '#ef4444', 9],
    ['RICE DISHES', 'Rice dishes', '#16a4d4', 10],
    ['CHICKEN', 'Chicken dishes', '#f97316', 11],
    ['RED RED', 'Red red with proteins', '#dc2626', 12],
    ['PALAVA SAUCE', 'Palava sauce with proteins', '#ea580c', 13],
    ['GHANAIAN LOCAL DISHES', 'Ghanaian local dishes with banku / workple', '#7c2d12', 14],
    ['SOUPS', 'Soups with fufu, banku or eba', '#16a4d4', 15],
    ['NSLV ONE POT DISH', 'NSLV one pot dishes', '#059669', 16],
    ['ONE POT DISH EXTRAS', 'One pot dish extras', '#059669', 17],
    ['PIZZA - VEGETABLE', 'Vegetable pizzas', '#22c55e', 18],
    ['PIZZA - SIGNATURE', 'Signature pizzas', '#f59e0b', 19],
    ['PIZZA EXTRAS', 'Pizza extras', '#f97316', 20],
    ['DESSERT', 'Desserts', '#ec4899', 21],
  ];
  for (const [name, description, color, order] of restaurantCategories) {
    await prisma.itemCategory.upsert({
      where: { name_type: { name, type: 'RESTAURANT' } },
      update: {},
      create: { name, type: 'RESTAURANT', description, color, order, isActive: true },
    });
  }

  // [name, category, price, description?] — matching the NS Luxury Villa final menu
  const restaurantItems: Array<[string, string, number, string?]> = [
    // BREAKFAST
    ['Tea, Coffee, Milo', 'BREAKFAST', 10],
    ['Oat, Tom Brown, Corn Flakes', 'BREAKFAST', 10],
    ['Spanish Omelet, Scramble Egg, Poached Egg', 'BREAKFAST', 15],
    ['Boiled Egg', 'BREAKFAST', 10],
    ['Steam Vegetables / Tossed Vegetables', 'BREAKFAST', 10],
    ['NSLV Omelet', 'BREAKFAST', 25, 'Chicken sausage, cheese and vegetables'],
    ['English Breakfast', 'BREAKFAST', 70],
    // BREAKFAST EXTRAS
    ['Baked Beans', 'BREAKFAST EXTRAS', 5],
    ['Bacon', 'BREAKFAST EXTRAS', 10],
    ['Toasted Bread', 'BREAKFAST EXTRAS', 5],
    ['Vegetables', 'BREAKFAST EXTRAS', 5],
    // SOUP STARTERS
    ['Vegetable Soup', 'SOUP STARTERS', 30],
    ['Tomatoes Soup', 'SOUP STARTERS', 30],
    ['Mushroom Soup', 'SOUP STARTERS', 30],
    ['Mushroom Cream Soup', 'SOUP STARTERS', 40],
    ['Chicken Cream Soup', 'SOUP STARTERS', 60],
    ['Beef Pepper Soup', 'SOUP STARTERS', 60],
    // MEAT LOVERS
    ['Spicy Chicken Wings', 'MEAT LOVERS', 70, 'Served with fried yam / yam chips / rice'],
    ['Spicy Gizzard', 'MEAT LOVERS', 50],
    ['Pork', 'MEAT LOVERS', 60, 'Served with fried yam / yam chips / rice'],
    // SNACKS
    ['Club Sandwich', 'SNACKS', 70],
    ['Tuna Sandwich', 'SNACKS', 60],
    ['Beef Burger', 'SNACKS', 65],
    ['Spring Rolls (5 pcs)', 'SNACKS', 35],
    ['Samosa (5 pcs)', 'SNACKS', 40],
    ['Loaded Fries (small)', 'SNACKS', 90],
    ['Loaded Fries (large)', 'SNACKS', 130],
    // SALAD
    ['French Salad', 'SALAD', 45, 'Lettuce, cucumber, tomatoes, onion, egg, beetroot'],
    ['Ghanaian Mixed Salad', 'SALAD', 70, 'Sardine, macaroni, egg, baked beans, tomatoes, onion, carrot, cucumber, lettuce, cabbage, potato'],
    ['Chef Salad', 'SALAD', 70, 'Lettuce, cucumber, chicken, sausage, ham, cheese, tomatoes, onion, egg, green pepper'],
    ['Chicken Salad', 'SALAD', 70, 'Chicken flakes, lettuce, green pepper, onion, tomatoes, egg, baked beans, cucumber'],
    ['Tuna Salad', 'SALAD', 60, 'Tuna, baked beans, lettuce, onion, tomatoes, green pepper, cucumber'],
    ['Vegetable Salad', 'SALAD', 45, 'Lettuce, cabbage, carrot, tomatoes, onion, egg, baked beans, green pepper'],
    ['Garden Salad', 'SALAD', 65, 'Potato, garden peas, green pepper, egg, tomatoes, cucumber, carrot, beef sauce'],
    ['Sauté Beef Salad', 'SALAD', 70, 'Beef, tomatoes, onion, lettuce, cucumber, green pepper'],
    ['Potato Salad', 'SALAD', 55, 'Potato dice, onion, mushed egg, spring onion, green pepper'],
    ['Cucumber Salad', 'SALAD', 30, 'Cucumber, tomatoes, onion, parsley'],
    ['NS Salad', 'SALAD', 80, 'Fillet fish, potato, sausage, onion, chicken, lettuce, cucumber, carrot, tomatoes, green pepper'],
    // PASTA
    ['Spaghetti Bolognaise', 'PASTA', 70],
    ['Spaghetti Carbonara', 'PASTA', 60, 'White sauce, mushroom, bacon'],
    ['Macaroni Cheese and Chicken Pasta', 'PASTA', 75, 'White sauce, onion, fillet chicken, parsley'],
    ['Macaroni Arabiata', 'PASTA', 55, 'Macaroni in vegetable tomatoes sauce'],
    ['Spaghetti Stir Fry', 'PASTA', 70, 'Chicken, beef, egg, vegetable, chilli pepper'],
    // PROTEINS
    ['Tilapia Only', 'PROTEINS', 100],
    ['Red Fish Only', 'PROTEINS', 80],
    ['Cassava Fish Only', 'PROTEINS', 70],
    ['Goat Only', 'PROTEINS', 60],
    ['Beef Only', 'PROTEINS', 60],
    ['Chicken Only', 'PROTEINS', 60],
    ['Smoked Fish Only', 'PROTEINS', 70],
    ['Salmon Fish Only', 'PROTEINS', 50],
    ['Grass Cutter Only', 'PROTEINS', 75],
    ['Adziador / Aborbi Only', 'PROTEINS', 40],
    // SPECIAL RICE
    ['Nasi-goreng', 'SPECIAL RICE', 90, 'Chicken, mushroom, sausage, egg, cabbage'],
    ['Chinese Fried Rice', 'SPECIAL RICE', 110, 'Chicken, shrimps, beef'],
    ['Shrimps Fried Rice', 'SPECIAL RICE', 100],
    ['Beef Fried Rice', 'SPECIAL RICE', 100],
    ['Chicken Fried Rice', 'SPECIAL RICE', 80],
    ['Mushroom Fried Rice', 'SPECIAL RICE', 65],
    ['Egg Fried Rice', 'SPECIAL RICE', 40],
    // BEEF
    ['Curry Beef', 'BEEF', 80],
    ['Beef Steak', 'BEEF', 75],
    ['Pepper Steak', 'BEEF', 75],
    ['Bacon Steak', 'BEEF', 65, 'Cream sauce'],
    ['Mushroom Steak', 'BEEF', 65, 'Cream sauce'],
    ['Beef Stir Fry', 'BEEF', 80, 'Carrot, green pepper, onion'],
    ['Beef Sauce', 'BEEF', 80],
    ['Shredded Beef Sauce', 'BEEF', 80],
    ['Beef Stew', 'BEEF', 80],
    // RICE DISHES
    ['Tilapia with Rice', 'RICE DISHES', 120],
    ['Red Fish with Rice', 'RICE DISHES', 80],
    ['Cassava Fish with Rice', 'RICE DISHES', 70],
    ['Grilled Chicken with Rice', 'RICE DISHES', 80],
    ['Assorted Jollof', 'RICE DISHES', 130],
    ['Assorted Fried Rice', 'RICE DISHES', 120],
    ['Jollof Rice Only', 'RICE DISHES', 30],
    ['Fried Rice Only', 'RICE DISHES', 25],
    ['Vegetable Rice Only', 'RICE DISHES', 20],
    ['Plain Rice', 'RICE DISHES', 15],
    // CHICKEN
    ['Curry Chicken', 'CHICKEN', 80],
    ['Chicken Braise', 'CHICKEN', 65, 'Grilled chicken, mushroom, green pepper, onion, tomatoes'],
    ['Mexican Chicken', 'CHICKEN', 75, 'Fillet chicken, garlic, red pepper'],
    ['Mushroom and Chicken Sauce', 'CHICKEN', 85, 'Cream sauce'],
    ['Chicken Stir Fry', 'CHICKEN', 80, 'Onion, green pepper, carrot'],
    ['Mixed Stir Fry', 'CHICKEN', 85, 'Mushroom, chicken, beef, carrot, green pepper, onion'],
    ['Chicken Sauce', 'CHICKEN', 85],
    // RED RED
    ['Red Red with Plantain', 'RED RED', 40],
    ['Red Red with Chicken', 'RED RED', 75],
    ['Red Red with Beef', 'RED RED', 75],
    ['Red Red with Smoked Fish', 'RED RED', 75],
    ['Red Red with Goat', 'RED RED', 75],
    ['Red Red with Tilapia', 'RED RED', 120],
    ['Red Red with Red Fish', 'RED RED', 80],
    ['Red Red with Cassava Fish', 'RED RED', 80],
    // PALAVA SAUCE
    ['Palava Sauce with Chicken', 'PALAVA SAUCE', 75],
    ['Palava Sauce with Beef', 'PALAVA SAUCE', 75],
    ['Palava Sauce with Smoked Fish', 'PALAVA SAUCE', 75],
    ['Palava Sauce with Goat', 'PALAVA SAUCE', 100],
    ['Palava Sauce with Tilapia', 'PALAVA SAUCE', 120],
    ['Palava Sauce with Red Fish', 'PALAVA SAUCE', 100],
    ['Palava Sauce with Cassava Fish', 'PALAVA SAUCE', 85],
    // GHANAIAN LOCAL DISHES
    ['Red Fish with Banku / Workple / Pepper', 'GHANAIAN LOCAL DISHES', 80],
    ['Cassava Fish with Banku / Workple / Pepper', 'GHANAIAN LOCAL DISHES', 80],
    ['Adziador with Banku / Workple Pepper or Stew', 'GHANAIAN LOCAL DISHES', 70],
    ['Aborbi with Banku / Workple Pepper or Stew', 'GHANAIAN LOCAL DISHES', 50],
    ['Grilled Tilapia with Banku / Workple Pepper', 'GHANAIAN LOCAL DISHES', 100],
    // SOUPS
    ['Tilapia Light Soup with Banku, Fufu, or Eba', 'SOUPS', 130],
    ['Tilapia Okro Soup with Banku, Workple or Eba', 'SOUPS', 130],
    ['Tilapia Okro Stew with Banku, Workple or Eba', 'SOUPS', 130],
    ['Tilapia Green Green with Banku, Workple or Eba', 'SOUPS', 130],
    ['Tilapia Ademe with Banku, Workple or Eba', 'SOUPS', 130],
    ['Salmon Light Soup with Fufu, Banku or Eba', 'SOUPS', 80],
    ['Chicken Light Soup with Fufu, Banku or Eba', 'SOUPS', 120],
    ['Smoked Fish Light Soup with Fufu, Banku or Eba', 'SOUPS', 110],
    ['Red Fish Light Soup with Fufu, Banku or Eba', 'SOUPS', 110],
    ['Cassava Fish Light Soup with Fufu, Banku or Eba', 'SOUPS', 100],
    ['Goat Light Soup with Fufu, Banku or Eba', 'SOUPS', 100],
    ['Groundnut Soup with Fufu, Banku or Eba', 'SOUPS', 100, 'Advance order required - please order in advance'],
    ['Palm Nut Soup with Fufu, Banku or Eba', 'SOUPS', 100, 'Advance order required - please order in advance'],
    ['Beef Light Soup with Fufu, Banku or Eba', 'SOUPS', 90],
    ['Grass Cutter Light Soup with Fufu, Banku or Eba', 'SOUPS', 130],
    ['Adzaidor / Aborbi Light Soup with Fufu, Banku or Eba', 'SOUPS', 60],
    // NSLV ONE POT DISH
    ['Tilapia Moyo Shrimps', 'NSLV ONE POT DISH', 140, 'Served with banku, workple, eba or rice'],
    ['Tilapia Moyo with Mushroom', 'NSLV ONE POT DISH', 130, 'Served with banku, workple or rice'],
    ['Assorted Okro Soup / Stew', 'NSLV ONE POT DISH', 150, 'Smoked fish, cow leg, crab, adziador, kobi with banku / workple / eba'],
    ['Assorted Green Green', 'NSLV ONE POT DISH', 150, 'Salmon, wele, crab, adziador, kobi with banku / workple / eba'],
    ['Assorted Ademe Soup / Green Green', 'NSLV ONE POT DISH', 150, 'Adziador, kobi, crab, salmon, with banku / workple'],
    ['Assorted Light Soup', 'NSLV ONE POT DISH', 150, 'Cow leg, adziador, salmon, smoked fish, banku / workple / rice / fufu'],
    // ONE POT DISH EXTRAS
    ['Extra Soup', 'ONE POT DISH EXTRAS', 10],
    ['Extra Banku or Workple', 'ONE POT DISH EXTRAS', 5],
    ['Extra Shrimps', 'ONE POT DISH EXTRAS', 15],
    ['Soup Only', 'ONE POT DISH EXTRAS', 15],
    // PIZZA - VEGETABLE
    ['E Pizza', 'PIZZA - VEGETABLE', 80, 'Chopped tomatoes, cheese, oregano, mushroom, chopped onion'],
    ['Vegetable Pizza', 'PIZZA - VEGETABLE', 90, 'Broccoli, mushroom, carrot, sweet corn, onion, green pepper, tomatoes'],
    ['Vegetarian Hawaiian Pizza', 'PIZZA - VEGETABLE', 70, 'Mushroom, pineapple, oregano'],
    ['Cheese Pizza', 'PIZZA - VEGETABLE', 70, 'Cheese, oregano'],
    // PIZZA - SIGNATURE
    ['Four Season Pizza', 'PIZZA - SIGNATURE', 130, 'Ham, sausage, beef, mushroom, olives, tomatoes, onion, green pepper'],
    ['Chicken Supreme Pizza', 'PIZZA - SIGNATURE', 120, 'Chicken, mushroom, onion, tomatoes, green pepper'],
    ['Americano Pizza', 'PIZZA - SIGNATURE', 130, 'Sausage, mushroom, tomatoes, green pepper, chicken'],
    ['Afadjato Pizza', 'PIZZA - SIGNATURE', 100, 'Mushroom, sausage, chicken chunk, sweet corn, olives, onion, green pepper, parsley'],
    ['Meat Feast Pizza', 'PIZZA - SIGNATURE', 140, 'Gizzard, beef, chicken, bacon'],
    ['Amedzofe Pizza', 'PIZZA - SIGNATURE', 100, 'Chicken fillet, gizzard, bacon, onion, green pepper, black olives'],
    ['Gemi Pizza', 'PIZZA - SIGNATURE', 110, 'Shrimps, gizzard, mushroom, tomatoes, oregano, green pepper, onion'],
    ['Chicken Pizza', 'PIZZA - SIGNATURE', 100, 'Chicken chunk, green pepper, onions, tomatoes'],
    ['Beef Pizza', 'PIZZA - SIGNATURE', 110, 'Tomatoes, beef chunk, green pepper, onion, tomatoes'],
    ['Tuna Pizza', 'PIZZA - SIGNATURE', 80, 'Tuna, onion, tomatoes, green pepper'],
    ['NSLV Assorted Pizza', 'PIZZA - SIGNATURE', 140, 'Chicken, beef, sausage, gizzard, mushroom, cheese, green pepper, tomatoes, olives, onions'],
    // PIZZA EXTRAS
    ['Extra Cheese', 'PIZZA EXTRAS', 50],
    ['Extra Vegetables', 'PIZZA EXTRAS', 10],
    ['Extra Chicken', 'PIZZA EXTRAS', 20],
    ['Extra Beef', 'PIZZA EXTRAS', 30],
    ['Extra Sausage', 'PIZZA EXTRAS', 10],
    ['Extra Mushroom', 'PIZZA EXTRAS', 10],
    // DESSERT
    ['Watermelon', 'DESSERT', 15],
    ['Pineapple', 'DESSERT', 10],
    ['Cut Apple', 'DESSERT', 15],
    ['Mixed Fruit (Fruit Salad)', 'DESSERT', 40],
    ['Pancake', 'DESSERT', 20],
    ['Cupcake', 'DESSERT', 15],
    ['Cup Cake with Icing', 'DESSERT', 40],
  ];
  await prisma.restaurantItem.createMany({
    data: restaurantItems.map(([name, category, price, description]) => ({ name, category, price, description: description || null })),
    skipDuplicates: true,
  });

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
