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
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="glass-strong w-full max-w-md rounded-3xl p-10">
        <div
          className="glass-warm mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ color: '#b88738' }}
        >
          <Compass size={30} />
        </div>
        <h1 className="mt-5 text-xl font-bold" style={{ color: 'var(--ns-ink)' }}>
          Page Not Found
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6" style={{ color: 'var(--ns-muted)' }}>
          The workspace route or resource you are looking for could not be found or has moved.
        </p>
        <div className="pt-5">
          <Link to="/">
            <Button variant="secondary" size="sm">
              <ArrowLeft size={14} /> Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
