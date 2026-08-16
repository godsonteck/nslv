// ============================================
// NS LUXURY VILLA — Payments Ledger
// Record payments against in-house guests. Selecting a guest
// shows their live bill and the amount is auto-filled.
// ============================================

import React, { useEffect, useState } from 'react';
import { paymentsApi, staysApi } from '../../services/apiService';
import { CreditCard, Plus, RefreshCw, WalletCards, ReceiptText, Undo2 } from 'lucide-react';
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
        type: string;
        description: string;
        amount: number | string;
        voidedAt: string | null;
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

const money = (v: number | string | undefined | null) => Number(v ?? 0);

export const PaymentsPage: React.FC = () => {
  const [data, setData] = useState<PaymentRecord[]>([]);
  const [stays, setStays] = useState<BillStay[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<PaymentForm>({ stayId: '', amount: '', method: 'CASH', reference: '', description: '' });
  const canRefund = useAuthStore((s) => s.hasRole('admin'));

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
      openModal();
      void load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to record payment');
    } finally {
      setBusy(false);
    }
  };

  const total = data.reduce((s, p) => s + (p.type === 'REFUND' ? -money(p.amount) : money(p.amount)), 0);
  const refunds = data.filter((payment) => payment.type === 'REFUND');
  const refundedTotal = refunds.reduce((sum, payment) => sum + money(payment.amount), 0);
  const openRefund = (payment: PaymentRecord) => {
    setRefundTarget(payment); setRefundAmount(money(payment.amount).toFixed(2)); setRefundReason(''); setRefundReference('');
  };
  const submitRefund = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!refundTarget) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) return showToast('error', 'Enter a positive refund amount.');
    if (!refundReason.trim()) return showToast('error', 'A refund reason is required.');
    try {
      setBusy(true);
      await paymentsApi.refund(refundTarget.id, { amount, method: refundTarget.method as DirectPaymentMethod, reference: refundReference || undefined, reason: refundReason.trim(), idempotencyKey: crypto.randomUUID() });
      showToast('success', 'Refund approved and recorded as an immutable ledger reversal.');
      setRefundTarget(null); void load();
    } catch (error) { showToast('error', error instanceof Error ? error.message : 'Unable to issue refund'); }
    finally { setBusy(false); }
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
      title="Payments ledger"
      subtitle="A clear, auditable record of money received against real guest and property activity."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={openModal}>
            <Plus size={14} /> Record payment
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="Collected" value={formatCurrency(total)} note="Current ledger result" icon={CreditCard} accent />
        <StatTile label="Transactions" value={data.length} icon={WalletCards} />
        <StatTile label="Refunded" value={formatCurrency(refundedTotal)} note={`${refunds.length} refund${refunds.length === 1 ? '' : 's'} recorded`} icon={Undo2} />
        <StatTile label="Open stays" value={stays.length} note="Available for folio settlement" />
      </div>

      <Section title="Transaction ledger">
        <Toolbar search={q} onSearch={setQ} placeholder="Reference, guest or description…" />
        {loading ? (
          <LoadingState />
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#899397]">No payment transactions recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                <tr>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Payer</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {visible.map((p) => (
                  <tr key={p.id} className="hover:bg-[#fbfcfa]">
                    <td className="px-5 py-4 font-mono text-[11px] font-bold text-[#8d693c]">
                      {p.reference || p.id.slice(0, 8)}
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-[#26363e]">
                      {p.guest ? formatGuestName(p.guest) : p.description || 'General payment'}
                    </td>
                    <td className="px-5 py-4 text-[10px] font-bold text-[#667278]">{p.method || '—'}</td>
                    <td className="px-5 py-4 text-[10px] font-extrabold text-[#667278]">{p.type === 'REFUND' ? 'REFUND' : p.type === 'DEPOSIT' ? 'DEPOSIT' : 'PAYMENT'}</td>
                    <td className="px-5 py-4 text-[10px] text-[#899397]">
                      {(() => { const ts = p.processedAt || p.createdAt; return ts ? new Date(ts).toLocaleString() : '—'; })()}
                    </td>
                    <td className="px-5 py-4 text-right text-xs font-extrabold text-[#20343e]">
                      {p.type === 'REFUND' ? '− ' : ''}{formatCurrency(money(p.amount))}
                    </td>
                    <td className="px-5 py-4">{statusBadge(p.status || 'PAID')}</td>
                    <td className="px-5 py-4 text-right">{canRefund && ['PAYMENT', 'DEPOSIT'].includes(p.type) && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(p.status) ? <Button variant="outline" size="sm" onClick={() => openRefund(p)}><Undo2 size={13} /> Approve refund</Button> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Modal open={open} onClose={() => setOpen(false)} title="Record payment" size="lg">
        <form onSubmit={save} className="space-y-4 p-6">
          <FormField label="In-house guest" required>
            <SelectInput required value={form.stayId} onChange={(e) => handleStayChange(e.target.value)}>
              <option value="">Select a guest stay…</option>
              {stays.map((s) => (
                <option key={s.id} value={s.id}>
                  Room {s.room?.number || '—'} · {formatGuestName(s.guest, 'Guest')}
                </option>
              ))}
            </SelectInput>
          </FormField>

          {selectedStay && (
            <div className="rounded-xl border border-[#e3e8e4] bg-[#f7faf8]">
              <div className="flex items-center justify-between border-b border-[#e3e8e4] px-4 py-3">
                <div className="flex items-center gap-2">
                  <WalletCards size={14} className="text-[#2d8a68]" />
                  <span className="text-[11px] font-extrabold text-[#26363e]">
                    Guest bill · Room {selectedStay.room?.number || '—'}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-[#20343e]">{statusBadge(folio?.status || '—')}</span>
              </div>
              {folio && folio.items.length > 0 ? (
                <div className="divide-y divide-[#edf0ed]">
                  {folio.items
                    .filter((i) => !i.voidedAt)
                    .map((i) => (
                      <div key={i.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-[#26363e]">{i.description}</div>
                          <div className="text-[10px] text-[#8a9598]">
                            {i.type === 'PAYMENT' ? 'Payment applied' : i.type}
                          </div>
                        </div>
                        <span
                          className={`ml-3 shrink-0 text-[11px] font-extrabold ${
                            money(i.amount) < 0 ? 'text-[#2d8a68]' : 'text-[#26363e]'
                          }`}
                        >
                          {money(i.amount) < 0 ? '− ' : ''}
                          {formatCurrency(Math.abs(money(i.amount)))}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="px-4 py-4 text-[11px] text-[#8a9598]">No charges on this bill yet.</div>
              )}
              <div className="flex items-center justify-between border-t border-[#e3e8e4] px-4 py-3">
                <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#7d898d]">Balance due</span>
                <strong className="text-lg text-[#20343e]">{formatCurrency(balance)}</strong>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Amount (GHS)" required>
              <TextInput
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                disabled={!selectedStay}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder={selectedStay ? 'Auto-filled from the bill' : 'Select a guest first'}
              />
            </FormField>
            <FormField label="Method" required>
              <SelectInput value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as DirectPaymentMethod })}>
                <option>CASH</option>
                <option>CARD</option>
                <option>MOBILE_MONEY</option>
                <option>BANK_TRANSFER</option>
                <option>BANK_TRANSFER</option>
              </SelectInput>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Reference">
              <TextInput value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </FormField>
            <FormField label="Description">
              <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!selectedStay || !folio}>
              <ReceiptText size={14} /> Record payment
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!refundTarget} onClose={() => setRefundTarget(null)} title="Approve refund">
        <form onSubmit={submitRefund} className="space-y-4 p-6">
          <p className="rounded-xl bg-[#fdf4e8] p-3 text-xs text-[#6a4d26]">Admin approval creates an immutable reversal; it never edits the original payment. The server prevents over-refunds.</p>
          <FormField label="Refund amount (GHS)" required><TextInput required type="number" min="0.01" step="0.01" max={refundTarget ? money(refundTarget.amount) : undefined} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} /></FormField>
          <FormField label="Reason" required><TextInput required value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason for refund" /></FormField>
          <FormField label="Refund reference"><TextInput value={refundReference} onChange={(e) => setRefundReference(e.target.value)} /></FormField>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setRefundTarget(null)}>Cancel</Button><Button type="submit" loading={busy}><Undo2 size={14} /> Approve refund</Button></div>
        </form>
      </Modal>
    </ShellPage>
  );
};

export default PaymentsPage;
