import React, { useCallback, useEffect, useState } from 'react';
import { formatCurrency, PERMISSIONS } from '@nslv/shared';
import { ArrowDown, ArrowUp, Banknote, Calculator, ChevronLeft, ChevronRight, DollarSign, Plus, Printer, RefreshCw, ShieldAlert, Trash2, Users } from 'lucide-react';
import { Button, DataTable, FormField, Modal, PageHeader, SelectInput, showToast, TextInput } from '../../components/ui';
import { apiFetch } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { cashRegisterApi } from '../../services/apiService';

const CASH_CATEGORIES = ['FUEL', 'SUPPLIES', 'STAFF_MEALS', 'MAINTENANCE', 'UTILITIES', 'TRANSPORT', 'MISC'];
interface CashEntry { id: string; type: 'OPENING' | 'INFLOW' | 'OUTFLOW'; amount: number; description: string; category?: string; recipient?: string; receiptRef?: string; recordedAt: string; }
interface CashPayment { id: string; amount: number; type: 'PAYMENT' | 'REFUND'; source?: string; sourceId?: string; reference?: string; description?: string; processedAt: string; }
interface CashRegisterSummary { businessDate: string; openingCash: number; carriedForward: number; carriedFromDate?: string | null; inflows: number; outflows: number; cashSales: number; cashRefunds: number; netCash: number; entries: CashEntry[]; cashPayments: CashPayment[]; byCategory: Record<string, number>; }
const token = () => useAuthStore.getState().tokens?.accessToken ?? null;

export const CashRegisterPage: React.FC = () => {
  const { hasPermission, user } = useAuthStore();
  // The server remains authoritative. This role fallback lets an existing
  // Reception session reach the new page before its client profile refreshes.
  const isReception = user?.roles?.some((role) => role.name === 'Reception') ?? false;
  const canManage = hasPermission(PERMISSIONS.CASH_REGISTER_MANAGE) || isReception;
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<CashRegisterSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [bankDepositOpen, setBankDepositOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');
  const [entry, setEntry] = useState({ type: 'OUTFLOW' as 'INFLOW' | 'OUTFLOW', amount: '', description: '', category: 'FUEL', recipient: '', receiptRef: '' });
  const [bankDepositAmount, setBankDepositAmount] = useState('');
  const [bankDepositDescription, setBankDepositDescription] = useState('');
  const [bankDepositReference, setBankDepositReference] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CashRegisterSummary | null>(`/cash-register?businessDate=${selectedDate}`, {}, token());
      setSummary(data);
      // Check low cash alert
      if (data) {
        const alert = await cashRegisterApi.getLowCashAlert(selectedDate, 200);
        if (alert.data?.isLow) showToast('warning', alert.data.message);
      }
    } catch (error: any) { showToast('error', error?.message ?? 'Unable to load the cash record.'); }
    finally { setLoading(false); }
  }, [selectedDate]);
  useEffect(() => { void load(); }, [load]);

  const shiftDate = (days: number) => { const date = new Date(`${selectedDate}T12:00:00`); date.setDate(date.getDate() + days); setSelectedDate(date.toISOString().slice(0, 10)); };
  const saveOpening = async (event: React.FormEvent) => {
    event.preventDefault(); if (openingAmount === '' || Number(openingAmount) < 0) return showToast('error', 'Enter a valid cash balance.'); setSaving(true);
    try { await apiFetch('/cash-register/opening', { method: 'POST', body: JSON.stringify({ businessDate: selectedDate, amount: Number(openingAmount), notes: openingNotes || undefined }) }, token()); showToast('success', 'Cash at hand balance recorded.'); setOpeningOpen(false); await load(); }
    catch (error: any) { showToast('error', error?.message ?? 'Unable to record the cash balance.'); } finally { setSaving(false); }
  };
  const saveEntry = async (event: React.FormEvent) => {
    event.preventDefault(); if (!entry.amount || Number(entry.amount) <= 0 || !entry.description.trim()) return showToast('error', 'Amount and description are required.'); setSaving(true);
    try { await apiFetch('/cash-register/entries', { method: 'POST', body: JSON.stringify({ businessDate: selectedDate, type: entry.type, amount: Number(entry.amount), description: entry.description.trim(), ...(entry.type === 'OUTFLOW' ? { category: entry.category } : {}), recipient: entry.recipient || undefined, receiptRef: entry.receiptRef || undefined }) }, token()); showToast('success', entry.type === 'OUTFLOW' ? 'Money-out record saved.' : 'Money-in record saved.'); setEntryOpen(false); await load(); }
    catch (error: any) { showToast('error', error?.message ?? 'Unable to record cash movement.'); } finally { setSaving(false); }
  };
  const saveBankDeposit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!bankDepositAmount || Number(bankDepositAmount) <= 0 || !bankDepositDescription.trim()) return showToast('error', 'Amount and description are required.'); setSaving(true);
    try { await cashRegisterApi.recordBankDeposit({ businessDate: selectedDate, amount: Number(bankDepositAmount), description: bankDepositDescription.trim(), reference: bankDepositReference || undefined }); showToast('success', 'Bank deposit recorded.'); setBankDepositOpen(false); setBankDepositAmount(''); setBankDepositDescription(''); setBankDepositReference(''); await load(); }
    catch (error: any) { showToast('error', error?.message ?? 'Unable to record bank deposit.'); } finally { setSaving(false); }
  };
  const openHandover = async () => {
    try { const res = await cashRegisterApi.getShiftHandover(selectedDate); if (res.data?.items) { const itemsHtml = res.data.items.map((i: { checked: boolean; label: string; value: string }) => `${i.checked ? '✅' : '⬜'} ${i.label}: ${i.value}`).join('\n'); const msg = `SHIFT HANDOVER - ${new Date(selectedDate).toLocaleDateString()}\nExpected cash: GHS ${res.data.expectedCash.toFixed(2)}\n${res.data.incompleteCount > 0 ? `\n⚠️ ${res.data.incompleteCount} items pending:\n${itemsHtml}` : '\n✅ All checks complete'}\n\n${itemsHtml}`; alert(msg); } else { showToast('error', 'No data for handover'); } } catch (error: any) { showToast('error', error?.message ?? 'Unable to load handover'); }
  };
  const deleteEntry = async (entryId: string) => { if (!window.confirm('Delete this cash movement?')) return; try { await apiFetch(`/cash-register/entries/${entryId}`, { method: 'DELETE' }, token()); showToast('success', 'Cash movement deleted.'); await load(); } catch (error: any) { showToast('error', error?.message ?? 'Unable to delete the cash movement.'); } };
  const printReceipt = (entry: CashEntry) => {
    const receiptHtml = `
      <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2>NS LUXURY VILLA</h2>
          <div>Cash Receipt</div>
        </div>
        <hr>
        <div><strong>Date:</strong> ${new Date(entry.recordedAt).toLocaleString()}</div>
        <div><strong>Type:</strong> ${entry.type}</div>
        <div><strong>Description:</strong> ${entry.description}</div>
        <div><strong>Category:</strong> ${entry.category || '—'}</div>
        <div><strong>Recipient:</strong> ${entry.recipient || '—'}</div>
        <div><strong>Receipt Ref:</strong> ${entry.receiptRef || '—'}</div>
        <hr>
        <div style="font-size: 1.2em;"><strong>Amount: ${entry.type === 'OUTFLOW' ? '−' : '+'}GHS ${Number(entry.amount).toFixed(2)}</strong></div>
        <hr>
        <div style="text-align: center; margin-top: 20px; font-size: 0.8em; color: #666;">
          NS Luxury Villa - Ho, Ghana<br>
          Thank you!
        </div>
      </div>
    `;
    const printWindow = window.open('', '_blank');
    printWindow!.document.write(receiptHtml);
    printWindow!.document.close();
    printWindow!.print();
  };

  const columns = [
    { key: 'recordedAt', header: 'Recorded', render: (row: CashEntry) => new Date(row.recordedAt).toLocaleString() },
    { key: 'type', header: 'Movement', render: (row: CashEntry) => <span className={row.type === 'OUTFLOW' ? 'text-red-600 font-semibold' : row.type === 'INFLOW' ? 'text-emerald-700 font-semibold' : 'text-sky-700 font-semibold'}>{row.type === 'OUTFLOW' ? 'Money out' : row.type === 'INFLOW' ? 'Money in' : 'Cash at hand'}</span> },
    { key: 'description', header: 'Reason / description', render: (row: CashEntry) => row.description },
    { key: 'category', header: 'Category', render: (row: CashEntry) => row.category || '—' },
    { key: 'recipient', header: 'Received by', render: (row: CashEntry) => row.recipient || '—' },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (row: CashEntry) => <span className={row.type === 'OUTFLOW' ? 'text-red-600 font-semibold' : 'font-semibold'}>{row.type === 'OUTFLOW' ? '−' : row.type === 'INFLOW' ? '+' : ''}{formatCurrency(Number(row.amount))}</span> },
    { key: 'actions', header: '', align: 'right' as const, render: (row: CashEntry) => canManage && row.type !== 'OPENING' ? (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => printReceipt(row)} title="Print receipt"><Printer size={14} /></Button>
        <Button variant="ghost" size="sm" onClick={() => void deleteEntry(row.id)} title="Delete movement"><Trash2 size={14} /></Button>
      </div>
    ) : null },
  ];
  const openBalance = () => { setOpeningAmount(summary ? String(summary.openingCash) : ''); setOpeningNotes(''); setOpeningOpen(true); };
  const openEntry = (type: 'INFLOW' | 'OUTFLOW') => { setEntry({ type, amount: '', description: '', category: 'FUEL', recipient: '', receiptRef: '' }); setEntryOpen(true); };

  return <div className="space-y-6">
    {/* Low cash alert banner */}
    {summary && summary.netCash < 200 && (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-center gap-3">
        <ShieldAlert className="text-amber-600" size={24} />
        <div className="flex-1">
          <div className="font-bold text-amber-800">Low Cash Alert</div>
          <div className="text-sm text-amber-700">Cash at hand (GHS {summary.netCash.toFixed(2)}) is below GHS 200. Consider recording a bank deposit or requesting float top-up.</div>
        </div>
      </div>
    )}

    <PageHeader title="Cash at Hand" subtitle="A live handover balance: brought forward cash + cash sales + cash received − refunds − money paid out." actions={<div className="flex items-center gap-2">{canManage && <><Button variant="outline" size="sm" onClick={openBalance}><DollarSign size={14} /> Set counted starting balance</Button><Button variant="outline" size="sm" onClick={() => openEntry('INFLOW')}><Plus size={14} /> Record cash received</Button><Button variant="primary" size="sm" onClick={() => openEntry('OUTFLOW')}><Plus size={14} /> Record money out</Button><Button variant="outline" size="sm" onClick={() => { setBankDepositAmount(''); setBankDepositDescription(''); setBankDepositReference(''); setBankDepositOpen(true); }}><Banknote size={14} /> Record bank deposit</Button><Button variant="secondary" size="sm" onClick={openHandover}><Users size={14} /> Shift handover</Button></>}</div>} />
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"><Button variant="outline" size="sm" onClick={() => shiftDate(-1)}><ChevronLeft size={14} /></Button><TextInput type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40" /><Button variant="outline" size="sm" onClick={() => shiftDate(1)}><ChevronRight size={14} /></Button><Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>Today</Button><Button variant="ghost" size="sm" onClick={() => void load()} loading={loading}><RefreshCw size={14} /> Refresh</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{([{ label: 'Brought forward', amount: summary?.carriedForward ?? 0, Icon: DollarSign, note: summary?.carriedFromDate ? `Calculated from ${new Date(summary.carriedFromDate).toLocaleDateString()}` : 'No counted balance recorded yet' }, { label: 'Cash sales', amount: summary?.cashSales ?? 0, Icon: ArrowUp, note: 'Completed cash payments, recorded automatically' }, { label: 'Cash received', amount: summary?.inflows ?? 0, Icon: ArrowUp, note: 'Manual additions recorded today' }, { label: 'Cash out / refunds', amount: (summary?.outflows ?? 0) + (summary?.cashRefunds ?? 0), Icon: ArrowDown, note: 'Payouts and cash refunds' }, { label: 'Available cash at hand', amount: summary?.netCash ?? 0, Icon: Calculator, note: 'Live balance for the next handover' }] as Array<{ label: string; amount: number; Icon: React.ElementType; note: string }>).map(({ label, amount, Icon, note }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>{label}</span><Icon size={16} /></div><div className="mt-2 text-xl font-bold text-slate-800">{formatCurrency(amount)}</div><div className="mt-1 text-[11px] text-slate-500">{note}</div></div>)}</div>
    <DataTable columns={columns} data={summary?.entries ?? []} loading={loading} keyFn={(row) => row.id} emptyTitle="No cash record for this date" emptySubtitle="Choose any prior date to record its cash balance, then record money paid out for expenses or other uses." />
    <DataTable columns={[{ key: 'processedAt', header: 'Recorded', render: (row: CashPayment) => new Date(row.processedAt).toLocaleString() }, { key: 'type', header: 'Movement', render: (row: CashPayment) => <span className={row.type === 'REFUND' ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{row.type === 'REFUND' ? 'Cash refund' : 'Cash sale'}</span> }, { key: 'description', header: 'Source', render: (row: CashPayment) => row.description || row.source || 'Cash payment' }, { key: 'reference', header: 'Reference', render: (row: CashPayment) => row.reference || row.sourceId || '—' }, { key: 'amount', header: 'Amount', align: 'right' as const, render: (row: CashPayment) => <span className={row.type === 'REFUND' ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{row.type === 'REFUND' ? '−' : '+'}{formatCurrency(Number(row.amount))}</span> }]} data={summary?.cashPayments ?? []} loading={loading} keyFn={(row) => row.id} emptyTitle="No cash sales or refunds for this date" emptySubtitle="Completed cash payments appear here automatically and are included in the live handover balance." />
    <Modal open={openingOpen} onClose={() => setOpeningOpen(false)} title="Record cash at hand"><form onSubmit={saveOpening}><FormField label="Business date" required><TextInput type="date" value={selectedDate} readOnly /></FormField><FormField label="Cash handed to Reception (GHS)" required><TextInput type="number" min="0" step="0.01" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} required /></FormField><FormField label="Notes"><TextInput value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} placeholder="e.g. cash brought forward from last week" /></FormField><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpeningOpen(false)}>Cancel</Button><Button type="submit" loading={saving}>Save cash balance</Button></div></form></Modal>
    <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title={entry.type === 'OUTFLOW' ? 'Record money out' : 'Record money in'}><form onSubmit={saveEntry}><FormField label="Movement" required><SelectInput value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value as 'INFLOW' | 'OUTFLOW' })}><option value="OUTFLOW">Money out (expense / payout)</option><option value="INFLOW">Money in (cash returned / added)</option></SelectInput></FormField><FormField label="Amount (GHS)" required><TextInput type="number" min="0.01" step="0.01" value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} required /></FormField><FormField label="Reason / description" required><TextInput value={entry.description} onChange={(e) => setEntry({ ...entry, description: e.target.value })} placeholder="e.g. Generator fuel" required /></FormField>{entry.type === 'OUTFLOW' && <FormField label="Category" required><SelectInput value={entry.category} onChange={(e) => setEntry({ ...entry, category: e.target.value })}>{CASH_CATEGORIES.map((category) => <option key={category} value={category}>{category.replace('_', ' ')}</option>)}</SelectInput></FormField>}<FormField label="Received by"><TextInput value={entry.recipient} onChange={(e) => setEntry({ ...entry, recipient: e.target.value })} placeholder="Person or supplier" /></FormField><FormField label="Receipt reference"><TextInput value={entry.receiptRef} onChange={(e) => setEntry({ ...entry, receiptRef: e.target.value })} placeholder="Optional receipt or invoice number" /></FormField><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEntryOpen(false)}>Cancel</Button><Button type="submit" loading={saving}>Save movement</Button></div></form></Modal>
    <Modal open={bankDepositOpen} onClose={() => setBankDepositOpen(false)} title="Record Bank Deposit"><form onSubmit={saveBankDeposit}><FormField label="Business date" required><TextInput type="date" value={selectedDate} readOnly /></FormField><FormField label="Amount (GHS)" required><TextInput type="number" min="0.01" step="0.01" value={bankDepositAmount} onChange={(e) => setBankDepositAmount(e.target.value)} placeholder="0.00" required /></FormField><FormField label="Description" required><TextInput value={bankDepositDescription} onChange={(e) => setBankDepositDescription(e.target.value)} placeholder="e.g. Cash deposited to Ecobank" required /></FormField><FormField label="Reference (optional)"><TextInput value={bankDepositReference} onChange={(e) => setBankDepositReference(e.target.value)} placeholder="Deposit slip / transaction reference" /></FormField><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setBankDepositOpen(false)}>Cancel</Button><Button type="submit" variant="primary" loading={saving}><Banknote size={14} /> Save bank deposit</Button></div></form></Modal>
  </div>;
};

export default CashRegisterPage;
