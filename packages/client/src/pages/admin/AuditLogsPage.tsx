// ============================================
// NS LUXURY VILLA — Audit Logs Page
// /audit — Browse, filter, export audit trail
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck, Download, User, Clock, Filter,
  ChevronDown, Server, Eye,
} from 'lucide-react';
import {
  PageHeader, Button, DataTable, Pagination, SearchInput,
  showToast, ToastContainer, Badge, Modal, EmptyState,
} from '../components/ui';
import { auditApi } from '../services/apiService';

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

// ──────────────────────────────────────────
// Action color map
// ──────────────────────────────────────────
const actionVariant = (action: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' => {
  if (action.includes('created') || action.includes('login')) return 'success';
  if (action.includes('deleted') || action.includes('deactivated') || action.includes('failed')) return 'danger';
  if (action.includes('updated') || action.includes('changed')) return 'warning';
  if (action.includes('viewed') || action.includes('exported')) return 'info';
  return 'neutral';
};

// ──────────────────────────────────────────
// Detail Modal
// ──────────────────────────────────────────
const AuditDetailModal: React.FC<{ log: AuditLogEntry | null; onClose: () => void }> = ({ log, onClose }) => {
  if (!log) return null;

  const renderJson = (data: unknown) => (
    <pre className="bg-[#0F141C] border border-[#2D3748] rounded-lg p-3 text-[10px] text-[#9CA3AF] overflow-auto max-h-40 font-mono">
      {JSON.stringify(data, null, 2)}
    </pre>
  );

  return (
    <Modal open={!!log} onClose={onClose} title="Audit Log Details" size="lg">
      <div className="space-y-4">
        {/* Core Info */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Event ID', value: log.id },
            { label: 'Action', value: log.action },
            { label: 'Resource', value: log.resource },
            { label: 'Resource ID', value: log.resourceId ?? '—' },
            { label: 'IP Address', value: log.ipAddress ?? '—' },
            { label: 'Timestamp', value: new Date(log.createdAt).toLocaleString() },
          ].map((item) => (
            <div key={item.label} className="bg-[#151C28] border border-[#2D3748] rounded-lg p-3">
              <div className="text-[10px] text-[#6B7280] uppercase tracking-wide mb-1">{item.label}</div>
              <div className="text-xs text-[#F3F4F6] font-medium break-all">{item.value}</div>
            </div>
          ))}
        </div>

        {/* User */}
        {log.userName && (
          <div className="bg-[#151C28] border border-[#2D3748] rounded-lg p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C49A45] to-[#8C2D19] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {(log.userName ?? 'S')[0]}
            </div>
            <div>
              <div className="text-xs text-[#F3F4F6] font-medium">{log.userName}</div>
              {log.userEmail && <div className="text-[10px] text-[#6B7280]">{log.userEmail}</div>}
            </div>
          </div>
        )}

        {/* Before / After */}
        {log.beforeData && (
          <div>
            <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1.5">Before</div>
            {renderJson(log.beforeData)}
          </div>
        )}
        {log.afterData && (
          <div>
            <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1.5">After</div>
            {renderJson(log.afterData)}
          </div>
        )}

        {/* Device Info */}
        {log.deviceInfo && (
          <div className="bg-[#151C28] border border-[#2D3748] rounded-lg p-3">
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wide mb-1">Device Info</div>
            <div className="text-[10px] text-[#9CA3AF] break-all font-mono">{log.deviceInfo}</div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ──────────────────────────────────────────
// Audit Logs Page
// ──────────────────────────────────────────
const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailLog, setDetailLog] = useState<AuditLogEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list({
        page,
        pageSize,
        action: actionFilter || undefined,
        resource: resourceFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (res.success && res.data) {
        setLogs(res.data.data ?? res.data.items ?? []);
        setTotal(res.data.total ?? 0);
      }
    } catch {
      showToast('error', 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleExport = async () => {
    showToast('info', 'Audit log export is being prepared…');
    // Phase 9 will implement CSV export
  };

  const columns = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      width: '160px',
      render: (log: AuditLogEntry) => (
        <div className="flex items-center gap-1.5 text-[#9CA3AF]">
          <Clock size={11} className="shrink-0" />
          <div>
            <div>{new Date(log.createdAt).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div className="text-[10px] text-[#6B7280]">{new Date(log.createdAt).toLocaleTimeString()}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Performed By',
      render: (log: AuditLogEntry) =>
        log.userName ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#C49A45] to-[#8C2D19] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              {log.userName[0]}
            </div>
            <div>
              <div className="text-[#F3F4F6] font-medium text-xs">{log.userName}</div>
              {log.userEmail && <div className="text-[10px] text-[#6B7280]">{log.userEmail}</div>}
            </div>
          </div>
        ) : (
          <span className="text-[#6B7280] flex items-center gap-1"><Server size={11} />System</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (log: AuditLogEntry) => (
        <Badge label={log.action} variant={actionVariant(log.action)} />
      ),
    },
    {
      key: 'resource',
      header: 'Resource',
      render: (log: AuditLogEntry) => (
        <div>
          <span className="text-[#F3F4F6] capitalize">{log.resource}</span>
          {log.resourceId && <div className="text-[10px] text-[#6B7280] font-mono">{log.resourceId.slice(0, 16)}…</div>}
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP Address',
      render: (log: AuditLogEntry) => (
        <span className="text-[#9CA3AF] font-mono text-[10px]">{log.ipAddress ?? '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '50px',
      render: (log: AuditLogEntry) => (
        <button
          onClick={() => setDetailLog(log)}
          className="p-1.5 hover:bg-[#2D3748] rounded-lg text-[#6B7280] hover:text-[#F3F4F6] transition-colors"
          title="View Details"
        >
          <Eye size={13} />
        </button>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6">
      <PageHeader
        title="Audit Logs"
        subtitle="Complete, immutable record of all system events and user actions"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
              <Filter size={13} /> Filters <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download size={13} /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      {showFilters && (
        <div className="bg-[#1C2536] border border-[#2D3748] rounded-xl p-4 mb-4 grid grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1.5 block">Action Contains</label>
            <input
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              placeholder="e.g. user.created"
              className="w-full bg-[#121824] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#C49A45] transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1.5 block">Resource</label>
            <input
              value={resourceFilter}
              onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
              placeholder="e.g. user, reservation"
              className="w-full bg-[#121824] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#C49A45] transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1.5 block">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full bg-[#121824] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-[#F3F4F6] focus:outline-none focus:border-[#C49A45] transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1.5 block">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full bg-[#121824] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-[#F3F4F6] focus:outline-none focus:border-[#C49A45] transition-colors"
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total Events', value: total.toLocaleString(), icon: <ShieldCheck size={16} />, color: 'text-[#C49A45]' },
          { label: 'Auth Events', value: logs.filter(l => l.action.startsWith('auth')).length, icon: <User size={16} />, color: 'text-blue-400' },
          { label: 'Admin Actions', value: logs.filter(l => l.action.startsWith('user')).length, icon: <Server size={16} />, color: 'text-purple-400' },
          { label: 'Showing', value: `Page ${page}/${totalPages}`, icon: <Filter size={16} />, color: 'text-emerald-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#1C2536] border border-[#2D3748] rounded-xl p-3 flex items-center gap-3">
            <div className={`${stat.color}`}>{stat.icon}</div>
            <div>
              <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-[#6B7280]">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        keyFn={(l) => l.id}
        emptyMessage="No audit log entries found."
      />

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <AuditDetailModal log={detailLog} onClose={() => setDetailLog(null)} />
      <ToastContainer />
    </div>
  );
};

export default AuditLogsPage;
