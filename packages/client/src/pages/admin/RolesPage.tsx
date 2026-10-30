// ============================================
// NS LUXURY VILLA — Roles & Permissions Matrix
// Section #26: Grouped Permissions & Access Controls
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import { Shield, Lock, Unlock, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import {
  Button, Spinner, Badge, showToast, Modal, FormField, TextInput,
} from '../../components/ui';
import { rolesApi, type RoleRecord, type PermissionRecord } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';

interface MatrixProps {
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  modules: string[];
}

const PermissionMatrix: React.FC<MatrixProps> = ({ roles, permissions, modules }) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules.slice(0, 4)));

  const toggleModule = (mod: string) =>
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(mod) ? next.delete(mod) : next.add(mod);
      return next;
    });

  const getPermsByModule = (mod: string) => permissions.filter((p) => p.module === mod);

  const hasPermission = (role: RoleRecord, permId: string) =>
    role.permissions?.some((rp) => rp.permission?.id === permId) ?? false;

  return (
    <div className="glass border border-[var(--ns-glass-line)] rounded-md overflow-hidden text-xs">
      {/* Role Header Row */}
      <div className="border-b border-[var(--ns-glass-line)] ns-glass-band sticky top-0 z-10">
        <div className="flex">
          <div className="w-64 shrink-0 px-4 py-3 font-semibold text-[var(--ns-muted)] uppercase tracking-wider">
            Module Permission
          </div>
          {roles.map((role) => (
            <div key={role.id} className="flex-1 px-2 py-3 text-center min-w-[110px]">
              <span className="font-semibold text-[var(--ns-ink)] block">{role.name.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Module Groups */}
      {modules.map((mod) => {
        const modPerms = getPermsByModule(mod);
        const isExpanded = expandedModules.has(mod);

        return (
          <div key={mod} className="border-b border-[var(--ns-glass-line)] last:border-0">
            {/* Module Header */}
            <button
              onClick={() => toggleModule(mod)}
              className="w-full flex items-center px-4 py-2 ns-glass-band ns-glass-hover transition-colors text-left font-semibold text-[var(--ns-gold)]"
            >
              {isExpanded ? <ChevronDown size={14} className="mr-2 text-[var(--ns-muted)]" /> : <ChevronRight size={14} className="mr-2 text-[var(--ns-muted)]" />}
              <span className="uppercase tracking-wider mr-2">{mod}</span>
              <span className="text-[10px] text-[var(--ns-muted)] font-mono">({modPerms.length} rules)</span>
            </button>

            {/* Permission Rows */}
            {isExpanded &&
              modPerms.map((perm) => (
                <div key={perm.id} className="flex items-center border-t border-[var(--ns-glass-line)] ns-glass-hover transition-colors">
                  <div className="w-64 shrink-0 px-4 py-2">
                    <div className="font-medium text-[var(--ns-ink)]">{perm.action}</div>
                    {perm.description && <div className="text-[10px] text-[var(--ns-muted)]">{perm.description}</div>}
                  </div>
                  {roles.map((role) => {
                    const has = hasPermission(role, perm.id);
                    return (
                      <div key={role.id} className="flex-1 flex items-center justify-center py-2 min-w-[110px]">
                        {has ? (
                          <div className="w-4 h-4 rounded glass-subtle border border-[var(--ns-success)]/30 flex items-center justify-center">
                            <Unlock size={10} className="text-[var(--ns-success)]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded glass-subtle border border-[var(--ns-glass-line)] flex items-center justify-center">
                            <Lock size={10} className="text-[var(--ns-muted)]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
};

export const RolesPage: React.FC = () => {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission(PERMISSIONS.ROLES_MANAGE);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRecord | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([rolesApi.list(), rolesApi.permissions()]);
      if (rolesRes.success && rolesRes.data) setRoles(rolesRes.data);
      if (permsRes.success && permsRes.data) {
        setPermissions(permsRes.data.permissions);
        setModules([...permsRes.data.modules]);
      }
    } catch {
      showToast('error', 'Failed to load roles data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openEdit = (role: RoleRecord) => {
    setEditing(role);
    setName(role.name);
    setDescription(role.description ?? '');
    setSelectedCodes(new Set(role.permissions?.map((rp) => rp.permission?.code).filter(Boolean) as string[] ?? []));
    setModalOpen(true);
  };

  const togglePermission = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCodes.size === 0) {
      showToast('error', 'At least one permission must be assigned.');
      return;
    }
    const body = { name, description, permissionCodes: [...selectedCodes] };
    try {
      if (!editing) return;
      await rolesApi.update(editing.id, body);
      showToast('success', `Role ${name} updated.`);
      setModalOpen(false);
      fetchRoles();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to save role.');
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Compact Header ── */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Shield size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>Roles & Access Control</h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Structured role definitions and permission matrix across all villa modules</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {roles.map((role) => (
          <div key={role.id} className="glass border border-[var(--ns-glass-line)] rounded-md p-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-[var(--ns-gold)]" />
                <span className="font-semibold text-[var(--ns-ink)]">{role.name.replace(/_/g, ' ')}</span>
                {role.isSystem && <Badge label="System" variant="info" />}
              </div>
              {role.description && <p className="text-[11px] text-[var(--ns-muted)] mt-1">{role.description}</p>}
              <div className="text-[10px] text-[var(--ns-muted)] font-mono mt-2">
                {role.permissions?.length ?? 0} permissions
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(role)} className="p-1.5 glass-subtle ns-glass-hover rounded text-[var(--ns-muted)] hover:text-[var(--ns-ink)]" title="Edit Role">
                  <Pencil size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-[var(--ns-muted)]"><Spinner /></div>
      ) : (
        <PermissionMatrix roles={roles} permissions={permissions} modules={modules} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Configure role — ${editing.name}` : 'Configure role'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Role Name" required>
              <TextInput value={name} disabled required minLength={2} maxLength={50} />
            </FormField>
            <FormField label="Description">
              <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" maxLength={255} />
            </FormField>
          </div>

          <div>
            <div className="text-xs font-medium text-[var(--ns-ink)] mb-2">
              Permissions <span className="text-[var(--ns-muted)] font-normal">({selectedCodes.size} selected)</span>
            </div>
            <div className="max-h-72 overflow-y-auto glass-subtle border border-[var(--ns-glass-line)] rounded p-3 space-y-3">
              {modules.map((mod) => {
                const modPerms = permissions.filter((p) => p.module === mod);
                if (modPerms.length === 0) return null;
                return (
                  <div key={mod}>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--ns-gold)] font-semibold mb-1">{mod}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {modPerms.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 p-1.5 rounded ns-glass-hover cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-[var(--ns-gold)]"
                            checked={selectedCodes.has(p.code)}
                            onChange={() => togglePermission(p.code)}
                          />
                          <span className="text-[11px] text-[var(--ns-muted)]">{p.code}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--ns-glass-line)] flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RolesPage;
