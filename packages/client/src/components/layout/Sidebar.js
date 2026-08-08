import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';
import { LayoutDashboard, CalendarDays, Users, BedDouble, LogIn, UtensilsCrossed, Wine, Waves, CreditCard, Receipt, Boxes, FileBarChart, UserCheck, ShieldCheck, History, Settings, } from 'lucide-react';
export const Sidebar = () => {
    const { hasPermission } = useAuthStore();
    const navItems = [
        {
            label: 'Dashboard',
            to: '/dashboard',
            icon: _jsx(LayoutDashboard, { size: 18 }),
            permission: PERMISSIONS.DASHBOARD_VIEW,
        },
        {
            label: 'Reservations',
            to: '/reservations',
            icon: _jsx(CalendarDays, { size: 18 }),
            permission: PERMISSIONS.RESERVATIONS_VIEW,
        },
        {
            label: 'Guests',
            to: '/guests',
            icon: _jsx(Users, { size: 18 }),
            permission: PERMISSIONS.GUESTS_VIEW,
        },
        {
            label: 'Rooms',
            to: '/rooms',
            icon: _jsx(BedDouble, { size: 18 }),
            permission: PERMISSIONS.ROOMS_VIEW,
        },
        {
            label: 'Front Desk',
            to: '/frontdesk',
            icon: _jsx(LogIn, { size: 18 }),
            permission: PERMISSIONS.CHECKIN_PERFORM,
        },
        {
            label: 'Restaurant',
            to: '/restaurant',
            icon: _jsx(UtensilsCrossed, { size: 18 }),
            permission: PERMISSIONS.RESTAURANT_VIEW,
        },
        {
            label: 'Bar Workspace',
            to: '/bar',
            icon: _jsx(Wine, { size: 18 }),
            permission: PERMISSIONS.BAR_VIEW,
        },
        {
            label: 'Pool Workspace',
            to: '/pool',
            icon: _jsx(Waves, { size: 18 }),
            permission: PERMISSIONS.POOL_VIEW,
        },
        {
            label: 'Payments',
            to: '/payments',
            icon: _jsx(CreditCard, { size: 18 }),
            permission: PERMISSIONS.PAYMENTS_VIEW,
        },
        {
            label: 'Expenses',
            to: '/expenses',
            icon: _jsx(Receipt, { size: 18 }),
            permission: PERMISSIONS.EXPENSES_VIEW,
        },
        {
            label: 'Inventory',
            to: '/inventory',
            icon: _jsx(Boxes, { size: 18 }),
            permission: PERMISSIONS.INVENTORY_VIEW,
        },
        {
            label: 'Reports',
            to: '/reports',
            icon: _jsx(FileBarChart, { size: 18 }),
            permission: PERMISSIONS.REPORTS_VIEW,
        },
        {
            label: 'Staff Directory',
            to: '/staff',
            icon: _jsx(UserCheck, { size: 18 }),
            permission: PERMISSIONS.STAFF_VIEW,
        },
        {
            label: 'Users & Roles',
            to: '/users',
            icon: _jsx(ShieldCheck, { size: 18 }),
            permission: PERMISSIONS.USERS_VIEW,
        },
        {
            label: 'Audit Logs',
            to: '/audit',
            icon: _jsx(History, { size: 18 }),
            permission: PERMISSIONS.AUDIT_VIEW,
        },
        {
            label: 'System Settings',
            to: '/settings',
            icon: _jsx(Settings, { size: 18 }),
            permission: PERMISSIONS.SETTINGS_VIEW,
        },
    ];
    // Filter items user has permission to see
    const visibleItems = navItems.filter((item) => !item.permission || hasPermission(item.permission));
    return (_jsxs("aside", { className: "w-64 bg-[#151C28] border-r border-[#2D3748] flex flex-col h-full select-none", children: [_jsx("div", { className: "px-5 py-4 border-b border-[#2D3748]/50 text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider", children: "Operational Workspace" }), _jsx("nav", { className: "flex-1 overflow-y-auto p-3 space-y-1", children: visibleItems.map((item) => (_jsxs(NavLink, { to: item.to, className: ({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${isActive
                        ? 'bg-[#8C2D19] text-white shadow-md font-semibold'
                        : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C2536]'}`, children: [item.icon, _jsx("span", { children: item.label })] }, item.to))) }), _jsxs("div", { className: "p-4 border-t border-[#2D3748] text-center", children: [_jsx("p", { className: "text-[11px] text-[#6B7280]", children: "NS Luxury Villa v1.0" }), _jsx("p", { className: "text-[10px] text-[#E2B768]", children: "Arrive as a guest, stay as family" })] })] }));
};
