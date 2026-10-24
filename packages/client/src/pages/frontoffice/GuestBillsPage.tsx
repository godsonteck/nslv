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
} from 'lucide-react';
import { Button, Modal, LoadingState, showToast, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
import { staysApi, foliosApi } from '../../services/apiService';
import { formatCurrency, formatGuestName } from '@nslv/shared';
import { villaAssets } from '../../assets';
import { receiptCompanyBlock } from '../../lib/company';

interface BillStay {
  id: string;
  guest: { firstName: string; lastName?: string | null; id: string } | null;
  room: { number: string | number; roomType?: { name?: string } } | null;
  actualCheckIn: string;
  reservation: {
    id: string;
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

export const GuestBillsPage: React.FC = () => {
  const [stays, setStays] = useState<BillStay[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Selected Bill for Modal View
  const [selectedBill, setSelectedBill] = useState<{ stay: BillStay; folio: any } | null>(null);
  const [loadingFolio, setLoadingFolio] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staysApi.getActiveStays();
      setStays(res.data || []);
    } catch (e: any) {
      showToast('error', e?.message ?? 'Unable to load guest bills.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openFolios = useMemo(
    () =>
      stays
        .map((s) => ({
          stay: s,
          folio: s.reservation.folios.find((f) => f.status === 'OPEN') ?? s.reservation.folios[0],
        }))
        .filter((x) => !!x.folio),
    [stays],
  );

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

  const printBill = () => {
    if (!selectedBill) return;
    const { stay, folio } = selectedBill;
    const win = window.open('', '_blank', 'width=520,height=800');
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
    const balance = money(folio.balance);

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Guest Bill · Room ${stay.room?.number ?? '—'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; font-size: 11.5px; color: #0c1921; background: #fff; padding: 24px; max-width: 460px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #c59a58; padding-bottom: 12px; margin-bottom: 16px; }
    .logo { height: 48px; object-fit: contain; margin-bottom: 8px; }
    .title { font-family: 'Cinzel', serif; font-size: 16px; font-weight: 800; color: #0c1921; letter-spacing: 1px; }
    .sub { font-size: 10px; font-weight: 600; color: #c59a58; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    .company { font-size: 9.5px; color: #5a6b75; margin-top: 4px; }
    .meta-card { background: #fcf9f2; border: 1px solid #e7d8bc; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10.5px; }
    .lbl { color: #71828a; font-weight: 600; text-transform: uppercase; font-size: 9px; }
    .val { font-weight: 700; color: #0c1921; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { background: #0c1921; color: #fcf9f2; text-align: left; padding: 6px 10px; font-size: 9.5px; text-transform: uppercase; font-weight: 700; }
    td { padding: 6px 10px; border-bottom: 1px solid #edf2f2; }
    .section-title { font-size: 11px; font-weight: 800; color: #0c1921; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 6px; }
    .total-card { border-top: 2px solid #0c1921; border-bottom: 2px solid #0c1921; padding: 10px 0; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .total-card .lbl { font-size: 12px; font-weight: 800; color: #0c1921; }
    .total-card .amt { font-size: 16px; font-weight: 900; color: ${balance > 0 ? '#b91c1c' : '#047857'}; }
    .footer { text-align: center; font-size: 9.5px; color: #71828a; margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; }
    .btn { display: block; width: 100%; padding: 10px; background: #0c1921; color: #fff; border: none; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; margin-top: 16px; }
    @media print { .btn { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="NS Luxury Villa" class="logo" onerror="this.style.display='none'"/>
    <div class="title">NS LUXURY VILLA</div>
    <div class="sub">Official In-House Guest Folio</div>
    <div class="company">Lokoe, Ho, Volta Region, Ghana | Tel: +233 535 572 774</div>
  </div>

  <div class="meta-card">
    <div class="grid">
      <div><div class="lbl">Room Number</div><div class="val">Room ${stay.room?.number ?? '—'} (${stay.room?.roomType?.name || 'Suite'})</div></div>
      <div><div class="lbl">Guest Name</div><div class="val">${guestName}</div></div>
      <div><div class="lbl">Checked In</div><div class="val">${new Date(stay.actualCheckIn).toLocaleDateString('en-GH')}</div></div>
      <div><div class="lbl">Folio Reference</div><div class="val" style="font-family:monospace">${folio.id.slice(0, 8).toUpperCase()}</div></div>
    </div>
  </div>

  <div class="section-title">Room & Department Charges</div>
  ${items ? `<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>${items}</tbody></table>` : '<div style="font-size:11px;color:#71828a;padding:8px 0">No posted charges on record.</div>'}

  ${payments ? `<div class="section-title" style="margin-top:16px">Recorded Payments & Deposits</div><table><thead><tr><th>Method</th><th style="text-align:center">Date</th><th style="text-align:right">Amount</th></tr></thead><tbody>${payments}</tbody></table>` : ''}

  <div class="total-card">
    <div class="lbl">BALANCE OUTSTANDING DUE:</div>
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
    <ShellPage
      eyebrow="Front Office"
      title="Guest Bills & Folios"
      subtitle="Live room accounts for checked-in guests. Room charges from the restaurant, bar, pool, and front desk accumulate automatically."
      actions={
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5 border-[#e5ebeb]">
          <RefreshCw size={13} /> Refresh
        </Button>
      }
    >
      {/* ── Metric Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="In-House Guests"
          value={stays.length}
          note="Active checked-in reservations"
          icon={UserRound}
        />
        <StatTile
          label="Open Folios"
          value={openFolios.length}
          note="Live guest room billing accounts"
          icon={ReceiptText}
        />
        <StatTile
          label="Total Balance Due"
          value={formatCurrency(outstandingTotal)}
          note={outstandingTotal > 0 ? 'Pending payment before departure' : 'All accounts settled'}
          icon={WalletCards}
          accent={outstandingTotal > 0}
        />
      </div>

      {/* ── Table Section ── */}
      <Section
        title="Active Guest Room Folios"
        subtitle="Click any row or 'View Bill' to inspect breakdown, posted items, payments, or print official slips."
      >
        <Toolbar search={q} onSearch={setQ} placeholder="Search by guest name or room number…" />

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
                <tr className="border-b border-[var(--ns-line)] bg-[var(--ns-surface-2)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                  <th className="py-3 px-5">Room</th>
                  <th className="py-3 px-5">Guest Name</th>
                  <th className="py-3 px-5">Folio Ref</th>
                  <th className="py-3 px-5">Account Status</th>
                  <th className="py-3 px-5 text-right">Balance Due</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-line)]">
                {visible.map(({ stay, folio }) => {
                  const balance = money(folio.balance);
                  const isSettled = balance <= 0.01;

                  return (
                    <tr
                      key={stay.id}
                      onClick={() => openBillModal(stay, folio)}
                      className="cursor-pointer hover:bg-[var(--ns-surface-2)] transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#173c4d] font-mono text-xs font-black text-[#c59a58]">
                            {stay.room?.number ?? '—'}
                          </span>
                          <span className="text-[11px] font-semibold text-[var(--ns-muted)]">
                            {stay.room?.roomType?.name || 'Room'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[var(--ns-ink)] text-xs">
                          {formatGuestName(stay.guest, 'Guest')}
                        </div>
                        <div className="text-[10px] text-[var(--ns-muted)]">
                          Checked in: {new Date(stay.actualCheckIn).toLocaleDateString('en-GH')}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-[#b88738]">
                        {folio.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-3.5 px-5">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={10} /> Fully Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock size={10} /> Balance Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-sm font-black">
                        <span className={balance > 0 ? 'text-[#b91c1c] dark:text-[#f87171]' : 'text-[#047857] dark:text-[#34d399]'}>
                          {formatCurrency(balance)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openBillModal(stay, folio)}
                          className="h-8 gap-1.5 border-[var(--ns-line)] text-xs font-semibold text-[var(--ns-ink)] hover:bg-[var(--ns-surface-2)]"
                        >
                          <ReceiptText size={13} className="text-[#c59a58]" /> View Bill
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

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
        {selectedBill && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="rounded-xl border border-[#c59a58]/30 bg-[#c59a58]/10 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#b88738]">
                  Folio {selectedBill.folio.id.slice(0, 8).toUpperCase()}
                </span>
                <div className="text-sm font-bold text-[var(--ns-ink)]">
                  Room {selectedBill.stay.room?.number ?? ''} | {formatGuestName(selectedBill.stay.guest, 'Guest')}
                </div>
                <div className="text-[11px] text-[var(--ns-muted)]">
                  Checked in {new Date(selectedBill.stay.actualCheckIn).toLocaleDateString('en-GH')}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                  Balance Due
                </span>
                <div className="text-xl font-black text-[var(--ns-ink)]">
                  {formatCurrency(money(selectedBill.folio.balance))}
                </div>
              </div>
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
              <div className="max-h-60 overflow-y-auto rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--ns-line)] bg-[var(--ns-surface-2)] text-[10px] font-extrabold uppercase text-[var(--ns-muted)]">
                      <th className="py-2 px-3">Item / Description</th>
                      <th className="py-2 px-3">Dept</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ns-line)]">
                    {(selectedBill.folio.items || [])
                      .filter((i: any) => !i.voidedAt)
                      .map((i: any) => (
                        <tr key={i.id} className="hover:bg-[var(--ns-surface-2)]">
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
              <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--ns-line)] bg-[var(--ns-surface-2)] text-[10px] font-extrabold uppercase text-[var(--ns-muted)]">
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ns-line)]">
                    {(selectedBill.folio.payments || []).map((p: any) => (
                      <tr key={p.id} className="hover:bg-[var(--ns-surface-2)]">
                        <td className="py-2 px-3 font-semibold text-[var(--ns-ink)]">{p.method}</td>
                        <td className="py-2 px-3 text-[var(--ns-muted)] text-[11px]">
                          {new Date(p.processedAt || p.createdAt).toLocaleDateString('en-GH')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
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
            <div className="flex justify-between items-center pt-3 border-t border-[var(--ns-line)]">
              <Button variant="ghost" size="sm" onClick={() => setSelectedBill(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={printBill}
                className="gap-1.5 bg-[#173c4d] hover:bg-[#133240] text-white font-semibold"
              >
                <Printer size={14} className="text-[#c59a58]" /> Print Guest Folio
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ShellPage>
  );
};

export default GuestBillsPage;
