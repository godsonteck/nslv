import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useUIStore } from '../../stores/uiStore';
import { villaAssets } from '../../assets';
import {
  CalendarDays,
  Users,
  BedDouble,
  LayoutDashboard,
  CreditCard,
  BarChart3,
  Settings,
  ShieldCheck,
  UtensilsCrossed,
  Utensils,
  Wine,
  Waves,
  UserRound,
  ClipboardList,
  ReceiptText,
  CalendarClock,
  Palette,
  KeyRound,
  ScrollText,
  Tags,
  Clock,
  WalletCards,
} from 'lucide-react';
import type { PermissionCode } from '@nslv/shared';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  perms: PermissionCode[];
}
interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, perms: ['dashboard.view'] },
      { label: 'Front desk', to: '/frontdesk', icon: UserRound, perms: ['checkin.perform', 'checkout.perform'] },
      { label: 'Reception report', to: '/reception/report', icon: BarChart3, perms: ['checkin.perform', 'reports.view', 'cash_register.view'] },
      { label: 'Guest bills', to: '/bills', icon: ReceiptText, perms: ['folios.view'] },
      { label: 'Reservations', to: '/reservations', icon: CalendarDays, perms: ['reservations.view'] },
      { label: 'Guests', to: '/guests', icon: Users, perms: ['guests.view'] },
      { label: 'Rooms', to: '/rooms', icon: BedDouble, perms: ['rooms.view'] },
      { label: 'Events', to: '/events', icon: CalendarClock, perms: ['events.view'] },
      { label: 'Pool services', to: '/pool/services', icon: Waves, perms: ['pool.view'] },
    ],
  },
  {
    title: 'Departments',
    items: [
      { label: 'Restaurant workspace', to: '/restaurant', icon: UtensilsCrossed, perms: ['restaurant.view'] },
      { label: 'Restaurant POS', to: '/restaurant/pos', icon: UtensilsCrossed, perms: ['restaurant.view'] },
      { label: 'Bar workspace', to: '/bar', icon: Wine, perms: ['bar.view'] },
      { label: 'Bar POS', to: '/bar/pos', icon: Wine, perms: ['bar.view'] },
    ],
  },
  {
    title: 'Finance & insight',
    items: [
      { label: 'Payments', to: '/payments', icon: CreditCard, perms: ['payments.view'] },
      { label: 'Cash at hand', to: '/cash-at-hand', icon: WalletCards, perms: ['cash_register.view'] },
      { label: 'Reports', to: '/reports', icon: BarChart3, perms: ['reports.view'] },
      { label: 'Expenditure', to: '/expenses', icon: ReceiptText, perms: ['expenses.view'] },
      { label: 'Inventory', to: '/inventory', icon: ClipboardList, perms: ['inventory.view'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Admin console', to: '/admin', icon: ShieldCheck, perms: ['users.view'] },
      { label: 'Users', to: '/admin/users', icon: ShieldCheck, perms: ['users.view'] },
      { label: 'Roles & access', to: '/admin/roles', icon: KeyRound, perms: ['roles.view'] },
      { label: 'Room config', to: '/admin/rooms', icon: BedDouble, perms: ['rooms.manage'] },
      { label: 'Event spaces', to: '/admin/event-spaces', icon: CalendarClock, perms: ['events.edit'] },
      { label: 'Menus & POS', to: '/admin/menus', icon: Utensils, perms: ['restaurant.menu', 'bar.menu', 'pool.manage'] },
      { label: 'Categories', to: '/admin/categories', icon: Tags, perms: ['categories.view'] },
      { label: 'Settings', to: '/admin/settings', icon: Settings, perms: ['settings.view'] },
      { label: 'Branding', to: '/admin/branding', icon: Palette, perms: ['settings.edit'] },
      { label: 'Late checkouts', to: '/admin/late-checkouts', icon: Clock, perms: ['reports.view'] },
      { label: 'Audit logs', to: '/admin/audit', icon: ScrollText, perms: ['audit.view'] },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const { theme } = useThemeStore();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  const perms = user?.permissions ?? [];
  const roleName = user?.roles?.[0]?.name ?? 'Staff';
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Staff member';
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'NS';
  const villaLogo = theme?.logoUrl || villaAssets.logo;

  const sections = ALL_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.perms.some((p) => perms.includes(p))),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-y-auto overflow-x-hidden ns-glass-bar-soft border-r border-[var(--ns-glass-line)] transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'w-[246px] px-3.5 py-4' : 'w-[68px] px-2 py-4'
      }`}
    >
      <div className="flex min-h-full flex-col">
        {/* Brand Header */}
        <div
          className={`mb-5 flex items-center ${
            sidebarOpen ? 'gap-3 px-1' : 'justify-center'
          }`}
        >
          <img
            src={villaLogo}
            alt="NS Luxury Villa"
            className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-[#c59a58]/30 shadow-xs"
            title="NS Luxury Villa"
          />
          {sidebarOpen && (
            <div className="min-w-0 transition-opacity duration-200">
              <div
                className="truncate font-['Manrope'] text-[13px] font-black leading-tight"
                style={{ color: 'var(--ns-ink)' }}
              >
                NS Luxury Villa
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#c59a58]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,.2)]" />
                <span className="truncate">Lokoe, Ho ({roleName})</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        {sections.map((section, sIdx) => (
          <div key={section.title} className={sidebarOpen ? 'mb-4' : 'mb-2.5'}>
            {sidebarOpen ? (
              <div className="px-3 pb-1.5 text-[9px] font-black uppercase tracking-wider text-[#c59a58] opacity-80">
                {section.title}
              </div>
            ) : sIdx > 0 ? (
              <div className="my-2 border-t border-[var(--ns-glass-line)] mx-1" />
            ) : null}

            <div className="space-y-1">
              {section.items.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={label}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-xl text-[11px] font-bold transition-all ${
                      sidebarOpen
                        ? 'gap-2.5 px-3 py-2 w-full'
                        : 'justify-center h-10 w-10 mx-auto'
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-[#173c4d] to-[#0f2834] text-white shadow-sm border border-[#c59a58]/40'
                        : 'hover:bg-[var(--ns-glass-1)] text-slate-500 hover:text-[var(--ns-ink)]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {sidebarOpen && (
                        <span
                          className={`absolute left-0 top-1/2 h-3.5 w-[2.5px] -translate-y-1/2 rounded-full transition-all ${
                            isActive ? 'bg-[#c59a58]' : 'bg-transparent'
                          }`}
                        />
                      )}
                      <Icon
                        size={sidebarOpen ? 15 : 18}
                        className={`shrink-0 transition-all ${
                          isActive
                            ? 'text-[#f0d49f]'
                            : 'text-slate-400 group-hover:text-[#c59a58]'
                        }`}
                      />
                      {sidebarOpen && (
                        <span
                          className={`truncate ${isActive ? 'font-extrabold text-white' : ''}`}
                          style={{ color: isActive ? '#ffffff' : 'var(--ns-ink)' }}
                        >
                          {label}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="mt-auto pt-3">
          {sidebarOpen ? (
            <div className="space-y-3">
              <div
                className="glass-subtle flex items-center gap-2.5 rounded-2xl p-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#174b59] to-[#0e3440] text-[10px] font-black text-white shadow-2xs">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold" style={{ color: 'var(--ns-ink)' }}>
                    {fullName}
                  </div>
                  <div className="truncate text-[9px] font-semibold uppercase tracking-wider text-[#c59a58]">
                    {roleName}
                  </div>
                </div>
              </div>
              <div
                className="border-t border-[var(--ns-glass-line)] pt-2.5 text-[9px] leading-4"
                style={{ color: 'var(--ns-muted)' }}
              >
                <div className="font-black uppercase tracking-[.14em]" style={{ color: 'var(--ns-ink)' }}>
                  NS Luxury Villa
                </div>
                <div className="italic text-[#c59a58]">
                  &ldquo;Arrive as guest, stay as family&rdquo;
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex h-9 w-9 mx-auto items-center justify-center rounded-xl bg-gradient-to-br from-[#174b59] to-[#0e3440] text-[10px] font-black text-white shadow-2xs cursor-pointer hover:opacity-90 transition"
              title={`${fullName} (${roleName})`}
            >
              {initials}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
