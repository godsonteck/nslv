// ============================================
// NS LUXURY VILLA — System Administration Console
// /admin — System-level console. Restricted to the Admin role.
// Distinct from the Manager operational control center:
// only Admin manages accounts, roles, permissions, settings
// and the immutable audit trail.
// ============================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, rolesApi, auditApi, type AuditLogRecord } from '../../services/apiService';
import { Button, MetricCard, DataTable, Badge, LoadingState } from '../../components/ui';
import {
  ShieldCheck,
  Users,
  KeyRound,
  Utensils,
  Tags,
  Settings,
  ScrollText,
  Activity,
  RefreshCw,
  ArrowRight,
  Server,
  Lock,
  Upload,
  BedDouble,
  CalendarClock,
} from 'lucide-react';

interface ConsoleMetrics {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  totalPermissions: number;
}

const emptyMetrics: ConsoleMetrics = {
  totalUsers: 0,
  activeUsers: 0,
  totalRoles: 0,
  totalPermissions: 0,
};

const actionVariant = (action: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' => {
  if (action.includes('created') || action.includes('login')) return 'success';
  if (action.includes('deleted') || action.includes('deactivated') || action.includes('failed')) return 'danger';
  if (action.includes('updated') || action.includes('changed') || action.includes('assigned')) return 'warning';
  if (action.includes('viewed') || action.includes('exported')) return 'info';
  return 'neutral';
};

const SystemHero: React.FC = () => (
  <section className="relative overflow-hidden rounded-[24px] bg-[#101a2b] text-white shadow-[0_18px_50px_rgba(16,26,43,.25)]">
    <div className="absolute inset-0 bg-gradient-to-br from-[#101a2b] via-[#16233a] to-[#0e2941]"/>
    <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#b18a55]/20 blur-3xl"/>
    <div className="relative grid min-h-[240px] lg:grid-cols-[1.2fr_.8fr]">
      <div className="relative p-7 sm:p-9">
        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#d9bd91]"><Lock size={13} /> System administration</div>
        <h2 className="mt-3 max-w-xl text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Configure the platform, not the rooms.</h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-white/70">Accounts, roles, permissions, staff records, POS menus, system settings and the immutable audit trail. Operations live in the Manager control center.</p>
      </div>
      <div className="grid grid-cols-2 border-l border-white/10 bg-white/5">
        <HeroStat label="User accounts" icon={<Users size={15} />} note="Managed here" />
        <HeroStat label="Roles & grants" icon={<KeyRound size={15} />} note="Permission model" />
        <HeroStat label="Audit trail" icon={<ScrollText size={15} />} note="Immutable events" />
        <HeroStat label="System settings" icon={<Settings size={15} />} note="Property config" />
      </div>
    </div>
  </section>
);

const HeroStat: React.FC<{ label: string; icon: React.ReactNode; note: string }> = ({ label, icon, note }) => (
  <div className="flex flex-col justify-center border-b border-r border-white/10 p-5 last:border-r-0">
    <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[.15em] text-white/50">{icon}{label}</div>
    <div className="mt-2 text-[10px] text-white/50">{note}</div>
  </div>
);

interface QuickTile { label: string; to: string; icon: React.ReactNode; desc: string; }
const QUICK_LINKS: QuickTile[] = [
  { label: 'User accounts', to: '/admin/users', icon: <Users size={18} />, desc: 'Create, suspend & assign roles' },
  { label: 'Roles & permissions', to: '/admin/roles', icon: <KeyRound size={18} />, desc: 'Define the access model' },
  { label: 'Room config', to: '/admin/rooms', icon: <BedDouble size={18} />, desc: 'Room types, inventory & amenities' },
  { label: 'Event spaces', to: '/admin/event-spaces', icon: <CalendarClock size={18} />, desc: 'Venue locations, capacity & rates' },
  { label: 'Categories', to: '/admin/categories', icon: <Tags size={18} />, desc: 'Classify menus, stock, rooms & expenses' },
  { label: 'Menu & POS', to: '/admin/menus', icon: <Utensils size={18} />, desc: 'Catalog & department pricing' },
  { label: 'System settings', to: '/admin/settings', icon: <Settings size={18} />, desc: 'Property-wide configuration' },
  { label: 'Audit logs', to: '/admin/audit', icon: <ScrollText size={18} />, desc: 'Immutable activity trail' },
];

export const AdminConsolePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<ConsoleMetrics>(emptyMetrics);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [error, setError] = useState('');

  const load = async (initial = false) => {
    try {
      initial ? setLoading(true) : setRefreshing(true);
      setError('');
      const [usersRes, rolesRes, permsRes, auditRes] = await Promise.allSettled([
        usersApi.list({ pageSize: 200 }),
        rolesApi.list(),
        rolesApi.permissions(),
        auditApi.list({ pageSize: 8 }),
      ]);
      const next = { ...emptyMetrics };
      if (usersRes.status === 'fulfilled') {
        const list = usersRes.value.data?.data ?? usersRes.value.data?.items ?? [];
        next.totalUsers = list.length;
        next.activeUsers = list.filter((u) => String(u.status).toUpperCase() === 'ACTIVE').length;
      }
      if (rolesRes.status === 'fulfilled') next.totalRoles = rolesRes.value.data?.length ?? 0;
      if (permsRes.status === 'fulfilled') next.totalPermissions = permsRes.value.data?.permissions?.length ?? 0;
      setMetrics(next);
      if (auditRes.status === 'fulfilled') setLogs(auditRes.value.data?.data ?? auditRes.value.data?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load system administration data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => { void load(true); }, []);

  if (loading) return <LoadingState message="Loading the system administration console…" />;

  const auditColumns = [
    { key: 'time', header: 'When', render: (l: AuditLogRecord) => <span className="font-mono text-[10px] text-[#5b6b7a]">{new Date(l.createdAt).toLocaleString()}</span> },
    { key: 'action', header: 'Action', render: (l: AuditLogRecord) => <Badge label={l.action} variant={actionVariant(l.action)} /> },
    { key: 'resource', header: 'Resource', render: (l: AuditLogRecord) => <span className="font-bold text-[#1a2b3c]">{l.resource}</span> },
    { key: 'user', header: 'Actor', render: (l: AuditLogRecord) => <span className="text-[#40525f]">{l.userName ?? l.userEmail ?? '—'}</span> },
  ];

  return (
    <div className="space-y-6 select-none pb-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8a9ba8]"><Server size={13} className="text-[#b18a55]" /> NSVilla · Admin only</div>
          <h1 className="mt-1 font-[Manrope] text-[26px] font-extrabold tracking-[-0.04em] text-[#101a2b]">System Administration Console</h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#7a858a]">Secure management of user accounts, roles & permissions, staff records, POS menus, system settings and the immutable audit trail.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} loading={refreshing}><RefreshCw size={14} /> Refresh</Button>
          <Button size="sm" onClick={() => navigate('/admin/users')}><ShieldCheck size={14} /> Manage users</Button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div>}

      <SystemHero />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="User accounts" value={metrics.totalUsers} subtext={`${metrics.activeUsers} active`} indicator={<Users size={18} />} accent />
        <MetricCard label="System roles" value={metrics.totalRoles} subtext="Granular permission model" indicator={<KeyRound size={18} />} />
        <MetricCard label="Permissions" value={metrics.totalPermissions} subtext="Tracked access grants" indicator={<ShieldCheck size={18} />} />
        <MetricCard label="Audit events" value={logs.length} subtext="Most recent activity" indicator={<Activity size={18} />} />
      </div>

      <div>
        <h2 className="mb-3 text-base font-extrabold tracking-[-.02em] text-[#14232b]">Administration modules</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((tile) => (
            <button key={tile.to} onClick={() => navigate(tile.to)} className="group flex items-start gap-4 rounded-2xl border border-[#e2e7ea] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#b18a55]/50 hover:shadow-md">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0f4f7] text-[#1b4965] transition group-hover:bg-[#101a2b] group-hover:text-[#d9bd91]">{tile.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-[#1a2b3c]">{tile.label}</span>
                <span className="mt-1 block text-[11px] leading-4 text-[#7c8a95]">{tile.desc}</span>
                <span className="mt-2 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#8f6a3e]">Open <ArrowRight size={12} /></span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold tracking-[-.02em] text-[#14232b]">Recent audit activity</h2>
          <p className="mt-0.5 text-[11px] text-[#7c8a95]">Latest system events captured on the immutable trail.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/audit')}>Full audit logs →</Button>
      </div>
      <DataTable
        columns={auditColumns}
        data={logs}
        loading={refreshing}
        keyFn={(l) => l.id}
        emptyTitle="No audit events recorded"
        emptySubtitle="System actions will appear here as they are captured."
        onRowClick={() => navigate('/admin/audit')}
      />
    </div>
  );
};

export default AdminConsolePage;
