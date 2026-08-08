// ============================================
// NS LUXURY VILLA — Database Seed Script
// Populates default permissions, roles, rooms, & admin
// ============================================

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

    // Assign default permissions to role
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
  }

  // 3. Seed Room Amenities
  console.log('🏨 Seeding room amenities...');
  const amenities = [
    { name: 'Air Conditioning', icon: 'Snowflake', category: 'comfort' },
    { name: 'Ceiling Fan', icon: 'Fan', category: 'comfort' },
    { name: 'En-suite Bathroom', icon: 'Bath', category: 'bathroom' },
    { name: 'Hot Water Shower', icon: 'Droplets', category: 'bathroom' },
    { name: 'Bathtub', icon: 'Bath', category: 'bathroom' },
    { name: 'Premium Toiletries', icon: 'Sparkles', category: 'bathroom' },
    { name: 'King Size Bed', icon: 'BedDouble', category: 'comfort' },
    { name: 'Queen Size Bed', icon: 'BedDouble', category: 'comfort' },
    { name: 'Twin Beds', icon: 'BedDouble', category: 'comfort' },
    { name: 'Sofa Bed', icon: 'Sofa', category: 'comfort' },
    { name: 'Flat-screen TV', icon: 'Tv', category: 'entertainment' },
    { name: 'Satellite/Cable TV', icon: 'Tv', category: 'entertainment' },
    { name: 'Streaming Apps', icon: 'PlayCircle', category: 'entertainment' },
    { name: 'High-speed WiFi', icon: 'Wifi', category: 'connectivity' },
    { name: 'Work Desk', icon: 'Briefcase', category: 'business' },
    { name: 'Mini Fridge', icon: 'Fridge', category: 'convenience' },
    { name: 'Coffee/Tea Maker', icon: 'Coffee', category: 'convenience' },
    { name: 'Complimentary Water', icon: 'Droplets', category: 'convenience' },
    { name: 'In-room Safe', icon: 'Shield', category: 'security' },
    { name: 'Private Balcony', icon: 'Sun', category: 'view' },
    { name: 'Garden View', icon: 'Trees', category: 'view' },
    { name: 'Pool View', icon: 'Waves', category: 'view' },
    { name: 'Blackout Curtains', icon: 'Moon', category: 'comfort' },
    { name: 'Daily Housekeeping', icon: 'Sparkles', category: 'service' },
    { name: 'Turndown Service', icon: 'MoonStar', category: 'service' },
    { name: 'Hair Dryer', icon: 'Wind', category: 'bathroom' },
    { name: 'Ironing Facilities', icon: 'Shirt', category: 'convenience' },
    { name: 'Wardrobe/Closet', icon: 'Shirt', category: 'comfort' },
    { name: 'Luggage Rack', icon: 'Package', category: 'convenience' },
    { name: 'Extra Pillows & Blankets', icon: 'Feather', category: 'comfort' },
  ];

  for (const amenity of amenities) {
    await prisma.roomAmenity.upsert({
      where: { name: amenity.name },
      update: { icon: amenity.icon, category: amenity.category },
      create: amenity,
    });
  }

  // 4. Seed Room Types
  console.log('🏠 Seeding room types...');
  const roomTypesData = [
    {
      name: 'Standard Room',
      description: 'Comfortable room with essential amenities for a pleasant stay',
      basePrice: 350.00,
      maxAdults: 2,
      maxChildren: 1,
      sortOrder: 1,
      amenities: ['Air Conditioning', 'En-suite Bathroom', 'Hot Water Shower', 'Queen Size Bed', 'Flat-screen TV', 'High-speed WiFi', 'Work Desk', 'Mini Fridge', 'Coffee/Tea Maker', 'In-room Safe', 'Daily Housekeeping', 'Hair Dryer', 'Wardrobe/Closet', 'Luggage Rack'],
    },
    {
      name: 'Deluxe Room',
      description: 'Spacious room with premium furnishings and enhanced amenities',
      basePrice: 550.00,
      maxAdults: 2,
      maxChildren: 2,
      sortOrder: 2,
      amenities: ['Air Conditioning', 'En-suite Bathroom', 'Hot Water Shower', 'Bathtub', 'Premium Toiletries', 'King Size Bed', 'Flat-screen TV', 'Satellite/Cable TV', 'Streaming Apps', 'High-speed WiFi', 'Work Desk', 'Mini Fridge', 'Coffee/Tea Maker', 'Complimentary Water', 'In-room Safe', 'Private Balcony', 'Garden View', 'Blackout Curtains', 'Daily Housekeeping', 'Turndown Service', 'Hair Dryer', 'Ironing Facilities', 'Wardrobe/Closet', 'Luggage Rack', 'Extra Pillows & Blankets'],
    },
    {
      name: 'Executive Suite',
      description: 'Luxurious suite with separate living area and premium amenities',
      basePrice: 950.00,
      maxAdults: 3,
      maxChildren: 2,
      sortOrder: 3,
      amenities: ['Air Conditioning', 'Ceiling Fan', 'En-suite Bathroom', 'Hot Water Shower', 'Bathtub', 'Premium Toiletries', 'King Size Bed', 'Sofa Bed', 'Flat-screen TV', 'Satellite/Cable TV', 'Streaming Apps', 'High-speed WiFi', 'Work Desk', 'Mini Fridge', 'Coffee/Tea Maker', 'Complimentary Water', 'In-room Safe', 'Private Balcony', 'Pool View', 'Blackout Curtains', 'Daily Housekeeping', 'Turndown Service', 'Hair Dryer', 'Ironing Facilities', 'Wardrobe/Closet', 'Luggage Rack', 'Extra Pillows & Blankets'],
    },
    {
      name: 'Family Apartment',
      description: 'Two-bedroom apartment ideal for families with kitchenette',
      basePrice: 1200.00,
      maxAdults: 4,
      maxChildren: 3,
      sortOrder: 4,
      amenities: ['Air Conditioning', 'Ceiling Fan', 'En-suite Bathroom', 'Hot Water Shower', 'Bathtub', 'Premium Toiletries', 'King Size Bed', 'Twin Beds', 'Sofa Bed', 'Flat-screen TV', 'Satellite/Cable TV', 'Streaming Apps', 'High-speed WiFi', 'Work Desk', 'Mini Fridge', 'Coffee/Tea Maker', 'Complimentary Water', 'In-room Safe', 'Private Balcony', 'Garden View', 'Pool View', 'Blackout Curtains', 'Daily Housekeeping', 'Turndown Service', 'Hair Dryer', 'Ironing Facilities', 'Wardrobe/Closet', 'Luggage Rack', 'Extra Pillows & Blankets'],
    },
    {
      name: 'Presidential Villa',
      description: 'Ultimate luxury villa with private pool, butler service, and panoramic views',
      basePrice: 2500.00,
      maxAdults: 6,
      maxChildren: 4,
      sortOrder: 5,
      amenities: ['Air Conditioning', 'Ceiling Fan', 'En-suite Bathroom', 'Hot Water Shower', 'Bathtub', 'Premium Toiletries', 'King Size Bed', 'Twin Beds', 'Sofa Bed', 'Flat-screen TV', 'Satellite/Cable TV', 'Streaming Apps', 'High-speed WiFi', 'Work Desk', 'Mini Fridge', 'Coffee/Tea Maker', 'Complimentary Water', 'In-room Safe', 'Private Balcony', 'Pool View', 'Garden View', 'Blackout Curtains', 'Daily Housekeeping', 'Turndown Service', 'Hair Dryer', 'Ironing Facilities', 'Wardrobe/Closet', 'Luggage Rack', 'Extra Pillows & Blankets'],
    },
  ];

  for (const rtData of roomTypesData) {
    const { amenities: amenityNames, ...roomTypeData } = rtData;
    const roomType = await prisma.roomType.upsert({
      where: { name: roomTypeData.name },
      update: { ...roomTypeData, basePrice: roomTypeData.basePrice },
      create: { ...roomTypeData, basePrice: roomTypeData.basePrice },
    });

    // Link amenities
    for (const amenityName of amenityNames) {
      const amenity = await prisma.roomAmenity.findUnique({ where: { name: amenityName } });
      if (amenity) {
        await prisma.roomTypeAmenity.upsert({
          where: {
            roomTypeId_amenityId: {
              roomTypeId: roomType.id,
              amenityId: amenity.id,
            },
          },
          update: {},
          create: {
            roomTypeId: roomType.id,
            amenityId: amenity.id,
          },
        });
      }
    }
  }

  // 5. Seed Rooms
  console.log('🚪 Seeding rooms...');
  const roomData = [
    // Standard Rooms (101-104)
    { number: '101', name: 'Standard Room 101', roomTypeName: 'Standard Room', floor: 1 },
    { number: '102', name: 'Standard Room 102', roomTypeName: 'Standard Room', floor: 1 },
    { number: '103', name: 'Standard Room 103', roomTypeName: 'Standard Room', floor: 1 },
    { number: '104', name: 'Standard Room 104', roomTypeName: 'Standard Room', floor: 1 },
    // Deluxe Rooms (201-204)
    { number: '201', name: 'Deluxe Room 201', roomTypeName: 'Deluxe Room', floor: 2 },
    { number: '202', name: 'Deluxe Room 202', roomTypeName: 'Deluxe Room', floor: 2 },
    { number: '203', name: 'Deluxe Room 203', roomTypeName: 'Deluxe Room', floor: 2 },
    { number: '204', name: 'Deluxe Room 204', roomTypeName: 'Deluxe Room', floor: 2 },
    // Executive Suites (301-302)
    { number: '301', name: 'Executive Suite 301', roomTypeName: 'Executive Suite', floor: 3 },
    { number: '302', name: 'Executive Suite 302', roomTypeName: 'Executive Suite', floor: 3 },
    // Family Apartments (401-402)
    { number: '401', name: 'Family Apartment 401', roomTypeName: 'Family Apartment', floor: 4 },
    { number: '402', name: 'Family Apartment 402', roomTypeName: 'Family Apartment', floor: 4 },
    // Presidential Villa (501)
    { number: '501', name: 'Presidential Villa 501', roomTypeName: 'Presidential Villa', floor: 5 },
  ];

  for (const room of roomData) {
    const roomType = await prisma.roomType.findUnique({ where: { name: room.roomTypeName } });
    if (roomType) {
      await prisma.room.upsert({
        where: { number: room.number },
        update: { name: room.name, roomTypeId: roomType.id, floor: room.floor },
        create: { number: room.number, name: room.name, roomTypeId: roomType.id, floor: room.floor },
      });
    }
  }

  // 6. Seed Default System Settings
  console.log('⚙️ Seeding default system settings...');
  const defaultSettings = [
    { key: 'villa.name', value: 'NS Luxury Villa', category: 'general', description: 'Property name' },
    { key: 'villa.currency', value: 'GHS', category: 'financial', description: 'Primary currency symbol' },
    { key: 'villa.timezone', value: 'Africa/Accra', category: 'general', description: 'System timezone' },
    { key: 'villa.checkin_time', value: '14:00', category: 'operations', description: 'Standard check-in time' },
    { key: 'villa.checkout_time', value: '11:00', category: 'operations', description: 'Standard check-out time' },
    { key: 'villa.checkin_time', value: '14:00', category: 'operations', description: 'Standard check-in time' },
    { key: 'villa.checkout_time', value: '11:00', category: 'operations', description: 'Standard check-out time' },
    { key: 'villa.late_checkout_fee', value: '50', category: 'financial', description: 'Late check-out fee in GHS' },
    { key: 'villa.early_checkin_fee', value: '50', category: 'financial', description: 'Early check-in fee in GHS' },
    { key: 'villa.tax_rate', value: '17.5', category: 'financial', description: 'VAT rate percentage (Ghana)' },
    { key: 'villa.service_charge_rate', value: '10', category: 'financial', description: 'Service charge percentage' },
    { key: 'villa.cancellation_policy_hours', value: '24', category: 'operations', description: 'Free cancellation hours before check-in' },
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: JSON.stringify(setting.value) },
      create: {
        key: setting.key,
        value: JSON.stringify(setting.value),
        category: setting.category,
        description: setting.description,
      },
    });
  }

  // 7. Seed Default Admin Account
  console.log('👤 Seeding default Admin account...');
  const adminEmail = process.env['ADMIN_DEFAULT_EMAIL'] || 'admin@nsvilla.com';
  const adminUsername = process.env['ADMIN_DEFAULT_USERNAME'] || 'admin';
  const adminPassword = process.env['ADMIN_DEFAULT_PASSWORD'] || 'ChangeThisPassword123!';

  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  const adminRole = await prisma.role.findUnique({ where: { name: SYSTEM_ROLES.ADMIN } });
  if (!adminRole) throw new Error('Admin role not found during seed!');

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      firstName: 'NS Villa',
      lastName: 'Administrator',
      status: 'ACTIVE',
      mustChangePassword: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
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
