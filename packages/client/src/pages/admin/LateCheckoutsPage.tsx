// ============================================
// NS LUXURY VILLA — Late Check-Outs Audit Page
// Administration Portal: Late Departure & Fee Audit
// ============================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Clock,
  Download,
  RefreshCw,
  Search,
  AlertTriangle,
  DollarSign,
  SlidersHorizontal,
  Eye,
  Trash2,
} from 'lucide-react';
import { staysApi } from '../../services/apiService';
import { Button, LoadingState, showToast, Modal, FormField, TextInput } from '../../components/ui';

interface LateCheckoutRecord {
  id: string;
  reservationId: string;
  confirmationNo: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  roomNumber: string;
  roomTypeName: string;
  checkInDate: string;
  scheduledCheckOutDate: string;
  actualCheckIn: string | null;
  actualCheckOut: string;
  deadline: string;
  hoursLate: number;
  feeAmount: number;
  refundedAmount: number;
  feeDescription: string;
  waived?: boolean;
  waivedAmount?: number;
  waivedReason?: string | null;
  paymentMethod: string;
  checkedOutByName: string;
  checkedInByName: string;
  roomCondition: string;
  notes: string | null;
}

interface AuditData {
  policy: { hourlyRate: number; checkoutTime: string };
  summary: {
    totalLateCheckouts: number;
    totalFeesBilled: number;
    totalRefunded: number;
    totalFeesCollected: number;
    totalFeesWaived?: number;
    avgDelayHours: number;
  };
  records: LateCheckoutRecord[];
}

export const LateCheckoutsPage: React.FC = () => {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<LateCheckoutRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<LateCheckoutRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Compute start/end dates based on date filter preset
  const dateParams = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (dateFilter === 'today') {
      return { startDate: `${todayStr}T00:00:00.000Z`, endDate: `${todayStr}T23:59:59.999Z` };
    }
    if (dateFilter === 'week') {
      const d = new Date(now);
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setUTCDate(diff));
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      return {
        startDate: `${monday.toISOString().slice(0, 10)}T00:00:00.000Z`,
        endDate: `${sunday.toISOString().slice(0, 10)}T23:59:59.999Z`,
      };
    }
    if (dateFilter === 'month') {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const first = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      const last = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
      return { startDate: `${first}T00:00:00.000Z`, endDate: `${last}T23:59:59.999Z` };
    }
    if (dateFilter === 'custom' && customStart && customEnd) {
      return {
        startDate: `${customStart}T00:00:00.000Z`,
        endDate: `${customEnd}T23:59:59.999Z`,
      };
    }
    return {};
  }, [dateFilter, customStart, customEnd]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await staysApi.getLateCheckouts({
        ...dateParams,
        search: search.trim() || undefined,
      });
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load late check-outs');
    } finally {
      setLoading(false);
    }
  }, [dateParams, search]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Execute Deletion / Waiving
  const confirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingRecord) return;
    try {
      setDeletingBusy(true);
      const res = await staysApi.deleteLateCheckout(deletingRecord.id, deleteReason || 'Waived by Administrator');
      if (res.success) {
        showToast('success', res.data?.message || 'Late check-out details and fees successfully removed');
        if (selectedRecord?.id === deletingRecord.id) {
          setSelectedRecord(null);
        }
        setDeletingRecord(null);
        setDeleteReason('');
        void loadData();
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete late checkout details');
    } finally {
      setDeletingBusy(false);
    }
  };

  // Export Audit to CSV
  const exportCsv = () => {
    if (!data || !data.records.length) {
      showToast('warning', 'No late checkout records to export');
      return;
    }

    const headers = [
      'Confirmation No',
      'Guest Name',
      'Phone',
      'Email',
      'Room Number',
      'Room Type',
      'Check-In Date',
      'Scheduled Check-Out',
      'Actual Departure',
      'Hours Late',
      'Late Fee Billed (GHS)',
      'Late Fee Refunded (GHS)',
      'Late Fee Net Collected (GHS)',
      'Fee Waived (GHS)',
      'Waiver Reason',
      'Fee Description',
      'Settlement Method',
      'Checked Out By (Staff)',
      'Checked In By (Staff)',
      'Room Condition',
      'Notes',
    ];

    const rows = data.records.map((r) => [
      r.confirmationNo,
      r.guestName,
      r.guestPhone,
      r.guestEmail,
      r.roomNumber,
      r.roomTypeName,
      new Date(r.checkInDate).toLocaleDateString(),
      new Date(r.scheduledCheckOutDate).toLocaleDateString(),
      new Date(r.actualCheckOut).toLocaleString(),
      String(r.hoursLate),
      r.feeAmount.toFixed(2),
      r.refundedAmount.toFixed(2),
      Math.max(0, r.feeAmount - r.refundedAmount).toFixed(2),
      (r.waivedAmount || 0).toFixed(2),
      r.waivedReason || '',
      r.feeDescription,
      r.paymentMethod,
      r.checkedOutByName,
      r.checkedInByName,
      r.roomCondition,
      r.notes || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NSLV_Late_Checkouts_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Late checkouts audit exported successfully');
  };

  const formatCurrency = (val: number) =>
    Number(val || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' });

  const summary = data?.summary || { totalLateCheckouts: 0, totalFeesBilled: 0, totalRefunded: 0, totalFeesCollected: 0, totalFeesWaived: 0, avgDelayHours: 0 };
  const policy = data?.policy || { hourlyRate: 50, checkoutTime: '12:00' };
  const records = data?.records || [];

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-300">
      {/* Compact Header */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Clock size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>Late Check-Outs Audit</h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Complete ledger of delayed departures, automated hourly fees, delay durations, and staff attributions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!records.length}>
            <Download size={14} /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Total Late Departures</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{summary.totalLateCheckouts} Stays</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Late Fees Recovered</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{formatCurrency(summary.totalFeesCollected)}</div>
          <div className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--ns-muted)' }}>{formatCurrency(summary.totalFeesBilled)} billed · {formatCurrency(summary.totalRefunded)} refunded{(summary.totalFeesWaived || 0) > 0 ? ` · ${formatCurrency(summary.totalFeesWaived || 0)} waived` : ''}</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Avg Delay Duration</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{summary.avgDelayHours} Hours</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Active Late Policy</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>GHS {policy.hourlyRate}/hr</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-[var(--ns-glass-line)] p-4 sm:flex-row sm:items-center sm:justify-between ns-glass-band">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[var(--ns-teal)]" />
            <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Late Departures Ledger</h2>
          </div>
          <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Filter by date range or search guest name, room, staff, or confirmation code.</p>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-[var(--ns-glass-line)] flex flex-wrap items-center justify-between gap-3 ns-glass-band">
          {/* Preset Date Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 glass-subtle p-1 rounded-lg border border-[var(--ns-glass-line)]">
            {[
              { key: 'all', label: 'All Time' },
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'custom', label: 'Custom Range' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDateFilter(tab.key as any)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  dateFilter === tab.key
                    ? 'glass-subtle ns-glass-selected text-[var(--ns-gold)] shadow-sm'
                    : 'glass-subtle ns-glass-hover text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 px-2.5 text-xs glass-input border border-[var(--ns-glass-line)] rounded text-[var(--ns-ink)] font-mono"
              />
              <span className="text-xs text-[var(--ns-muted)]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 px-2.5 text-xs glass-input border border-[var(--ns-glass-line)] rounded text-[var(--ns-ink)] font-mono"
              />
            </div>
          )}

          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ns-muted)]" />
            <input
              type="text"
              placeholder="Search guest, room, staff, code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs glass-input border border-[var(--ns-glass-line)] rounded text-[var(--ns-ink)] placeholder:text-[var(--ns-muted)] focus:border-[var(--ns-gold)] focus:outline-none"
            />
          </div>
        </div>

        {/* Ledger Table */}
        {loading ? (
          <LoadingState message="Loading late check-out audit records..." />
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ns-muted)]">
            <Clock size={32} className="mx-auto mb-2 opacity-30 text-[var(--ns-gold)]" />
            No late check-outs found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-[var(--ns-muted)]">
              <thead className="text-[10px] uppercase font-bold text-[var(--ns-muted)] ns-glass-band border-b border-[var(--ns-glass-line)]">
                <tr>
                  <th className="p-3">Guest & Booking</th>
                  <th className="p-3">Room</th>
                  <th className="p-3">Scheduled Deadline</th>
                  <th className="p-3">Actual Departure</th>
                  <th className="p-3 text-center">Delay</th>
                  <th className="p-3 text-right">Late Fee Billed</th>
                  <th className="p-3">Settlement</th>
                  <th className="p-3">Handled By</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-glass-line)]">
                {records.map((r) => (
                  <tr key={r.id} className="ns-glass-hover transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-[var(--ns-ink)]">{r.guestName}</div>
                      <div className="text-[10px] font-mono text-[var(--ns-gold)]">{r.confirmationNo}</div>
                      {r.guestPhone && r.guestPhone !== '—' && (
                        <div className="text-[10px] text-[var(--ns-muted)]">{r.guestPhone}</div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-[var(--ns-ink)]">Room {r.roomNumber}</div>
                      <div className="text-[10px] text-[var(--ns-muted)]">{r.roomTypeName}</div>
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      <div>{new Date(r.scheduledCheckOutDate).toLocaleDateString()}</div>
                      <div className="text-[10px] text-[var(--ns-muted)]">{policy.checkoutTime} PM</div>
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      <div className="text-[var(--ns-ink)]">{new Date(r.actualCheckOut).toLocaleDateString()}</div>
                      <div className="text-[10px] text-[var(--ns-warning)]">
                        {new Date(r.actualCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold glass-subtle text-[var(--ns-warning)] border border-[var(--ns-warning)]/50">
                        <Clock size={10} /> +{r.hoursLate}h late
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <div className="font-extrabold text-[var(--ns-warning)] font-mono text-xs">
                        {r.waived ? (
                          <>
                            <span className="line-through opacity-50">{formatCurrency(r.waivedAmount || 0)}</span>{' '}
                            <span className="text-[var(--ns-muted)]">GHS 0.00</span>
                          </>
                        ) : r.refundedAmount > 0 ? (
                          <>
                            <span className="line-through opacity-50">{formatCurrency(r.feeAmount)}</span>{' '}
                            <span className="text-[var(--ns-muted)]">{formatCurrency(Math.max(0, r.feeAmount - r.refundedAmount))}</span>
                          </>
                        ) : (
                          formatCurrency(r.feeAmount)
                        )}
                      </div>
                      <div className="text-[9px] text-[var(--ns-muted)]">
                        {r.hoursLate}h @ GHS {policy.hourlyRate}/h
                      </div>
                      {r.waived && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 rounded text-[9px] font-bold glass-subtle text-[var(--ns-muted)] border border-[var(--ns-glass-line)]"
                          title={r.waivedReason || 'Fee waived at checkout'}
                        >
                          Waived at checkout
                        </span>
                      )}
                      {r.refundedAmount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 rounded text-[9px] font-bold glass-subtle text-[var(--ns-success)] border border-[var(--ns-success)]/50">
                          {formatCurrency(r.refundedAmount)} Refunded
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold glass-subtle text-[var(--ns-muted)]">
                        {r.paymentMethod}
                      </span>
                      <div className="text-[10px] text-[var(--ns-muted)] mt-0.5">Condition: {r.roomCondition}</div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1 font-semibold text-[var(--ns-ink)]">
                        👤 {r.checkedOutByName}
                      </div>
                      <div className="text-[10px] text-[var(--ns-muted)]">
                        Check-in: {r.checkedInByName}
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRecord(r)}
                          className="!text-[var(--ns-gold)] ns-glass-hover hover:text-[var(--ns-gold)]"
                          title="View Full Stay & Fee Audit"
                        >
                          <Eye size={14} /> Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!r.waived}
                          onClick={() => {
                            setDeletingRecord(r);
                            setDeleteReason('');
                          }}
                          className="glass-subtle ns-glass-hover !text-[var(--ns-danger)] hover:text-[var(--ns-danger)]"
                          title={r.waived ? 'Fee was already waived at checkout' : 'Delete / Waive Late Check-out'}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stay & Fee Inspection Modal */}
      {selectedRecord && (
        <Modal
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={`Late Departure Details · ${selectedRecord.confirmationNo}`}
          size="lg"
        >
          <div className="p-5 space-y-4 text-xs">
            {/* Alert Header */}
            <div className="p-4 rounded-xl glass-subtle border border-[var(--ns-warning)]/60 flex items-start gap-3">
              <AlertTriangle className="text-[var(--ns-warning)] shrink-0 mt-0.5" size={18} />
              <div>
                <div className="font-bold text-[var(--ns-warning)]">
                  Late Departure Delay of {selectedRecord.hoursLate} Hour{selectedRecord.hoursLate > 1 ? 's' : ''}
                </div>
                <div className="text-[11px] text-[var(--ns-warning)] mt-0.5">
                  Guest departed on {new Date(selectedRecord.actualCheckOut).toLocaleString()} (Scheduled cutoff: {new Date(selectedRecord.scheduledCheckOutDate).toLocaleDateString()} at {policy.checkoutTime} PM).{' '}
                  {selectedRecord.waived ? (
                    <>
                      Late departure fee of <strong>{formatCurrency(selectedRecord.waivedAmount || 0)}</strong> was <strong>waived at checkout</strong>
                      {selectedRecord.waivedReason ? ` — ${selectedRecord.waivedReason}` : ''}.
                    </>
                  ) : (
                    <>Total automated late departure fee charged: <strong>{formatCurrency(selectedRecord.feeAmount)}</strong>.</>
                  )}
                </div>
              </div>
            </div>

            {/* Stay & Room Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3.5 glass-subtle rounded-xl border border-[var(--ns-glass-line)] space-y-2">
                <div className="text-[10px] uppercase font-bold text-[var(--ns-muted)]">Guest & Reservation</div>
                <div className="text-sm font-extrabold text-[var(--ns-ink)]">{selectedRecord.guestName}</div>
                <div className="text-xs text-[var(--ns-muted)]">Confirmation: <span className="font-mono text-[var(--ns-gold)]">{selectedRecord.confirmationNo}</span></div>
                <div className="text-xs text-[var(--ns-muted)]">Phone: {selectedRecord.guestPhone}</div>
                <div className="text-xs text-[var(--ns-muted)]">Email: {selectedRecord.guestEmail}</div>
              </div>

              <div className="p-3.5 glass-subtle rounded-xl border border-[var(--ns-glass-line)] space-y-2">
                <div className="text-[10px] uppercase font-bold text-[var(--ns-muted)]">Room & Stay Window</div>
                <div className="text-sm font-extrabold text-[var(--ns-ink)]">Room {selectedRecord.roomNumber} · {selectedRecord.roomTypeName}</div>
                <div className="text-xs text-[var(--ns-muted)]">Check-in Date: {new Date(selectedRecord.checkInDate).toLocaleDateString()}</div>
                <div className="text-xs text-[var(--ns-muted)]">Scheduled Check-out: {new Date(selectedRecord.scheduledCheckOutDate).toLocaleDateString()}</div>
                <div className="text-xs text-[var(--ns-muted)]">Room Condition at Exit: <span className="font-bold text-[var(--ns-ink)]">{selectedRecord.roomCondition}</span></div>
              </div>
            </div>

            {/* Financial Settlement & Staff Audit */}
            <div className="p-3.5 glass-subtle rounded-xl border border-[var(--ns-glass-line)] space-y-3">
              <div className="text-[10px] uppercase font-bold text-[var(--ns-muted)]">Settlement & Staff Accountability</div>
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--ns-glass-line)]">
                  <span className="text-[var(--ns-muted)]">Late Fee Charge</span>
                  <span className={`font-extrabold ${selectedRecord.waived ? 'text-[var(--ns-muted)]' : 'text-[var(--ns-warning)]'}`}>
                    {selectedRecord.waived ? `Waived (${formatCurrency(selectedRecord.waivedAmount || 0)})` : formatCurrency(selectedRecord.feeAmount)}
                  </span>
                </div>
                {selectedRecord.refundedAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-[var(--ns-glass-line)]">
                    <span className="text-[var(--ns-muted)]">Late Fee Refunded</span>
                    <span className="font-bold text-[var(--ns-success)]">−{formatCurrency(selectedRecord.refundedAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-[var(--ns-glass-line)]">
                  <span className="text-[var(--ns-muted)]">Settlement Method</span>
                  <span className="font-bold text-[var(--ns-ink)]">{selectedRecord.paymentMethod}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--ns-glass-line)]">
                  <span className="text-[var(--ns-muted)]">Checked Out By</span>
                  <span className="font-bold text-[var(--ns-ink)]">👤 {selectedRecord.checkedOutByName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--ns-glass-line)]">
                  <span className="text-[var(--ns-muted)]">Checked In By</span>
                  <span className="font-bold text-[var(--ns-ink)]">👤 {selectedRecord.checkedInByName}</span>
                </div>
              </div>

              {selectedRecord.notes && (
                <div className="pt-2 border-t border-[var(--ns-glass-line)] text-xs">
                  <span className="font-bold text-[var(--ns-muted)]">Departure Notes: </span>
                  <span className="text-[var(--ns-ink)]">{selectedRecord.notes}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeletingRecord(selectedRecord);
                  setDeleteReason('');
                }}
                className="glass-subtle ns-glass-hover !text-[var(--ns-danger)] !border-[var(--ns-danger)]"
              >
                <Trash2 size={14} /> Delete / Waive Late Fee
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                Close Audit View
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete / Waive Confirmation Modal */}
      {deletingRecord && (
        <Modal
          open={!!deletingRecord}
          onClose={() => !deletingBusy && setDeletingRecord(null)}
          title={`Delete Late Departure · ${deletingRecord.confirmationNo}`}
        >
          <form onSubmit={confirmDelete} className="space-y-4 text-xs">
            <div className="p-4 rounded-xl glass-subtle border border-[var(--ns-danger)]/50 flex items-start gap-3">
              <AlertTriangle className="text-[var(--ns-danger)] shrink-0 mt-0.5" size={18} />
              <div className="space-y-1">
                <div className="font-bold text-[var(--ns-danger)]">
                  Remove Late Check-Out Status & Fee
                </div>
                <div className="text-[11px] text-[var(--ns-danger)] leading-relaxed">
                  This action will void the <strong>{formatCurrency(deletingRecord.feeAmount)}</strong> late check-out charge on the folio, reset the departure timestamp to on-time cutoff, and record this deletion in the immutable audit log.
                </div>
              </div>
            </div>

            <div className="p-3 glass-subtle rounded-xl border border-[var(--ns-glass-line)] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--ns-muted)]">Guest:</span>
                <span className="font-bold text-[var(--ns-ink)]">{deletingRecord.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ns-muted)]">Room:</span>
                <span className="font-bold text-[var(--ns-ink)]">Room {deletingRecord.roomNumber} ({deletingRecord.roomTypeName})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ns-muted)]">Fee to be Voided:</span>
                <span className="font-bold text-[var(--ns-warning)]">{formatCurrency(deletingRecord.feeAmount)} ({deletingRecord.hoursLate}h late)</span>
              </div>
            </div>

            <FormField label="Reason for Waiving / Deleting (Audit Note)" required>
              <TextInput
                required
                placeholder="e.g., Management waiver, compensation, system correction…"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={deletingBusy}
                onClick={() => setDeletingRecord(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={deletingBusy}
                className="glass ns-glass-hover !border-[var(--ns-danger)] !text-[var(--ns-danger)]"
              >
                Confirm & Remove Late Fee
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default LateCheckoutsPage;
