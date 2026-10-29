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
  Admin: { name: 'Administration', summary: 'System access, people, settings and traceability.', icon: <ShieldCheck size={22} />, available: [{ label: 'Users', to: '/admin/users' }, { label: 'Roles & permissions', to: '/admin/roles' }, { label: 'Audit logs', to: '/admin/audit' }, { label: 'Settings', to: '/admin/settings' }], pending: ['Operational reporting', 'Financial oversight'] },
  Manager: { name: 'Operations management', summary: 'A single place to supervise the villa’s daily operations.', icon: <Building2 size={22} />, available: [], pending: ['Live occupancy and arrivals', 'Department performance', 'Operational reports'] },
  Reception: { name: 'Reception', summary: 'Front-office workflows built for fast, accurate guest service.', icon: <Users size={22} />, available: [{ label: 'Front desk', to: '/frontdesk' }, { label: 'Pool services', to: '/pool/services' }], pending: ['Reservations and availability', 'Check-in and check-out', 'Guest folios and payments'] },
  Restaurant: { name: 'Restaurant', summary: 'Dining and kitchen operations with the restaurant POS.', icon: <UtensilsCrossed size={22} />, available: [{ label: 'Restaurant workspace', to: '/restaurant' }, { label: 'Restaurant POS', to: '/restaurant/pos' }], pending: [] },
  Bar: { name: 'Bar', summary: 'Bar and lounge service with the bar POS.', icon: <Wine size={22} />, available: [{ label: 'Bar workspace', to: '/bar' }, { label: 'Bar POS', to: '/bar/pos' }], pending: [] },
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
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ns-ink)' }}>Available now</h2>
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
            <h2 className="text-sm font-semibold" style={{ color: 'var(--ns-ink)' }}>Operational data is not connected yet</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--ns-muted)' }}>
              These workflows stay unavailable until their server APIs, permissions, and persistence are implemented. No sample figures are shown here.
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


