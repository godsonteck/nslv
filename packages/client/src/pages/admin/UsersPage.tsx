// ============================================
// NS LUXURY VILLA — Users Management Page
// /admin/users — Multi-Role & Cross-Functional Access Control
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import { UserPlus, Edit2, ShieldOff, ShieldCheck, Trash2, Info, Monitor, CheckSquare, Square, Shield } from 'lucide-react';
import {
  PageHeader,
  Button,
  DataTable,
  Pagination,
  SearchInput,
  SelectInput,
  Badge,
  Modal,
  FormField,
  TextInput,
  showToast,
  statusBadge,
} from '../../components/ui';
import { usersApi, rolesApi, type UserRecord } from '../../services/apiService';
import { ApiClientError } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';

/** What each named role unlocks — shown as a preview when admin assigns roles */
const ROLE_ACCESS_MAP: Record<string, { description: string; interfaces: string[]; color: string; badgeBg: string }> = {
  'Admin': {
    description: 'Full system access — supervise all departments, users, settings, and audit logs.',
    interfaces: ['All System Interfaces', 'Users & Security', 'Roles & Permissions', 'Settings & Branding', 'Financial Reports', 'Audit Logs', 'All Department Workspaces'],
    color: 'text-red-400',
    badgeBg: 'bg-red-950/60 text-red-300 border-red-800/40',
  },
  'Manager': {
    description: 'Operational manager — oversees reservations, front desk, all POS outlets, and operational reporting.',
    interfaces: ['Dashboard Overview', 'Reservations & Rooms', 'Guest Directory', 'Front Desk', 'Restaurant POS', 'Bar POS', 'Pool Services', 'Payments & Ledgers', 'Expenses', 'Inventory', 'Reports', 'Events'],
    color: 'text-[#f1a83f]',
    badgeBg: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
  },
  'Reception': {
    description: 'Front office desk — handles check-in, check-out, reservations, guest folios, and pool entry counter.',
    interfaces: ['Front Desk Check-In/Out', 'Reservations', 'Guest Profiles', 'Room Status', 'Guest Bills & Folios', 'Payments Desk', 'Pool Entry & Receipts'],
    color: 'text-blue-400',
    badgeBg: 'bg-blue-950/60 text-blue-300 border-blue-800/40',
  },
  'F&B': {
    description: 'Food & Beverage staff — access both restaurant dining POS and bar/lounge POS from one workspace.',
    interfaces: ['F&B Workspace Hub', 'Restaurant Dining POS', 'Bar & Lounge POS', 'Inventory', 'Menu Categories'],
    color: 'text-amber-400',
    badgeBg: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
  },
  'Restaurant': {
    description: 'Restaurant-only staff — access restaurant kitchen/dining orders and Restaurant POS.',
    interfaces: ['Restaurant Workspace', 'Restaurant POS & Kitchen Orders', 'Inventory Items', 'Menu Categories'],
    color: 'text-orange-400',
    badgeBg: 'bg-orange-950/60 text-orange-300 border-orange-800/40',
  },
  'Bar': {
    description: 'Bar-only staff — access bar/lounge drinks, beverage orders, and Bar POS.',
    interfaces: ['Bar Workspace', 'Bar POS & Drink Orders', 'Inventory Items', 'Menu Categories'],
    color: 'text-purple-400',
    badgeBg: 'bg-purple-950/60 text-purple-300 border-purple-800/40',
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editUser) {
      const userRoleIds = (editUser.roles || []).map((r) => r.id);
      const primary = userRoleIds[0] || '';
      const additional = userRoleIds.slice(1);

      setForm({
        firstName: editUser.firstName,
        lastName: editUser.lastName,
        email: editUser.email,
        username: editUser.username,
        password: '',
        phone: editUser.phone ?? '',
        primaryRoleId: primary,
        additionalRoleIds: additional,
      });
    } else {
      const defaultRole = roles.find((r) => r.name === 'Reception')?.id || roles[0]?.id || '';
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        phone: '',
        primaryRoleId: defaultRole,
        additionalRoleIds: [],
      });
    }
    setErrors({});
  }, [editUser, open, roles]);

  const setField = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleAdditionalRole = (roleId: string) => {
    setForm((f) => {
      const exists = f.additionalRoleIds.includes(roleId);
      const updated = exists
        ? f.additionalRoleIds.filter((id) => id !== roleId)
        : [...f.additionalRoleIds, roleId];
      return { ...f, additionalRoleIds: updated };
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email.trim() || !form.email.includes('@')) errs.email = 'Valid email address required';
    if (!isEdit && !form.username.trim()) errs.username = 'Username is required';
    if (!isEdit) {
      if (!form.password) {
        errs.password = 'Password is required';
      } else if (form.password.length < 8) {
        errs.password = 'Min 8 characters required';
      } else if (!/[A-Z]/.test(form.password)) {
        errs.password = 'Must contain at least 1 uppercase letter (A-Z)';
      } else if (!/[a-z]/.test(form.password)) {
        errs.password = 'Must contain at least 1 lowercase letter (a-z)';
      } else if (!/[0-9]/.test(form.password)) {
        errs.password = 'Must contain at least 1 number (0-9)';
      } else if (!/[^A-Za-z0-9]/.test(form.password)) {
        errs.password = 'Must contain at least 1 special symbol (!@#$%...)';
      }
    }
    if (form.phone && form.phone.trim() && !/^\+?[0-9\s-]{7,20}$/.test(form.phone.trim())) {
      errs.phone = 'Valid phone number required (e.g. +233XXXXXXXXX)';
    }
    if (!form.primaryRoleId) errs.primaryRoleId = 'Please select a primary role';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);

    const allAssignedRoleIds = Array.from(
      new Set([form.primaryRoleId, ...form.additionalRoleIds].filter(Boolean))
    );

    try {
      if (isEdit) {
        await usersApi.update(editUser.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || null,
          roleIds: allAssignedRoleIds,
        });
        showToast('success', `User ${form.firstName} updated with ${allAssignedRoleIds.length} role(s).`);
      } else {
        await usersApi.create({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          username: form.username,
          password: form.password,
          phone: form.phone || null,
          roleIds: allAssignedRoleIds,
        });
        showToast('success', `User ${form.firstName} created with ${allAssignedRoleIds.length} role(s).`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiClientError && err.details) {
        const fieldErrs: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(err.details)) {
          if (Array.isArray(msgs) && msgs.length > 0) {
            fieldErrs[k] = msgs[0];
          }
        }
        if (Object.keys(fieldErrs).length > 0) {
          setErrors((prev) => ({ ...prev, ...fieldErrs }));
        }
      }
      showToast('error', err?.message ?? 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  // Compute all assigned roles and their aggregated interfaces
  const selectedRoleObjs = roles.filter(
    (r) => r.id === form.primaryRoleId || form.additionalRoleIds.includes(r.id)
  );

  const aggregatedInterfaces = Array.from(
    new Set(
      selectedRoleObjs.flatMap((r) => ROLE_ACCESS_MAP[r.name]?.interfaces || [`${r.name} capabilities`])
    )
  );

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit User & Role Access · ${editUser?.firstName}` : 'Create User & Assign Role Access'} size="lg">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="First Name" required error={errors.firstName}>
            <TextInput value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} error={!!errors.firstName} placeholder="John" />
          </FormField>
          <FormField label="Last Name" required error={errors.lastName}>
            <TextInput value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} error={!!errors.lastName} placeholder="Doe" />
          </FormField>
        </div>

        <FormField label="Email Address" required error={errors.email}>
          <TextInput type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} error={!!errors.email} placeholder="john@nsvilla.com" />
        </FormField>

        {!isEdit && (
          <div className="grid grid-cols-2 gap-x-4">
            <FormField label="Username" required error={errors.username}>
              <TextInput value={form.username} onChange={(e) => setField('username', e.target.value)} error={!!errors.username} placeholder="johndoe" />
            </FormField>
            <FormField label="Password" required error={errors.password}>
              <TextInput type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} error={!!errors.password} placeholder="Min 8 chars (e.g. Pass@1234)" />
            </FormField>
          </div>
        )}

        <FormField label="Phone (optional)" error={errors.phone}>
          <TextInput value={form.phone} onChange={(e) => setField('phone', e.target.value)} error={!!errors.phone} placeholder="+233 XX XXX XXXX" />
        </FormField>

        {/* 1. Primary Role Selection */}
        <div className="p-4 rounded-xl bg-[#14161D] border border-[#2B303E] space-y-3">
          <FormField label="Primary / Default Role" required error={errors.primaryRoleId}>
            <SelectInput
              value={form.primaryRoleId}
              onChange={(e) => {
                const newPrimary = e.target.value;
                setField('primaryRoleId', newPrimary);
                // remove from additional if selected as primary
                setField(
                  'additionalRoleIds',
                  form.additionalRoleIds.filter((id) => id !== newPrimary)
                );
              }}
              error={!!errors.primaryRoleId}
            >
              <option value="">Select primary role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name.replace(/_/g, ' ')}
                </option>
              ))}
            </SelectInput>
            {errors.primaryRoleId && <p className="text-xs text-[#EF4444] mt-1">{errors.primaryRoleId}</p>}
          </FormField>

          {/* 2. Additional Roles / Multi-Access Checkboxes */}
          <div>
            <div className="text-xs font-semibold text-[#A0A5AD] mb-1.5 flex items-center justify-between">
              <span>Grant Additional Roles &amp; Interface Access:</span>
              <span className="text-[10px] text-[#6E737B]">Allow user to do more across departments</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 pt-1">
              {roles
                .filter((r) => r.id !== form.primaryRoleId)
                .map((role) => {
                  const isChecked = form.additionalRoleIds.includes(role.id);
                  const accessMeta = ROLE_ACCESS_MAP[role.name];

                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleAdditionalRole(role.id)}
                      className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all text-xs ${
                        isChecked
                          ? 'bg-[#1C202B] border-[#C5A880] text-[#F4F4F2]'
                          : 'bg-[#181B24]/70 border-[#2B303E] text-[#A0A5AD] hover:border-[#3D4457]'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare size={16} className="text-[#C5A880] shrink-0 mt-0.5" />
                      ) : (
                        <Square size={16} className="text-[#6E737B] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold flex items-center gap-1.5">
                          <span className={isChecked ? 'text-[#F4F4F2]' : 'text-[#A0A5AD]'}>
                            + {role.name.replace(/_/g, ' ')} Access
                          </span>
                        </div>
                        {accessMeta && (
                          <div className="text-[10px] text-[#6E737B] line-clamp-1 mt-0.5">
                            {accessMeta.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* 3. Combined Capabilities & Unlocked Interfaces Summary */}
        {selectedRoleObjs.length > 0 && (
          <div className="p-3.5 rounded-xl bg-[#14161D] border border-[#2B303E] text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[#C5A880]">
                <Shield size={14} />
                <span>Effective Interfaces &amp; Capabilities Unlocked ({selectedRoleObjs.length} role{selectedRoleObjs.length !== 1 ? 's' : ''}):</span>
              </div>
              <div className="flex items-center gap-1">
                {selectedRoleObjs.map((r) => {
                  const meta = ROLE_ACCESS_MAP[r.name];
                  return (
                    <span
                      key={r.id}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        meta?.badgeBg || 'bg-[#232733] text-[#F4F4F2] border-[#2B303E]'
                      }`}
                    >
                      {r.name}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {aggregatedInterfaces.map((iface) => (
                <span
                  key={iface}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#1C202B] text-[#F4F4F2] border border-[#2B303E]"
                >
                  <Monitor size={10} className="text-[#C5A880]" />
                  {iface}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-[#2B303E]">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save} className="bg-[#C5A880] text-[#10131A] font-bold">
            {isEdit ? 'Save Changes' : 'Create User'}
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

  const pageSize = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ page, pageSize, search: search || undefined, status: statusFilter || undefined });
      if (res.success && res.data) {
        setUsers(res.data.data ?? res.data.items ?? []);
        setTotal(res.data.total);
      }
    } catch {
      showToast('error', 'Failed to load system users.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (u: UserRecord) => (
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[#252836] border border-[#2B303E] flex items-center justify-center text-xs font-semibold text-[#f1a83f] shrink-0">
            {u.firstName[0]}{u.lastName[0]}
          </div>
          <div>
            <div className="font-medium text-[#F4F4F2]">{u.firstName} {u.lastName}</div>
            <div className="text-[11px] text-[#6E737B]">@{u.username}</div>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (u: UserRecord) => <span className="text-[#A0A5AD]">{u.email}</span> },
    {
      key: 'roles',
      header: 'Assigned Roles & Access',
      render: (u: UserRecord) => (
        <div className="flex flex-wrap gap-1.5">
          {u.roles.map((r) => {
            const meta = ROLE_ACCESS_MAP[r.name];
            return (
              <span
                key={r.id}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  meta?.badgeBg || 'bg-[#232733] text-[#F4F4F2] border-[#2B303E]'
                }`}
              >
                {r.name.replace(/_/g, ' ')}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center' as const,
      render: (u: UserRecord) => statusBadge(u.status),
    },
    {
      key: '2fa',
      header: '2FA',
      align: 'center' as const,
      render: (u: UserRecord) => u.totpEnabled ? <Badge label="Enabled" variant="success" /> : <Badge label="Disabled" variant="neutral" />,
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      render: (u: UserRecord) => u.lastLoginAt ? <span className="text-[#A0A5AD]">{new Date(u.lastLoginAt).toLocaleDateString()}</span> : <span className="text-[#6E737B]">Never</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (u: UserRecord) => (
        <div className="flex items-center gap-1 justify-end">
          {canEdit && (
            <>
              <button onClick={() => { setEditUser(u); setModalOpen(true); }} className="p-1 hover:bg-[#232733] rounded text-[#A0A5AD] hover:text-[#F4F4F2]" title="Edit Roles & Access">
                <Edit2 size={14} />
              </button>
              <button onClick={() => handleStatusToggle(u)} className="p-1 hover:bg-[#232733] rounded text-[#A0A5AD] hover:text-[#F4F4F2]" title={u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}>
                {u.status === 'ACTIVE' ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
              </button>
              {canDelete && (
                <button onClick={() => handleDelete(u)} className="p-1 hover:bg-red-500/10 rounded text-[#A0A5AD] hover:text-red-400" title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User accounts & access"
        subtitle="Manage staff accounts, assign multiple roles, and grant cross-departmental interface permissions."
        actions={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => { setEditUser(null); setModalOpen(true); }} className="bg-[#C5A880] text-[#10131A] font-bold">
              <UserPlus size={14} /> Add User
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SearchInput
            placeholder="Search by name, email, username..."
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            className="w-72"
          />
          <SelectInput
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-36"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </SelectInput>
        </div>
        <div className="text-xs text-[#6E737B]">Total: {total} users</div>
      </div>

      <DataTable
        keyFn={(u) => u.id}
        columns={columns}
        data={users}
        loading={loading}
        emptyMessage="No users found."
      />

      {total > pageSize && (
        <div className="flex justify-end">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / pageSize)}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}

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
