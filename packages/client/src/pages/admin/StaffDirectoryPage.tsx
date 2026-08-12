// ============================================
// NS LUXURY VILLA — Staff Directory Page
// /admin/staff — Searchable staff roster
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import { Users, Phone, Mail, Calendar } from 'lucide-react';
import {
  PageHeader,
  SearchInput,
  SelectInput,
  Badge,
  EmptyState,
  Spinner,
  showToast,
  statusBadge,
} from '../../components/ui';
import { usersApi, type UserRecord } from '../../services/apiService';

const StaffCard: React.FC<{ user: UserRecord }> = ({ user }) => {
  const initials = `${user.firstName[0]}${user.lastName[0]}`;

  return (
    <div className="bg-[#1C1F28] border border-[#2B303E] hover:border-[#C5A880]/50 rounded-md p-4 transition-all group space-y-3">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded bg-[#252836] border border-[#2B303E] flex items-center justify-center text-xs font-bold text-[#C5A880]">
          {initials}
        </div>
        {statusBadge(user.status)}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-[#F4F4F2] group-hover:text-[#C5A880] transition-colors">
          {user.firstName} {user.lastName}
        </h3>
        <p className="text-[10px] text-[#6E737B]">@{user.username}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {user.roles.slice(0, 2).map((r) => (
          <Badge key={r.id} label={r.name.replace(/_/g, ' ')} variant="info" />
        ))}
      </div>

      <div className="space-y-1 border-t border-[#20242F] pt-2 text-[11px]">
        <div className="text-[#A0A5AD] truncate flex items-center gap-1.5">
          <Mail size={12} className="text-[#6E737B] shrink-0" />
          <span className="truncate">{user.email}</span>
        </div>
        {user.phone && (
          <div className="text-[#A0A5AD] flex items-center gap-1.5">
            <Phone size={12} className="text-[#6E737B] shrink-0" />
            <span>{user.phone}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const StaffDirectoryPage: React.FC = () => {
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
        if (Array.isArray(users)) {
          setAllUsers(users);
        } else {
          console.warn('Users data is not an array:', users);
          setAllUsers([]);
        }
      } else {
        console.warn('Invalid response structure:', res);
      }
    } catch (error) {
      console.error('Failed to load staff directory:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to load staff directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
    <div className="space-y-6">
      <PageHeader
        title="Staff Roster & Personnel"
        subtitle={`${filtered.length} staff member${filtered.length !== 1 ? 's' : ''} in directory`}
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#1C1F28] border border-[#2B303E] rounded-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Search staff name or email..." className="w-64" />
        <div className="flex items-center gap-2">
          <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </SelectInput>
          <SelectInput value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-36">
            <option value="">All Roles</option>
            {uniqueRoles.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </SelectInput>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-[#A0A5AD]">Loading staff directory...</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No staff members found" subtitle="Try adjusting your search or filter criteria." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((user) => (
            <StaffCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StaffDirectoryPage;
