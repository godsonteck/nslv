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
    title: 'Main',
    items: [
      { label: 'Home', to: '/dashboard', icon: LayoutDashboard, perms: ['dashboard.view'] },
      { label: 'Front desk', to: '/frontdesk', icon: UserRound, perms: ['checkin.perform', 'checkout.perform'] },
      { label: 'Guest report', to: '/reception/report', icon: BarChart3, perms: ['checkin.perform', 'reports.view', 'cash_register.view'] },
      { label: 'Guest bills', to: '/bills', icon: ReceiptText, perms: ['folios.view'] },
      { label: 'Reservations', to: '/reservations', icon: CalendarDays, perms: ['reservations.view'] },
      { label: 'Guests', to: '/guests', icon: Users, perms: ['guests.view'] },
      { label: 'Rooms', to: '/rooms', icon: BedDouble, perms: ['rooms.view'] },
      { label: 'Events', to: '/events', icon: CalendarClock, perms: ['events.view'] },
      { label: 'Pool', to: '/pool/services', icon: Waves, perms: ['pool.view'] },
    ],
  },
  {
    title: 'Teams',
    items: [
      { label: 'Restaurant', to: '/restaurant', icon: UtensilsCrossed, perms: ['restaurant.view'] },
      { label: 'Restaurant POS', to: '/restaurant/pos', icon: UtensilsCrossed, perms: ['restaurant.view'] },
      { label: 'Bar', to: '/bar', icon: Wine, perms: ['bar.view'] },
      { label: 'Bar POS', to: '/bar/pos', icon: Wine, perms: ['bar.view'] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Payments', to: '/payments', icon: CreditCard, perms: ['payments.view'] },
      { label: 'Cash', to: '/cash-at-hand', icon: WalletCards, perms: ['cash_register.view'] },
      { label: 'Reports', to: '/reports', icon: BarChart3, perms: ['reports.view'] },
      { label: 'Expenses', to: '/expenses', icon: ReceiptText, perms: ['expenses.view'] },
      { label: 'Inventory', to: '/inventory', icon: ClipboardList, perms: ['inventory.view'] },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Admin', to: '/admin', icon: ShieldCheck, perms: ['users.view'] },
      { label: 'People', to: '/admin/users', icon: ShieldCheck, perms: ['users.view'] },
      { label: 'Roles', to: '/admin/roles', icon: KeyRound, perms: ['roles.view'] },
      { label: 'Rooms', to: '/admin/rooms', icon: BedDouble, perms: ['rooms.manage'] },
      { label: 'Venues', to: '/admin/event-spaces', icon: CalendarClock, perms: ['events.edit'] },
      { label: 'Menus', to: '/admin/menus', icon: Utensils, perms: ['restaurant.menu', 'bar.menu', 'pool.manage'] },
      { label: 'Items', to: '/admin/categories', icon: Tags, perms: ['categories.view'] },
      { label: 'Settings', to: '/admin/settings', icon: Settings, perms: ['settings.view'] },
      { label: 'Brand', to: '/admin/branding', icon: Palette, perms: ['settings.edit'] },
      { label: 'Late stays', to: '/admin/late-checkouts', icon: Clock, perms: ['reports.view'] },
      { label: 'Audit', to: '/admin/audit', icon: ScrollText, perms: ['audit.view'] },
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
      className={`relative z-10 flex h-full shrink-0 flex-col overflow-y-auto overflow-x-hidden rounded-[26px] border border-[rgba(255,255,255,0.28)] bg-[rgba(255,255,255,0.03)] shadow-[0_12px_30px_rgba(15,60,72,0.08),inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-[18px] transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'w-[268px] px-3 py-4' : 'w-[72px] px-2.5 py-4'
      }`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        boxShadow: '0 12px 30px rgba(15, 60, 72, 0.08), inset 0 1px 0 rgba(255,255,255,0.42)',
      }}
    >
      <div className="flex min-h-full flex-col">
        {/* Brand Header */}
        <div
          className={`mb-6 flex items-center ${
            sidebarOpen ? 'gap-3 px-1' : 'justify-center'
          }`}
        >
          <img
            src={villaLogo}
            alt="NS Luxury Villa"
            className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-[var(--ns-teal)]/35 shadow-xs"
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
              <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--ns-gold)]">
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
              <div className="px-3 pb-2 text-[9px] font-black uppercase tracking-[.16em] text-[var(--ns-muted)] opacity-100">
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
                    `group relative z-0 flex items-center rounded-xl text-[11px] font-bold transition-all ${
                      sidebarOpen
                        ? 'gap-3 px-3 py-2.5 w-full'
                        : 'justify-center h-11 w-11 mx-auto'
                    } ${
                      isActive
                        ? 'ns-glass-selected border border-[color-mix(in_srgb,var(--ns-teal)_65%,white)]'
                        : 'border border-transparent ns-glass-hover text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {sidebarOpen && (
                        <span
                          className={`absolute left-0 top-1/2 h-3.5 w-[2.5px] -translate-y-1/2 rounded-full transition-all ${
                            isActive ? 'bg-[var(--ns-teal)]' : 'bg-transparent'
                          }`}
                        />
                      )}
                      <Icon
                        size={sidebarOpen ? 15 : 18}
                        className={`shrink-0 transition-all ${
                          isActive
                            ? 'text-[var(--ns-teal)] drop-shadow-xs'
                            : 'text-[var(--ns-muted)] group-hover:text-[var(--ns-teal)]'
                        }`}
                      />
                      {sidebarOpen && (
                        <span
                          className={`truncate ${isActive ? 'font-black' : 'font-bold'}`}
                          style={{ color: 'var(--ns-ink)' }}
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
                className="glass-subtle flex items-center gap-2.5 rounded-2xl p-2.5 border border-[var(--ns-glass-line)]"
              >
                <div className="glass clay-badge flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--ns-teal)] text-[10px] font-black border border-[var(--ns-teal)]/55">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-black" style={{ color: 'var(--ns-ink)' }}>
                    {fullName}
                  </div>
                  <div className="truncate text-[9.5px] font-black uppercase tracking-wider text-[var(--ns-gold)]">
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
                <div className="italic font-semibold text-[var(--ns-gold)]">
                  &ldquo;Arrive as guest, stay as family&rdquo;
                </div>
              </div>
            </div>
          ) : (
            <div
              className="glass flex h-9 w-9 mx-auto items-center justify-center rounded-xl clay-badge text-[var(--ns-teal)] text-[10px] font-black cursor-pointer hover:opacity-90 transition border border-[var(--ns-teal)]/55"
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
