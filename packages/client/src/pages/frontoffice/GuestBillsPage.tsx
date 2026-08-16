// ============================================
// NS LUXURY VILLA — Guest Bills (Reception)
// Live guest folios: restaurant/bar/pool room charges
// appear here automatically. Amounts are always read-only.
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ReceiptText, Printer, WalletCards, Search, UserRound } from 'lucide-react';
import { Button, Modal, SearchInput, LoadingState, showToast, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
import { staysApi } from '../../services/apiService';
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
  const [active, setActive] = useState<BillStay | null>(null);

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

  const activeBill = active ? openFolios.find((x) => x.stay.id === active.id) : null;

  const printBill = () => {
    if (!activeBill) return;
    const { stay, folio } = activeBill;
    const win = window.open('', '_blank');
    if (!win) {
      showToast('error', 'Pop-up blocked. Please allow pop-ups to print bill.');
      return;
    }

    const items = folio.items
      .map(
        (i) =>
          `<tr><td>${i.description}</td><td class="r">${i.quantity}</td><td class="r">${formatCurrency(money(i.unitPrice))}</td><td class="r">${formatCurrency(money(i.amount))}</td></tr>`,
      )
      .join('');
    const payments = folio.payments
      .map(
        (p) =>
          `<tr><td>${p.method} payment</td><td class="r">${new Date(p.processedAt).toLocaleDateString()}</td><td class="r">${formatCurrency(money(p.amount))}</td></tr>`,
      )
      .join('');
    const guestName = formatGuestName(stay.guest, 'Guest');
    const logoUrl = new URL(villaAssets.logo, window.location.href).href;

    win.document.write(`<!DOCTYPE html><html><head><title>Guest bill</title><style>
      body{font-family:'Courier New',monospace;font-size:12px;color:#111;padding:24px;width:320px;margin:0 auto}
      h1{font-size:15px;text-align:center;margin:0 0 4px} .company{text-align:center;font-size:10px;line-height:1.45;color:#444;margin-bottom:8px}.sub{text-align:center;font-size:10px;color:#555;margin-bottom:16px}
      .logo{display:block;margin:0 auto 10px;width:56px;height:56px;border-radius:12px;object-fit:cover}
      .row{display:flex;justify-content:space-between;font-size:11px;margin:2px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0} th{font-size:10px;text-align:left;border-bottom:1px solid #999;padding:4px 0}
      td{padding:3px 0;font-size:11px;vertical-align:top} td.r,th.r{text-align:right}
      .sec{font-size:10px;font-weight:bold;letter-spacing:.08em;margin:10px 0 4px;border-top:1px dashed #999;padding-top:10px}
      .total{border-top:1px solid #111;padding-top:8px;font-size:13px;font-weight:bold;display:flex;justify-content:space-between}
      .foot{text-align:center;font-size:10px;color:#555;margin-top:18px;border-top:1px dashed #999;padding-top:8px}
      @media print{.noprint{display:none}}</style></head><body>
      <img src="${logoUrl}" alt="NS Luxury Villa" class="logo"/>
      ${receiptCompanyBlock()}<div class="sub">GUEST BILL · ROOM ${stay.room?.number ?? '—'}</div>
      <div class="row"><span>Guest</span><span>${guestName}</span></div>
      <div class="row"><span>Checked in</span><span>${new Date(stay.actualCheckIn).toLocaleDateString()}</span></div>
      <div class="row"><span>Folio</span><span>${folio.id.slice(0, 8).toUpperCase()}</span></div>
      <div class="row"><span>Printed</span><span>${new Date().toLocaleString()}</span></div>
      <div class="sec">CHARGES</div>
      ${items ? `<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>${items}</tbody></table>` : '<div style="text-align:center;font-size:11px;color:#777;margin:6px 0">No charges recorded</div>'}
      ${payments ? `<div class="sec">PAYMENTS</div><table><thead><tr><th>Method</th><th class="r">Date</th><th class="r">Amount</th></tr></thead><tbody>${payments}</tbody></table>` : ''}
      <div class="total"><span>Balance due</span><span>${formatCurrency(money(folio.balance))}</span></div>
      <div class="foot">Currency: GHS · Check-in 2:00 PM · Check-out 12:00 PM<br/>Thank you for staying at NS Luxury Villa.</div>
      <div class="noprint" style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 24px;font-size:12px">Print bill</button></div>
      </body></html>`);
    win.document.close();
  };

  return (
    <ShellPage
      eyebrow="RECEPTION · GUEST BILLS"
      title="Guest bills"
      subtitle="Live folio charges posted by the restaurant, bar and pool appear automatically. All amounts are calculated automatically."
      actions={
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Guests in house" value={stays.length} icon={UserRound} />
        <StatTile label="Open bills" value={openFolios.length} icon={ReceiptText} />
        <StatTile label="Outstanding total" value={formatCurrency(outstandingTotal)} icon={WalletCards} accent />
      </div>

      <Section title="In-house guest bills" subtitle="Select a guest bill to review and print">
        <div className="border-b border-[#e8ebe8] p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Search by guest or room…" />
        </div>
        {loading ? (
          <div className="p-10"><LoadingState /></div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#899397]">No in-house guest bills found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                <tr>
                  <th className="px-5 py-3">Room</th>
                  <th className="px-5 py-3">Guest</th>
                  <th className="px-5 py-3">Folio</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                  <th className="px-5 py-3 text-right">Bill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {visible.map(({ stay, folio }) => (
                  <tr key={stay.id} className="hover:bg-[#fbfcfa]">
                    <td className="px-5 py-3 font-mono text-[11px] font-extrabold text-[#26363e]">
                      Room {stay.room?.number ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[11px] text-[#26363e]">
                      {formatGuestName(stay.guest, 'Guest')}
                    </td>
                    <td className="px-5 py-3">{statusBadge(folio.status)}</td>
                    <td className="px-5 py-3 text-right text-[11px] font-extrabold text-[#26363e]">
                      {formatCurrency(money(folio.balance))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setActive(stay)}>
                        <ReceiptText size={13} /> View bill
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Modal
        open={!!activeBill}
        onClose={() => setActive(null)}
        title={activeBill ? `Guest bill · Room ${activeBill.stay.room?.number ?? '—'}` : 'Guest bill'}
        size="lg"
      >
        {activeBill && (
          <div className="p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold text-[#26363e]">
                  {formatGuestName(activeBill.stay.guest, 'Guest')}
                </div>
                <div className="mt-1 text-[10px] text-[#899397]">
                  Checked in {new Date(activeBill.stay.actualCheckIn).toLocaleDateString()} · Room {activeBill.stay.room?.number ?? '—'}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={printBill}>
                <Printer size={13} /> Print bill
              </Button>
            </div>

            {activeBill.folio.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dfe4e0] p-10 text-center">
                <WalletCards className="mx-auto text-[#a0aaad]" />
                <div className="mt-3 text-xs font-extrabold text-[#59676d]">No charges on this bill yet</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                    <tr>
                      <th className="px-4 py-3">Charge</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Unit</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0ed]">
                    {activeBill.folio.items.map((item) => (
                      <tr key={item.id} className={item.voidedAt ? 'opacity-40 line-through' : ''}>
                        <td className="px-4 py-3 text-[11px] font-bold text-[#26363e]">{item.description}</td>
                        <td className="px-4 py-3 text-[10px] text-[#899397]">{item.department}</td>
                        <td className="px-4 py-3 text-right text-[11px] text-[#718086]">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-[11px] text-[#718086]">{formatCurrency(money(item.unitPrice))}</td>
                        <td className="px-4 py-3 text-right text-[11px] font-extrabold text-[#26363e]">
                          {formatCurrency(money(item.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeBill.folio.payments.length > 0 && (
              <div className="mt-5">
                <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#7d898d]">Payments received</div>
                <div className="mt-2 space-y-2">
                  {activeBill.folio.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl bg-[#f0f7f2] px-4 py-2.5">
                      <span className="text-[11px] font-bold text-[#26363e]">{p.method} payment</span>
                      <span className="text-[11px] font-extrabold text-[#2d8a68]">− {formatCurrency(money(p.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-[#e8ebe8] px-4 pb-2 pt-4">
              <span className="text-xs text-[#899397]">Balance due</span>
              <strong className="text-2xl text-[#20343e]">{formatCurrency(money(activeBill.folio.balance))}</strong>
            </div>
          </div>
        )}
      </Modal>
    </ShellPage>
  );
};

export default GuestBillsPage;
