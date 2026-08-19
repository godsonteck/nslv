// ============================================
// NS LUXURY VILLA — Permission Codes
// Granular permission system for RBAC
// ============================================

/**
 * Every permission code in the system.
 * Format: module.action
 *
 * These are used in:
 * - role_permissions DB table to map roles → permissions
 * - RBAC middleware to enforce access on API routes
 * - Frontend to conditionally render UI elements
 *
 * The backend ALWAYS enforces permissions. Frontend hiding is UX only.
 */
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',

  // Reservations
  RESERVATIONS_VIEW: 'reservations.view',
  RESERVATIONS_CREATE: 'reservations.create',
  RESERVATIONS_EDIT: 'reservations.edit',
  RESERVATIONS_CANCEL: 'reservations.cancel',

  // Guests
  GUESTS_VIEW: 'guests.view',
  GUESTS_CREATE: 'guests.create',
  GUESTS_EDIT: 'guests.edit',
  GUESTS_VIEW_SENSITIVE: 'guests.view_sensitive',

  // Rooms
  ROOMS_VIEW: 'rooms.view',
  ROOMS_MANAGE: 'rooms.manage',
  ROOMS_STATUS: 'rooms.status',

  // Check-in / Check-out
  CHECKIN_PERFORM: 'checkin.perform',
  CHECKOUT_PERFORM: 'checkout.perform',

  // Folios
  FOLIOS_VIEW: 'folios.view',
  FOLIOS_MANAGE: 'folios.manage',
  FOLIOS_ADJUST: 'folios.adjust',

  // Payments
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_REFUND: 'payments.refund',
  PAYMENTS_ADJUST: 'payments.adjust',

  // Restaurant
  RESTAURANT_VIEW: 'restaurant.view',
  RESTAURANT_ORDERS: 'restaurant.orders',
  RESTAURANT_MENU: 'restaurant.menu',
  RESTAURANT_ROOM_CHARGE: 'restaurant.room_charge',
  RESTAURANT_SALES: 'restaurant.sales',

  // Bar
  BAR_VIEW: 'bar.view',
  BAR_ORDERS: 'bar.orders',
  BAR_MENU: 'bar.menu',
  BAR_ROOM_CHARGE: 'bar.room_charge',
  BAR_SALES: 'bar.sales',

  // Pool
  POOL_VIEW: 'pool.view',
  POOL_MANAGE: 'pool.manage',
  POOL_INCIDENTS: 'pool.incidents',
  POOL_PAYMENTS: 'pool.payments',

  // Expenses
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_CREATE: 'expenses.create',
  EXPENSES_APPROVE: 'expenses.approve',
  EXPENSES_DELETE: 'expenses.delete',

  // Inventory
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_MANAGE: 'inventory.manage',
  INVENTORY_ADJUST: 'inventory.adjust',

  // Categories
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_MANAGE: 'categories.manage',

  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  REPORTS_FINANCIAL: 'reports.financial',

  // Staff
  STAFF_VIEW: 'staff.view',
  STAFF_MANAGE: 'staff.manage',

  // Users & Roles
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  PERMISSIONS_MANAGE: 'permissions.manage',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',

  // Audit
  AUDIT_VIEW: 'audit.view',
  AUDIT_EXPORT: 'audit.export',

  // Backups
  BACKUPS_VIEW: 'backups.view',
  BACKUPS_CREATE: 'backups.create',
  BACKUPS_RESTORE: 'backups.restore',

  // Notifications
  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_MANAGE: 'notifications.manage',

  // Events
  EVENTS_VIEW: 'events.view',
  EVENTS_CREATE: 'events.create',
  EVENTS_EDIT: 'events.edit',
  EVENTS_CANCEL: 'events.cancel',

  // System
  SYSTEM_CONFIGURE: 'system.configure',
  INTEGRATIONS_MANAGE: 'integrations.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** All permission codes as an array (used for seeding) */
export const ALL_PERMISSION_CODES: PermissionCode[] = Object.values(PERMISSIONS);

/**
 * Default system role names.
 * These are created at seed and cannot be deleted.
 * Restaurant and Bar are separate outlets with their own roles and workspaces.
 * The Pool is managed by Reception alongside front-office guest service.
 */
export const SYSTEM_ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  RECEPTION: 'Reception',
  RESTAURANT: 'Restaurant',
  BAR: 'Bar',
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

/**
 * Default permission mapping for each system role.
 * Admin gets ALL permissions.
 * Other roles get a curated subset.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleName, PermissionCode[]> = {
  [SYSTEM_ROLES.ADMIN]: ALL_PERMISSION_CODES,

  [SYSTEM_ROLES.MANAGER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RESERVATIONS_VIEW,
    PERMISSIONS.RESERVATIONS_CREATE,
    PERMISSIONS.RESERVATIONS_EDIT,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.GUESTS_VIEW,
    PERMISSIONS.GUESTS_CREATE,
    PERMISSIONS.GUESTS_EDIT,
    PERMISSIONS.GUESTS_VIEW_SENSITIVE,
    PERMISSIONS.ROOMS_VIEW,
    PERMISSIONS.ROOMS_MANAGE,
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.CHECKIN_PERFORM,
    PERMISSIONS.CHECKOUT_PERFORM,
    PERMISSIONS.FOLIOS_VIEW,
    PERMISSIONS.FOLIOS_MANAGE,
    PERMISSIONS.FOLIOS_ADJUST,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.RESTAURANT_VIEW,
    PERMISSIONS.RESTAURANT_ORDERS,
    PERMISSIONS.RESTAURANT_MENU,
    PERMISSIONS.RESTAURANT_ROOM_CHARGE,
    PERMISSIONS.RESTAURANT_SALES,
    PERMISSIONS.BAR_VIEW,
    PERMISSIONS.BAR_ORDERS,
    PERMISSIONS.BAR_MENU,
    PERMISSIONS.BAR_ROOM_CHARGE,
    PERMISSIONS.BAR_SALES,
    PERMISSIONS.POOL_VIEW,
    PERMISSIONS.POOL_MANAGE,
    PERMISSIONS.POOL_INCIDENTS,
    PERMISSIONS.POOL_PAYMENTS,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.EXPENSES_APPROVE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.REPORTS_FINANCIAL,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_CREATE,
    PERMISSIONS.EVENTS_EDIT,
    PERMISSIONS.EVENTS_CANCEL,
  ],

  [SYSTEM_ROLES.RECEPTION]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RESERVATIONS_VIEW,
    PERMISSIONS.RESERVATIONS_CREATE,
    PERMISSIONS.RESERVATIONS_EDIT,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.GUESTS_VIEW,
    PERMISSIONS.GUESTS_CREATE,
    PERMISSIONS.GUESTS_EDIT,
    PERMISSIONS.GUESTS_VIEW_SENSITIVE,
    PERMISSIONS.ROOMS_VIEW,
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.CHECKIN_PERFORM,
    PERMISSIONS.CHECKOUT_PERFORM,
    PERMISSIONS.FOLIOS_VIEW,
    PERMISSIONS.FOLIOS_MANAGE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.POOL_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
  ],

  [SYSTEM_ROLES.RESTAURANT]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RESTAURANT_VIEW,
    PERMISSIONS.RESTAURANT_ORDERS,
    PERMISSIONS.RESTAURANT_MENU,
    PERMISSIONS.RESTAURANT_ROOM_CHARGE,
    PERMISSIONS.RESTAURANT_SALES,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
  ],

  [SYSTEM_ROLES.BAR]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.BAR_VIEW,
    PERMISSIONS.BAR_ORDERS,
    PERMISSIONS.BAR_MENU,
    PERMISSIONS.BAR_ROOM_CHARGE,
    PERMISSIONS.BAR_SALES,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
  ],
};

/**
 * Permission metadata — human-readable descriptions for the admin UI
 */
export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  [PERMISSIONS.DASHBOARD_VIEW]: 'View the dashboard',
  [PERMISSIONS.RESERVATIONS_VIEW]: 'View reservations',
  [PERMISSIONS.RESERVATIONS_CREATE]: 'Create new reservations',
  [PERMISSIONS.RESERVATIONS_EDIT]: 'Edit existing reservations',
  [PERMISSIONS.RESERVATIONS_CANCEL]: 'Cancel reservations',
  [PERMISSIONS.GUESTS_VIEW]: 'View guest profiles',
  [PERMISSIONS.GUESTS_CREATE]: 'Create guest profiles',
  [PERMISSIONS.GUESTS_EDIT]: 'Edit guest profiles',
  [PERMISSIONS.GUESTS_VIEW_SENSITIVE]: 'View sensitive guest information (ID, address)',
  [PERMISSIONS.ROOMS_VIEW]: 'View rooms and availability',
  [PERMISSIONS.ROOMS_MANAGE]: 'Create, edit, and configure rooms',
  [PERMISSIONS.ROOMS_STATUS]: 'Change room status (cleaning, maintenance)',
  [PERMISSIONS.CHECKIN_PERFORM]: 'Perform guest check-in',
  [PERMISSIONS.CHECKOUT_PERFORM]: 'Perform guest check-out',
  [PERMISSIONS.FOLIOS_VIEW]: 'View guest folios',
  [PERMISSIONS.FOLIOS_MANAGE]: 'Add charges to guest folios',
  [PERMISSIONS.FOLIOS_ADJUST]: 'Make folio adjustments and corrections',
  [PERMISSIONS.PAYMENTS_VIEW]: 'View payment records',
  [PERMISSIONS.PAYMENTS_CREATE]: 'Process payments',
  [PERMISSIONS.PAYMENTS_REFUND]: 'Process refunds',
  [PERMISSIONS.PAYMENTS_ADJUST]: 'Make payment adjustments',
  [PERMISSIONS.RESTAURANT_VIEW]: 'View restaurant dashboard',
  [PERMISSIONS.RESTAURANT_ORDERS]: 'Manage restaurant orders',
  [PERMISSIONS.RESTAURANT_MENU]: 'Manage restaurant menu',
  [PERMISSIONS.RESTAURANT_ROOM_CHARGE]: 'Charge restaurant orders to guest rooms',
  [PERMISSIONS.RESTAURANT_SALES]: 'View restaurant sales data',
  [PERMISSIONS.BAR_VIEW]: 'View bar dashboard',
  [PERMISSIONS.BAR_ORDERS]: 'Manage bar orders',
  [PERMISSIONS.BAR_MENU]: 'Manage bar drink menu',
  [PERMISSIONS.BAR_ROOM_CHARGE]: 'Charge bar orders to guest rooms',
  [PERMISSIONS.BAR_SALES]: 'View bar sales data',
  [PERMISSIONS.POOL_VIEW]: 'View pool dashboard',
  [PERMISSIONS.POOL_MANAGE]: 'Manage pool access and entries',
  [PERMISSIONS.POOL_INCIDENTS]: 'Report and manage pool incidents',
  [PERMISSIONS.POOL_PAYMENTS]: 'Process pool payments',
  [PERMISSIONS.EXPENSES_VIEW]: 'View expenses',
  [PERMISSIONS.EXPENSES_CREATE]: 'Create expense records',
  [PERMISSIONS.EXPENSES_APPROVE]: 'Approve or reject expenses',
  [PERMISSIONS.EXPENSES_DELETE]: 'Delete expense records',
  [PERMISSIONS.INVENTORY_VIEW]: 'View inventory',
  [PERMISSIONS.INVENTORY_MANAGE]: 'Manage inventory items and suppliers',
  [PERMISSIONS.INVENTORY_ADJUST]: 'Make inventory adjustments',
  [PERMISSIONS.CATEGORIES_VIEW]: 'View menu and inventory categories',
  [PERMISSIONS.CATEGORIES_MANAGE]: 'Create, edit, and delete categories',
  [PERMISSIONS.REPORTS_VIEW]: 'View operational reports',
  [PERMISSIONS.REPORTS_EXPORT]: 'Export reports (CSV/PDF)',
  [PERMISSIONS.REPORTS_FINANCIAL]: 'View financial reports',
  [PERMISSIONS.STAFF_VIEW]: 'View staff directory',
  [PERMISSIONS.STAFF_MANAGE]: 'Manage staff accounts',
  [PERMISSIONS.USERS_VIEW]: 'View system user accounts',
  [PERMISSIONS.USERS_CREATE]: 'Create new user accounts',
  [PERMISSIONS.USERS_EDIT]: 'Edit user accounts',
  [PERMISSIONS.USERS_DELETE]: 'Deactivate or delete user accounts',
  [PERMISSIONS.ROLES_VIEW]: 'View roles',
  [PERMISSIONS.ROLES_MANAGE]: 'Create and edit roles',
  [PERMISSIONS.PERMISSIONS_MANAGE]: 'Assign permissions to roles',
  [PERMISSIONS.SETTINGS_VIEW]: 'View system settings',
  [PERMISSIONS.SETTINGS_EDIT]: 'Edit system settings',
  [PERMISSIONS.AUDIT_VIEW]: 'View audit logs',
  [PERMISSIONS.AUDIT_EXPORT]: 'Export audit logs',
  [PERMISSIONS.BACKUPS_VIEW]: 'View backup status',
  [PERMISSIONS.BACKUPS_CREATE]: 'Create manual backups',
  [PERMISSIONS.BACKUPS_RESTORE]: 'Restore from backups',
  [PERMISSIONS.NOTIFICATIONS_VIEW]: 'View notifications',
  [PERMISSIONS.NOTIFICATIONS_MANAGE]: 'Manage notification settings',
  [PERMISSIONS.SYSTEM_CONFIGURE]: 'Configure system-level settings',
  [PERMISSIONS.INTEGRATIONS_MANAGE]: 'Manage external integrations',
  [PERMISSIONS.EVENTS_VIEW]: 'View events and event spaces',
  [PERMISSIONS.EVENTS_CREATE]: 'Create new events',
  [PERMISSIONS.EVENTS_EDIT]: 'Edit events and event spaces',
  [PERMISSIONS.EVENTS_CANCEL]: 'Cancel or delete events',
};

/**
 * Group permissions by module for the admin permissions UI
 */
export const PERMISSION_MODULES = [
  'dashboard',
  'reservations',
  'guests',
  'rooms',
  'checkin',
  'checkout',
  'folios',
  'payments',
  'restaurant',
  'bar',
  'pool',
  'expenses',
  'inventory',
  'reports',
  'staff',
  'users',
  'roles',
  'permissions',
  'settings',
  'audit',
  'backups',
  'notifications',
  'events',
  'system',
  'integrations',
] as const;
