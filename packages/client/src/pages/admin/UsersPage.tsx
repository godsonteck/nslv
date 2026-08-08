// ============================================
// NS LUXURY VILLA — Users Management Page
// /admin/users
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import { UserPlus, Edit2, ShieldOff, ShieldCheck } from 'lucide-react';
import {
  PageHeader, Button, DataTable, Pagination, SearchInput,
  Badge, Modal, FormField, TextInput, ToastContainer, showToast,
  statusBadge,
} from '../components/ui';
import { usersApi, rolesApi, type UserRecord } from '../services/apiService';
import { useAuthStore } from '../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';

// ──────────────────────────────────────────
// Create / Edit User Modal
// ──────────────────────────────────────────
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
    firstName: '', lastName: '', email: '', username: '',
    password: '', phone: '', roleIds: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editUser) {
      setForm({
        firstName: editUser.firstName,
        lastName: editUser.lastName,
        email: editUser.email,
        username: editUser.username,
        password: '',
        phone: editUser.phone ?? '',
        roleIds: editUser.roles.map((r) => r.id),
      });
    } else {
      setForm({ firstName: '', lastName: '', email: '', username: '', password: '', phone: '', roleIds: [] });
    }
    setErrors({});
  }, [editUser, open]);

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const toggleRole = (id: string) =>
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(id) ? f.roleIds.filter((r) => r !== id) : [...f.roleIds, id],
    }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'Required';
    if (!form.lastName.trim()) errs.lastName = 'Required';
    if (!form.email.trim() || !form.email.includes('@')) errs.email = 'Valid email required';
    if (!isEdit && !form.username.trim()) errs.username = 'Required';
    if (!isEdit && form.password.length < 8) errs.password = 'Min 8 characters';
    if (form.roleIds.length === 0) errs.roleIds = 'Assign at least one role';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await usersApi.update(editUser.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || null,
          roleIds: form.roleIds,
        });
        showToast('success', 'User updated successfully.');
      } else {
        await usersApi.create({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          username: form.username,
          password: form.password,
          phone: form.phone || null,
          roleIds: form.roleIds,
        });
        showToast('success', 'User created successfully.');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', err?.message ?? 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit User' : 'Create New User'} size="lg">
      <div className="grid grid-cols-2 gap-x-4">
        <FormField label="First Name" required error={errors.firstName}>
          <TextInput value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} error={!!errors.firstName} placeholder="John" />
        </FormField>
        <FormField label="Last Name" required error={errors.lastName}>
          <TextInput value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} error={!!errors.lastName} placeholder="Doe" />
        </FormField>
      </div>
      <FormField label="Email Address" required error={errors.email}>
        <TextInput type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} error={!!errors.email} placeholder="john@example.com" />
      </FormField>
      {!isEdit && (
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Username" required error={errors.username}>
            <TextInput value={form.username} onChange={(e) => setField('username', e.target.value)} error={!!errors.username} placeholder="johndoe" />
          </FormField>
          <FormField label="Password" required error={errors.password}>
            <TextInput type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} error={!!errors.password} placeholder="Min 8 characters" />
          </FormField>
        </div>
      )}
      <FormField label="Phone (optional)">
        <TextInput value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+233 XX XXX XXXX" />
      </FormField>
      <FormField label="Assign Roles" required error={errors.roleIds}>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {roles.map((role) => (
            <label key={role.id}
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${form.roleIds.includes(role.id) ? 'border-[#C49A45] bg-[#C49A45]/10 text-[#C49A45]' : 'border-[#2D3748] hover:border-[#4B5563] text-[#9CA3AF]'}`}>
              <input type="checkbox" className="hidden" checked={form.roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} />
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${form.roleIds.includes(role.id) ? 'border-[#C49A45] bg-[#C49A45]' : 'border-[#4B5563]'}`}>
                {form.roleIds.includes(role.id) && <span className="text-[#0F141C] text-[9px] font-bold">✓</span>}
              </div>
              <span className="text-xs font-medium capitalize">{role.name.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
        {errors.roleIds && <p className="text-xs text-[#EF4444] mt-1">{errors.roleIds}</p>}
      </FormField>
      <div className="flex justify-end gap-3 mt-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={save}>{isEdit ? 'Save Changes' : 'Create User'}</Button>
      </div>
    </Modal>
  );
};

// ──────────────────────────────────────────
// Users Page
// ──────────────────────────────────────────
const UsersPage: React.FC = () => {
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission(PERMISSIONS.USERS_CREATE);
  const canEdit = hasPermission(PERMISSIONS.USERS_EDIT);

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
      showToast('error', 'Failed to load users.');
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
      showToast('error', 'Failed to update status.');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (u: UserRecord) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C49A45] to-[#8C2D19] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {u.firstName[0]}{u.lastName[0]}
          </div>
          <div>
            <div className="font-medium text-[#F3F4F6]">{u.firstName} {u.lastName}</div>
            <div className="text-[#6B7280]">@{u.username}</div>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (u: UserRecord) => <span className="text-[#9CA3AF]">{u.email}</span> },
    {
      key: 'roles',
      header: 'Roles',
      render: (u: UserRecord) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r.id} label={r.name.replace(/_/g, ' ')} variant="info" />
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u: UserRecord) => statusBadge(u.status),
    },
    {
      key: '2fa',
      header: '2FA',
      render: (u: UserRecord) => u.totpEnabled
        ? <Badge label="Enabled" variant="success" />
        : <Badge label="Disabled" variant="neutral" />,
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      render: (u: UserRecord) => u.lastLoginAt
        ? <span className="text-[#9CA3AF]">{new Date(u.lastLoginAt).toLocaleDateString()}</span>
        : <span className="text-[#6B7280]">Never</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (u: UserRecord) => (
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button onClick={() => { setEditUser(u); setModalOpen(true); }}
                className="p-1.5 hover:bg-[#2D3748] rounded-lg text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors" title="Edit">
                <Edit2 size={13} />
              </button>
              <button onClick={() => handleStatusToggle(u)}
                className="p-1.5 hover:bg-[#2D3748] rounded-lg text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
                title={u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}>
                {u.status === 'ACTIVE' ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6">
      <PageHeader
        title="User Management"
        subtitle="Manage staff accounts, roles, and access levels"
        actions={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => { setEditUser(null); setModalOpen(true); }}>
              <UserPlus size={14} /> Add User
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search users..." />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[#121824] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-[#F3F4F6] focus:outline-none focus:border-[#C49A45] transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        keyFn={(u) => u.id}
        emptyMessage="No users found."
      />

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <UserModal
        open={modalOpen}
        editUser={editUser}
        roles={roles}
        onClose={() => setModalOpen(false)}
        onSaved={fetchUsers}
      />

      <ToastContainer />
    </div>
  );
};

export default UsersPage;
