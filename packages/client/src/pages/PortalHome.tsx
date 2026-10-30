import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Building2, ClipboardList, ShieldCheck, Users, UtensilsCrossed, Wine } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { formatUserGreeting } from '@nslv/shared';

type PortalDefinition = {
  name: string;
  summary: string;
  icon: React.ReactNode;
  available: { label: string; to: string }[];
  pending: string[];
};

const portals: Record<string, PortalDefinition> = {
  Admin: { name: 'Admin', summary: 'Manage staff, permissions, settings, and daily records in one place.', icon: <ShieldCheck size={22} />, available: [{ label: 'People', to: '/admin/users' }, { label: 'Roles', to: '/admin/roles' }, { label: 'Audit trail', to: '/admin/audit' }, { label: 'Settings', to: '/admin/settings' }], pending: ['Reports', 'Finance'] },
  Manager: { name: 'Manager', summary: 'Keep an eye on rooms, guests, and daily work across the property.', icon: <Building2 size={22} />, available: [], pending: ['Room view', 'Team performance', 'Daily reports'] },
  Reception: { name: 'Front desk', summary: 'Handle guest arrivals, billing, and check-out in one place.', icon: <Users size={22} />, available: [{ label: 'Front desk', to: '/frontdesk' }, { label: 'Pool service', to: '/pool/services' }], pending: ['Bookings', 'Check-in and check-out', 'Guest bills'] },
  Restaurant: { name: 'Restaurant', summary: 'Run orders and service for the restaurant team.', icon: <UtensilsCrossed size={22} />, available: [{ label: 'Restaurant desk', to: '/restaurant' }, { label: 'Restaurant POS', to: '/restaurant/pos' }], pending: [] },
  Bar: { name: 'Bar', summary: 'Handle drinks and bar sales from the till.', icon: <Wine size={22} />, available: [{ label: 'Bar desk', to: '/bar' }, { label: 'Bar POS', to: '/bar/pos' }], pending: [] },
};

export const PortalHome: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const greeting = formatUserGreeting(user);
  const role = user?.roles[0]?.name || 'Reception';
  const portal = portals[role] || portals.Reception;

  return (
    <div className="max-w-5xl space-y-6">
      <section className="glass-strong relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div
            className="glass-subtle flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ color: 'var(--ns-gold)' }}
          >
            {portal.icon}
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--ns-gold)]">{role} portal</p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: 'var(--ns-ink)' }}>{greeting}</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--ns-muted)' }}>{portal.summary}</p>
          </div>
        </div>
      </section>
      {portal.available.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ns-ink)' }}>Quick links</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {portal.available.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="glass ns-glass-hover flex items-center justify-between rounded-xl p-4 text-sm transition-colors hover:border-[var(--ns-gold)]/60"
                style={{ color: 'var(--ns-ink)' }}
              >
                <span>{item.label}</span>
                <ArrowRight size={16} className="text-[var(--ns-gold)]" />
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="glass rounded-2xl p-6">
        <div className="flex gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--ns-gold)]" />
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--ns-ink)' }}>Live data is not connected yet</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--ns-muted)' }}>
              These sections will stay unavailable until the system is fully connected. No sample numbers are shown here.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {portal.pending.map((item) => (
            <div
              key={item}
              className="glass-subtle flex items-center gap-2 rounded-lg p-3 text-xs"
              style={{ color: 'var(--ns-muted)' }}
            >
              <ClipboardList size={14} />
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};


