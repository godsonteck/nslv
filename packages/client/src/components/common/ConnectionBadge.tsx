// ============================================
// NS LUXURY VILLA — Connection Status Indicator
// Restrained Operational Network Status
// ============================================

import React from 'react';
import { useConnectionStore } from '../../stores/connectionStore';

export const ConnectionBadge: React.FC = () => {
  const { mode, pendingSyncCount } = useConnectionStore();

  const getStatusDisplay = () => {
    switch (mode) {
      case 'ONLINE':
        return {
          dotClass: 'bg-[var(--ns-success)]',
          label: 'Online',
          textClass: 'text-[var(--ns-success)]',
          borderClass: 'border-[var(--ns-success)]',
        };
      case 'OFFLINE':
        return {
          dotClass: 'bg-[var(--ns-warning)]',
          label: pendingSyncCount > 0 ? `Offline (${pendingSyncCount} queued)` : 'Offline',
          textClass: 'text-[var(--ns-warning)]',
          borderClass: 'border-[var(--ns-warning)]',
        };
      case 'SYNCING':
        return {
          dotClass: 'bg-[var(--ns-info)] animate-pulse',
          label: `Syncing ${pendingSyncCount}...`,
          textClass: 'text-[var(--ns-info)]',
          borderClass: 'border-[var(--ns-info)]',
        };
      case 'SYNC_ERROR':
        return {
          dotClass: 'bg-[var(--ns-danger)]',
          label: 'Sync Error',
          textClass: 'text-[var(--ns-danger)]',
          borderClass: 'border-[var(--ns-danger)]',
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <div
      className={`glass flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs select-none ${status.borderClass}`}
      title="NS Villa System Connection Status"
    >
      <span className={`w-2 h-2 rounded-full ${status.dotClass}`} />
      <span className={`font-medium ${status.textClass}`}>{status.label}</span>
    </div>
  );
};
