// ============================================
// NS LUXURY VILLA — Payments & Settlements Ledger
// Record payments against in-house guests with live bill calculation,
// cash tendered & change tracking, part-payment identification,
// and instant official luxury receipt generation.
// ============================================

import React, { useEffect, useState } from 'react';
import { paymentsApi, staysApi } from '../../services/apiService';
import {
  CreditCard,
  Plus,
  RefreshCw,
  WalletCards,
  ReceiptText,
  Undo2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Printer,
  Banknote,
  Smartphone,
  Landmark,
  Search,
  Filter,
  Sparkles,
  BedDouble,
  UserRound,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { TenderSplit, makeTenderRow, parseTenders, tendersCoverTotal, type TenderRow } from '../../components/ui/TenderSplit';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
import { formatCurrency, formatGuestName } from '@nslv/shared';
import { printPaymentReceipt } from '../../lib/company';

interface PaymentRecord {
  id: string;
  reference?: string | null;
  description?: string | null;
  amount: number;
  method: string;
  status: string;
  type: string;
  processedAt?: string;
  createdAt?: string;
  guest?: { firstName: string; lastName?: string | null } | null;
  originalPaymentId?: string | null;
  processorName?: string;
  fullySettled?: boolean;
  /** Server-computed: what the guest owes (single-res total or combined group total) */
  amountDue?: number;
  /** Server-computed remaining balance across the reservation or group booking */
  remainingBalance?: number;
  /** Non-null when this payment is attached to a group booking */
  groupBookingId?: string | null;
  /** Combined total of all rooms in the group */
  groupTotal?: number | null;
  /** Room numbers in the group, e.g. ['1','3','5'] */
  groupRooms?: string[] | null;
  reservation?: {
    id?: string;
    bookingId?: string;
    confirmationNo?: string;
    room?: { number: string | number; name?: string };
  } | null;
  reservationId?: string;
  roomNumber?: string | number;
}

interface BillStay {
  id: string;
  reservationId?: string;
  guest: { firstName: string; lastName?: string | null } | null;
  room: { number: string | number; name?: string; roomType?: { name?: string } } | null;
  reservation: {
    id: string;
    folios: Array<{
      id: string;
      status: string;
      balance: number | string;
      items: Array<{
        id: string;
        description: string;
        amount: number | string;
        type: string;
      }>;
    }>;
  };
}

type DirectPaymentMethod = 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER';
type FilterType = 'ALL' | 'FULL' | 'PART' | 'REFUND' | 'PENDING';
type FilterMethod = 'ALL' | DirectPaymentMethod;

interface PaymentForm {
  stayId: string;
  amount: string;
  method: DirectPaymentMethod;
  tendered?: string;
  reference: string;
  description: string;
}

const money = (val: unknown) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

const MethodIcon: React.FC<{ method: string; className?: string }> = ({ method, className = 'w-3.5 h-3.5' }) => {
  const m = String(method).toUpperCase();
  if (m === 'CASH') return <Banknote className={className} />;
  if (m === 'MOBILE_MONEY') return <Smartphone className={className} />;
  if (m === 'BANK_TRANSFER') return <Landmark className={className} />;
  return <CreditCard className={className} />;
};

const methodLabel = (m: string) => {
  const val = String(m).toUpperCase();
  if (val === 'MOBILE_MONEY') return 'Mobile Money';
  if (val === 'BANK_TRANSFER') return 'Bank Transfer';
  if (val === 'CARD') return 'Card (POS)';
  if (val === 'CASH') return 'Cash';
  return m;
};

export const PaymentsPage: React.FC = () => {
  const [data, setData] = useState<PaymentRecord[]>([]);
  const [stays, setStays] = useState<BillStay[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  
  // Refund States
  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [refundMethod, setRefundMethod] = useState<DirectPaymentMethod>('CASH');

  // Filters & Search
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
  const [methodFilter, setMethodFilter] = useState<FilterMethod>('ALL');

  // Form State
  const [form, setForm] = useState<PaymentForm>({ stayId: '', amount: '', method: 'CASH', tendered: '', reference: '', description: '' });
  const [splitOpen, setSplitOpen] = useState(false);
  const [tenders, setTenders] = useState<TenderRow[]>([makeTenderRow()]);

  const isPrivileged = useAuthStore((s) => s.hasRole('admin') || s.hasRole('manager') || s.hasPermission('payments.refund'));
  const canRequestOrRefund = useAuthStore((s) => s.hasRole('admin') || s.hasRole('manager') || s.hasPermission('payments.refund') || s.hasPermission('payments.create'));
  const isAdmin = useAuthStore((s) => s.hasRole('admin'));

  const load = async () => {
    try {
      setLoading(true);
      const [a, b] = await Promise.all([paymentsApi.list(), staysApi.getActiveStays()]);
      setData(a.data || []);
      setStays(b.data || []);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedStay = stays.find((s) => s.id === form.stayId) || null;
  const folio = selectedStay?.reservation.folios.find((f) => f.status === 'OPEN') ?? selectedStay?.reservation.folios[0] ?? null;
  const balance = folio ? money(folio.balance) : 0;

  const handleStayChange = (stayId: string) => {
    const stay = stays.find((s) => s.id === stayId) || null;
    const f = stay?.reservation.folios.find((x) => x.status === 'OPEN') ?? stay?.reservation.folios[0] ?? null;
    const bal = f ? money(f.balance) : 0;
    setForm({
      ...form,
      stayId,
      amount: bal > 0 ? bal.toFixed(2) : '',
      tendered: '',
    });
  };

  const openModal = () => {
    setForm({ stayId: '', amount: '', method: 'CASH', tendered: '', reference: '', description: '' });
    setSplitOpen(false);
    setTenders([makeTenderRow()]);
    setIdempotencyKey(crypto.randomUUID());
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!selectedStay || !folio) {
      showToast('error', 'Select an in-house guest with an open bill.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('error', 'A positive payment amount is required.');
      return;
    }
    const currentBalance = money(folio.balance);
    if (amount > currentBalance + 0.01) {
      showToast('error', `Payment cannot exceed the outstanding bill balance of ${formatCurrency(currentBalance)}.`);
      return;
    }
    const cashTendered = form.method === 'CASH' && form.tendered ? Number(form.tendered) : amount;
    if (form.method === 'CASH' && cashTendered < amount) {
      showToast('error', 'Cash tendered cannot be less than the payment amount.');
      return;
    }
    const changeDue = form.method === 'CASH' && cashTendered > amount ? cashTendered - amount : 0;
    const settlesInFull = amount >= currentBalance - 0.005;
    const remainingAfter = Math.max(0, currentBalance - amount);
    const splitTenders = splitOpen ? parseTenders(tenders) : undefined;
    if (splitOpen && !tendersCoverTotal(tenders, amount)) {
      showToast('error', 'Tender amounts must equal the payment amount.');
      return;
    }

    try {
      setBusy(true);
      const desc = form.description?.trim()
        ? form.description.trim()
        : settlesInFull
        ? `Payment received in full.${changeDue > 0 ? ` Cash tendered: GHS ${cashTendered.toFixed(2)}, Change given: GHS ${changeDue.toFixed(2)}.` : ''} Balance remaining: GHS 0.00`
        : `Partial payment recorded. Remaining balance: GHS ${remainingAfter.toFixed(2)}.${changeDue > 0 ? ` Cash tendered: GHS ${cashTendered.toFixed(2)}, Change given: GHS ${changeDue.toFixed(2)}.` : ''}`;

      const res = await paymentsApi.processPayment({
        folioId: folio.id,
        amount,
        method: splitTenders?.[0]?.method ?? form.method,
        ...(splitTenders ? { tenders: splitTenders } : {}),
        idempotencyKey: idempotencyKey || crypto.randomUUID(),
        reference: form.reference?.trim() || undefined,
        description: desc,
      });

      const createdPayment = res?.data || res;
      printPaymentReceipt(createdPayment || { amount, method: form.method, reference: form.reference, createdAt: new Date().toISOString() }, {
        guestName: formatGuestName(selectedStay.guest, 'Guest'),
        bookingRef: selectedStay.reservation.id.slice(0, 8).toUpperCase(),
        roomNumber: String(selectedStay.room?.number ?? ''),
        amountDue: currentBalance,
        tenderedAmount: form.method === 'CASH' && cashTendered > amount ? cashTendered : undefined,
        changeGiven: changeDue > 0 ? changeDue : undefined,
        remainingBalance: remainingAfter,
        fullySettled: settlesInFull,
      });

      showToast('success', settlesInFull ? 'Payment recorded — bill paid in full.' : 'Partial payment recorded.');
      setOpen(false);
      void load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to record payment');
    } finally {
      setBusy(false);
    }
  };

  // Metrics
  const totalNet = data.reduce((s, p) => s + (p.type === 'REFUND' && p.status === 'COMPLETED' ? -money(p.amount) : p.status === 'COMPLETED' ? money(p.amount) : 0), 0);
  const completedPayments = data.filter((p) => ['PAYMENT', 'DEPOSIT'].includes(p.type) && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(p.status));
  const fullPayments = completedPayments.filter((p) => p.type === 'PAYMENT' || p.fullySettled);
  const partPayments = completedPayments.filter((p) => p.type === 'DEPOSIT' && !p.fullySettled);
  const completedRefunds = data.filter((payment) => payment.type === 'REFUND' && payment.status === 'COMPLETED');
  const pendingRefunds = data.filter((payment) => payment.type === 'REFUND' && payment.status === 'PENDING');
  const refundedTotal = completedRefunds.reduce((sum, payment) => sum + money(payment.amount), 0);

  const openRefund = (payment: PaymentRecord) => {
    const existingRefunds = data.filter((p: any) => p.originalPaymentId === payment.id && p.type === 'REFUND' && p.status === 'COMPLETED');
    const priorSum = existingRefunds.reduce((sum: number, r: any) => sum + money(r.amount), 0);
    const maxRefundable = Math.max(0, money(payment.amount) - priorSum);

    setRefundTarget(payment);
    setRefundAmount(maxRefundable.toFixed(2));
    setRefundMethod((payment.method as DirectPaymentMethod) || 'CASH');
    setRefundReason('');
    setRefundReference('');
  };

  const handleDeletePayment = async (payment: PaymentRecord) => {
    const isRefund = payment.type === 'REFUND';
    const label = `${isRefund ? 'refund' : payment.type === 'DEPOSIT' ? 'deposit' : 'payment'} of ${formatCurrency(money(payment.amount))}`;
    const note = isRefund
      ? 'Deleting a refund also deletes the payment it reversed — both must be unposted and unlinked for this to work.'
      : 'Only records not yet posted to a folio and without linked refunds can be deleted.';
    if (!window.confirm(`Permanently delete this ${label} (${payment.method || '—'})? This cannot be undone. ${note}`)) return;
    try {
      setBusyId(payment.id);
      await paymentsApi.remove(payment.id);
      showToast('success', 'Payment record deleted.');
      void load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to delete payment record');
    } finally {
      setBusyId(null);
    }
  };

  const submitRefund = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!refundTarget) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) return showToast('error', 'Enter a positive refund amount.');
    const reason = refundReason.trim();
    if (!reason || reason.length < 3) return showToast('error', 'A refund reason of at least 3 characters is required.');
    try {
      setBusy(true);
      const res = await paymentsApi.refund(refundTarget.id, {
        amount,
        method: refundMethod || (refundTarget.method as DirectPaymentMethod),
        reference: refundReference.trim() || undefined,
        reason,
        idempotencyKey: crypto.randomUUID(),
        allowClosedFolioReopen: true,
      });
      if (res?.data?.status === 'PENDING') {
        showToast('success', 'Refund request submitted for Manager/Admin approval.');
      } else {
        showToast('success', 'Refund approved and recorded on the ledger.');
      }
      setRefundTarget(null);
      void load();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Unable to process refund request');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveRefund = async (refundId: string) => {
    try {
      setBusyId(refundId);
      await paymentsApi.approveRefund(refundId);
      showToast('success', 'Refund approved and executed successfully.');
      void load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to approve refund');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectRefund = async (refundId: string) => {
    const reason = window.prompt('Reason for rejecting this refund request:', 'Declined by management');
    if (reason === null) return;
    try {
      setBusyId(refundId);
      await paymentsApi.rejectRefund(refundId, reason.trim() || 'Declined by management');
      showToast('success', 'Refund request rejected.');
      void load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to reject refund');
    } finally {
      setBusyId(null);
    }
  };

  // Filtered List
  const visible = data.filter((p) => {
    // 1. Text Search
    if (q) {
      const query = q.toLowerCase();
      const guestStr = p.guest ? `${p.guest.firstName} ${p.guest.lastName ?? ''}`.toLowerCase() : '';
      const refStr = (p.reference || p.id).toLowerCase();
      const descStr = (p.description || '').toLowerCase();
      const roomStr = p.reservation?.room?.number ? `room ${p.reservation.room.number}`.toLowerCase() : '';
      const staffStr = (p.processorName || '').toLowerCase();
      if (!guestStr.includes(query) && !refStr.includes(query) && !descStr.includes(query) && !roomStr.includes(query) && !staffStr.includes(query)) {
        return false;
      }
    }

    // 2. Type Filter
    if (typeFilter === 'FULL') {
      if (p.type === 'REFUND') return false;
      if (!(p.type === 'PAYMENT' || p.fullySettled)) return false;
    } else if (typeFilter === 'PART') {
      if (p.type !== 'DEPOSIT' || p.fullySettled) return false;
    } else if (typeFilter === 'REFUND') {
      if (p.type !== 'REFUND') return false;
    } else if (typeFilter === 'PENDING') {
      if (p.status !== 'PENDING') return false;
    }

    // 3. Method Filter
    if (methodFilter !== 'ALL') {
      if (p.method?.toUpperCase() !== methodFilter) return false;
    }

    return true;
  });

  return (
    <ShellPage
      eyebrow="NS LUXURY VILLA · AUDIT & FINANCIAL SETTLEMENTS"
      title="Payments Ledger & Cashiering"
      subtitle="Direct collections, group deposits, part-payment settlement verification, and manager refund approvals."
      actions={
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => void load()} className="border-[#cbd5e1] hover:bg-white bg-white/70 shadow-xs text-xs font-semibold gap-1.5">
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={openModal} className="bg-gradient-to-r from-[#174b59] to-[#0f3440] hover:from-[#133e4a] hover:to-[#0a232b] text-white shadow-md text-xs font-semibold gap-1.5">
            <Plus size={14} /> Record Payment
          </Button>
        </div>
      }
    >
      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Net Revenue Collected</span>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-950">{formatCurrency(totalNet)}</div>
          <p className="mt-1 text-[11px] text-emerald-700 font-medium">Immutable ledger balance</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Total Collections</span>
            <div className="rounded-xl bg-slate-100 p-2 text-[#475569]">
              <WalletCards size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-[#0f172a]">{completedPayments.length}</div>
          <p className="mt-1 text-[11px] text-[#64748b]">
            <span className="font-bold text-emerald-700">{fullPayments.length} Full</span> ·{' '}
            <span className="font-bold text-amber-700">{partPayments.length} Part / Deposit</span>
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-br from-white to-rose-50/30 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Refunds Issued</span>
            <div className="rounded-xl bg-rose-100 p-2 text-rose-700">
              <Undo2 size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-950">{formatCurrency(refundedTotal)}</div>
          <p className="mt-1 text-[11px] text-rose-700">{completedRefunds.length} ledger reversal{completedRefunds.length === 1 ? '' : 's'}</p>
        </div>

        <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-colors ${pendingRefunds.length > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Pending Approvals</span>
            <div className={`rounded-xl p-2 ${pendingRefunds.length > 0 ? 'bg-amber-200 text-amber-900 animate-pulse' : 'bg-slate-100 text-[#475569]'}`}>
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-[#0f172a]">{pendingRefunds.length}</div>
          <p className="mt-1 text-[11px] text-[#64748b]">
            {pendingRefunds.length > 0 ? 'Awaiting Manager / Admin review' : 'All transactions cleared'}
          </p>
        </div>
      </div>

      {/* Main Section */}
      <Section
        title="Transaction Ledger"
        subtitle="Complete chronological record of receipts, collections, and reversals."
      >
        {/* Filter Bar */}
        <div className="border-b border-[#e8ebe8] bg-[#fbfdfc] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Type Tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#dfe4e0] bg-white p-1">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === 'ALL' ? 'bg-[#16a4d4] text-white shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'}`}
              >
                All ({data.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('FULL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === 'FULL' ? 'bg-[#16a4d4] text-white shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'}`}
              >
                Full Payments ({fullPayments.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('PART')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === 'PART' ? 'bg-[#16a4d4] text-white shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'}`}
              >
                Part Payments ({partPayments.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('REFUND')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === 'REFUND' ? 'bg-[#16a4d4] text-white shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'}`}
              >
                Refunds ({completedRefunds.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('PENDING')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${typeFilter === 'PENDING' ? 'bg-amber-600 text-white shadow-sm' : pendingRefunds.length > 0 ? 'text-amber-700 font-extrabold bg-amber-50' : 'text-[#64748b] hover:text-[#0f172a]'}`}
              >
                Pending ({pendingRefunds.length})
              </button>
            </div>

            {/* Method Select Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#899397] font-semibold text-[11px] uppercase tracking-wider">Method:</span>
              <div className="flex flex-wrap gap-1">
                {(['ALL', 'CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'] as FilterMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethodFilter(m)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition border ${methodFilter === m ? 'border-[#16a4d4] bg-[#eff9fc] text-[#0e7490]' : 'border-transparent text-[#64748b] hover:bg-slate-100'}`}
                  >
                    {m === 'ALL' ? 'All' : methodLabel(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by guest, room, receipt reference, or handled-by staff…"
              className="w-full rounded-xl border border-[#dfe4e0] bg-white py-2 pl-9 pr-4 text-xs font-medium text-[#0f172a] placeholder-[#94a3b8] focus:border-[#16a4d4] focus:outline-none focus:ring-1 focus:ring-[#16a4d4]"
            />
          </div>
        </div>

        {/* Transaction Table */}
        {loading ? (
          <LoadingState message="Loading payment transactions..." />
        ) : visible.length === 0 ? (
          <div className="p-16 text-center">
            <ReceiptText className="mx-auto text-[#cbd5e1]" size={36} />
            <h3 className="mt-3 text-sm font-extrabold text-[#334155]">No transactions found</h3>
            <p className="mt-1 text-xs text-[#94a3b8]">
              {q || typeFilter !== 'ALL' || methodFilter !== 'ALL'
                ? 'Try adjusting your search criteria or resetting filters.'
                : 'No payments have been recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[.12em] text-[#64748b] border-b border-[#e2e8f0]">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Receipt / Ref</th>
                  <th className="px-5 py-3.5 font-bold">Payer / Guest</th>
                  <th className="px-5 py-3.5 font-bold">Method</th>
                  <th className="px-5 py-3.5 font-bold">Classification</th>
                  <th className="px-5 py-3.5 font-bold">Handled By & Time</th>
                  <th className="px-5 py-3.5 font-bold text-right">Amount</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed] text-xs">
                {visible.map((p) => {
                  const isPendingRefund = p.type === 'REFUND' && p.status === 'PENDING';
                  const isRefund = p.type === 'REFUND';
                  const isDeposit = p.type === 'DEPOSIT' && !p.fullySettled;
                  const isFull = (p.type === 'PAYMENT' || p.fullySettled) && !isRefund;
                  const canPrint = ['PAYMENT', 'DEPOSIT', 'REFUND'].includes(p.type) && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(p.status);
                  const isCompletedPayment = ['PAYMENT', 'DEPOSIT'].includes(p.type) && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(p.status);

                  const isGroupPayment = !!p.groupBookingId && !!p.groupRooms?.length;
                  const guestDisplayName = p.guest ? formatGuestName(p.guest) : p.description || 'General payment';
                  // For group payments show all rooms; for single show the one room
                  const roomNumber = isGroupPayment
                    ? null  // handled separately below
                    : p.reservation?.room?.number || p.roomNumber;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#f8fbfb] transition-colors ${isPendingRefund ? 'bg-amber-500/5' : ''}`}
                    >
                      {/* Ref */}
                      <td className="px-5 py-4 font-mono font-bold text-[#a8761e]">
                        <span className="rounded bg-amber-50 px-2 py-0.5 border border-amber-200/60 text-[11px]">
                          {p.reference || `RCP-${p.id.slice(-8).toUpperCase()}`}
                        </span>
                      </td>

                      {/* Guest / Payer */}
                      <td className="px-5 py-4 font-bold text-[#1e293b]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{guestDisplayName}</span>
                          {isGroupPayment ? (
                            <span className="rounded-md bg-[#e8f2f4] px-1.5 py-0.5 text-[10px] font-extrabold text-[#16a4d4] flex items-center gap-1 border border-[#b8dde6]">
                              <BedDouble size={11} /> Group · Rooms {p.groupRooms!.join(', ')}
                            </span>
                          ) : roomNumber ? (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold text-[#475569] flex items-center gap-1 border border-slate-200">
                              <BedDouble size={11} /> Room {roomNumber}
                            </span>
                          ) : null}
                        </div>
                        {isGroupPayment && p.groupBookingId && (
                          <div className="font-mono text-[10px] text-[#a8761e] mt-0.5">
                            Group: {p.groupBookingId}
                          </div>
                        )}
                        {!isGroupPayment && p.reservation?.confirmationNo && (
                          <div className="font-mono text-[10px] text-[#94a3b8] mt-0.5">
                            Booking: {p.reservation.confirmationNo}
                          </div>
                        )}
                      </td>

                      {/* Method */}
                      <td className="px-5 py-4 font-semibold text-[#475569]">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-[#334155] border border-slate-200">
                          <MethodIcon method={p.method} />
                          <span>{methodLabel(p.method)}</span>
                        </div>
                      </td>

                      {/* Classification */}
                      <td className="px-5 py-4">
                        {isRefund ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-rose-800 border border-rose-200">
                            <ArrowUpRight size={11} /> Refund
                          </span>
                        ) : isDeposit ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800 border border-amber-200">
                            Part payment
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={11} /> Paid in full
                          </span>
                        )}
                      </td>

                      {/* Staff & Time */}
                      <td className="px-5 py-4 text-[11px]">
                        <div className="font-bold text-[#334155] flex items-center gap-1">
                          <UserRound size={12} className="text-[#94a3b8]" />
                          <span>{p.processorName || 'Staff'}</span>
                        </div>
                        <div className="text-[10px] text-[#94a3b8] font-mono mt-0.5">
                          {(() => {
                            const ts = p.processedAt || p.createdAt;
                            return ts ? new Date(ts).toLocaleString() : '—';
                          })()}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className={`px-5 py-4 text-right text-xs font-black ${isRefund ? 'text-rose-600' : 'text-[#047857]'}`}>
                        {isRefund ? '− ' : '+ '}{formatCurrency(money(p.amount))}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {isPendingRefund ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock size={11} /> PENDING APPROVAL
                          </span>
                        ) : (
                          statusBadge(p.status || 'COMPLETED')
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {isPendingRefund ? (
                          isPrivileged ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleApproveRefund(p.id)}
                                loading={busyId === p.id}
                              >
                                <CheckCircle2 size={13} /> Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRejectRefund(p.id)}
                                loading={busyId === p.id}
                                className="text-red-500 hover:text-red-600"
                              >
                                <XCircle size={13} /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-amber-700">Awaiting Manager</span>
                          )
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {canPrint && (
                              <button
                                type="button"
                                title="Print official receipt"
                                onClick={() =>
                                  printPaymentReceipt(p, {
                                    guestName: p.guest ? formatGuestName(p.guest) : undefined,
                                    // group: use bookingId; single: use confirmationNo
                                    bookingRef: isGroupPayment
                                      ? p.groupBookingId ?? undefined
                                      : (p.reservation?.confirmationNo || p.reservationId?.slice(0, 8)?.toUpperCase()),
                                    roomNumber: isGroupPayment ? undefined : (roomNumber ? String(roomNumber) : undefined),
                                    // amountDue from server = full reservation or combined group total
                                    amountDue: p.amountDue ?? (isGroupPayment ? (p.groupTotal ?? Number(p.amount)) : Number(p.amount)),
                                    type: p.type as any,
                                    fullySettled: isFull,
                                    isGroup: isGroupPayment,
                                    roomCount: isGroupPayment ? (p.groupRooms?.length) : undefined,
                                    remainingBalance: isFull ? 0 : (p.remainingBalance !== undefined ? p.remainingBalance : Math.max(0, (p.amountDue ?? Number(p.amount)) - Number(p.amount))),
                                  })
                                }
                                className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#eff9fc] hover:text-[#16a4d4] transition-colors border border-transparent hover:border-[#b8dde6]"
                              >
                                <Printer size={15} />
                              </button>
                            )}

                            {isCompletedPayment && canRequestOrRefund && (
                              <button
                                type="button"
                                title={isPrivileged ? 'Approve & Issue refund' : 'Submit refund request'}
                                onClick={() => openRefund(p)}
                                className="rounded-lg p-1.5 text-[#64748b] hover:bg-amber-50 hover:text-amber-800 transition-colors border border-transparent hover:border-amber-200"
                              >
                                <Undo2 size={15} />
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                title="Delete payment record (Admin)"
                                onClick={() => handleDeletePayment(p)}
                                disabled={busyId === p.id}
                                className="rounded-lg p-1.5 text-[#94a3b8] hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                              >
                                {busyId === p.id ? <Clock size={15} className="animate-spin" /> : <Trash2 size={15} />}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Record Payment Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Record guest payment" size="lg">
        <form onSubmit={save} className="space-y-4 p-6">
          <FormField label="Select in-house guest & room" required>
            <SelectInput value={form.stayId} onChange={(e) => handleStayChange(e.target.value)}>
              <option value="">Select guest…</option>
              {stays.map((s) => {
                const f = s.reservation.folios.find((x) => x.status === 'OPEN') ?? s.reservation.folios[0];
                const bal = f ? money(f.balance) : 0;
                return (
                  <option key={s.id} value={s.id}>
                    Room {s.room?.number || '—'} · {formatGuestName(s.guest)} (Outstanding: {formatCurrency(bal)})
                  </option>
                );
              })}
            </SelectInput>
          </FormField>

          {/* Outstanding Bill Details Banner */}
          {selectedStay && folio && (
            <div className="rounded-2xl border border-[#dfe4df] bg-gradient-to-br from-[#f8faf8] to-[#edf6f4] p-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Outstanding Bill Balance</span>
                  <div className="mt-0.5 text-2xl font-black text-[#0f172a]">
                    {formatCurrency(balance)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="rounded-md bg-white px-2.5 py-1 text-[11px] font-mono font-bold text-[#0e7490] border border-[#bee3ec]">
                    Folio #{folio.id.slice(0, 8).toUpperCase()}
                  </div>
                  <p className="mt-1 text-[10px] text-[#64748b]">
                    Room {selectedStay.room?.number || '—'} · {folio.items?.length || 0} line items
                  </p>
                </div>
              </div>

              {/* Quick Fill Buttons */}
              {balance > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-[#e2e7e4]">
                  <span className="text-[10px] font-bold uppercase text-[#64748b] self-center">Quick fill:</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, amount: balance.toFixed(2), tendered: '' })}
                    className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 hover:bg-emerald-200 transition border border-emerald-300"
                  >
                    ✓ Pay Full Balance ({formatCurrency(balance)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, amount: (balance / 2).toFixed(2), tendered: '' })}
                    className="rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-800 hover:bg-amber-200 transition border border-amber-300"
                  >
                    50% Deposit ({formatCurrency(balance / 2)})
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Payment amount (GHS)" required>
              <TextInput
                required
                type="number"
                min="0.01"
                step="0.01"
                max={balance > 0 ? (balance + 0.01).toFixed(2) : undefined}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Payment method" required>
              <SelectInput
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as DirectPaymentMethod })}
                disabled={splitOpen}
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card (POS)</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </SelectInput>
            </FormField>
          </div>

          {/* Cash Tendered Input */}
          {form.method === 'CASH' && !splitOpen && (
            <FormField label="Cash tendered / handed over by guest (GHS) (optional)">
              <TextInput
                type="number"
                min={Number(form.amount) || 0}
                step="0.01"
                placeholder={form.amount || '0.00'}
                value={form.tendered}
                onChange={(e) => setForm({ ...form, tendered: e.target.value })}
              />
            </FormField>
          )}

          {/* Real-time Settlement Check Card */}
          {selectedStay && folio && Number(form.amount) > 0 && (
            <div className="rounded-2xl border border-[#dfe4df] bg-[#f9faf9] p-4 text-xs space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center text-[#475569]">
                <span className="font-medium">Money supposed to be paid (Bill Balance):</span>
                <span className="font-extrabold text-[#0f172a]">{formatCurrency(balance)}</span>
              </div>
              <div className="flex justify-between items-center text-[#475569]">
                <span className="font-medium">Money paid (This transaction):</span>
                <span className="font-bold text-[#0f172a]">{formatCurrency(Number(form.amount))}</span>
              </div>
              {form.method === 'CASH' && Number(form.tendered) > Number(form.amount) && (
                <div className="flex justify-between items-center text-[#475569]">
                  <span className="font-medium">Cash tendered:</span>
                  <span className="font-bold text-[#0f172a]">{formatCurrency(Number(form.tendered))}</span>
                </div>
              )}
              
              <div className="border-t border-[#e2e7e4] pt-2 flex justify-between items-center">
                <span className="font-bold text-[#334155]">Payment Classification:</span>
                {Number(form.amount) >= balance - 0.005 ? (
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800 border border-emerald-300">
                    ✓ Full Payment (Paid in full)
                  </span>
                ) : (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 border border-amber-300">
                    Part Payment / Deposit
                  </span>
                )}
              </div>

              {/* Change calculation */}
              {form.method === 'CASH' && Number(form.tendered) > Number(form.amount) && (
                <div className="flex justify-between items-center rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800 border border-emerald-200">
                  <span className="font-extrabold">→ Change due to guest:</span>
                  <span className="font-black text-sm">{formatCurrency(Number(form.tendered) - Number(form.amount))}</span>
                </div>
              )}

              {/* Remaining balance */}
              {Number(form.amount) < balance - 0.005 && (
                <div className="flex justify-between items-center rounded-xl bg-amber-50 px-3 py-2 text-amber-800 border border-amber-200">
                  <span className="font-extrabold">→ Remaining balance to be paid:</span>
                  <span className="font-black text-sm">{formatCurrency(balance - Number(form.amount))}</span>
                </div>
              )}

              {Number(form.amount) >= balance - 0.005 && (
                <div className="text-[11px] text-emerald-800 font-semibold text-center pt-1">
                  ✓ This payment completely clears the guest's folio balance.
                </div>
              )}
            </div>
          )}

          {/* Split Payment Option */}
          <label className="flex items-center gap-2 text-xs font-bold text-[#475569]">
            <input
              type="checkbox"
              checked={splitOpen}
              onChange={(e) => {
                setSplitOpen(e.target.checked);
                setTenders([makeTenderRow()]);
              }}
              className="h-3.5 w-3.5 accent-[#16a4d4]"
            />
            Split payment across methods (e.g. cash + mobile money)
          </label>

          {splitOpen && (
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <TenderSplit total={Number(form.amount) || 0} rows={tenders} onChange={setTenders} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Transaction / Reference Code (optional)">
              <TextInput
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="e.g. MoMo Ref / POS Auth"
              />
            </FormField>
            <FormField label="Description (optional)">
              <TextInput
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Auto-generated if left blank"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#edf0ed]">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={busy}
              disabled={splitOpen && !tendersCoverTotal(tenders, Number(form.amount) || 0)}
              className="bg-[#16a4d4] text-white hover:bg-[#138db8]"
            >
              <ReceiptText size={14} /> Record & Print Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Refund Modal */}
      <Modal
        open={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title={isPrivileged ? 'Approve & Issue Ledger Reversal' : 'Submit Refund Request'}
      >
        <form onSubmit={submitRefund} className="space-y-4 p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-extrabold">
              {isPrivileged
                ? 'Manager / Admin approval creates an immediate immutable ledger reversal.'
                : 'Receptionist Refund Request: Submitted with PENDING status for Manager/Admin review.'}
            </p>
            <p className="mt-1.5 text-[11px] text-amber-800">
              Original Payment: <strong>{refundTarget ? formatCurrency(money(refundTarget.amount)) : ''}</strong> ({refundTarget?.method || 'N/A'})
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Refund amount (GHS)" required>
              <TextInput
                required
                type="number"
                min="0.01"
                step="0.01"
                max={refundTarget ? money(refundTarget.amount) : undefined}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </FormField>

            <FormField label="Refund Method" required>
              <SelectInput
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as DirectPaymentMethod)}
              >
                <option value="CASH">CASH</option>
                <option value="CARD">CARD</option>
                <option value="MOBILE_MONEY">MOBILE_MONEY</option>
                <option value="BANK_TRANSFER">BANK_TRANSFER</option>
              </SelectInput>
            </FormField>
          </div>

          <FormField label="Refund Reason" required>
            <TextInput
              required
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Guest cancellation / Folio credit adjustment"
            />
          </FormField>

          <FormField label="Transfer / Authorization Reference (optional)">
            <TextInput
              value={refundReference}
              onChange={(e) => setRefundReference(e.target.value)}
              placeholder="e.g. MoMo Transaction ID / POS Ref"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#edf0ed]">
            <Button type="button" variant="ghost" onClick={() => setRefundTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              <Undo2 size={14} /> {isPrivileged ? 'Confirm & Issue Reversal' : 'Submit for Manager Review'}
            </Button>
          </div>
        </form>
      </Modal>
    </ShellPage>
  );
};

export default PaymentsPage;
