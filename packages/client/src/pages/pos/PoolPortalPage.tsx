import React, { useEffect, useState } from 'react';
import { posApi } from '../../services/apiService';
import { Users, RefreshCw, ClipboardCheck, Waves, ReceiptText, Printer } from 'lucide-react';
import { Button, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
import { formatCurrency } from '@nslv/shared';
import { receiptCompanyBlock } from '../../lib/company';
import { villaAssets } from '../../assets';

const POOL_PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'];

export default function PoolPortalPage() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [count, setCount] = useState('1');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selling, setSelling] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [qty, setQty] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const [att, svc, txs] = await Promise.all([posApi.getPoolAttendance(), posApi.getPoolServices(), posApi.getPoolTransactions()]);
      setAttendance(att.data || []);
      setServices(svc.data || []);
      setTransactions(txs.data || []);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load pool');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const today = attendance.filter((entry) => String(entry.createdAt || '').slice(0, 10) === new Date().toISOString().slice(0, 10));
  const visitors = today.reduce((sum, entry) => sum + Number(entry.partySize || 0), 0);
  const salesToday = transactions
    .filter((tx) => String(tx.createdAt || '').slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((sum, tx) => sum + Number(tx.totalAmount || 0), 0);

  const submitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const partySize = Number(count);
    if (!Number.isInteger(partySize) || partySize < 1) {
      showToast('error', 'Enter a whole number of visitors.');
      return;
    }
    try {
      setBusy(true);
      await posApi.createPoolAttendance({ visitorName: name, phone: phone || undefined, partySize, notes: notes || undefined });
      showToast('success', 'Pool attendance recorded');
      setName('');
      setPhone('');
      setCount('1');
      setNotes('');
      await load();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Unable to record attendance');
    } finally {
      setBusy(false);
    }
  };

  const printPoolReceipt = (tx: any) => {
    const win = window.open('', '_blank', 'width=380,height=560');
    if (!win) return;
    const paymentLabel = tx.paymentMethod === 'ROOM_CHARGE' ? 'Charged to folio' : tx.paymentMethod;
    const logoUrl = new URL(villaAssets.logo, window.location.href).href;
    win.document.write(`<!DOCTYPE html><html><head><title>POOL RECEIPT</title><style>
      body{font-family:'Courier New',monospace;font-size:12px;color:#111;padding:24px;width:320px;margin:0 auto}
      h1{font-size:15px;text-align:center;margin:0 0 4px} .company{text-align:center;font-size:10px;line-height:1.45;color:#444;margin-bottom:8px}.sub{text-align:center;font-size:10px;color:#555;margin-bottom:16px}
      .logo{display:block;margin:0 auto 10px;width:56px;height:56px;border-radius:12px;object-fit:cover}
      .row{display:flex;justify-content:space-between;font-size:11px;margin:2px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0} th{font-size:10px;text-align:left;border-bottom:1px solid #999;padding:4px 0}
      td{padding:3px 0;font-size:11px} td.r,th.r{text-align:right}
      .total{border-top:1px solid #111;padding-top:8px;font-size:13px;font-weight:bold;display:flex;justify-content:space-between}
      .foot{text-align:center;font-size:10px;color:#555;margin-top:18px;border-top:1px dashed #999;padding-top:8px}
      @media print{.noprint{display:none}}</style></head><body>
      <img src="${logoUrl}" alt="NS Luxury Villa" class="logo"/>
      ${receiptCompanyBlock()}<div class="sub">POOL RECEIPT · OFFICIAL RECEIPT</div>
      <div class="row"><span>Receipt No</span><span>${tx.transactionNo}</span></div>
      <div class="row"><span>Date</span><span>${new Date(tx.createdAt).toLocaleString()}</span></div>
      <div class="row"><span>Payment</span><span>${paymentLabel}</span></div>
      <table><thead><tr><th>Service</th><th class="r">Qty</th><th class="r">Total</th></tr></thead><tbody>
        <tr><td>${tx.service?.name || 'Pool service'}</td><td class="r">${tx.quantity} × ${formatCurrency(Number(tx.unitPrice || 0))}</td><td class="r">${formatCurrency(Number(tx.totalAmount || 0))}</td></tr>
      </tbody></table>
      <div class="total"><span>Amount paid</span><span>${formatCurrency(Number(tx.totalAmount || 0))}</span></div>
      <div class="foot">Currency: GHS · This is a computer-generated receipt.<br/>Thank you for visiting NS Luxury Villa.</div>
      <div class="noprint" style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 24px;font-size:12px">Print receipt</button></div>
      </body></html>`);
    win.document.close();
  };

  const submitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = Number(qty);
    if (!serviceId) {
      showToast('error', 'Select a pool service.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      showToast('error', 'Enter a whole quantity.');
      return;
    }
    try {
      setSelling(true);
      const res = await posApi.createPoolTransaction({
        serviceId,
        quantity,
        paymentMethod,
        notes: payNotes || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      const tx = res?.data;
      showToast('success', 'Pool charge recorded');
      setQty('1');
      setPayNotes('');
      await load();
      if (tx) printPoolReceipt(tx);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Unable to record pool charge');
    } finally {
      setSelling(false);
    }
  };

  const selectedService = services.find((s) => s.id === serviceId);
  const lineTotal = selectedService ? Number(selectedService.price || 0) * Number(qty || 0) : 0;

  return (
    <ShellPage
      eyebrow="POOL · RECEPTION DESK"
      title="Pool services"
      subtitle="Record attendance and sell pool services with an official receipt."
      actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw size={14} /> Refresh</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="Entries today" value={today.length} icon={ClipboardCheck} />
        <StatTile label="People today" value={visitors} icon={Users} accent />
        <StatTile label="Sales today" value={formatCurrency(salesToday)} icon={Waves} />
        <StatTile label="Recent charges" value={transactions.length} note="Pool transactions" icon={ReceiptText} />
      </div>

      {loading ? <LoadingState /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Record entry" subtitle="One record per visitor or group">
            <form onSubmit={submitAttendance} className="space-y-4 p-5">
              <FormField label="Visitor or group name" required>
                <TextInput required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name of visitor or group lead" />
              </FormField>
              <FormField label="Phone number">
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional contact number" />
              </FormField>
              <FormField label="Number of people" required>
                <TextInput required type="number" min="1" step="1" value={count} onChange={(e) => setCount(e.target.value)} />
              </FormField>
              <FormField label="Notes">
                <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional details" />
              </FormField>
              <Button className="w-full" loading={busy}><ClipboardCheck size={14} /> Record attendance</Button>
            </form>
          </Section>

          <Section title="Sell pool service" subtitle="Charge a service and print the official receipt">
            {services.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#899397]">
                No pool services are configured yet. Add them under <strong>Admin → Menus &amp; POS → Pool</strong>.
              </div>
            ) : (
              <form onSubmit={submitSale} className="space-y-4 p-5">
                <FormField label="Service" required>
                  <SelectInput value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                    <option value="">Select a service…</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {formatCurrency(Number(s.price || 0))}</option>
                    ))}
                  </SelectInput>
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Quantity" required>
                    <TextInput required type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                  </FormField>
                  <FormField label="Payment method" required>
                    <SelectInput value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      {POOL_PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </SelectInput>
                  </FormField>
                </div>
                <FormField label="Notes">
                  <TextInput value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional details" />
                </FormField>
                <div className="rounded-xl bg-[#f7f8f6] p-3 text-xs text-[#27383F]">
                  <div className="flex items-center justify-between font-bold">
                    <span>Amount due</span>
                    <span className="ns-number">GHS {lineTotal.toFixed(2)}</span>
                  </div>
                </div>
                <Button className="w-full" loading={selling}><ReceiptText size={14} /> Sell &amp; print receipt</Button>
              </form>
            )}
          </Section>
        </div>
      )}

      <Section title="Recent charges" subtitle="Latest pool transactions with receipt re-print">
        {loading ? (
          <LoadingState />
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#899397]">No pool charges have been recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                <tr>
                  <th className="px-5 py-3">No.</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Qty</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {transactions.slice(0, 30).map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#fbfcfa]">
                    <td className="px-5 py-3 font-mono text-[11px] font-extrabold text-[#26363e]">{tx.transactionNo || '—'}</td>
                    <td className="px-5 py-3 text-[11px] font-bold text-[#26363e]">{tx.service?.name || '—'}</td>
                    <td className="px-5 py-3 text-[11px] text-[#718086]">{tx.quantity}</td>
                    <td className="px-5 py-3 text-[11px] text-[#718086]">{tx.paymentMethod || '—'}</td>
                    <td className="px-5 py-3">{statusBadge(tx.paymentStatus || 'COMPLETED')}</td>
                    <td className="px-5 py-3 text-right text-[11px] font-extrabold text-[#26363e]">{formatCurrency(Number(tx.totalAmount || 0))}</td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => printPoolReceipt(tx)}><Printer size={13} /> Print</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recent attendance" subtitle="Latest pool entries">
        <div className="divide-y divide-[#edf0ed]">
          {attendance.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#899397]">No pool attendance has been recorded yet.</div>
          ) : (
            attendance.slice(0, 20).map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf5f6] text-[#2e7f8c]"><Users size={15} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold">{entry.visitorName || 'Guest'}</div>
                  <div className="mt-1 text-[10px] text-[#8a9598]">
                    {entry.partySize || 1} person{Number(entry.partySize || 1) > 1 ? 's' : ''} · {new Date(entry.createdAt).toLocaleString()}
                    {entry.phone ? ` · ${entry.phone}` : ''}
                  </div>
                </div>
                {entry.notes && <div className="max-w-[200px] text-right text-[10px] text-[#8a9598]">{entry.notes}</div>}
              </div>
            ))
          )}
        </div>
      </Section>
    </ShellPage>
  );
}