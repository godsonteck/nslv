// ============================================
// NS LUXURY VILLA — System Administration Console
// System-level console for Administrator role.
// ============================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, rolesApi, auditApi, type AuditLogRecord } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { formatUserGreeting } from '@nslv/shared';
import { Button, statusBadge, LoadingState } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
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
  BedDouble,
  CalendarClock,
  Clock,
  Sparkles,
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

interface QuickTile {
  label: string;
  to: string;
  icon: React.ReactNode;
  desc: string;
}

const QUICK_LINKS: QuickTile[] = [
  { label: 'Staff Accounts', to: '/admin/users', icon: <Users size={18} />, desc: 'User credentials, roles & active status' },
  { label: 'Roles & Permissions', to: '/admin/roles', icon: <KeyRound size={18} />, desc: 'Access control & role definitions' },
  { label: 'Room Configuration', to: '/admin/rooms', icon: <BedDouble size={18} />, desc: 'Suites, inventory & villa amenities' },
  { label: 'Event Function Spaces', to: '/admin/event-spaces', icon: <CalendarClock size={18} />, desc: 'Venue spaces, capacities & rates' },
  { label: 'Catalog Categories', to: '/admin/categories', icon: <Tags size={18} />, desc: 'Menus, inventory & expense categories' },
  { label: 'Dining & POS Menus', to: '/admin/menus', icon: <Utensils size={18} />, desc: 'Restaurant & Bar catalogs & pricing' },
  { label: 'System Configuration', to: '/admin/settings', icon: <Settings size={18} />, desc: 'Property-wide preferences & policies' },
  { label: 'Late Departure Fees', to: '/admin/late-checkouts', icon: <Clock size={18} />, desc: 'Delayed checkouts & fee audits' },
  { label: 'Immutable Audit Trail', to: '/admin/audit', icon: <ScrollText size={18} />, desc: 'Full tamper-evident activity log' },
];

export const AdminConsolePage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const greeting = formatUserGreeting(user);
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
        usersApi.list({ pageSize: 100 }),
        rolesApi.list(),
        rolesApi.permissions(),
        auditApi.list({ pageSize: 6 }),
      ]);
      const next = { ...emptyMetrics };
      if (usersRes.status === 'fulfilled') {
        const list = usersRes.value.data?.data ?? usersRes.value.data?.items ?? [];
        next.totalUsers = list.length;
        next.activeUsers = list.filter((u: any) => String(u.status).toUpperCase() === 'ACTIVE').length;
      }
      if (rolesRes.status === 'fulfilled') next.totalRoles = rolesRes.value.data?.length ?? 0;
      if (permsRes.status === 'fulfilled') next.totalPermissions = permsRes.value.data?.permissions?.length ?? 0;
      setMetrics(next);
      if (auditRes.status === 'fulfilled') setLogs(auditRes.value.data?.data ?? auditRes.value.data?.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load administration console data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  return (
    <ShellPage
      eyebrow="Administration"
      title="System Administration"
      subtitle="Staff accounts, roles, access permissions, room configurations, menu catalogs, and immutable security audit logs."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            loading={refreshing}
            className="gap-1.5 border-[var(--ns-line)] text-[var(--ns-ink)] hover:bg-[var(--ns-surface-2)]"
          >
            <RefreshCw size={13} /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/admin/users')}
            className="gap-1.5 bg-[#c59a58] hover:bg-[#b88738] text-white shadow-sm font-semibold"
          >
            <ShieldCheck size={14} /> Staff Accounts
          </Button>
        </div>
      }
    >
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* ── Key Security Stats ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Staff Accounts"
          value={metrics.totalUsers}
          note={`${metrics.activeUsers} active system users`}
          icon={Users}
          accent
        />
        <StatTile
          label="Configured Roles"
          value={metrics.totalRoles}
          note="Granular permission access tiers"
          icon={KeyRound}
        />
        <StatTile
          label="Tracked Permissions"
          value={metrics.totalPermissions}
          note="Module security grants"
          icon={ShieldCheck}
        />
        <StatTile
          label="Recent Audit Records"
          value={logs.length}
          note="Immutable security events"
          icon={Activity}
        />
      </div>

      {/* ── Administration Modules Grid ── */}
      <Section
        title="Administration Modules"
        subtitle="Manage underlying property configuration, users, permissions, and audit trails."
      >
        <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((tile) => (
            <button
              key={tile.to}
              onClick={() => navigate(tile.to)}
              className="group flex items-start gap-4 rounded-2xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-5 text-left shadow-sm hover:border-[#c59a58]/40 hover:shadow-md transition-all"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ns-surface-2)] border border-[var(--ns-line)] text-[#c59a58] transition-colors group-hover:bg-[#173c4d] group-hover:text-white">
                {tile.icon}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[var(--ns-ink)]">{tile.label}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-[var(--ns-muted)]">{tile.desc}</span>
                <span className="mt-2.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#b88738]">
                  Open Module <ArrowRight size={11} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Audit Trail Preview ── */}
      <Section
        title="Recent Security & System Events"
        subtitle="Live snapshot from the immutable audit trail."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/audit')}
            className="gap-1 text-xs text-[#b88738] font-bold"
          >
            Full Audit Log <ArrowRight size={12} />
          </Button>
        }
      >
        {loading ? (
          <div className="p-10"><LoadingState /></div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ns-muted)]">
            No recent audit events captured.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--ns-line)] bg-[var(--ns-surface-2)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-5">Security Action</th>
                  <th className="py-3 px-5">Target Resource</th>
                  <th className="py-3 px-5">User / Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-line)]">
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => navigate('/admin/audit')}
                    className="cursor-pointer hover:bg-[var(--ns-surface-2)] transition-colors"
                  >
                    <td className="py-3 px-5 font-mono text-[11px] text-[var(--ns-muted)]">
                      {new Date(l.createdAt).toLocaleString('en-GH')}
                    </td>
                    <td className="py-3 px-5">
                      <span className="inline-flex rounded-md bg-[#173c4d]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--ns-ink)]">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-bold text-[var(--ns-ink)]">
                      {l.resource}
                    </td>
                    <td className="py-3 px-5 text-[var(--ns-muted)]">
                      {l.userName ?? l.userEmail ?? 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </ShellPage>
  );
};

export default AdminConsolePage;
