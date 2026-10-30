// ============================================
// NS LUXURY VILLA — Guest Bills & Live Folios
// Front Desk: View, inspect and print in-house guest folios
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  ReceiptText,
  Printer,
  WalletCards,
  UserRound,
  Eye,
  CheckCircle2,
  Clock,
  Search,
  BedDouble,
  CreditCard,
  Building,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Button, Modal, LoadingState, showToast, statusBadge, FormField, TextInput, SelectInput } from '../../components/ui';
import { staysApi, foliosApi, paymentsApi } from '../../services/apiService';
import { formatCurrency, formatGuestName } from '@nslv/shared';
import { villaAssets } from '../../assets';
import { receiptCompanyBlock } from '../../lib/company';

interface BillStay {
  id: string;
  isCheckedOut?: boolean;
  finalBalance?: number;
  actualCheckOut?: string;
  checkedOutDate?: string;
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
  guest: { firstName: string; lastName?: string | null; id?: string } | null;
  room: { number: string | number; roomType?: { name?: string } } | null;
  actualCheckIn: string;
  reservation: {
    id: string;
    confirmationNo?: string;
    status: string;
    folios: Array<{
      id: string;
      status: string;
      balance: number | string;
      items: Array<{
        id: string;
        type: string;
        description: string;
        amount: number | string;
        quantity: number;
        unitPrice: number | string;
        department: string;
        postedAt: string;
        voidedAt: string | null;
      }>;
      payments: Array<{
        id: string;
        amount: number | string;
        method: string;
        processedAt: string;
      }>;
    }>;
  };
}

const money = (v: number | string | undefined | null) => Number(v ?? 0);

export const computeBillSummary = (stay: BillStay, folio: any) => {
  const isCheckedOut = Boolean(stay.isCheckedOut || stay.reservation?.status === 'CHECKED_OUT');
  const actualCheckOut = stay.actualCheckOut || (stay as any).checkedOutDate || (stay as any).reservation?.checkOutDate;

  // 1. Valid Payments
  const rawPayments = folio?.payments || [];
  const validPayments = rawPayments.filter(
    (p: any) => (!p.status || p.status === 'COMPLETED') && !p.voidedAt && p.type !== 'REFUND',
  );
  const totalPaid = stay.totalPaid !== undefined ? Number(stay.totalPaid) : validPayments.reduce((s: number, p: any) => s + money(p.amount), 0);

  // Method breakdown
  let cashPaid = stay.cashPaid !== undefined ? Number(stay.cashPaid) : 0;
  let momoPaid = stay.momoPaid !== undefined ? Number(stay.momoPaid) : 0;
  let cardPaid = stay.cardPaid !== undefined ? Number(stay.cardPaid) : 0;
  let bankPaid = stay.bankPaid !== undefined ? Number(stay.bankPaid) : 0;

  if (stay.cashPaid === undefined && validPayments.length) {
    for (const p of validPayments) {
      const amt = money(p.amount);
      const m = String(p.method).toUpperCase();
      if (m === 'CASH') cashPaid += amt;
      else if (m === 'MOBILE_MONEY' || m === 'MOMO') momoPaid += amt;
      else if (m === 'CARD') cardPaid += amt;
      else if (m === 'BANK_TRANSFER') bankPaid += amt;
    }
  }

  // 2. Paid by Checkout
  const checkoutTime = actualCheckOut ? new Date(actualCheckOut).getTime() : null;
  const paidAtCheckout = stay.paidAtCheckout !== undefined
    ? Number(stay.paidAtCheckout)
    : checkoutTime
    ? validPayments.filter((p: any) => new Date(p.processedAt || p.createdAt).getTime() <= checkoutTime + 5000).reduce((s: number, p: any) => s + money(p.amount), 0)
    : totalPaid;

  // 3. Charges posted to folio
  const items = (folio?.items || []).filter(
    (i: any) => !i.voidedAt && !['PAYMENT', 'DEPOSIT'].includes(String(i.type).toUpperCase()),
  );
  const chargesSum = items.reduce((s: number, i: any) => s + money(i.amount), 0);
  const lateFeeItems = items.filter(
    (i: any) => i.referenceType === 'CHECKOUT' || /late checkout/i.test(i.description || ''),
  );
  const lateFeeAmount = lateFeeItems.reduce((s: number, i: any) => s + money(i.amount), 0);
  const baseRoomAmount = (stay as any).baseRoomAmount !== undefined
    ? Number((stay as any).baseRoomAmount)
    : money((stay as any).reservation?.totalAmount);

  // 4. Total Billed (Supposed to Pay)
  let totalBilled = chargesSum > 0
    ? chargesSum
    : stay.totalBilled !== undefined
    ? Number(stay.totalBilled)
    : Math.max(totalPaid, baseRoomAmount + lateFeeAmount);

  // 5. Current Balance Owed (Reconciled)
  // Must ALWAYS satisfy: totalBilled = totalPaid + balance
  let balance = stay.currentOwed !== undefined && chargesSum === 0
    ? Number(stay.currentOwed)
    : Math.max(0, Number((totalBilled - totalPaid).toFixed(2)));

  totalBilled = Math.max(totalBilled, totalPaid + balance);
  if (totalPaid >= totalBilled) {
    balance = 0;
  }

  return {
    isCheckedOut,
    actualCheckOut,
    totalBilled,
    paidAtCheckout,
    totalPaid,
    cashPaid,
    momoPaid,
    cardPaid,
    bankPaid,
    balance,
    baseRoomAmount,
    lateFeeAmount,
    hasLateCheckout: lateFeeAmount > 0,
  };
};

export const GuestBillsPage: React.FC = () => {
  const [stays, setStays] = useState<BillStay[]>([]);
  const [unsettledStays, setUnsettledStays] = useState<BillStay[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'IN_HOUSE' | 'CHECKED_OUT'>('ALL');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Selected Bill for Modal View
  const [selectedBill, setSelectedBill] = useState<{ stay: BillStay; folio: any } | null>(null);
  const [loadingFolio, setLoadingFolio] = useState(false);

  // Quick Payment Modal from Bill
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER'>('CASH');
  const [payRef, setPayRef] = useState('');
  const [payDesc, setPayDesc] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, unsettledRes] = await Promise.all([
        staysApi.getActiveStays(),
        staysApi.getUnsettledStays().catch(() => ({ success: true, data: [] })),
      ]);
      setStays(res.data || []);
      setUnsettledStays(unsettledRes.data || []);
    } catch (e: any) {
      showToast('error', e?.message ?? 'Unable to load guest bills.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openFolios = useMemo(() => {
    const active = stays.map((s) => ({
      stay: s,
      folio: s.reservation.folios.find((f) => f.status === 'OPEN') ?? s.reservation.folios[0],
      isCheckedOut: false,
    }));
    const unsettled = unsettledStays.map((s) => ({
      stay: s,
      folio: s.reservation.folios.find((f) => Number(f.balance) > 0.005) ?? s.reservation.folios[0],
      isCheckedOut: true,
    }));
    const combined = filterTab === 'IN_HOUSE' ? active : filterTab === 'CHECKED_OUT' ? unsettled : [...active, ...unsettled];
    return combined.filter((x) => !!x.folio);
  }, [stays, unsettledStays, filterTab]);

  const outstandingTotal = useMemo(
    () => openFolios.reduce((sum, x) => sum + money(x.folio.balance), 0),
    [openFolios],
  );

  const visible = openFolios.filter((x) => {
    if (!q) return true;
    const query = q.toLowerCase();
    const guestName = formatGuestName(x.stay.guest, '').toLowerCase();
    const room = String(x.stay.room?.number ?? '');
    return guestName.includes(query) || room.includes(query);
  });

  const openBillModal = async (stay: BillStay, folio: any) => {
    setSelectedBill({ stay, folio });
    try {
      setLoadingFolio(true);
      const res = await foliosApi.getFolio(folio.id);
      if (res.data || res) {
        setSelectedBill({ stay, folio: res.data || res });
      }
    } catch {
      // Retain existing folio data if live reload fails
    } finally {
      setLoadingFolio(false);
    }
  };

  const openPaymentModal = () => {
    if (!selectedBill) return;
    const bal = money(selectedBill.folio.balance);
    setPayAmount(bal > 0 ? bal.toFixed(2) : '');
    setPayMethod('CASH');
    setPayRef('');
    const chargeItems = (selectedBill.folio.items || []).filter(
      (i: any) => !i.voidedAt && !['PAYMENT', 'DEPOSIT'].includes(String(i.type).toUpperCase()) && Number(i.amount) > 0,
    );
    const itemNames = [...new Set(chargeItems.map((i: any) => i.description || i.type))];
    const defaultDesc = itemNames.length
      ? `Payment for: ${itemNames.slice(0, 3).join(', ')}${itemNames.length > 3 ? ` + ${itemNames.length - 3} more` : ''}`
      : `Settlement for Room ${selectedBill.stay.room?.number || '—'}`;
    setPayDesc(defaultDesc);
    setPayModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('error', 'Enter a valid payment amount.');
      return;
    }
    const bal = money(selectedBill.folio.balance);
    if (amount > bal + 0.01) {
      showToast('error', `Payment cannot exceed the outstanding balance of ${formatCurrency(bal)}.`);
      return;
    }
    try {
      setPaySubmitting(true);
      const guestName = formatGuestName(selectedBill.stay.guest, 'Guest');
      const isSettled = amount >= bal - 0.005;
      const basePurpose = payDesc.trim() || 'Payment settlement';
      const desc = isSettled
        ? `${basePurpose} (Paid in full via ${payMethod}) for ${guestName}${selectedBill.stay.isCheckedOut ? ' [Post-checkout settlement]' : ''}`
        : `${basePurpose} (Part payment via ${payMethod}) for ${guestName}. Remaining: GHS ${(bal - amount).toFixed(2)}${selectedBill.stay.isCheckedOut ? ' [Post-checkout settlement]' : ''}`;

      await paymentsApi.processPayment({
        folioId: selectedBill.folio.id,
        reservationId: selectedBill.stay.reservation.id,
        amount,
        method: payMethod,
        reference: payRef.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
        description: desc,
      });

      showToast('success', 'Payment successfully recorded!');
      setPayModalOpen(false);
      // Reload folio data
      const updatedFolio = await foliosApi.getFolio(selectedBill.folio.id);
      setSelectedBill({ ...selectedBill, folio: updatedFolio.data || updatedFolio });
      void load();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to process payment.');
    } finally {
      setPaySubmitting(false);
    }
  };

  const printBill = () => {
    if (!selectedBill) return;
    const { stay, folio } = selectedBill;
    const summary = computeBillSummary(stay, folio);
    const win = window.open('', '_blank', 'width=560,height=840');
    if (!win) {
      showToast('error', 'Pop-up blocked. Please allow pop-ups to print bill.');
      return;
    }

    const items = (folio.items || [])
      .filter((i: any) => !i.voidedAt)
      .map(
        (i: any) =>
          `<tr>
            <td>${i.description}</td>
            <td style="text-align:center">${i.quantity ?? 1}</td>
            <td style="text-align:right">${formatCurrency(money(i.unitPrice || i.amount))}</td>
            <td style="text-align:right;font-weight:bold">${formatCurrency(money(i.amount))}</td>
          </tr>`,
      )
      .join('');

    const payments = (folio.payments || [])
      .map(
        (p: any) =>
          `<tr>
            <td>${p.method} Payment</td>
            <td style="text-align:center">${new Date(p.processedAt || p.createdAt).toLocaleDateString('en-GH')}</td>
            <td style="text-align:right;font-weight:bold;color:#047857">-${formatCurrency(money(p.amount))}</td>
          </tr>`,
      )
      .join('');

    const guestName = formatGuestName(stay.guest, 'Guest');
    const logoUrl = new URL(villaAssets.logo, window.location.href).href;
    const balance = summary.balance;

    const checkedOutStr = summary.actualCheckOut
      ? new Date(summary.actualCheckOut).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })
      : null;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Guest Folio · Room ${stay.room?.number ?? '—'} · ${guestName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; font-size: 11px; color: #0c1921; background: #fff; padding: 24px; max-width: 500px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #c59a58; padding-bottom: 12px; margin-bottom: 14px; }
    .logo { height: 46px; object-fit: contain; margin-bottom: 6px; }
    .title { font-family: 'Cinzel', serif; font-size: 16px; font-weight: 800; color: #0c1921; letter-spacing: 1px; }
    .sub { font-size: 10px; font-weight: 700; color: #c59a58; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    .company { font-size: 9px; color: #5a6b75; margin-top: 3px; }
    .meta-card { background: #fcf9f2; border: 1px solid #e7d8bc; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10.5px; }
    .lbl { color: #71828a; font-weight: 600; text-transform: uppercase; font-size: 8.5px; }
    .val { font-weight: 700; color: #0c1921; }
    .audit-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin: 14px 0; }
    .audit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; font-size: 10.5px; }
    .audit-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; }
    .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-emerald { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
    th { background: #0c1921; color: #fcf9f2; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; font-weight: 700; }
    td { padding: 5px 8px; border-bottom: 1px solid #edf2f2; }
    .section-title { font-size: 10.5px; font-weight: 800; color: #0c1921; text-transform: uppercase; letter-spacing: 0.5px; margin: 14px 0 4px; }
    .total-card { border-top: 2px solid #0c1921; border-bottom: 2px solid #0c1921; padding: 10px 0; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; }
    .total-card .lbl { font-size: 11px; font-weight: 800; color: #0c1921; }
    .total-card .amt { font-size: 16px; font-weight: 900; color: ${balance > 0.005 ? '#b91c1c' : '#047857'}; }
    .footer { text-align: center; font-size: 9px; color: #71828a; margin-top: 20px; padding-top: 10px; border-top: 1px dashed #cbd5e1; }
    .btn { display: block; width: 100%; padding: 10px; background: #0c1921; color: #fff; border: none; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; margin-top: 14px; }
    @media print { .btn { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="NS Luxury Villa" class="logo" onerror="this.style.display='none'"/>
    <div class="title">NS LUXURY VILLA</div>
    <div class="sub">${summary.isCheckedOut ? 'Departure Settlement Folio' : 'Official Guest Room Folio'}</div>
    <div class="company">Lokoe, Ho, Volta Region, Ghana | Tel: +233 535 572 774</div>
  </div>

  <div class="meta-card">
    <div class="grid">
      <div><div class="lbl">Room & Guest</div><div class="val">Room ${stay.room?.number ?? '—'} (${stay.room?.roomType?.name || 'Suite'}) · ${guestName}</div></div>
      <div><div class="lbl">Folio Reference</div><div class="val" style="font-family:monospace">${folio.id.slice(0, 8).toUpperCase()}</div></div>
      <div><div class="lbl">Checked In</div><div class="val">${new Date(stay.actualCheckIn).toLocaleDateString('en-GH')}</div></div>
      <div>
        <div class="lbl">${summary.isCheckedOut ? 'Checked Out On' : 'Account Status'}</div>
        <div class="val">${checkedOutStr ? `<span class="badge badge-amber">Checked Out: ${checkedOutStr}</span>` : '<span class="badge badge-emerald">In-House</span>'}</div>
      </div>
    </div>
  </div>

  <!-- Financial Audit Summary: Supposed to pay, Paid by checkout, Total paid (Cash/MoMo), Balance -->
  <div class="audit-card">
    <div style="font-size:9.5px;font-weight:800;color:#0c1921;text-transform:uppercase;letter-spacing:0.5px;">Departure & Settlement Summary</div>
    <div class="audit-grid">
      <div class="audit-item">
        <div class="lbl">Supposed to Pay (Total Bill)</div>
        <div class="val" style="font-size:12px;font-family:monospace;">${formatCurrency(summary.totalBilled)}</div>
      </div>
      <div class="audit-item">
        <div class="lbl">${summary.isCheckedOut ? 'Paid by Checkout' : 'Paid at Check-in'}</div>
        <div class="val" style="font-size:12px;font-family:monospace;color:#047857;">${formatCurrency(summary.paidAtCheckout)}</div>
      </div>
      <div class="audit-item">
        <div class="lbl">Total Paid to Date</div>
        <div class="val" style="font-size:12px;font-family:monospace;color:#047857;">${formatCurrency(summary.totalPaid)}</div>
        <div style="font-size:8.5px;color:#475569;margin-top:2px;">
          ${summary.cashPaid > 0 ? `💵 Cash: ${formatCurrency(summary.cashPaid)} ` : ''}
          ${summary.momoPaid > 0 ? `📱 MoMo: ${formatCurrency(summary.momoPaid)} ` : ''}
          ${summary.cardPaid > 0 ? `💳 Card: ${formatCurrency(summary.cardPaid)} ` : ''}
          ${summary.bankPaid > 0 ? `🏦 Bank: ${formatCurrency(summary.bankPaid)} ` : ''}
          ${summary.totalPaid === 0 ? 'No payments recorded' : ''}
        </div>
      </div>
      <div class="audit-item" style="border-color:${balance > 0.005 ? '#fca5a5' : '#86efac'};background:${balance > 0.005 ? '#fef2f2' : '#f0fdf4'};">
        <div class="lbl" style="color:${balance > 0.005 ? '#b91c1c' : '#15803d'};">Guest Owes</div>
        <div class="val" style="font-size:13px;font-family:monospace;color:${balance > 0.005 ? '#b91c1c' : '#15803d'};">${formatCurrency(balance)}</div>
      </div>
    </div>
  </div>

  <div class="section-title">Department Charges & Services</div>
  ${items ? `<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>${items}</tbody></table>` : '<div style="font-size:10.5px;color:#71828a;padding:6px 0">No posted charges on record.</div>'}

  ${payments ? `<div class="section-title">Recorded Payments & Settlements</div><table><thead><tr><th>Method</th><th style="text-align:center">Date</th><th style="text-align:right">Amount</th></tr></thead><tbody>${payments}</tbody></table>` : ''}

  <div class="total-card">
    <div class="lbl">FINAL BALANCE OWED:</div>
    <div class="amt">${formatCurrency(balance)}</div>
  </div>

  <div class="footer">
    Thank you for staying at NS Luxury Villa, Lokoe, Ho, Ghana<br/>
    Check-in: 2:00 PM | Check-out: 12:00 PM
  </div>

  <button class="btn" onclick="window.print()">&#128438; Print Guest Folio</button>
</body>
</html>`);

    win.document.close();
  };

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-300">
      {/* Compact Header */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <ReceiptText size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>Guest Bills &amp; Folios</h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Live room accounts for in-house guests</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 border-[var(--ns-glass-line)] ns-glass-hover">
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>
      {/* KPI Ribbon */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>In-House Guests</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{stays.length}</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Open Folios</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{openFolios.length}</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Total Balance Due</div>
          <div className="text-xl font-black mt-0.5" style={{ color: outstandingTotal > 0 ? 'var(--ns-warning)' : 'var(--ns-ink)' }}>{formatCurrency(outstandingTotal)}</div>
        </div>
      </div>

      {/* ── Table Section ── */}
      <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-[var(--ns-glass-line)] p-4 sm:flex-row sm:items-center sm:justify-between ns-glass-band">
          <div className="flex items-center gap-2">
            <ReceiptText size={14} className="text-[var(--ns-teal)]" />
            <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Guest Room Folios</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--ns-glass-line)] glass-subtle p-1">
              <button
                type="button"
                onClick={() => setFilterTab('ALL')}
                className={`glass-subtle ns-glass-hover rounded-lg px-3 py-1.5 text-xs font-bold transition ${filterTab === 'ALL' ? 'glass text-[var(--ns-teal)] shadow-sm ns-glass-selected' : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'}`}
              >
                All ({stays.length + unsettledStays.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('IN_HOUSE')}
                className={`glass-subtle ns-glass-hover rounded-lg px-3 py-1.5 text-xs font-bold transition ${filterTab === 'IN_HOUSE' ? 'glass text-[var(--ns-teal)] shadow-sm ns-glass-selected' : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'}`}
              >
                In-House ({stays.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('CHECKED_OUT')}
                className={`glass-subtle ns-glass-hover rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${filterTab === 'CHECKED_OUT' ? 'glass text-[var(--ns-ink)] shadow-sm font-black ns-glass-selected' : unsettledStays.length > 0 ? 'text-[var(--ns-warning)] font-extrabold glass' : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'}`}
              >
                Checked Out ({unsettledStays.length})
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ns-muted)]" size={13} />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search guest or room…"
                className="w-full rounded-lg border border-[var(--ns-glass-line)] glass-input py-1.5 pl-7 pr-3 text-[11px] font-medium text-[var(--ns-ink)] placeholder-[var(--ns-muted)] focus:border-[var(--ns-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--ns-gold)]"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12"><LoadingState /></div>
        ) : visible.length === 0 ? (
          <div className="p-16 text-center text-xs text-[var(--ns-muted)]">
            {stays.length === 0 ? 'No guests are currently checked in.' : 'No in-house guest accounts match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--ns-glass-line)] ns-glass-band text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                  <th className="py-3 px-4">Room &amp; Guest</th>
                  <th className="py-3 px-4">Checkout / Status</th>
                  <th className="py-3 px-4 text-right">Supposed to Pay</th>
                  <th className="py-3 px-4 text-right">Paid by Then</th>
                  <th className="py-3 px-4">Paid &amp; Method (Cash / MoMo)</th>
                  <th className="py-3 px-4 text-right">Guest Owes</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-glass-line)]">
                {visible.map(({ stay, folio }) => {
                  const summary = computeBillSummary(stay, folio);

                  return (
                    <tr
                      key={stay.id}
                      onClick={() => openBillModal(stay, folio)}
                      className="cursor-pointer ns-glass-hover transition-colors"
                    >
                      {/* Room & Guest */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg glass-subtle font-mono text-xs font-black text-[var(--ns-gold)]">
                            {stay.room?.number ?? '—'}
                          </span>
                          <div>
                            <div className="font-bold text-[var(--ns-ink)] text-xs flex items-center gap-1.5 flex-wrap">
                              <span>{formatGuestName(stay.guest, 'Guest')}</span>
                              <span className="text-[10px] text-[var(--ns-muted)] font-normal">
                                ({stay.room?.roomType?.name || 'Room'})
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-[var(--ns-gold)]">
                              Folio #{folio.id.slice(0, 8).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Checkout / Status */}
                      <td className="py-3.5 px-4">
                        {summary.isCheckedOut ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 rounded glass-subtle text-[var(--ns-warning)] border border-[var(--ns-warning)] text-[10px] font-black uppercase px-2 py-0.2">
                              Checked Out
                            </span>
                            <div className="text-[10.5px] font-semibold text-[var(--ns-ink)]">
                              {summary.actualCheckOut ? new Date(summary.actualCheckOut).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date recorded'}
                            </div>
                            <div className="text-[9.5px] text-[var(--ns-muted)]">
                              {summary.actualCheckOut ? new Date(summary.actualCheckOut).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 rounded glass-subtle text-[var(--ns-success)] border border-[var(--ns-success)] text-[10px] font-black uppercase px-2 py-0.2">
                              In-House Stay
                            </span>
                            <div className="text-[10px] text-[var(--ns-muted)]">
                              Since {new Date(stay.actualCheckIn).toLocaleDateString('en-GH')}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Supposed to Pay (Total Bill) */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono text-xs font-black text-[var(--ns-ink)]">
                          {formatCurrency(summary.totalBilled)}
                        </div>
                        <div className="text-[9.5px] text-[var(--ns-muted)]">Total folio bill</div>
                      </td>

                      {/* Paid by Then */}
                      <td className="py-3.5 px-4 text-right">
                        {summary.isCheckedOut ? (
                          <>
                            <div className="font-mono text-xs font-bold text-[var(--ns-ink)]">
                              {formatCurrency(summary.paidAtCheckout)}
                            </div>
                            <div className="text-[9.5px] text-[var(--ns-muted)]">At departure</div>
                          </>
                        ) : (
                          <>
                            <div className="font-mono text-xs font-bold text-[var(--ns-ink)]">
                              {formatCurrency(summary.totalPaid)}
                            </div>
                            <div className="text-[9.5px] text-[var(--ns-muted)]">Paid to date</div>
                          </>
                        )}
                      </td>

                      {/* Paid & Method (Cash / MoMo) */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-bold text-[var(--ns-success)] mb-1">
                          {formatCurrency(summary.totalPaid)} <span className="text-[9.5px] text-[var(--ns-muted)] font-normal">total</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {summary.cashPaid > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded glass-subtle px-1.5 py-0.5 text-[9.5px] font-extrabold text-[var(--ns-success)] border border-[var(--ns-success)]">
                              💵 Cash {formatCurrency(summary.cashPaid)}
                            </span>
                          )}
                          {summary.momoPaid > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded glass-subtle px-1.5 py-0.5 text-[9.5px] font-extrabold text-[var(--ns-warning)] border border-[var(--ns-warning)]">
                              📱 MoMo {formatCurrency(summary.momoPaid)}
                            </span>
                          )}
                          {summary.cardPaid > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded glass-subtle px-1.5 py-0.5 text-[9.5px] font-extrabold text-[var(--ns-info)] border border-[var(--ns-info)]">
                              💳 Card {formatCurrency(summary.cardPaid)}
                            </span>
                          )}
                          {summary.bankPaid > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded glass-subtle px-1.5 py-0.5 text-[9.5px] font-extrabold text-[var(--ns-purple)] border border-[var(--ns-purple)]">
                              🏦 Bank {formatCurrency(summary.bankPaid)}
                            </span>
                          )}
                          {summary.totalPaid === 0 && (
                            <span className="text-[10px] text-[var(--ns-muted)] italic">No payments yet</span>
                          )}
                        </div>
                      </td>

                      {/* What Guest Owes */}
                      <td className="py-3.5 px-4 text-right">
                        {summary.balance > 0.005 ? (
                          <>
                            <div className="font-mono text-sm font-black text-[var(--ns-danger)]">
                              {formatCurrency(summary.balance)}
                            </div>
                            <div className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--ns-danger)]">
                              Owes balance
                            </div>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md glass-subtle px-2 py-0.5 text-[10px] font-bold text-[var(--ns-success)] border border-[var(--ns-success)]">
                            <CheckCircle2 size={10} /> Fully Settled
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {summary.balance > 0.005 && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedBill({ stay, folio });
                                setPayAmount(summary.balance.toFixed(2));
                                setPayMethod('CASH');
                                setPayRef('');
                                setPayDesc(`Payment for outstanding balance (Room ${stay.room?.number || '—'})`);
                                setPayModalOpen(true);
                              }}
                              className="h-8 gap-1 glass ns-glass-hover text-[var(--ns-success)] text-xs font-bold"
                            >
                              <CreditCard size={12} /> Pay
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openBillModal(stay, folio)}
                            className="h-8 gap-1 border-[var(--ns-glass-line)] text-xs font-semibold text-[var(--ns-ink)] ns-glass-hover"
                          >
                            <ReceiptText size={13} className="text-[var(--ns-gold)]" /> View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Guest Bill Modal ── */}
      <Modal
        open={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        title={
          selectedBill
            ? `Guest Bill · Room ${selectedBill.stay.room?.number ?? '—'} (${formatGuestName(selectedBill.stay.guest, 'Guest')})`
            : 'Guest Bill'
        }
      >
        {selectedBill && (() => {
          const summary = computeBillSummary(selectedBill.stay, selectedBill.folio);
          return (
          <div className="space-y-4">
            {/* Header info & Departure Audit */}
            <div className="rounded-2xl border border-[var(--ns-glass-line)] glass p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ns-glass-line)] pb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-gold)]">
                    Folio #{selectedBill.folio.id.slice(0, 8).toUpperCase()}
                  </span>
                  <div className="text-base font-black text-[var(--ns-ink)]">
                    Room {selectedBill.stay.room?.number ?? '—'} · {formatGuestName(selectedBill.stay.guest, 'Guest')}
                  </div>
                  <div className="text-[11px] text-[var(--ns-muted)]">
                    Checked in: {new Date(selectedBill.stay.actualCheckIn).toLocaleDateString('en-GH')}
                  </div>
                </div>
                <div className="text-right">
                  {summary.isCheckedOut ? (
                    <div className="inline-flex flex-col items-end">
                      <span className="inline-flex items-center gap-1 rounded-full glass-subtle px-2.5 py-1 text-xs font-black text-[var(--ns-warning)] border border-[var(--ns-warning)]">
                        <AlertCircle size={13} /> Checked Out
                      </span>
                      {summary.actualCheckOut && (
                        <span className="text-[10.5px] font-semibold text-[var(--ns-warning)] mt-1">
                          {new Date(summary.actualCheckOut).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full glass-subtle px-2.5 py-1 text-xs font-bold text-[var(--ns-success)] border border-[var(--ns-success)]">
                      <CheckCircle2 size={13} /> In-House
                    </span>
                  )}
                </div>
              </div>

              {/* 4 Financial Audit Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="rounded-xl border border-[var(--ns-glass-line)] glass-subtle p-2.5">
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] block">
                    Supposed to Pay
                  </span>
                  <div className="font-mono text-sm font-black text-[var(--ns-ink)] mt-0.5">
                    {formatCurrency(summary.totalBilled)}
                  </div>
                  <span className="text-[9px] text-[var(--ns-muted)]">Total bill charges</span>
                </div>

                <div className="rounded-xl border border-[var(--ns-glass-line)] glass-subtle p-2.5">
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] block">
                    {summary.isCheckedOut ? 'Paid by Checkout' : 'Paid at Check-in'}
                  </span>
                  <div className="font-mono text-sm font-black text-[var(--ns-success)] mt-0.5">
                    {formatCurrency(summary.paidAtCheckout)}
                  </div>
                  <span className="text-[9px] text-[var(--ns-muted)]">
                    {summary.isCheckedOut ? 'At departure time' : 'Initial settlement'}
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--ns-glass-line)] glass-subtle p-2.5">
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] block">
                    Total Paid to Date
                  </span>
                  <div className="font-mono text-sm font-black text-[var(--ns-success)] mt-0.5">
                    {formatCurrency(summary.totalPaid)}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {summary.cashPaid > 0 && (
                      <span className="rounded glass-subtle px-1 py-0.2 text-[9px] font-extrabold text-[var(--ns-success)]">
                        💵 Cash {formatCurrency(summary.cashPaid)}
                      </span>
                    )}
                    {summary.momoPaid > 0 && (
                      <span className="rounded glass-subtle px-1 py-0.2 text-[9px] font-extrabold text-[var(--ns-warning)]">
                        📱 MoMo {formatCurrency(summary.momoPaid)}
                      </span>
                    )}
                    {summary.cardPaid > 0 && (
                      <span className="rounded glass-subtle px-1 py-0.2 text-[9px] font-extrabold text-[var(--ns-info)]">
                        💳 Card {formatCurrency(summary.cardPaid)}
                      </span>
                    )}
                    {summary.bankPaid > 0 && (
                      <span className="rounded glass-subtle px-1 py-0.2 text-[9px] font-extrabold text-[var(--ns-purple)]">
                        🏦 Bank {formatCurrency(summary.bankPaid)}
                      </span>
                    )}
                    {summary.totalPaid === 0 && (
                      <span className="text-[9px] text-[var(--ns-muted)] italic">No payments</span>
                    )}
                  </div>
                </div>

                <div className={`rounded-xl border p-2.5 ${summary.balance > 0.005 ? 'border-[var(--ns-danger)] glass-subtle' : 'border-[var(--ns-success)] glass-subtle'}`}>
                  <span className={`text-[9.5px] font-extrabold uppercase tracking-wider block ${summary.balance > 0.005 ? 'text-[var(--ns-danger)]' : 'text-[var(--ns-success)]'}`}>
                    Guest Owes
                  </span>
                  <div className={`font-mono text-sm font-black mt-0.5 ${summary.balance > 0.005 ? 'text-[var(--ns-danger)]' : 'text-[var(--ns-success)]'}`}>
                    {formatCurrency(summary.balance)}
                  </div>
                  <span className={`text-[9px] font-semibold ${summary.balance > 0.005 ? 'text-[var(--ns-danger)]' : 'text-[var(--ns-success)]'}`}>
                    {summary.balance > 0.005 ? 'Outstanding balance' : 'Fully settled'}
                  </span>
                </div>
              </div>

              {selectedBill.stay.checkOutNotes && (
                <div className="rounded-lg glass-subtle border border-[var(--ns-warning)] px-3 py-1.5 text-[11px] text-[var(--ns-warning)]">
                  <span className="font-bold">Checkout Remark:</span> {selectedBill.stay.checkOutNotes}
                </div>
              )}
            </div>

            {/* Charges List */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ns-ink)]">
                  Department Charges & Room Services
                </h4>
                <span className="text-[11px] text-[var(--ns-muted)]">
                  {(selectedBill.folio.items || []).filter((i: any) => !i.voidedAt).length} item(s)
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-[var(--ns-glass-line)] glass-subtle">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--ns-glass-line)] ns-glass-band text-[10px] font-extrabold uppercase text-[var(--ns-muted)]">
                      <th className="py-2 px-3">Item / Description</th>
                      <th className="py-2 px-3">Dept</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ns-glass-line)]">
                    {(selectedBill.folio.items || [])
                      .filter((i: any) => !i.voidedAt)
                      .map((i: any) => (
                        <tr key={i.id} className="ns-glass-hover">
                          <td className="py-2 px-3 font-medium text-[var(--ns-ink)]">{i.description}</td>
                          <td className="py-2 px-3 text-[10px] font-semibold text-[var(--ns-muted)]">{i.department || 'ROOM'}</td>
                          <td className="py-2 px-3 text-center font-mono">{i.quantity ?? 1}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[var(--ns-ink)]">
                            {formatCurrency(money(i.amount))}
                          </td>
                        </tr>
                      ))}
                    {(selectedBill.folio.items || []).filter((i: any) => !i.voidedAt).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-[var(--ns-muted)]">
                          No posted charges on record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments List */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ns-ink)]">
                  Recorded Payments & Deposits
                </h4>
                <span className="text-[11px] text-[var(--ns-muted)]">
                  {(selectedBill.folio.payments || []).length} payment(s)
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--ns-glass-line)] glass-subtle">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--ns-glass-line)] ns-glass-band text-[10px] font-extrabold uppercase text-[var(--ns-muted)]">
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ns-glass-line)]">
                    {(selectedBill.folio.payments || []).map((p: any) => (
                      <tr key={p.id} className="ns-glass-hover">
                        <td className="py-2 px-3 font-semibold text-[var(--ns-ink)]">{p.method}</td>
                        <td className="py-2 px-3 text-[var(--ns-muted)] text-[11px]">
                          {new Date(p.processedAt || p.createdAt).toLocaleDateString('en-GH')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[var(--ns-success)]">
                          -{formatCurrency(money(p.amount))}
                        </td>
                      </tr>
                    ))}
                    {(selectedBill.folio.payments || []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-[var(--ns-muted)]">
                          No payments recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-[var(--ns-glass-line)]">
              <Button variant="ghost" size="sm" onClick={() => setSelectedBill(null)}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                {money(selectedBill.folio.balance) > 0.005 && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={openPaymentModal}
                    className="gap-1.5 glass ns-glass-hover text-[var(--ns-success)] font-bold"
                  >
                    <CreditCard size={14} /> Record Payment
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={printBill}
                  className="gap-1.5 border-[var(--ns-glass-line)] text-[var(--ns-ink)] font-semibold ns-glass-hover"
                >
                  <Printer size={14} className="text-[var(--ns-gold)]" /> Print Folio
                </Button>
              </div>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* Quick Payment Settlement Modal */}
      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Record Payment Against Folio" size="md">
        {selectedBill && (
          <form onSubmit={handleRecordPayment} className="space-y-4 p-5">
            <div className="rounded-xl border border-[var(--ns-warning)] glass-subtle p-3 text-xs">
              <div className="font-bold text-[var(--ns-warning)]">
                {formatGuestName(selectedBill.stay.guest, 'Guest')} · Room {selectedBill.stay.room?.number || '—'}
                {selectedBill.stay.isCheckedOut && (
                  <span className="ml-2 rounded glass-subtle text-[var(--ns-warning)] px-1.5 py-0.5 text-[10px]">
                    CHECKED OUT
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-[var(--ns-ink)]">
                <span>Current Folio Balance:</span>
                <span className="font-black text-[var(--ns-warning)] text-sm">
                  {formatCurrency(money(selectedBill.folio.balance))}
                </span>
              </div>
            </div>

            {/* Folio Charges Allocation Preview */}
            {selectedBill.folio.items && (
              <div className="rounded-xl border border-[var(--ns-info)] glass-subtle p-3 text-xs space-y-1">
                <div className="font-bold text-[var(--ns-info)] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-[var(--ns-info)]" />
                  What this money settles (Folio items)
                </div>
                <div className="text-[11px] text-[var(--ns-info)] flex flex-wrap gap-1.5 pt-1">
                  {(selectedBill.folio.items || [])
                    .filter((i: any) => !i.voidedAt && !['PAYMENT', 'DEPOSIT'].includes(String(i.type).toUpperCase()) && Number(i.amount) > 0)
                    .map((i: any) => (
                      <span key={i.id} className="rounded glass-subtle px-2 py-0.5 border border-[var(--ns-info)] font-medium text-[10.5px]">
                        {i.description || i.type} ({formatCurrency(money(i.amount))})
                      </span>
                    ))}
                </div>
              </div>
            )}

            <FormField label="Payment For / Purpose (What the money is for)" required>
              <TextInput
                value={payDesc}
                onChange={(e) => setPayDesc(e.target.value)}
                placeholder="e.g. Payment for: Room Accommodation, Late checkout fee"
              />
              <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                <span className="text-[9.5px] text-[var(--ns-muted)] self-center font-bold">Quick set:</span>
                <button
                  type="button"
                  onClick={() => setPayDesc('Payment for Late checkout fee')}
                  className="rounded glass ns-glass-hover text-[var(--ns-warning)] border border-[var(--ns-warning)] px-1.5 py-0.5 font-bold transition"
                >
                  ⏱ Late Checkout
                </button>
                <button
                  type="button"
                  onClick={() => setPayDesc('Payment for Room Accommodation / Stay')}
                  className="rounded glass ns-glass-hover text-[var(--ns-info)] border border-[var(--ns-info)] px-1.5 py-0.5 font-bold transition"
                >
                  🏨 Room Stay
                </button>
                <button
                  type="button"
                  onClick={() => setPayDesc('Full post-checkout debt clearance')}
                  className="rounded glass ns-glass-hover text-[var(--ns-success)] border border-[var(--ns-success)] px-1.5 py-0.5 font-bold transition"
                >
                  ✓ Full Clearance
                </button>
              </div>
            </FormField>

            <FormField label="Payment Amount (GHS)" required>
              <TextInput
                type="number"
                step="0.01"
                min="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Payment Method" required>
              <SelectInput
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="MOBILE_MONEY">Mobile Money (MTN / Telecel)</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </SelectInput>
            </FormField>

            <FormField label="Transaction Reference (Optional)">
              <TextInput
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="e.g. MoMo Transaction ID / POS Slip #"
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ns-glass-line)]">
              <Button type="button" variant="ghost" onClick={() => setPayModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={paySubmitting} className="glass ns-glass-hover text-[var(--ns-success)] font-bold">
                Confirm & Record Payment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default GuestBillsPage;
