// ============================================
// NS LUXURY VILLA — Users Management Page
// /admin/users
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import { UserPlus, Edit2, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
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
    roleId: '',
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
        roleId: editUser.roles[0]?.id ?? '',
      });
    } else {
      setForm({ firstName: '', lastName: '', email: '', username: '', password: '', phone: '', roleId: '' });
    }
    setErrors({});
  }, [editUser, open]);

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

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
    if (!form.roleId) errs.roleId = 'Select a role';
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
          roleId: form.roleId,
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
          roleId: form.roleId,
        });
        showToast('success', 'User created successfully.');
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

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit System User' : 'Create New System User'} size="lg">
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
      <FormField label="Assign Role" required error={errors.roleId}>
        <SelectInput
          value={form.roleId}
          onChange={(e) => setField('roleId', e.target.value)}
          error={!!errors.roleId}
        >
          <option value="">Select role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name.replace(/_/g, ' ')}
            </option>
          ))}
        </SelectInput>
        {errors.roleId && <p className="text-xs text-[#EF4444] mt-1">{errors.roleId}</p>}
      </FormField>
      <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-[#2B303E]">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={save}>{isEdit ? 'Save Changes' : 'Create User'}</Button>
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
      header: 'Assigned Roles',
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
              <button onClick={() => { setEditUser(u); setModalOpen(true); }} className="p-1 hover:bg-[#232733] rounded text-[#A0A5AD] hover:text-[#F4F4F2]" title="Edit">
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Accounts & Access"
        subtitle="Manage system staff accounts, role assignments, and security status"
        actions={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => { setEditUser(null); setModalOpen(true); }}>
              <UserPlus size={14} /> Add System User
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-3 p-3 bg-[#1C1F28] border border-[#2B303E] rounded-md">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search users by name or email..." className="w-72" />
        <SelectInput value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-40">
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </SelectInput>
      </div>

      <DataTable columns={columns} data={users} loading={loading} keyFn={(u) => u.id} emptyTitle="No user accounts found" />

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <UserModal open={modalOpen} editUser={editUser} roles={roles} onClose={() => setModalOpen(false)} onSaved={fetchUsers} />
    </div>
  );
};

export default UsersPage;
