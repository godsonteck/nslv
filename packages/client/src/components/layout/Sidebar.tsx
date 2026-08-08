// ============================================
// NS LUXURY VILLA — Role-Aware Sidebar Navigation
// Section #35 requirement: Navigation tailored per role
// ============================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS, type PermissionCode } from '@nslv/shared';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BedDouble,
  LogIn,
  UtensilsCrossed,
  Wine,
  Waves,
  CreditCard,
  Receipt,
  Boxes,
  FileBarChart,
  UserCheck,
  ShieldCheck,
  History,
  Settings,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  permission?: PermissionCode;
}

export const Sidebar: React.FC = () => {
  const { hasPermission } = useAuthStore();

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      to: '/dashboard',
      icon: <LayoutDashboard size={18} />,
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      label: 'Reservations',
      to: '/reservations',
      icon: <CalendarDays size={18} />,
      permission: PERMISSIONS.RESERVATIONS_VIEW,
    },
    {
      label: 'Guests',
      to: '/guests',
      icon: <Users size={18} />,
      permission: PERMISSIONS.GUESTS_VIEW,
    },
    {
      label: 'Rooms',
      to: '/rooms',
      icon: <BedDouble size={18} />,
      permission: PERMISSIONS.ROOMS_VIEW,
    },
    {
      label: 'Front Desk',
      to: '/frontdesk',
      icon: <LogIn size={18} />,
      permission: PERMISSIONS.CHECKIN_PERFORM,
    },
    {
      label: 'Restaurant',
      to: '/restaurant',
      icon: <UtensilsCrossed size={18} />,
      permission: PERMISSIONS.RESTAURANT_VIEW,
    },
    {
      label: 'Bar Workspace',
      to: '/bar',
      icon: <Wine size={18} />,
      permission: PERMISSIONS.BAR_VIEW,
    },
    {
      label: 'Pool Workspace',
      to: '/pool',
      icon: <Waves size={18} />,
      permission: PERMISSIONS.POOL_VIEW,
    },
    {
      label: 'Payments',
      to: '/payments',
      icon: <CreditCard size={18} />,
      permission: PERMISSIONS.PAYMENTS_VIEW,
    },
    {
      label: 'Expenses',
      to: '/expenses',
      icon: <Receipt size={18} />,
      permission: PERMISSIONS.EXPENSES_VIEW,
    },
    {
      label: 'Inventory',
      to: '/inventory',
      icon: <Boxes size={18} />,
      permission: PERMISSIONS.INVENTORY_VIEW,
    },
    {
      label: 'Reports',
      to: '/reports',
      icon: <FileBarChart size={18} />,
      permission: PERMISSIONS.REPORTS_VIEW,
    },
    {
      label: 'Staff Directory',
      to: '/staff',
      icon: <UserCheck size={18} />,
      permission: PERMISSIONS.STAFF_VIEW,
    },
    {
      label: 'Users & Roles',
      to: '/users',
      icon: <ShieldCheck size={18} />,
      permission: PERMISSIONS.USERS_VIEW,
    },
    {
      label: 'Audit Logs',
      to: '/audit',
      icon: <History size={18} />,
      permission: PERMISSIONS.AUDIT_VIEW,
    },
    {
      label: 'System Settings',
      to: '/settings',
      icon: <Settings size={18} />,
      permission: PERMISSIONS.SETTINGS_VIEW,
    },
  ];

  // Filter items user has permission to see
  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  return (
    <aside className="w-64 bg-[#151C28] border-r border-[#2D3748] flex flex-col h-full select-none">
      {/* Sidebar Section Title */}
      <div className="px-5 py-4 border-b border-[#2D3748]/50 text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
        Operational Workspace
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#8C2D19] text-white shadow-md font-semibold'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C2536]'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-[#2D3748] text-center">
        <p className="text-[11px] text-[#6B7280]">NS Luxury Villa v1.0</p>
        <p className="text-[10px] text-[#E2B768]">Arrive as a guest, stay as family</p>
      </div>
    </aside>
  );
};
