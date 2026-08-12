import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { CalendarDays, Users, BedDouble, LayoutDashboard, CreditCard, BarChart3, Settings, ShieldCheck, UtensilsCrossed, Utensils, Wine, Waves, UserRound, ClipboardList, ReceiptText, UserCog, CalendarClock, Palette } from 'lucide-react';
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
  ] },
  { title: 'Departments', items: [
    { label: 'F&B workspace', to: '/fnb', icon: UtensilsCrossed, perms: ['restaurant.view', 'bar.view', 'pool.view'] },
    { label: 'Restaurant POS', to: '/restaurant/pos', icon: UtensilsCrossed, perms: ['restaurant.view'] },
    { label: 'Bar POS', to: '/bar/pos', icon: Wine, perms: ['bar.view'] },
    { label: 'Pool services', to: '/pool/services', icon: Waves, perms: ['pool.view'] },
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
    { label: 'Menus & POS', to: '/admin/menus', icon: Utensils, perms: ['restaurant.menu', 'bar.menu', 'pool.manage'] },
    { label: 'Settings', to: '/admin/settings', icon: Settings, perms: ['settings.view'] },
    { label: 'Branding', to: '/admin/branding', icon: Palette, perms: ['settings.edit'] },
  ] },
];

export const Sidebar: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const { theme } = useThemeStore();
  const perms = user?.permissions ?? [];
  const roleName = user?.roles?.[0]?.name ?? 'Admin';
  const villaName = theme?.villaName || 'NSVilla';
  const villaTagline = theme?.villaTagline || 'Hospitality operations platform';
  const sections = ALL_SECTIONS
    .map(section => ({ ...section, items: section.items.filter(item => item.perms.some(p => perms.includes(p))) }))
    .filter(section => section.items.length > 0);

  return <aside className="flex h-full w-[246px] shrink-0 flex-col overflow-y-auto border-r border-[#e5e8e5] bg-[#fbfcfa]">
    <div className="flex min-h-full flex-col px-3 py-5">
      <div className="mb-5 rounded-2xl border border-[#e6ddcf] bg-[#f7f0e5] px-4 py-3.5">
        <div className="flex items-center justify-between"><div><div className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#a37a45]">{villaName}</div><div className="mt-1 font-['Manrope'] text-[13px] font-extrabold text-[#26363e]">{roleName} operations</div></div><span className="h-2 w-2 rounded-full bg-[#2d8a68] shadow-[0_0_0_4px_rgba(45,138,104,.10)]"/></div>
        <div className="mt-2 text-[10px] leading-4 text-slate-500">Connected to the live {villaName} property workspace.</div>
      </div>
      {sections.map(section => <div key={section.title} className="mb-5"><div className="px-3 pb-2 text-[9px] font-extrabold uppercase tracking-[.19em] text-slate-400">{section.title}</div><div className="space-y-0.5">{section.items.map(({label,to,icon:Icon}) => <NavLink key={to} to={to} className={({isActive}) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold transition ${isActive ? 'bg-[#174b59] text-white shadow-[0_7px_18px_rgba(23,75,89,.14)]' : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'}`}><Icon size={15} className="shrink-0 opacity-80"/><span>{label}</span></NavLink>)}</div></div>)}
      <div className="mt-auto border-t border-slate-200/80 pt-4 text-[9px] leading-5 text-slate-400"><div className="font-extrabold uppercase tracking-[.16em] text-slate-500">{villaName}</div><div>{villaTagline}</div><div>Ho, Volta Region · Ghana</div></div>
    </div>
  </aside>;
};
export default Sidebar;
