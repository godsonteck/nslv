import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { PermissionCode } from '@nslv/shared';

/**
 * Route guard that hides a page from users who lack the required permission.
 * `any` = the user needs at least one of these; `all` = needs every one.
 */
export const RequirePermission: React.FC<{
  any?: PermissionCode[];
  all?: PermissionCode[];
  children: React.ReactNode;
}> = ({ any, all, children }) => {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  const isAdmin = user.roles?.some((role) => role.name.toLowerCase() === 'admin') ?? false;
  const perms = user.permissions ?? [];
  const okAny = isAdmin || !any || any.some((p) => perms.includes(p));
  const okAll = isAdmin || !all || all.every((p) => perms.includes(p));
  if (!okAny || !okAll) {
    const portal = user.roles?.[0]?.name ?? 'Reception';
    return <Navigate to={`/${portal.toLowerCase()}`} replace />;
  }
  return <>{children}</>;
};

export default RequirePermission;
