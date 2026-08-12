// ============================================
// NS LUXURY VILLA — 404 Not Found Page
// Calm & Actionable Error Screen
// ============================================

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import { Compass, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 space-y-4">
      <div className="p-4 bg-[#1C1F28] border border-[#2B303E] rounded-md text-[#C5A880]">
        <Compass size={32} />
      </div>
      <h1 className="text-xl font-bold text-[#F4F4F2] font-['Outfit']">Page Not Found</h1>
      <p className="text-xs text-[#A0A5AD] max-w-sm">
        The workspace route or resource you are looking for could not be found or has moved.
      </p>
      <div className="pt-2">
        <Link to="/">
          <Button variant="secondary" size="sm">
            <ArrowLeft size={14} /> Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
