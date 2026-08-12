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
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 space-y-4">
      <div className="p-4 bg-[#1C1F28] border border-[#2B303E] rounded-md text-[#EF4444]">
        <ShieldAlert size={32} />
      </div>
      <h1 className="text-xl font-bold text-[#F4F4F2] font-['Outfit']">Access Restricted</h1>
      <p className="text-xs text-[#A0A5AD] max-w-sm">
        Your user account does not have sufficient role permissions to access this workstation module. Contact your administrator if you require permission.
      </p>
      <div className="pt-2">
        <Link to="/">
          <Button variant="secondary" size="sm">
            <ArrowLeft size={14} /> Return to Authorized Workstation
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
