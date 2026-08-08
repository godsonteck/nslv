// ============================================
// NS LUXURY VILLA — Roles & Permissions Page
// /admin/roles — Permission Matrix Builder
// ============================================

import React, { useEffect, useState } from 'react';
import { Shield, Lock, Unlock, ChevronDown, ChevronRight } from 'lucide-react';
import { PageHeader, Button, Spinner, Badge, showToast, ToastContainer } from '../components/ui';
import { rolesApi, type RoleRecord, type PermissionRecord } from '../services/apiService';

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
type PermissionWithMeta = PermissionRecord;
type RoleWithPerms = RoleRecord;

// ──────────────────────────────────────────
// Role Color Map
// ──────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'border-[#8C2D19] bg-[#8C2D19]/10 text-[#EF4444]',
  GENERAL_MANAGER: 'border-[#C49A45] bg-[#C49A45]/10 text-[#C49A45]',
  FRONT_DESK: 'border-blue-500 bg-blue-500/10 text-blue-400',
  HOUSEKEEPING: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
  RESTAURANT_STAFF: 'border-purple-500 bg-purple-500/10 text-purple-400',
  ACCOUNTANT: 'border-orange-500 bg-orange-500/10 text-orange-400',
};

const ROLE_BADGE_COLORS: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'neutral'> = {
  SUPER_ADMIN: 'danger',
  GENERAL_MANAGER: 'warning',
  FRONT_DESK: 'info',
  HOUSEKEEPING: 'success',
  RESTAURANT_STAFF: 'neutral',
  ACCOUNTANT: 'neutral',
};

// ──────────────────────────────────────────
// Permission Matrix
// ──────────────────────────────────────────
interface MatrixProps {
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  modules: string[];
}

const PermissionMatrix: React.FC<MatrixProps> = ({ roles, permissions, modules }) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(modules.slice(0, 3)));

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
    <div className="bg-[#1C2536] border border-[#2D3748] rounded-xl overflow-hidden">
      {/* Role Header Row */}
      <div className="border-b border-[#2D3748] bg-[#151C28] sticky top-0 z-10">
        <div className="flex">
          <div className="w-64 shrink-0 px-4 py-3 text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Permission</div>
          {roles.map((role) => (
            <div key={role.id} className="flex-1 px-2 py-2 text-center min-w-[100px]">
              <span className={`inline-block text-[10px] font-bold px-2 py-1 rounded-full border ${ROLE_COLORS[role.name] ?? 'border-[#2D3748] text-[#9CA3AF]'}`}>
                {role.name.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Module Groups */}
      {modules.map((mod) => {
        const modPerms = getPermsByModule(mod);
        const isExpanded = expandedModules.has(mod);

        return (
          <div key={mod} className="border-b border-[#232D3F] last:border-0">
            {/* Module Header */}
            <button
              onClick={() => toggleModule(mod)}
              className="w-full flex items-center px-4 py-2.5 bg-[#181F2E] hover:bg-[#1C2536] transition-colors text-left"
            >
              {isExpanded ? <ChevronDown size={14} className="text-[#9CA3AF] mr-2" /> : <ChevronRight size={14} className="text-[#9CA3AF] mr-2" />}
              <span className="text-xs font-bold text-[#C49A45] uppercase tracking-wide">{mod}</span>
              <Badge label={`${modPerms.length}`} variant="neutral" />
            </button>

            {/* Permission Rows */}
            {isExpanded && modPerms.map((perm) => (
              <div key={perm.id} className="flex items-center border-t border-[#232D3F] hover:bg-[#1D2840]/30 transition-colors">
                <div className="w-64 shrink-0 px-4 py-2.5">
                  <div className="text-xs font-medium text-[#F3F4F6]">{perm.action}</div>
                  {perm.description && <div className="text-[10px] text-[#6B7280] mt-0.5">{perm.description}</div>}
                </div>
                {roles.map((role) => {
                  const has = hasPermission(role, perm.id);
                  return (
                    <div key={role.id} className="flex-1 flex items-center justify-center py-2.5 min-w-[100px]">
                      {has ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                          <Unlock size={10} className="text-emerald-400" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#151C28] border border-[#2D3748] flex items-center justify-center">
                          <Lock size={10} className="text-[#4B5563]" />
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

// ──────────────────────────────────────────
// Role Card
// ──────────────────────────────────────────
const RoleCard: React.FC<{ role: RoleRecord }> = ({ role }) => {
  const totalPerms = role.permissions?.length ?? 0;

  return (
    <div className={`p-4 rounded-xl border ${ROLE_COLORS[role.name] ?? 'border-[#2D3748] bg-[#1C2536]'} backdrop-blur-sm`}>
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 bg-black/20 rounded-lg">
          <Shield size={16} />
        </div>
        <Badge label={`${totalPerms} perms`} variant={ROLE_BADGE_COLORS[role.name] ?? 'neutral'} />
      </div>
      <h3 className="text-sm font-bold mt-2">{role.name.replace(/_/g, ' ')}</h3>
      {role.description && <p className="text-[10px] mt-1 opacity-70 line-clamp-2">{role.description}</p>}
    </div>
  );
};

// ──────────────────────────────────────────
// Roles & Permissions Page
// ──────────────────────────────────────────
const RolesPage: React.FC = () => {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'matrix'>('overview');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rolesRes, permsRes] = await Promise.all([rolesApi.list(), rolesApi.permissions()]);
        if (rolesRes.success && rolesRes.data) setRoles(rolesRes.data);
        if (permsRes.success && permsRes.data) {
          setPermissions(permsRes.data.permissions as PermissionWithMeta[]);
          setModules([...permsRes.data.modules] as string[]);
        }
      } catch {
        showToast('error', 'Failed to load roles data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="p-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="View system roles and the permission matrix for each role"
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#121824] p-1 rounded-xl w-fit">
        {(['overview', 'matrix'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab
              ? 'bg-[#1C2536] text-[#F3F4F6] shadow'
              : 'text-[#6B7280] hover:text-[#9CA3AF]'
              }`}
          >
            {tab === 'overview' ? 'Role Overview' : 'Permission Matrix'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
      ) : activeTab === 'overview' ? (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {roles.map((role) => <RoleCard key={role.id} role={role} />)}
          </div>
          <div className="bg-[#1C2536] border border-[#2D3748] rounded-xl p-4">
            <h3 className="text-sm font-bold text-[#F3F4F6] mb-3">Permission Summary by Module</h3>
            <div className="grid grid-cols-4 gap-3">
              {modules.map((mod) => {
                const count = permissions.filter((p) => p.module === mod).length;
                return (
                  <div key={mod} className="bg-[#151C28] border border-[#2D3748] rounded-lg p-3">
                    <div className="text-lg font-bold text-[#C49A45]">{count}</div>
                    <div className="text-[10px] text-[#9CA3AF] mt-0.5 uppercase tracking-wide">{mod}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <PermissionMatrix roles={roles} permissions={permissions} modules={modules} />
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default RolesPage;
