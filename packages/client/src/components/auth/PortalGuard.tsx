import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export type PortalRole = 'Admin' | 'Manager' | 'Reception' | 'Restaurant' | 'Bar';

const portalPath = (portal: string): string => {
  if (portal === 'Restaurant') return '/restaurant';
  if (portal === 'Bar') return '/bar';
  return `/${portal.toLowerCase()}`;
};

export const portalPathFor = (roles: { name: string }[]): string => {
  const portal = roles[0]?.name;
  return portalPath(portal || 'Reception');
};

export const PortalGuard: React.FC<{ role: PortalRole; children: React.ReactNode }> = ({ role, children }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  // Administrators supervise every department. They must be able to open each
  // department's live workspace from the shared sidebar without being bounced
  // back to their portal just because they do not also have that department role.
  const canAccessPortal = user.roles.some((assigned) => assigned.name === role || assigned.name === 'Admin');
  if (!canAccessPortal) {
    return <Navigate to={portalPathFor(user.roles)} replace />;
  }
  return <>{children}</>;
};
