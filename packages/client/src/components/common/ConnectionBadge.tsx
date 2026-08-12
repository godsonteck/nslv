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
          dotClass: 'bg-emerald-400',
          label: 'Online',
          textClass: 'text-[#A0A5AD]',
        };
      case 'OFFLINE':
        return {
          dotClass: 'bg-amber-400',
          label: pendingSyncCount > 0 ? `Offline (${pendingSyncCount} queued)` : 'Offline',
          textClass: 'text-amber-300',
        };
      case 'SYNCING':
        return {
          dotClass: 'bg-blue-400 animate-pulse',
          label: `Syncing ${pendingSyncCount}...`,
          textClass: 'text-blue-300',
        };
      case 'SYNC_ERROR':
        return {
          dotClass: 'bg-red-400',
          label: 'Sync Error',
          textClass: 'text-red-300',
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <div
      className="flex items-center gap-2 text-xs select-none"
      title="NS Villa System Connection Status"
    >
      <span className={`w-2 h-2 rounded-full ${status.dotClass}`} />
      <span className={`font-medium ${status.textClass}`}>{status.label}</span>
    </div>
  );
};
