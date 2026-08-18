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
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';

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

  const summary = data?.summary || { totalLateCheckouts: 0, totalFeesBilled: 0, totalRefunded: 0, totalFeesCollected: 0, avgDelayHours: 0 };
  const policy = data?.policy || { hourlyRate: 50, checkoutTime: '12:00' };
  const records = data?.records || [];

  return (
    <ShellPage
      eyebrow="ADMINISTRATION · AUDIT & REVENUE RECOVERY"
      title="Late Check-Outs Audit"
      subtitle="Complete ledger of delayed departures, automated hourly fees, delay durations, and staff attributions."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!records.length}>
            <Download size={14} /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      }
    >
      {/* 4 Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total Late Departures"
          value={`${summary.totalLateCheckouts} Stays`}
          icon={AlertTriangle}
          accent
        />
        <StatTile
          label="Late Fees Recovered"
          value={formatCurrency(summary.totalFeesCollected)}
          note={`${formatCurrency(summary.totalFeesBilled)} billed · ${formatCurrency(summary.totalRefunded)} refunded`}
          icon={DollarSign}
          accent
        />
        <StatTile
          label="Avg Delay Duration"
          value={`${summary.avgDelayHours} Hours`}
          icon={Clock}
        />
        <StatTile
          label="Active Late Policy"
          value={`GHS ${policy.hourlyRate}/hr`}
          icon={SlidersHorizontal}
        />
      </div>

      {/* Filter Toolbar */}
      <Section title="Late Departures Ledger" subtitle="Filter by date range or search guest name, room, staff, or confirmation code.">
        <div className="p-4 border-b border-[#2B303E]/50 flex flex-wrap items-center justify-between gap-3 bg-[#14161D]/50">
          {/* Preset Date Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#10131A] p-1 rounded-lg border border-[#2B303E]">
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
                    ? 'bg-[#f1a83f] text-[#10131A] shadow-sm'
                    : 'text-[#A0A5AD] hover:text-[#F4F4F2] hover:bg-[#232733]'
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
                className="h-8 px-2.5 text-xs bg-[#14161D] border border-[#2B303E] rounded text-[#F4F4F2] font-mono"
              />
              <span className="text-xs text-[#6E737B]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 px-2.5 text-xs bg-[#14161D] border border-[#2B303E] rounded text-[#F4F4F2] font-mono"
              />
            </div>
          )}

          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E737B]" />
            <input
              type="text"
              placeholder="Search guest, room, staff, code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-[#14161D] border border-[#2B303E] rounded text-[#F4F4F2] placeholder-[#6E737B] focus:border-[#f1a83f] focus:outline-none"
            />
          </div>
        </div>

        {/* Ledger Table */}
        {loading ? (
          <LoadingState message="Loading late check-out audit records..." />
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#6E737B]">
            <Clock size={32} className="mx-auto mb-2 opacity-30 text-[#f1a83f]" />
            No late check-outs found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-[#A0A5AD]">
              <thead className="text-[10px] uppercase font-bold text-[#6E737B] bg-[#14161D] border-b border-[#2B303E]">
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
              <tbody className="divide-y divide-[#2B303E]/50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-[#14161D]/60 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-[#F4F4F2]">{r.guestName}</div>
                      <div className="text-[10px] font-mono text-[#f1a83f]">{r.confirmationNo}</div>
                      {r.guestPhone && r.guestPhone !== '—' && (
                        <div className="text-[10px] text-[#6E737B]">{r.guestPhone}</div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-[#F4F4F2]">Room {r.roomNumber}</div>
                      <div className="text-[10px] text-[#6E737B]">{r.roomTypeName}</div>
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      <div>{new Date(r.scheduledCheckOutDate).toLocaleDateString()}</div>
                      <div className="text-[10px] text-[#6E737B]">{policy.checkoutTime} PM</div>
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      <div className="text-[#F4F4F2]">{new Date(r.actualCheckOut).toLocaleDateString()}</div>
                      <div className="text-[10px] text-amber-300">
                        {new Date(r.actualCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/40 text-amber-300 border border-amber-800/50">
                        <Clock size={10} /> +{r.hoursLate}h late
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <div className="font-extrabold text-amber-300 font-mono text-xs">
                        {r.refundedAmount > 0 ? (
                          <>
                            <span className="line-through opacity-50">{formatCurrency(r.feeAmount)}</span>{' '}
                            <span className="text-[#6E737B]">{formatCurrency(Math.max(0, r.feeAmount - r.refundedAmount))}</span>
                          </>
                        ) : (
                          formatCurrency(r.feeAmount)
                        )}
                      </div>
                      <div className="text-[9px] text-[#6E737B]">
                        {r.hoursLate}h @ GHS {policy.hourlyRate}/h
                      </div>
                      {r.refundedAmount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 rounded text-[9px] font-bold bg-emerald-900/40 text-emerald-300 border border-emerald-800/50">
                          {formatCurrency(r.refundedAmount)} Refunded
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#232733] text-[#A0A5AD]">
                        {r.paymentMethod}
                      </span>
                      <div className="text-[10px] text-[#6E737B] mt-0.5">Condition: {r.roomCondition}</div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1 font-semibold text-[#F4F4F2]">
                        👤 {r.checkedOutByName}
                      </div>
                      <div className="text-[10px] text-[#6E737B]">
                        Check-in: {r.checkedInByName}
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRecord(r)}
                          className="text-[#f1a83f] hover:text-[#8a6420]"
                          title="View Full Stay & Fee Audit"
                        >
                          <Eye size={14} /> Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingRecord(r);
                            setDeleteReason('');
                          }}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete / Waive Late Check-out"
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
      </Section>

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
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-3">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
              <div>
                <div className="font-bold text-amber-300">
                  Late Departure Delay of {selectedRecord.hoursLate} Hour{selectedRecord.hoursLate > 1 ? 's' : ''}
                </div>
                <div className="text-[11px] text-amber-200/80 mt-0.5">
                  Guest departed on {new Date(selectedRecord.actualCheckOut).toLocaleString()} (Scheduled cutoff: {new Date(selectedRecord.scheduledCheckOutDate).toLocaleDateString()} at {policy.checkoutTime} PM). Total automated late departure fee charged: <strong>{formatCurrency(selectedRecord.feeAmount)}</strong>.
                </div>
              </div>
            </div>

            {/* Stay & Room Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3.5 bg-[#14161D] rounded-xl border border-[#2B303E] space-y-2">
                <div className="text-[10px] uppercase font-bold text-[#A0A5AD]">Guest & Reservation</div>
                <div className="text-sm font-extrabold text-[#F4F4F2]">{selectedRecord.guestName}</div>
                <div className="text-xs text-[#6E737B]">Confirmation: <span className="font-mono text-[#f1a83f]">{selectedRecord.confirmationNo}</span></div>
                <div className="text-xs text-[#6E737B]">Phone: {selectedRecord.guestPhone}</div>
                <div className="text-xs text-[#6E737B]">Email: {selectedRecord.guestEmail}</div>
              </div>

              <div className="p-3.5 bg-[#14161D] rounded-xl border border-[#2B303E] space-y-2">
                <div className="text-[10px] uppercase font-bold text-[#A0A5AD]">Room & Stay Window</div>
                <div className="text-sm font-extrabold text-[#F4F4F2]">Room {selectedRecord.roomNumber} · {selectedRecord.roomTypeName}</div>
                <div className="text-xs text-[#6E737B]">Check-in Date: {new Date(selectedRecord.checkInDate).toLocaleDateString()}</div>
                <div className="text-xs text-[#6E737B]">Scheduled Check-out: {new Date(selectedRecord.scheduledCheckOutDate).toLocaleDateString()}</div>
                <div className="text-xs text-[#6E737B]">Room Condition at Exit: <span className="font-bold text-[#F4F4F2]">{selectedRecord.roomCondition}</span></div>
              </div>
            </div>

            {/* Financial Settlement & Staff Audit */}
            <div className="p-3.5 bg-[#14161D] rounded-xl border border-[#2B303E] space-y-3">
              <div className="text-[10px] uppercase font-bold text-[#A0A5AD]">Settlement & Staff Accountability</div>
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#2B303E]/50">
                  <span className="text-[#6E737B]">Late Fee Charge</span>
                  <span className="font-extrabold text-amber-300">{formatCurrency(selectedRecord.feeAmount)}</span>
                </div>
                {selectedRecord.refundedAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-[#2B303E]/50">
                    <span className="text-[#6E737B]">Late Fee Refunded</span>
                    <span className="font-bold text-emerald-400">−{formatCurrency(selectedRecord.refundedAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-[#2B303E]/50">
                  <span className="text-[#6E737B]">Settlement Method</span>
                  <span className="font-bold text-[#F4F4F2]">{selectedRecord.paymentMethod}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2B303E]/50">
                  <span className="text-[#6E737B]">Checked Out By</span>
                  <span className="font-bold text-[#F4F4F2]">👤 {selectedRecord.checkedOutByName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2B303E]/50">
                  <span className="text-[#6E737B]">Checked In By</span>
                  <span className="font-bold text-[#F4F4F2]">👤 {selectedRecord.checkedInByName}</span>
                </div>
              </div>

              {selectedRecord.notes && (
                <div className="pt-2 border-t border-[#2B303E]/50 text-xs">
                  <span className="font-bold text-[#A0A5AD]">Departure Notes: </span>
                  <span className="text-[#F4F4F2]">{selectedRecord.notes}</span>
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
                className="text-red-400 border-red-900/50 hover:bg-red-950/40"
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
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 flex items-start gap-3">
              <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
              <div className="space-y-1">
                <div className="font-bold text-red-300">
                  Remove Late Check-Out Status & Fee
                </div>
                <div className="text-[11px] text-red-200/80 leading-relaxed">
                  This action will void the <strong>{formatCurrency(deletingRecord.feeAmount)}</strong> late check-out charge on the folio, reset the departure timestamp to on-time cutoff, and record this deletion in the immutable audit log.
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#14161D] rounded-xl border border-[#2B303E] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6E737B]">Guest:</span>
                <span className="font-bold text-[#F4F4F2]">{deletingRecord.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E737B]">Room:</span>
                <span className="font-bold text-[#F4F4F2]">Room {deletingRecord.roomNumber} ({deletingRecord.roomTypeName})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E737B]">Fee to be Voided:</span>
                <span className="font-bold text-amber-300">{formatCurrency(deletingRecord.feeAmount)} ({deletingRecord.hoursLate}h late)</span>
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
                className="bg-red-600 hover:bg-red-500 text-white"
              >
                Confirm & Remove Late Fee
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </ShellPage>
  );
};

export default LateCheckoutsPage;
