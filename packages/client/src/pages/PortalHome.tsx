import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Building2, CalendarDays, ClipboardList, Coffee, ShieldCheck, Users, Waves, Wine } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

type PortalDefinition = {
  name: string;
  summary: string;
  icon: React.ReactNode;
  available: { label: string; to: string }[];
  pending: string[];
};

const portals: Record<string, PortalDefinition> = {
  Admin: { name: 'Administration', summary: 'System access, people, settings and traceability.', icon: <ShieldCheck size={22} />, available: [{ label: 'Users', to: '/admin/users' }, { label: 'Roles & permissions', to: '/admin/roles' }, { label: 'Audit logs', to: '/admin/audit' }, { label: 'Settings', to: '/admin/settings' }], pending: ['Operational reporting', 'Financial oversight'] },
  Manager: { name: 'Operations management', summary: 'A single place to supervise the villa’s daily operations.', icon: <Building2 size={22} />, available: [], pending: ['Live occupancy and arrivals', 'Department performance', 'Operational reports'] },
  Reception: { name: 'Reception', summary: 'Front-office workflows built for fast, accurate guest service.', icon: <Users size={22} />, available: [], pending: ['Reservations and availability', 'Check-in and check-out', 'Guest folios and payments'] },
  Restaurant: { name: 'Restaurant', summary: 'Restaurant service will connect to the central guest folio.', icon: <Coffee size={22} />, available: [], pending: ['Touch POS', 'Kitchen order status', 'Verified room charges'] },
  Bar: { name: 'Bar', summary: 'Beverage service will use the same orders and folio rules.', icon: <Wine size={22} />, available: [], pending: ['Fast beverage POS', 'Bar order status', 'Verified room charges'] },
  Pool: { name: 'Pool', summary: 'Pool guest service will use in-house guest verification.', icon: <Waves size={22} />, available: [], pending: ['Guest and room lookup', 'Pool services', 'Folio and direct payments'] },
};

export const PortalHome: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const role = user?.roles[0]?.name || 'Reception';
  const portal = portals[role] || portals.Reception;

  return <div className="max-w-5xl space-y-6">
    <section className="bg-[#151C28] border border-[#2D3748] rounded-2xl p-6 md:p-8">
      <div className="flex items-start gap-4"><div className="p-3 rounded-xl bg-[#8C2D19]/20 text-[#E2B768]">{portal.icon}</div><div><p className="text-xs font-semibold uppercase tracking-widest text-[#E2B768]">{role} portal</p><h1 className="mt-1 text-2xl font-bold text-[#F3F4F6]">{portal.name}</h1><p className="mt-2 text-sm text-[#9CA3AF]">{portal.summary}</p></div></div>
    </section>
    {portal.available.length > 0 && <section><h2 className="mb-3 text-sm font-semibold text-[#F3F4F6]">Available now</h2><div className="grid gap-3 sm:grid-cols-2">{portal.available.map((item) => <Link key={item.to} to={item.to} className="flex items-center justify-between rounded-xl border border-[#2D3748] bg-[#1C2536] p-4 text-sm text-[#F3F4F6] hover:border-[#C49A45]/60"><span>{item.label}</span><ArrowRight size={16} className="text-[#E2B768]" /></Link>)}</div></section>}
    <section className="rounded-2xl border border-[#2D3748] bg-[#151C28] p-6"><div className="flex gap-3"><AlertCircle size={18} className="mt-0.5 shrink-0 text-[#E2B768]" /><div><h2 className="text-sm font-semibold text-[#F3F4F6]">Operational data is not connected yet</h2><p className="mt-1 text-sm text-[#9CA3AF]">These workflows stay unavailable until their server APIs, permissions, and persistence are implemented. No sample figures are shown here.</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-3">{portal.pending.map((item) => <div key={item} className="flex items-center gap-2 rounded-lg border border-[#2D3748] bg-[#0F141C] p-3 text-xs text-[#9CA3AF]"><ClipboardList size={14} />{item}</div>)}</div></section>
  </div>;
};
