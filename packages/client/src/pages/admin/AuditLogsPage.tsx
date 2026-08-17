// ============================================
// NS LUXURY VILLA — Audit Logs Page
// Section #27: Immutable System Activity & Audit Trail
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Download, Clock, Filter, Eye } from 'lucide-react';
import {
  PageHeader,
  Button,
  DataTable,
  Pagination,
  SearchInput,
  showToast,
  Badge,
  Modal,
  TextInput,
} from '../../components/ui';
import { auditApi } from '../../services/apiService';

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

const actionVariant = (action: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' => {
  if (action.includes('created') || action.includes('login')) return 'success';
  if (action.includes('deleted') || action.includes('deactivated') || action.includes('failed')) return 'danger';
  if (action.includes('updated') || action.includes('changed')) return 'warning';
  if (action.includes('viewed') || action.includes('exported')) return 'info';
  return 'neutral';
};

const AuditDetailModal: React.FC<{ log: AuditLogEntry | null; onClose: () => void }> = ({ log, onClose }) => {
  if (!log) return null;

  const renderJson = (data: unknown) => (
    <pre className="bg-[#14161D] border border-[#2B303E] rounded p-3 text-[10px] text-[#A0A5AD] overflow-auto max-h-40 font-mono">
      {JSON.stringify(data, null, 2)}
    </pre>
  );

  return (
    <Modal open={!!log} onClose={onClose} title="Audit Event Trace Details" size="lg">
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Event ID', value: log.id },
            { label: 'Action', value: log.action },
            { label: 'Resource', value: log.resource },
            { label: 'Resource ID', value: log.resourceId ?? '—' },
            { label: 'IP Address', value: log.ipAddress ?? '—' },
            { label: 'Timestamp', value: new Date(log.createdAt).toLocaleString() },
          ].map((item) => (
            <div key={item.label} className="bg-[#14161D] border border-[#2B303E] rounded p-2.5">
              <div className="text-[10px] text-[#6E737B] uppercase tracking-wide mb-0.5">{item.label}</div>
              <div className="text-xs text-[#F4F4F2] font-medium break-all">{item.value}</div>
            </div>
          ))}
        </div>

        {log.userName && (
          <div className="bg-[#14161D] border border-[#2B303E] rounded p-3 flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#252836] border border-[#2B303E] flex items-center justify-center text-xs font-bold text-[#f1a83f]">
              {(log.userName ?? 'S')[0]}
            </div>
            <div>
              <div className="text-xs text-[#F4F4F2] font-medium">{log.userName}</div>
              {log.userEmail && <div className="text-[10px] text-[#6E737B]">{log.userEmail}</div>}
            </div>
          </div>
        )}

        {log.beforeData && (
          <div>
            <div className="text-[10px] text-[#A0A5AD] uppercase tracking-wide mb-1">State Before</div>
            {renderJson(log.beforeData)}
          </div>
        )}
        {log.afterData && (
          <div>
            <div className="text-[10px] text-[#A0A5AD] uppercase tracking-wide mb-1">State After</div>
            {renderJson(log.afterData)}
          </div>
        )}
      </div>
    </Modal>
  );
};

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [detailLog, setDetailLog] = useState<AuditLogEntry | null>(null);

  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list({
        page,
        pageSize,
        action: actionFilter || undefined,
        resource: resourceFilter || undefined,
      });
      if (res.success && res.data) {
        setLogs(res.data.data ?? res.data.items ?? []);
        setTotal(res.data.total ?? 0);
      }
    } catch {
      showToast('error', 'Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const columns = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      width: '160px',
      render: (log: AuditLogEntry) => (
        <div className="text-xs text-[#A0A5AD]">
          <div>{new Date(log.createdAt).toLocaleDateString()}</div>
          <div className="text-[10px] font-mono text-[#6E737B]">{new Date(log.createdAt).toLocaleTimeString()}</div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (log: AuditLogEntry) =>
        log.userName ? (
          <div>
            <div className="text-[#F4F4F2] font-medium">{log.userName}</div>
            <div className="text-[10px] text-[#6E737B]">{log.userEmail || 'Staff'}</div>
          </div>
        ) : (
          <span className="text-[#6E737B]">System</span>
        ),
    },
    {
      key: 'action',
      header: 'Event Action',
      render: (log: AuditLogEntry) => <Badge label={log.action} variant={actionVariant(log.action)} />,
    },
    {
      key: 'resource',
      header: 'Target Entity',
      render: (log: AuditLogEntry) => (
        <div>
          <span className="text-[#F4F4F2] uppercase text-[11px] font-mono">{log.resource}</span>
          {log.resourceId && <div className="text-[10px] text-[#6E737B] font-mono">{log.resourceId.slice(0, 14)}…</div>}
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP Address',
      render: (log: AuditLogEntry) => <span className="font-mono text-[11px] text-[#6E737B]">{log.ipAddress ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (log: AuditLogEntry) => (
        <button onClick={() => setDetailLog(log)} className="p-1 hover:bg-[#232733] rounded text-[#f1a83f]" title="Inspect Event">
          <Eye size={15} />
        </button>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs & System History"
        subtitle="Immutable, timestamped audit trail of all security, operational and user actions"
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#1C1F28] border border-[#2B303E] rounded-md">
        <div className="flex items-center gap-2">
          <SearchInput value={actionFilter} onChange={(v) => { setActionFilter(v); setPage(1); }} placeholder="Filter by action (e.g. user.created)..." className="w-64" />
          <TextInput value={resourceFilter} onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }} placeholder="Filter entity..." className="w-40" />
        </div>
        <span className="text-xs text-[#A0A5AD] font-mono">{total} total audit records</span>
      </div>

      <DataTable columns={columns} data={logs} loading={loading} keyFn={(l) => l.id} emptyTitle="No audit logs recorded" />

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <AuditDetailModal log={detailLog} onClose={() => setDetailLog(null)} />
    </div>
  );
};

export default AuditLogsPage;
