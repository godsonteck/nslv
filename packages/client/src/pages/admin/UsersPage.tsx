// ============================================
// NS LUXURY VILLA — Staff & Users Management
// User Accounts, Multi-Role Access Control & Security
// ============================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  UserPlus,
  Edit2,
  ShieldOff,
  ShieldCheck,
  Trash2,
  Monitor,
  CheckSquare,
  Square,
  Shield,
  Users,
  KeyRound,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  Button,
  Pagination,
  SelectInput,
  Modal,
  FormField,
  TextInput,
  showToast,
  statusBadge,
  LoadingState,
} from '../../components/ui';
import { usersApi, rolesApi, type UserRecord } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';

const ROLE_ACCESS_MAP: Record<
  string,
  { description: string; interfaces: string[]; badgeBg: string }
> = {
  Admin: {
    description: 'Full system oversight — users, roles, settings, financials & audit trail.',
    interfaces: ['All Modules', 'Security & Users', 'Roles & Grants', 'Settings', 'Audit Logs'],
    badgeBg: 'glass-subtle text-[var(--ns-danger)] border-[var(--ns-danger)]',
  },
  Manager: {
    description: 'Operational manager — oversees reservations, front desk, POS outlets & reports.',
    interfaces: ['Dashboard', 'Reservations', 'Front Desk', 'POS Outlets', 'Ledgers', 'Reports'],
    badgeBg: 'glass-subtle text-[var(--ns-warning)] border-[var(--ns-warning)]',
  },
  Reception: {
    description: 'Front office desk — handles bookings, check-in/out, folios, and daily cash.',
    interfaces: ['Front Desk', 'Reservations', 'Guest Folios', 'Cash at Hand', 'Pool Passes'],
    badgeBg: 'glass-subtle text-[var(--ns-info)] border-[var(--ns-info)]',
  },
  Restaurant: {
    description: 'Dining room & kitchen staff — dining orders, menus & Restaurant POS.',
    interfaces: ['Restaurant POS', 'Kitchen Orders', 'Stock Inventory'],
    badgeBg: 'glass-subtle text-[var(--ns-success)] border-[var(--ns-success)]',
  },
  Bar: {
    description: 'Bar & lounge staff — beverage orders, drink recipes & Bar POS.',
    interfaces: ['Bar POS', 'Drink Orders', 'Beverage Inventory'],
    badgeBg: 'glass-subtle text-[var(--ns-purple)] border-[var(--ns-purple)]',
  },
};

interface UserModalProps {
  open: boolean;
  editUser: UserRecord | null;
  roles: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ open, editUser, roles, onClose, onSaved }) => {
  const isEdit = !!editUser;

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    primaryRoleId: '',
    additionalRoleIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editUser) {
      const userRoles = editUser.roles || [];
      const primaryId = userRoles[0]?.id || '';
      const additionalIds = userRoles.slice(1).map((r) => r.id);

      setForm({
        firstName: editUser.firstName || '',
        lastName: editUser.lastName || '',
        email: editUser.email || '',
        username: editUser.username || '',
        password: '',
        phone: editUser.phone || '',
        primaryRoleId: primaryId,
        additionalRoleIds: additionalIds,
      });
    } else {
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        phone: '',
        primaryRoleId: roles[0]?.id || '',
        additionalRoleIds: [],
      });
    }
  }, [editUser, roles]);

  const toggleAdditionalRole = (roleId: string) => {
    setForm((prev) => {
      const exists = prev.additionalRoleIds.includes(roleId);
      return {
        ...prev,
        additionalRoleIds: exists
          ? prev.additionalRoleIds.filter((id) => id !== roleId)
          : [...prev.additionalRoleIds, roleId],
      };
    });
  };

  const allAssignedRoleIds = useMemo(() => {
    return Array.from(new Set([form.primaryRoleId, ...form.additionalRoleIds].filter(Boolean)));
  }, [form.primaryRoleId, form.additionalRoleIds]);

  const selectedRoleObjs = useMemo(() => {
    return roles.filter((r) => allAssignedRoleIds.includes(r.id));
  }, [roles, allAssignedRoleIds]);

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.email.trim()) {
      showToast('error', 'Please fill in all required name, username and email fields.');
      return;
    }
    if (!isEdit && !form.password) {
      showToast('error', 'Initial temporary password is required.');
      return;
    }
    if (!form.primaryRoleId) {
      showToast('error', 'Please select at least one primary role.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && editUser) {
        await usersApi.update(editUser.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          roleIds: allAssignedRoleIds,
        });
        showToast('success', 'User updated successfully.');
      } else {
        await usersApi.create({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          roleIds: allAssignedRoleIds,
        });
        showToast('success', 'Staff account created.');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to save staff user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Staff Member — ${editUser?.firstName} ${editUser?.lastName}` : 'Add New Staff Account'}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First Name" required>
            <TextInput
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="e.g. Ama"
              required
            />
          </FormField>
          <FormField label="Last Name" required>
            <TextInput
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="e.g. Mensah"
              required
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Username" required>
            <TextInput
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="e.g. amensah"
              required
            />
          </FormField>
          <FormField label="Email Address" required>
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. ama@nsvilla.com"
              required
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={isEdit ? 'Reset Password (optional)' : 'Initial Password'} required={!isEdit}>
            <TextInput
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={isEdit ? 'Leave blank to retain current' : 'Min. 8 characters'}
              required={!isEdit}
            />
          </FormField>
          <FormField label="Phone Number">
            <TextInput
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+233 …"
            />
          </FormField>
        </div>

        {/* Primary Role */}
        <div className="rounded-xl border border-[var(--ns-glass-line)] glass-subtle p-4 space-y-3">
          <FormField label="Primary Department Role" required>
            <SelectInput
              value={form.primaryRoleId}
              onChange={(e) => {
                const newId = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  primaryRoleId: newId,
                  additionalRoleIds: prev.additionalRoleIds.filter((id) => id !== newId),
                }));
              }}
              required
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectInput>
          </FormField>

          {/* Additional Cross-Functional Roles */}
          <div>
            <label className="text-xs font-bold text-[var(--ns-ink)] block pb-2">
              Cross-Functional Delegated Roles (optional)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roles
                .filter((r) => r.id !== form.primaryRoleId)
                .map((r) => {
                  const isChecked = form.additionalRoleIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleAdditionalRole(r.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                        isChecked
                          ? 'border-[var(--ns-gold)] glass-subtle ns-glass-selected text-[var(--ns-ink)]'
                          : 'border-[var(--ns-glass-line)] glass-subtle text-[var(--ns-muted)] ns-glass-hover'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare size={14} className="text-[var(--ns-gold)] shrink-0" />
                      ) : (
                        <Square size={14} className="text-[var(--ns-muted)] shrink-0" />
                      )}
                      <span className="text-xs font-semibold">{r.name} Access</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Selected Capabilities Badge */}
        {selectedRoleObjs.length > 0 && (
          <div className="rounded-xl border border-[var(--ns-gold)]/30 glass-subtle ns-glass-selected p-3 text-xs flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-[var(--ns-ink)] flex items-center gap-1">
              <Shield size={13} className="text-[var(--ns-gold)]" /> Unlocked Access:
            </span>
            {selectedRoleObjs.map((r) => (
              <span
                key={r.id}
                className="rounded-md glass-subtle px-2 py-0.5 text-[10px] font-bold text-[var(--ns-teal)]"
              >
                {r.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-glass-line)]">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={saving}
            onClick={save}
            className="glass ns-glass-hover text-[var(--ns-teal)] font-semibold"
          >
            {isEdit ? 'Save Changes' : 'Create Staff User'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const UsersPage: React.FC = () => {
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission(PERMISSIONS.USERS_CREATE);
  const canEdit = hasPermission(PERMISSIONS.USERS_EDIT);
  const canDelete = hasPermission(PERMISSIONS.USERS_DELETE);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);

  const pageSize = 12;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      if (res.success && res.data) {
        setUsers(res.data.data ?? res.data.items ?? []);
        setTotal(res.data.total);
      }
    } catch {
      showToast('error', 'Failed to load system staff users.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    rolesApi.list().then((r) => {
      if (r.success && r.data) setRoles(r.data.map((ro: any) => ({ id: ro.id, name: ro.name })));
    });
  }, []);

  const handleStatusToggle = async (u: UserRecord) => {
    const newStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await usersApi.update(u.id, { status: newStatus });
      showToast('success', `User ${newStatus === 'ACTIVE' ? 'reactivated' : 'suspended'}.`);
      fetchUsers();
    } catch {
      showToast('error', 'Failed to update user status.');
    }
  };

  const handleDelete = async (u: UserRecord) => {
    if (!window.confirm(`Permanently delete ${u.firstName} ${u.lastName} (@${u.username})? This cannot be undone.`)) return;
    try {
      await usersApi.remove(u.id);
      showToast('success', 'User account deleted.');
      fetchUsers();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete user.');
    }
  };

  // Metrics
  const activeCount = useMemo(() => {
    return users.filter((u) => u.status === 'ACTIVE').length;
  }, [users]);

  return (
    <div className="space-y-5">
      {/* ── Compact Header ── */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Users size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>Staff User Accounts</h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Manage employee access credentials, assign multi-role security tiers, and cross-functional operational authorizations.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditUser(null);
                setModalOpen(true);
              }}
              className="gap-1.5 glass ns-glass-hover !border-[var(--ns-gold)] !text-[var(--ns-gold)] shadow-sm font-semibold"
            >
              <UserPlus size={14} /> Add Staff User
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Ribbon ── */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Total Staff Users', value: total, note: 'Registered system accounts', icon: Users },
          { label: 'Active Accounts', value: activeCount, note: 'Currently authorized to sign in', icon: UserCheck },
          { label: 'Configured Roles', value: roles.length, note: 'Security tiers & permission sets', icon: KeyRound },
        ].map((kpi) => (
          <div key={kpi.label} className="flex-1 min-w-[140px] rounded-xl border border-[var(--ns-glass-line)] glass px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-subtle border border-[var(--ns-glass-line)] text-[var(--ns-gold)] shrink-0">
              <kpi.icon size={14} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>{kpi.label}</div>
              <div className="text-lg font-black" style={{ color: 'var(--ns-ink)' }}>{kpi.value}</div>
              <div className="text-[10px] font-semibold" style={{ color: 'var(--ns-muted)' }}>{kpi.note}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Users Table Section ── */}
      <div className="rounded-2xl border border-[var(--ns-glass-line)] glass overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-3 border-b border-[var(--ns-glass-line)] ns-glass-band">
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--ns-ink)' }}>Authorized Personnel Directory</h2>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Staff member details, usernames, department roles, and account security states.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchUsers} className="h-8 gap-1.5 text-xs !text-[var(--ns-muted)]">
              <RefreshCw size={13} /> Refresh
            </Button>
          </div>
        </div>

        {/* Inline Toolbar */}
        <div className="px-5 py-3 border-b border-[var(--ns-glass-line)] flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ns-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search staff by name, email, or username…"
              className="w-full h-8 pl-8 pr-3 text-xs glass-input border border-[var(--ns-glass-line)] rounded text-[var(--ns-ink)] placeholder:text-[var(--ns-muted)] focus:border-[var(--ns-gold)] focus:outline-none"
            />
          </div>
          <SelectInput
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-36 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </SelectInput>
        </div>

        {loading ? (
          <div className="p-12"><LoadingState /></div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-xs text-[var(--ns-muted)]">
            No staff accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--ns-glass-line)] ns-glass-band text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                  <th className="py-3 px-5">Staff Member</th>
                  <th className="py-3 px-5">Email Address</th>
                  <th className="py-3 px-5">Assigned Roles</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-glass-line)]">
                {users.map((u) => (
                  <tr key={u.id} className="ns-glass-hover transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl glass-subtle border border-[var(--ns-glass-line)] font-mono text-xs font-bold text-[var(--ns-gold)] shrink-0">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <div className="font-bold text-[var(--ns-ink)] text-xs">
                            {u.firstName} {u.lastName}
                          </div>
                          <div className="text-[10px] text-[var(--ns-muted)] font-mono">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-[var(--ns-muted)] font-medium">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map((r: any) => {
                          const rName = typeof r === 'string' ? r : r?.name;
                          return (
                            <span
                              key={rName}
                              className="rounded-md glass-subtle border border-[var(--ns-glass-line)] px-2 py-0.5 text-[10px] font-bold text-[var(--ns-ink)]"
                            >
                              {rName}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      {statusBadge(u.status)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => {
                                setEditUser(u);
                                setModalOpen(true);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ns-muted)] glass-subtle ns-glass-hover transition-colors"
                              title="Edit Roles & Access"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleStatusToggle(u)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ns-muted)] glass-subtle ns-glass-hover transition-colors"
                              title={u.status === 'ACTIVE' ? 'Suspend Access' : 'Reactivate Access'}
                            >
                              {u.status === 'ACTIVE' ? (
                                <ShieldOff size={13} className="text-[var(--ns-warning)]" />
                              ) : (
                                <ShieldCheck size={13} className="text-[var(--ns-success)]" />
                              )}
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ns-danger)] glass-subtle ns-glass-hover transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <div className="p-4 border-t border-[var(--ns-glass-line)] flex justify-end">
            <Pagination
              page={page}
              totalPages={Math.ceil(total / pageSize)}
              total={total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {modalOpen && (
        <UserModal
          open={modalOpen}
          editUser={editUser}
          roles={roles}
          onClose={() => setModalOpen(false)}
          onSaved={fetchUsers}
        />
      )}
    </div>
  );
};

export default UsersPage;
