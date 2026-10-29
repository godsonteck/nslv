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
import { computeBillSummary } from '../frontoffice/GuestBillsPage';

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
  isCheckedOut?: boolean;
  actualCheckOut?: string | null;
  checkedOutDate?: string | null;
  checkOutNotes?: string | null;
  checkOutPaymentMethod?: string | null;
  totalBilled?: number;
  paidAtCheckout?: number;
  totalPaid?: number;
  currentOwed?: number;
  cashPaid?: number;
  momoPaid?: number;
  cardPaid?: number;
  bankPaid?: number;
  finalBalance?: number;
  guest: { firstName: string; lastName?: string | null } | null;
  room: { number: string | number; name?: string; roomType?: { name?: string } } | null;
  reservation: {
    id: string;
    confirmationNo?: string;
    status?: string;
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
      payments?: Array<{
        id: string;
        method: string;
        amount: number | string;
        processedAt?: string;
        createdAt?: string;
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
  const [unsettledStays, setUnsettledStays] = useState<BillStay[]>([]);
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
      const [a, b, c] = await Promise.all([
        paymentsApi.list(),
        staysApi.getActiveStays(),
        staysApi.getUnsettledStays().catch(() => ({ success: true, data: [] })),
      ]);
      setData(a.data || []);
      setStays(b.data || []);
      setUnsettledStays(c.data || []);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const allSelectableStays = [...stays, ...unsettledStays];
  const selectedStay = allSelectableStays.find((s) => s.id === form.stayId || s.reservationId === form.stayId) || null;
  const folio =
    selectedStay?.reservation.folios.find((f) => Number(f.balance) > 0.005) ??
    selectedStay?.reservation.folios.find((f) => f.status === 'OPEN') ??
    selectedStay?.reservation.folios[0] ??
    null;
  const selectedSummary = (selectedStay && folio) ? computeBillSummary(selectedStay as any, folio) : null;
  const balance = selectedSummary ? selectedSummary.balance : (folio ? money(folio.balance) : 0);

  const owingUnsettledStays = unsettledStays.filter((s) => {
    const f = s.reservation.folios.find((x) => Number(x.balance) > 0.005) ?? s.reservation.folios[0];
    const summary = computeBillSummary(s as any, f);
    return summary.balance > 0.005;
  });

  const handleStayChange = (stayId: string) => {
    const stay = allSelectableStays.find((s) => s.id === stayId || s.reservationId === stayId) || null;
    const f =
      stay?.reservation.folios.find((x) => Number(x.balance) > 0.005) ??
      stay?.reservation.folios.find((x) => x.status === 'OPEN') ??
      stay?.reservation.folios[0] ??
      null;
    const summary = stay && f ? computeBillSummary(stay as any, f) : null;
    const bal = summary ? summary.balance : (f ? money(f.balance) : 0);
    const chargeItems = (f?.items || []).filter(
      (item: any) => !item.voidedAt && !['PAYMENT', 'DEPOSIT'].includes(String(item.type).toUpperCase()) && Number(item.amount) > 0,
    );
    const itemNames = [...new Set(chargeItems.map((i: any) => i.description || i.type))];
    const defaultDesc = itemNames.length
      ? `Payment for: ${itemNames.slice(0, 3).join(', ')}${itemNames.length > 3 ? ` + ${itemNames.length - 3} more` : ''}`
      : 'Guest folio settlement';
    setForm({
      ...form,
      stayId,
      amount: bal > 0 ? bal.toFixed(2) : '',
      tendered: '',
      description: defaultDesc,
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
      showToast('error', 'Select an in-house guest or checked-out guest with an outstanding bill.');
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
      const isPostCheckout = selectedStay.isCheckedOut || selectedStay.reservation.status === 'CHECKED_OUT';
      const postCheckoutTag = isPostCheckout ? ' [Post-checkout settlement]' : '';
      const desc = form.description?.trim()
        ? form.description.trim()
        : settlesInFull
        ? `Payment received in full${postCheckoutTag}.${changeDue > 0 ? ` Cash tendered: GHS ${cashTendered.toFixed(2)}, Change given: GHS ${changeDue.toFixed(2)}.` : ''} Balance remaining: GHS 0.00`
        : `Partial payment recorded${postCheckoutTag}. Remaining balance: GHS ${remainingAfter.toFixed(2)}.${changeDue > 0 ? ` Cash tendered: GHS ${cashTendered.toFixed(2)}, Change given: GHS ${changeDue.toFixed(2)}.` : ''}`;

      const res = await paymentsApi.processPayment({
        folioId: folio.id,
        reservationId: selectedStay.reservation.id,
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
        description: desc,
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
          <Button variant="outline" size="sm" onClick={() => void load()} className="border-[var(--ns-line)] hover:bg-[var(--ns-surface-2)] bg-[var(--ns-surface)] text-[var(--ns-ink)] shadow-xs text-xs font-semibold gap-1.5">
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

        <div className="relative overflow-hidden rounded-2xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">Total Collections</span>
            <div className="rounded-xl bg-[var(--ns-surface-2)] p-2 text-[var(--ns-teal)]">
              <WalletCards size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-[var(--ns-ink)]">{completedPayments.length}</div>
          <p className="mt-1 text-[11px] text-[var(--ns-muted)]">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{fullPayments.length} Full</span> ·{' '}
            <span className="font-bold text-amber-600 dark:text-amber-400">{partPayments.length} Part / Deposit</span>
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-[var(--ns-surface)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Refunds Issued</span>
            <div className="rounded-xl bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
              <Undo2 size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700 dark:text-rose-400">{formatCurrency(refundedTotal)}</div>
          <p className="mt-1 text-[11px] text-[var(--ns-muted)]">{completedRefunds.length} ledger reversal{completedRefunds.length === 1 ? '' : 's'}</p>
        </div>

        <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-colors ${pendingRefunds.length > 0 ? 'border-amber-300 dark:border-amber-700 bg-amber-500/10' : 'border-[var(--ns-line)] bg-[var(--ns-surface)]'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Pending Approvals</span>
            <div className={`rounded-xl p-2 ${pendingRefunds.length > 0 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 animate-pulse' : 'bg-[var(--ns-surface-2)] text-[var(--ns-muted)]'}`}>
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-[var(--ns-ink)]">{pendingRefunds.length}</div>
          <p className="mt-1 text-[11px] text-[var(--ns-muted)]">
            {pendingRefunds.length > 0 ? 'Awaiting Manager / Admin review' : 'All transactions cleared'}
          </p>
        </div>
      </div>

      {/* Checked-Out Guests Outstanding Debt Alert */}
      {owingUnsettledStays.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/20 p-2 text-amber-700 dark:text-amber-400">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="font-extrabold text-amber-900 dark:text-amber-200">
                {owingUnsettledStays.length} Checked-Out Guest{owingUnsettledStays.length === 1 ? '' : 's'} with Outstanding Balance
              </p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
                Total unpaid debt: {formatCurrency(owingUnsettledStays.reduce((sum, s) => {
                  const f = s.reservation.folios.find((x) => Number(x.balance) > 0.005) ?? s.reservation.folios[0];
                  return sum + computeBillSummary(s as any, f).balance;
                }, 0))}. You can record payments for checked-out guests here anytime.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              openModal();
              if (owingUnsettledStays[0]) {
                handleStayChange(owingUnsettledStays[0].id);
              }
            }}
            className="border-amber-400 text-amber-900 hover:bg-amber-100 font-bold dark:border-amber-600 dark:text-amber-200"
          >
            Record Post-Checkout Payment
          </Button>
        </div>
      )}

      {/* Main Section */}
      <Section
        title="Transaction Ledger"
        subtitle="Complete chronological record of receipts, collections, and reversals."
      >
        {/* Filter Bar */}
        <div className="border-b border-[var(--ns-line)] bg-[var(--ns-surface-2)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Type Tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-1">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === 'ALL' ? 'bg-[#173c4d] text-[#fdfbf7] shadow-sm' : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'}`}
              >
                All ({data.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('FULL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === 'FULL' ? 'bg-[#173c4d] text-[#fdfbf7] shadow-sm' : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'}`}
              >
                Full Payments ({fullPayments.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('PART')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === 'PART' ? 'bg-[#c59a58] text-[#14232b] shadow-sm font-black' : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'}`}
              >
                Part Payments ({partPayments.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('REFUND')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${typeFilter === 'REFUND' ? 'bg-[#173c4d] text-[#fdfbf7] shadow-sm' : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'}`}
              >
                Refunds ({completedRefunds.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('PENDING')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${typeFilter === 'PENDING' ? 'bg-amber-600 text-white shadow-sm' : pendingRefunds.length > 0 ? 'text-amber-700 dark:text-amber-400 font-extrabold bg-amber-500/20' : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'}`}
              >
                Pending ({pendingRefunds.length})
              </button>
            </div>

            {/* Method Select Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[var(--ns-muted)] font-bold text-[10px] uppercase tracking-wider">Method:</span>
              <div className="flex flex-wrap gap-1">
                {(['ALL', 'CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'] as FilterMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethodFilter(m)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition border ${methodFilter === m ? 'border-[#c59a58] bg-[#fbf8f2] text-[#8c672b]' : 'border-transparent text-[#64748b] hover:bg-[#1e2535]'}`}
                  >
                    {m === 'ALL' ? 'All' : methodLabel(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ns-muted)]" size={15} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by guest, room, receipt reference, or handled-by staff…"
              className="w-full rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface-2)] py-2 pl-9 pr-4 text-xs font-medium text-[var(--ns-ink)] placeholder-[var(--ns-muted)] focus:border-[#c59a58] focus:outline-none focus:ring-1 focus:ring-[#c59a58]"
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
                            <span className="rounded-md bg-[#173c4d]/5 px-2 py-0.5 text-[10px] font-extrabold text-[#173c4d] flex items-center gap-1 border border-[#173c4d]/15">
                              <BedDouble size={11} className="text-[#c59a58]" /> Group · Rooms {p.groupRooms!.join(', ')}
                            </span>
                          ) : roomNumber ? (
                            <span className="rounded-md bg-[#1e2535] px-1.5 py-0.5 text-[10px] font-extrabold text-[#475569] flex items-center gap-1 border border-[#1e2535]">
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
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e2535] px-2 py-1 text-[11px] font-bold text-[#334155] border border-[#1e2535]">
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
                                className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#c59a58]/10 hover:text-[#b88738] transition-colors border border-transparent hover:border-[#c59a58]/30"
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
          <FormField label="Select guest & room (In-house or checked-out owing)" required>
            <SelectInput value={form.stayId} onChange={(e) => handleStayChange(e.target.value)}>
              <option value="">Select guest with outstanding bill…</option>
              {stays.length > 0 && (
                <optgroup label="In-House Guests">
                  {stays.map((s) => {
                    const f = s.reservation.folios.find((x) => x.status === 'OPEN') ?? s.reservation.folios[0];
                    const bal = f ? money(f.balance) : 0;
                    return (
                      <option key={s.id} value={s.id}>
                        Room {s.room?.number || '—'} · {formatGuestName(s.guest)} (Outstanding: {formatCurrency(bal)})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {owingUnsettledStays.length > 0 && (
                <optgroup label="Checked-Out Guests (Owing Balance)">
                  {owingUnsettledStays.map((s) => {
                    const f = s.reservation.folios.find((x) => Number(x.balance) > 0.005) ?? s.reservation.folios[0];
                    const summary = computeBillSummary(s as any, f);
                    const coDate = summary.actualCheckOut;
                    const dateStr = coDate
                      ? new Date(coDate).toLocaleDateString('en-GH', { day: '2-digit', month: 'short' })
                      : 'Departed';
                    const splitParts: string[] = [];
                    if (summary.cashPaid > 0) splitParts.push(`Cash: ${formatCurrency(summary.cashPaid)}`);
                    if (summary.momoPaid > 0) splitParts.push(`MoMo: ${formatCurrency(summary.momoPaid)}`);
                    const splitStr = splitParts.length > 0 ? ` [${splitParts.join(', ')}]` : '';
                    return (
                      <option key={s.id} value={s.id}>
                        Room {s.room?.number || '—'} · {formatGuestName(s.guest)} [Checked out: {dateStr}] · Owes: {formatCurrency(summary.balance)} (Billed: {formatCurrency(summary.totalBilled)}, Paid: {formatCurrency(summary.totalPaid)}{splitStr})
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </SelectInput>
          </FormField>

          {/* Outstanding Bill Details & Settlement Audit Banner */}
          {selectedStay && folio && selectedSummary && (
            <div className={`rounded-2xl border p-4 text-xs ${selectedSummary.isCheckedOut ? 'border-amber-300 bg-amber-50/80 text-amber-950 dark:bg-amber-950/30 dark:border-amber-700/60 dark:text-amber-200' : 'border-[#dfe4df] bg-gradient-to-br from-[#f8faf8] to-[#edf6f4]'}`}>
              {selectedSummary.isCheckedOut ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-100/90 dark:bg-amber-900/50 px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    <span>Post-Checkout Debt Settlement · Room {selectedStay.room?.number || '—'} · {formatGuestName(selectedStay.guest)}</span>
                  </div>
                  {selectedSummary.actualCheckOut && (
                    <span className="text-[11px] font-extrabold text-amber-900 dark:text-amber-100 bg-amber-200/80 dark:bg-amber-800/80 px-2.5 py-0.5 rounded-md">
                      Checked out: {new Date(selectedSummary.actualCheckOut).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
              ) : (
                <div className="mb-3 flex items-center justify-between text-xs text-[var(--ns-muted)]">
                  <span className="font-semibold">Room {selectedStay.room?.number || '—'} · {formatGuestName(selectedStay.guest)}</span>
                  <span className="font-mono text-[11px] text-[#0e7490] dark:text-[#38bdf8]">Folio #{folio.id.slice(0, 8).toUpperCase()}</span>
                </div>
              )}

              {/* 4 Financial Audit Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {/* 1. What Guest is Supposed to Pay */}
                <div className="rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-2.5">
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] block">
                    Supposed to Pay
                  </span>
                  <div className="font-mono text-sm font-black text-[var(--ns-ink)] mt-0.5">
                    {formatCurrency(selectedSummary.totalBilled)}
                  </div>
                  <span className="text-[9px] text-[var(--ns-muted)]">Total billed charges</span>
                </div>

                {/* 2. How Much Paid by Checkout / Check-in */}
                <div className="rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-2.5">
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] block">
                    {selectedSummary.isCheckedOut ? 'Paid by Checkout' : 'Paid at Check-in'}
                  </span>
                  <div className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(selectedSummary.paidAtCheckout)}
                  </div>
                  <span className="text-[9px] text-[var(--ns-muted)]">
                    {selectedSummary.isCheckedOut ? 'Departure payment' : 'Initial deposit'}
                  </span>
                </div>

                {/* 3. Total Paid with Cash & MoMo breakdown */}
                <div className="rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-2.5">
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] block">
                    Total Paid to Date
                  </span>
                  <div className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(selectedSummary.totalPaid)}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedSummary.cashPaid > 0 && (
                      <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-1 py-0.2 text-[9px] font-extrabold text-emerald-800 dark:text-emerald-300">
                        💵 Cash {formatCurrency(selectedSummary.cashPaid)}
                      </span>
                    )}
                    {selectedSummary.momoPaid > 0 && (
                      <span className="rounded bg-amber-100 dark:bg-amber-950 px-1 py-0.2 text-[9px] font-extrabold text-amber-900 dark:text-amber-300">
                        📱 MoMo {formatCurrency(selectedSummary.momoPaid)}
                      </span>
                    )}
                    {selectedSummary.cardPaid > 0 && (
                      <span className="rounded bg-blue-100 dark:bg-blue-950 px-1 py-0.2 text-[9px] font-extrabold text-blue-800 dark:text-blue-300">
                        💳 Card {formatCurrency(selectedSummary.cardPaid)}
                      </span>
                    )}
                    {selectedSummary.bankPaid > 0 && (
                      <span className="rounded bg-purple-100 dark:bg-purple-950 px-1 py-0.2 text-[9px] font-extrabold text-purple-800 dark:text-purple-300">
                        🏦 Bank {formatCurrency(selectedSummary.bankPaid)}
                      </span>
                    )}
                    {selectedSummary.totalPaid === 0 && (
                      <span className="text-[9px] text-slate-400 italic">No payments yet</span>
                    )}
                  </div>
                </div>

                {/* 4. What Guest Currently Owes */}
                <div className={`rounded-xl border p-2.5 ${selectedSummary.balance > 0.005 ? 'border-rose-300 bg-rose-50/70 dark:border-rose-800/60 dark:bg-rose-950/30' : 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800/60 dark:bg-emerald-950/30'}`}>
                  <span className={`text-[9.5px] font-extrabold uppercase tracking-wider block ${selectedSummary.balance > 0.005 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    Guest Owes
                  </span>
                  <div className={`font-mono text-sm font-black mt-0.5 ${selectedSummary.balance > 0.005 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {formatCurrency(selectedSummary.balance)}
                  </div>
                  <span className={`text-[9px] font-semibold ${selectedSummary.balance > 0.005 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {selectedSummary.balance > 0.005 ? 'Outstanding balance' : 'Fully settled'}
                  </span>
                </div>
              </div>

              {selectedStay.checkOutNotes && (
                <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-[11px] text-amber-900 dark:text-amber-200">
                  <span className="font-bold">Checkout Remark:</span> {selectedStay.checkOutNotes}
                </div>
              )}

              {/* Quick Fill Buttons */}
              {balance > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--ns-line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--ns-muted)] self-center">Quick fill:</span>
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
            <div className="rounded-2xl border border-[var(--ns-line)] bg-[var(--ns-surface-2)] p-4 text-xs space-y-2.5 shadow-sm">
              <div className="flex justify-between items-center text-[var(--ns-muted)]">
                <span className="font-medium">Money supposed to be paid (Bill Balance):</span>
                <span className="font-extrabold text-[var(--ns-ink)]">{formatCurrency(balance)}</span>
              </div>
              <div className="flex justify-between items-center text-[var(--ns-muted)]">
                <span className="font-medium">Money paid (This transaction):</span>
                <span className="font-bold text-[var(--ns-ink)]">{formatCurrency(Number(form.amount))}</span>
              </div>
              {form.method === 'CASH' && Number(form.tendered) > Number(form.amount) && (
                <div className="flex justify-between items-center text-[var(--ns-muted)]">
                  <span className="font-medium">Cash tendered:</span>
                  <span className="font-bold text-[var(--ns-ink)]">{formatCurrency(Number(form.tendered))}</span>
                </div>
              )}
              
              <div className="border-t border-[var(--ns-line)] pt-2 flex justify-between items-center">
                <span className="font-bold text-[var(--ns-ink)]">Payment Classification:</span>
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
              className="h-3.5 w-3.5 accent-[#c59a58]"
            />
            Split payment across methods (e.g. cash + mobile money)
          </label>

          {splitOpen && (
            <div className="rounded-xl border border-[var(--ns-line)] p-3 bg-[var(--ns-surface-2)]">
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
            <FormField label="Payment For / Purpose (What this money is for)">
              <TextInput
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Indicate purpose (e.g. Room, Late checkout)"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-line)]">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={busy}
              disabled={splitOpen && !tendersCoverTotal(tenders, Number(form.amount) || 0)}
              className="bg-[#173c4d] text-[#fdfbf7] hover:bg-[#133240] font-bold"
            >
              <ReceiptText size={14} className="text-[#c59a58]" /> Record & Print Receipt
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

