import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useConnectionStore } from '../../stores/connectionStore';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
export const ConnectionBadge = () => {
    const { mode, pendingSyncCount } = useConnectionStore();
    const getStatusDisplay = () => {
        switch (mode) {
            case 'ONLINE':
                return {
                    icon: _jsx(Wifi, { size: 14, className: "text-emerald-400" }),
                    label: 'Online — Synced',
                    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                };
            case 'OFFLINE':
                return {
                    icon: _jsx(WifiOff, { size: 14, className: "text-amber-400" }),
                    label: pendingSyncCount > 0 ? `Offline — ${pendingSyncCount} queued` : 'Offline Mode',
                    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                };
            case 'SYNCING':
                return {
                    icon: _jsx(RefreshCw, { size: 14, className: "animate-spin text-blue-400" }),
                    label: `Syncing ${pendingSyncCount} items...`,
                    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                };
            case 'SYNC_ERROR':
                return {
                    icon: _jsx(AlertTriangle, { size: 14, className: "text-red-400" }),
                    label: 'Sync Failed — Retry',
                    badgeClass: 'bg-red-500/10 text-red-400 border-red-500/20 cursor-pointer',
                };
        }
    };
    const status = getStatusDisplay();
    return (_jsxs("div", { className: `inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full border transition-all ${status.badgeClass}`, title: "NS Villa Network & Sync Status", children: [status.icon, _jsx("span", { children: status.label })] }));
};
