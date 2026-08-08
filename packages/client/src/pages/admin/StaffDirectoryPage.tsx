// ============================================
// NS LUXURY VILLA — Staff Directory Page
// /staff — Searchable staff roster
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import { Users, Phone, Mail, Calendar } from 'lucide-react';
import {
  PageHeader, SearchInput, Badge, EmptyState,
  Spinner, ToastContainer, showToast, statusBadge,
} from '../components/ui';
import { usersApi, type UserRecord } from '../services/apiService';

// ──────────────────────────────────────────
// Staff Card
// ──────────────────────────────────────────
const StaffCard: React.FC<{ user: UserRecord }> = ({ user }) => {
  const initials = `${user.firstName[0]}${user.lastName[0]}`;
  const gradient = `hsl(${(user.firstName.charCodeAt(0) * 13) % 360}, 60%, 35%)`;

  return (
    <div className="bg-[#1C2536] border border-[#2D3748] rounded-xl p-4 hover:border-[#C49A45]/40 hover:shadow-lg hover:shadow-[#C49A45]/5 transition-all group">
      {/* Avatar + Status */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${gradient}, #8C2D19)` }}
        >
          {initials}
        </div>
        {statusBadge(user.status)}
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold text-[#F3F4F6] group-hover:text-[#C49A45] transition-colors">
        {user.firstName} {user.lastName}
      </h3>
      <p className="text-[10px] text-[#6B7280] mb-3">@{user.username}</p>

      {/* Roles */}
      <div className="flex flex-wrap gap-1 mb-3">
        {user.roles.slice(0, 2).map((r) => (
          <Badge key={r.id} label={r.name.replace(/_/g, ' ')} variant="info" />
        ))}
        {user.roles.length > 2 && (
          <Badge label={`+${user.roles.length - 2}`} variant="neutral" />
        )}
      </div>

      {/* Contact */}
      <div className="space-y-1.5 border-t border-[#2D3748] pt-3">
        <a
          href={`mailto:${user.email}`}
          className="flex items-center gap-2 text-[10px] text-[#9CA3AF] hover:text-[#C49A45] transition-colors"
        >
          <Mail size={11} className="shrink-0" />
          <span className="truncate">{user.email}</span>
        </a>
        {user.phone && (
          <a
            href={`tel:${user.phone}`}
            className="flex items-center gap-2 text-[10px] text-[#9CA3AF] hover:text-[#C49A45] transition-colors"
          >
            <Phone size={11} className="shrink-0" />
            <span>{user.phone}</span>
          </a>
        )}
        <div className="flex items-center gap-2 text-[10px] text-[#6B7280]">
          <Calendar size={11} className="shrink-0" />
          <span>Joined {new Date(user.createdAt).toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      {/* 2FA indicator */}
      {user.totpEnabled && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
          <span>🔒</span> 2FA Enabled
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────
// Staff Directory Page
// ──────────────────────────────────────────
const StaffDirectoryPage: React.FC = () => {
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [filtered, setFiltered] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ pageSize: 200 });
      if (res.success && res.data) {
        const users = res.data.data ?? res.data.items ?? [];
        setAllUsers(users);
      }
    } catch {
      showToast('error', 'Failed to load staff directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let result = allUsers;
    if (statusFilter) result = result.filter((u) => u.status === statusFilter);
    if (roleFilter) result = result.filter((u) => u.roles.some((r) => r.name === roleFilter));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.phone && u.phone.includes(q)),
      );
    }
    setFiltered(result);
  }, [allUsers, search, statusFilter, roleFilter]);

  const uniqueRoles = Array.from(new Set(allUsers.flatMap((u) => u.roles.map((r) => r.name))));

  return (
    <div className="p-6">
      <PageHeader
        title="Staff Directory"
        subtitle={`${filtered.length} staff member${filtered.length !== 1 ? 's' : ''} found`}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search staff..."
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#121824] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-[#F3F4F6] focus:outline-none focus:border-[#C49A45] transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-[#121824] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-[#F3F4F6] focus:outline-none focus:border-[#C49A45] transition-colors"
        >
          <option value="">All Roles</option>
          {uniqueRoles.map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Stats chips */}
        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-[#6B7280]">
            <span className="text-emerald-400 font-bold">{allUsers.filter((u) => u.status === 'ACTIVE').length}</span> Active ·{' '}
            <span className="text-amber-400 font-bold">{allUsers.filter((u) => u.status === 'SUSPENDED').length}</span> Suspended ·{' '}
            <span className="text-[#9CA3AF] font-bold">{allUsers.filter((u) => u.totpEnabled).length}</span> 2FA Enrolled
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title="No staff members found"
          subtitle="Try adjusting your search or filter criteria."
        />
      ) : (
        <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((user) => (
            <StaffCard key={user.id} user={user} />
          ))}
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default StaffDirectoryPage;
