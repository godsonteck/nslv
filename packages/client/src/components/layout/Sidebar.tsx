import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { villaAssets } from '../../assets';
import { CalendarDays, Users, BedDouble, LayoutDashboard, CreditCard, BarChart3, Settings, ShieldCheck, UtensilsCrossed, Utensils, Wine, Waves, UserRound, ClipboardList, ReceiptText, CalendarClock, Palette, KeyRound, ScrollText, Tags, Clock } from 'lucide-react';
import type { PermissionCode } from '@nslv/shared';

interface NavItem { label: string; to: string; icon: typeof LayoutDashboard; perms: PermissionCode[]; }
interface NavSection { title: string; items: NavItem[]; }

const ALL_SECTIONS: NavSection[] = [
  { title: 'Workspace', items: [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, perms: ['dashboard.view'] },
    { label: 'Front desk', to: '/frontdesk', icon: UserRound, perms: ['checkin.perform', 'checkout.perform'] },
    { label: 'Guest bills', to: '/bills', icon: ReceiptText, perms: ['folios.view'] },
    { label: 'Reservations', to: '/reservations', icon: CalendarDays, perms: ['reservations.view'] },
    { label: 'Guests', to: '/guests', icon: Users, perms: ['guests.view'] },
    { label: 'Rooms', to: '/rooms', icon: BedDouble, perms: ['rooms.view'] },
    { label: 'Events', to: '/events', icon: CalendarClock, perms: ['events.view'] },
    { label: 'Pool services', to: '/pool/services', icon: Waves, perms: ['pool.view'] },
  ] },
  { title: 'Departments', items: [
    { label: 'F&B workspace', to: '/fnb', icon: UtensilsCrossed, perms: ['restaurant.view', 'bar.view'] },
    { label: 'Restaurant workspace', to: '/restaurant', icon: UtensilsCrossed, perms: ['restaurant.view'] },
    { label: 'Restaurant POS', to: '/restaurant/pos', icon: UtensilsCrossed, perms: ['restaurant.view'] },
    { label: 'Bar workspace', to: '/bar', icon: Wine, perms: ['bar.view'] },
    { label: 'Bar POS', to: '/bar/pos', icon: Wine, perms: ['bar.view'] },
  ] },
  { title: 'Finance & insight', items: [
    { label: 'Payments', to: '/payments', icon: CreditCard, perms: ['payments.view'] },
    { label: 'Reports', to: '/reports', icon: BarChart3, perms: ['reports.view'] },
    { label: 'Expenditure', to: '/expenses', icon: ReceiptText, perms: ['expenses.view'] },
    { label: 'Inventory', to: '/inventory', icon: ClipboardList, perms: ['inventory.view'] },
  ] },
  { title: 'Administration', items: [
    { label: 'Admin console', to: '/admin', icon: ShieldCheck, perms: ['users.view'] },
    { label: 'Users', to: '/admin/users', icon: ShieldCheck, perms: ['users.view'] },
    { label: 'Roles & access', to: '/admin/roles', icon: KeyRound, perms: ['roles.view'] },
    { label: 'Room config', to: '/admin/rooms', icon: BedDouble, perms: ['rooms.manage'] },
    { label: 'Event spaces', to: '/admin/event-spaces', icon: CalendarClock, perms: ['events.edit'] },
    { label: 'Menus & POS', to: '/admin/menus', icon: Utensils, perms: ['restaurant.menu', 'bar.menu', 'pool.manage'] },
    { label: 'Categories', to: '/admin/categories', icon: Tags, perms: ['categories.view'] },
    { label: 'Settings', to: '/admin/settings', icon: Settings, perms: ['settings.view'] },
    { label: 'Branding', to: '/admin/branding', icon: Palette, perms: ['settings.edit'] },
    { label: 'Late checkouts', to: '/admin/late-checkouts', icon: Clock, perms: ['audit.view', 'reports.view', 'settings.view', 'dashboard.view'] },
    { label: 'Audit logs', to: '/admin/audit', icon: ScrollText, perms: ['audit.view'] },
  ] },
];

export const Sidebar: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const { theme } = useThemeStore();
  const perms = user?.permissions ?? [];
  const roleName = user?.roles?.[0]?.name ?? 'Admin';
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Staff member';
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'NS';
  const villaName = theme?.villaName || 'NSVilla';
  const villaTagline = theme?.villaTagline || 'Hospitality operations platform';
  const villaLogo = theme?.logoUrl || villaAssets.logo;
  const hasRestaurant = perms.includes('restaurant.view' as any);
  const hasBar = perms.includes('bar.view' as any);
  const hasBoth = hasRestaurant && hasBar;

  const sections = ALL_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        // If user has both restaurant + bar, hide the individual workspace entries (show combined F&B hub only)
        if (hasBoth && (item.to === '/restaurant' || item.to === '/bar')) return false;
        // If user only has restaurant (not bar), hide the combined F&B hub
        if (hasRestaurant && !hasBar && item.to === '/fnb') return false;
        // If user only has bar (not restaurant), hide the combined F&B hub
        if (hasBar && !hasRestaurant && item.to === '/fnb') return false;
        return item.perms.some(p => perms.includes(p));
      }),
    }))
    .filter(section => section.items.length > 0);

  return (
    <aside className="flex h-full w-[246px] shrink-0 flex-col overflow-y-auto border-r border-[#e5e8e5] bg-[#fbfcfa]">
      <div className="flex min-h-full flex-col px-3.5 py-5">
        {/* Brand */}
        <div className="mb-7 flex items-center gap-3 px-1">
          <img src={villaLogo} alt={villaName} className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-black/10 shadow-[0_6px_16px_rgba(22,164,212,.22)]" />
          <div className="min-w-0">
            <div className="truncate font-['Manrope'] text-[14px] font-extrabold leading-tight text-[#26363e]">{villaName}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-[#9aa3a6]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2d8a68] shadow-[0_0_0_3px_rgba(45,138,104,.12)]" />
              {roleName} operations
            </div>
          </div>
        </div>

        {/* Navigation */}
        {sections.map(section => (
          <div key={section.title} className="mb-6">
            <div className="px-3 pb-2 text-[9px] font-extrabold uppercase tracking-[.19em] text-[#9aa3a6]">{section.title}</div>
            <div className="space-y-0.5">
              {section.items.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold transition ${isActive ? 'bg-[#16a4d4] text-white shadow-[0_6px_18px_rgba(22,164,212,.16)]' : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full transition ${isActive ? 'bg-[#f1a83f]' : 'bg-transparent'}`} />
                      <Icon size={15} className={`shrink-0 transition ${isActive ? 'text-[#f1a83f]' : 'opacity-80 group-hover:opacity-100'}`} />
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="mt-auto space-y-4">
          <div className="flex items-center gap-2.5 rounded-2xl border border-[#e8ebe8] bg-white p-3 shadow-[0_2px_10px_rgba(20,35,43,.04)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16a4d4] text-[10px] font-extrabold text-white ring-2 ring-[#e8f2f4]">{initials}</div>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-extrabold text-[#26363e]">{fullName}</div>
              <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-[#9aa3a6]">{roleName}</div>
            </div>
          </div>
          <div className="border-t border-[#edf0ed] pt-3 text-[9px] leading-5 text-[#9aa3a6]">
            <div className="font-extrabold uppercase tracking-[.16em] text-[#7d898d]">{villaName}</div>
            <div>{villaTagline}</div>
            <div className="mt-0.5">Ho, Volta Region · Ghana</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
