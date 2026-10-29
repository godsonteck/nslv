// ============================================
// NS LUXURY VILLA — 403 Access Denied Page
// Calm & Actionable Access Restriction Screen
// ============================================

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="glass-strong w-full max-w-md rounded-3xl p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--ns-danger)] glass-subtle text-[var(--ns-danger)]">
          <ShieldAlert size={30} />
        </div>
        <h1 className="mt-5 text-xl font-bold" style={{ color: 'var(--ns-ink)' }}>
          Access Restricted
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6" style={{ color: 'var(--ns-muted)' }}>
          Your user account does not have sufficient role permissions to access this workstation
          module. Contact your administrator if you require permission.
        </p>
        <div className="pt-5">
          <Link to="/">
            <Button variant="secondary" size="sm">
              <ArrowLeft size={14} /> Return to Authorized Workstation
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
