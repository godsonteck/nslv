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
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
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
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  Manager: {
    description: 'Operational manager — oversees reservations, front desk, POS outlets & reports.',
    interfaces: ['Dashboard', 'Reservations', 'Front Desk', 'POS Outlets', 'Ledgers', 'Reports'],
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  Reception: {
    description: 'Front office desk — handles bookings, check-in/out, folios, and daily cash.',
    interfaces: ['Front Desk', 'Reservations', 'Guest Folios', 'Cash at Hand', 'Pool Passes'],
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  Restaurant: {
    description: 'Dining room & kitchen staff — dining orders, menus & Restaurant POS.',
    interfaces: ['Restaurant POS', 'Kitchen Orders', 'Stock Inventory'],
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  Bar: {
    description: 'Bar & lounge staff — beverage orders, drink recipes & Bar POS.',
    interfaces: ['Bar POS', 'Drink Orders', 'Beverage Inventory'],
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
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
        <div className="rounded-xl border border-[#e5ebeb] bg-[#fbfdfd] p-4 space-y-3">
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
            <label className="text-xs font-bold text-[#0c1921] block pb-2">
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
                          ? 'border-[#c59a58] bg-[#fcf9f2] text-[#0c1921]'
                          : 'border-[#e5ebeb] bg-white text-[#5a6b75] hover:bg-slate-50'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare size={14} className="text-[#c59a58] shrink-0" />
                      ) : (
                        <Square size={14} className="text-[#cbd5e1] shrink-0" />
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
          <div className="rounded-xl border border-[#c59a58]/30 bg-[#fcf9f2] p-3 text-xs flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-[#0c1921] flex items-center gap-1">
              <Shield size={13} className="text-[#c59a58]" /> Unlocked Access:
            </span>
            {selectedRoleObjs.map((r) => (
              <span
                key={r.id}
                className="rounded-md bg-[#0c1921] px-2 py-0.5 text-[10px] font-bold text-[#fcf9f2]"
              >
                {r.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-[#edf2f2]">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={saving}
            onClick={save}
            className="bg-[#0c1921] hover:bg-[#173c4d] text-white font-semibold"
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
    <ShellPage
      eyebrow="ADMINISTRATION • STAFF ACCOUNTS & ROLES"
      title="Staff User Accounts"
      subtitle="Manage employee access credentials, assign multi-role security tiers, and cross-functional operational authorizations."
      actions={
        canCreate && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditUser(null);
              setModalOpen(true);
            }}
            className="gap-1.5 bg-[#c59a58] hover:bg-[#b88738] text-white shadow-sm font-semibold"
          >
            <UserPlus size={14} /> Add Staff User
          </Button>
        )
      }
    >
      {/* ── Stat Tiles ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Total Staff Users"
          value={total}
          note="Registered system accounts"
          icon={Users}
        />
        <StatTile
          label="Active Accounts"
          value={activeCount}
          note="Currently authorized to sign in"
          icon={UserCheck}
          accent
        />
        <StatTile
          label="Configured Roles"
          value={roles.length}
          note="Security tiers & permission sets"
          icon={KeyRound}
        />
      </div>

      {/* ── Users Table Section ── */}
      <Section
        title="Authorized Personnel Directory"
        subtitle="Staff member details, usernames, department roles, and account security states."
        action={
          <Button variant="ghost" size="sm" onClick={fetchUsers} className="h-8 gap-1.5 text-xs text-[#5a6b75]">
            <RefreshCw size={13} /> Refresh
          </Button>
        }
      >
        <Toolbar search={search} onSearch={(v) => { setSearch(v); setPage(1); }} placeholder="Search staff by name, email, or username…">
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
        </Toolbar>

        {loading ? (
          <div className="p-12"><LoadingState /></div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-xs text-[#71828a]">
            No staff accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#edf2f2] bg-[#fbfdfd] text-[10px] font-extrabold uppercase tracking-wider text-[#71828a]">
                  <th className="py-3 px-5">Staff Member</th>
                  <th className="py-3 px-5">Email Address</th>
                  <th className="py-3 px-5">Assigned Roles</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#fbfcfb] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0c1921] font-mono text-xs font-bold text-[#c59a58] shrink-0">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <div className="font-bold text-[#0c1921] text-xs">
                            {u.firstName} {u.lastName}
                          </div>
                          <div className="text-[10px] text-[#71828a] font-mono">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-[#5a6b75] font-medium">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map((r: any) => {
                          const rName = typeof r === 'string' ? r : r?.name;
                          return (
                            <span
                              key={rName}
                              className="rounded-md bg-[#173c4d]/5 px-2 py-0.5 text-[10px] font-bold text-[#0c1921]"
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
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5a6b75] hover:bg-slate-100 transition-colors"
                              title="Edit Roles & Access"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleStatusToggle(u)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5a6b75] hover:bg-slate-100 transition-colors"
                              title={u.status === 'ACTIVE' ? 'Suspend Access' : 'Reactivate Access'}
                            >
                              {u.status === 'ACTIVE' ? (
                                <ShieldOff size={13} className="text-amber-600" />
                              ) : (
                                <ShieldCheck size={13} className="text-emerald-600" />
                              )}
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
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
          <div className="p-4 border-t border-[#edf2f2] flex justify-end">
            <Pagination
              page={page}
              totalPages={Math.ceil(total / pageSize)}
              total={total}
              onPageChange={setPage}
            />
          </div>
        )}
      </Section>

      {modalOpen && (
        <UserModal
          open={modalOpen}
          editUser={editUser}
          roles={roles}
          onClose={() => setModalOpen(false)}
          onSaved={fetchUsers}
        />
      )}
    </ShellPage>
  );
};

export default UsersPage;
