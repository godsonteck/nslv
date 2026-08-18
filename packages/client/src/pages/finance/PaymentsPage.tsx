// ============================================
// NS LUXURY VILLA — Payments Ledger
// Record payments against in-house guests. Selecting a guest
// shows their live bill and the amount is auto-filled.
// ============================================

import React, { useEffect, useState } from 'react';
import { paymentsApi, staysApi } from '../../services/apiService';
import { CreditCard, Plus, RefreshCw, WalletCards, ReceiptText, Undo2, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
import { formatCurrency, formatGuestName } from '@nslv/shared';

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
}

interface BillStay {
  id: string;
  reservationId?: string;
  guest: { firstName: string; lastName?: string | null } | null;
  room: { number: string | number } | null;
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
interface PaymentForm {
  stayId: string;
  amount: string;
  method: DirectPaymentMethod;
  reference: string;
  description: string;
}

const money = (val: unknown) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

export const PaymentsPage: React.FC = () => {
  const [data, setData] = useState<PaymentRecord[]>([]);
  const [stays, setStays] = useState<BillStay[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [refundMethod, setRefundMethod] = useState<DirectPaymentMethod>('CASH');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<PaymentForm>({ stayId: '', amount: '', method: 'CASH', reference: '', description: '' });
  
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
    setForm({ ...form, stayId, amount: f ? money(f.balance).toFixed(2) : '' });
  };

  const openModal = () => {
    setForm({ stayId: '', amount: '', method: 'CASH', reference: '', description: '' });
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
      showToast('error', 'A positive amount is required.');
      return;
    }
    try {
      setBusy(true);
      await paymentsApi.processPayment({
        folioId: folio.id,
        amount,
        method: form.method,
        idempotencyKey: idempotencyKey || crypto.randomUUID(),
        reference: form.reference || undefined,
        description: form.description || undefined,
      });
      showToast('success', 'Payment recorded and applied to the guest bill.');
      setOpen(false);
      void load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to record payment');
    } finally {
      setBusy(false);
    }
  };

  const total = data.reduce((s, p) => s + (p.type === 'REFUND' && p.status === 'COMPLETED' ? -money(p.amount) : p.status === 'COMPLETED' ? money(p.amount) : 0), 0);
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
    const label = `${payment.type === 'REFUND' ? 'refund' : payment.type === 'DEPOSIT' ? 'deposit' : 'payment'} of ${formatCurrency(money(payment.amount))}`;
    if (!window.confirm(`Permanently delete this ${label} (${payment.method || '—'})? This cannot be undone. Only records not yet posted to a folio and without refunds can be deleted.`)) return;
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

  const visible = data.filter(
    (p) =>
      !q ||
      `${p.reference || ''} ${p.description || ''} ${formatGuestName(p.guest, '')}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );

  return (
    <ShellPage
      eyebrow="FINANCE · PAYMENTS"
      title="Payments & Ledger Reversals"
      subtitle="Direct collections, refund requests, and managerial approvals."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={openModal}>
            <Plus size={14} /> Record payment
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Net collected" value={formatCurrency(total)} note="Ledger settlement sum" icon={CreditCard} accent />
        <StatTile label="Total transactions" value={String(data.length)} note="Payments and refunds" icon={WalletCards} />
        <StatTile label="Completed Refunds" value={formatCurrency(refundedTotal)} note={`${completedRefunds.length} completed`} icon={Undo2} />
        <StatTile
          label="Pending Approvals"
          value={`${pendingRefunds.length} Request${pendingRefunds.length === 1 ? '' : 's'}`}
          note={pendingRefunds.length > 0 ? 'Awaiting Manager/Admin review' : 'All requests processed'}
          icon={Clock}
          accent={pendingRefunds.length > 0}
        />
      </div>

      <Section
        title="Transaction History"
        subtitle="Immutable ledger of completed payments, receptionist refund requests, and reversals"
        action={
          <Toolbar
            search={q}
            onSearch={setQ}
            placeholder="Search by payer, reference or note..."
          />
        }
      >
        {loading ? (
          <LoadingState message="Loading payment transactions..." />
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#7d898d]">No payment records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                <tr>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Payer / Guest</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Handled By & Time</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {visible.map((p) => {
                  const isPendingRefund = p.type === 'REFUND' && p.status === 'PENDING';
                  const isCompletedPayment = ['PAYMENT', 'DEPOSIT'].includes(p.type) && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(p.status);

                  return (
                    <tr key={p.id} className={`hover:bg-[#fbfcfa] transition-colors ${isPendingRefund ? 'bg-amber-500/5' : ''}`}>
                      <td className="px-5 py-4 font-mono text-[11px] font-bold text-[#a8761e]">
                        {p.reference || p.id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-[#26363e]">
                        {p.guest ? formatGuestName(p.guest) : p.description || 'General payment'}
                      </td>
                      <td className="px-5 py-4 text-[10px] font-bold text-[#667278]">{p.method || '—'}</td>
                      <td className="px-5 py-4 text-[10px] font-extrabold text-[#667278]">
                        {p.type === 'REFUND' ? 'REFUND' : p.type === 'DEPOSIT' ? 'DEPOSIT' : 'PAYMENT'}
                      </td>
                      <td className="px-5 py-4 text-[10px]">
                        <div className="font-semibold text-[#26363e] flex items-center gap-1">
                          <span>👤 {p.processorName || 'Staff'}</span>
                        </div>
                        <div className="text-[10px] text-[#899397] font-mono mt-0.5">
                          {(() => { const ts = p.processedAt || p.createdAt; return ts ? new Date(ts).toLocaleString() : '—'; })()}
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-right text-xs font-extrabold ${p.type === 'REFUND' ? 'text-red-500' : 'text-[#20343e]'}`}>
                        {p.type === 'REFUND' ? '− ' : ''}{formatCurrency(money(p.amount))}
                      </td>
                      <td className="px-5 py-4">
                        {isPendingRefund ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock size={11} /> PENDING APPROVAL
                          </span>
                        ) : (
                          statusBadge(p.status || 'PAID')
                        )}
                      </td>
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
                        ) : isAdmin || (isCompletedPayment && canRequestOrRefund) ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {isCompletedPayment && canRequestOrRefund && (
                              <Button variant="outline" size="sm" onClick={() => openRefund(p)}>
                                <Undo2 size={13} /> {isPrivileged ? 'Approve refund' : 'Request refund'}
                              </Button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                title="Delete payment record"
                                onClick={() => handleDeletePayment(p)}
                                disabled={busyId === p.id}
                                className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                              >
                                {busyId === p.id ? <Clock size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            )}
                          </div>
                        ) : (
                          '—'
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

      <Modal open={open} onClose={() => setOpen(false)} title="Record guest payment">
        <form onSubmit={save} className="space-y-4 p-6">
          <FormField label="In-house guest & room" required>
            <SelectInput value={form.stayId} onChange={(e) => handleStayChange(e.target.value)}>
              <option value="">Select in-house guest...</option>
              {stays.map((s) => {
                const f = s.reservation.folios.find((x) => x.status === 'OPEN') ?? s.reservation.folios[0];
                return (
                  <option key={s.id} value={s.id}>
                    Room {s.room?.number || '—'} · {formatGuestName(s.guest)} (Bill balance: {formatCurrency(f ? money(f.balance) : 0)})
                  </option>
                );
              })}
            </SelectInput>
          </FormField>

          {selectedStay && folio && (
            <div className="rounded-xl border border-[#dfe4df] bg-[#f7f8f6] p-4 text-xs">
              <div className="flex items-center justify-between font-bold text-[#20343e]">
                <span>Outstanding Bill Balance</span>
                <span className={balance > 0 ? 'text-[#a8761e]' : 'text-emerald-700'}>
                  {formatCurrency(balance)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#667278]">
                Folio #{folio.id.slice(0, 8)} · {folio.status} · {folio.items?.length || 0} line items
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Payment amount (GHS)" required>
              <TextInput
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Payment method" required>
              <SelectInput value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as DirectPaymentMethod })}>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </SelectInput>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Reference (Optional)">
              <TextInput value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </FormField>
            <FormField label="Description (Optional)">
              <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              <ReceiptText size={14} /> Record payment
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title={isPrivileged ? 'Approve & Issue Refund' : 'Submit Refund Request'}
      >
        <form onSubmit={submitRefund} className="space-y-4 p-6">
          <div className="rounded-xl border border-amber-200/40 bg-[#252830] p-3.5 text-xs text-[#E5D5BA]">
            <p className="font-semibold text-[#F4F4F2]">
              {isPrivileged
                ? 'Manager / Admin approval creates an immediate immutable ledger reversal.'
                : 'Receptionist Refund Request: Submitted with PENDING status for Manager/Admin review.'}
            </p>
            <p className="text-[11px] text-[#A0A5AD] mt-1">
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
              placeholder="e.g. Guest cancellation / Folio credit refund"
            />
          </FormField>

          <FormField label="Transaction / Transfer Reference (Optional)">
            <TextInput
              value={refundReference}
              onChange={(e) => setRefundReference(e.target.value)}
              placeholder="e.g. MoMo Ref / POS Auth Code"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setRefundTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              <Undo2 size={14} /> {isPrivileged ? 'Confirm & Issue Refund' : 'Submit for Manager Approval'}
            </Button>
          </div>
        </form>
      </Modal>
    </ShellPage>
  );
};

export default PaymentsPage;
