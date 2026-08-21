import React, { useCallback, useEffect, useState } from 'react';
import { formatCurrency, PERMISSIONS } from '@nslv/shared';
import { ArrowDown, ArrowUp, Calculator, ChevronLeft, ChevronRight, DollarSign, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button, DataTable, FormField, Modal, PageHeader, SelectInput, showToast, TextInput } from '../../components/ui';
import { apiFetch } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

const CASH_CATEGORIES = ['FUEL', 'SUPPLIES', 'STAFF_MEALS', 'MAINTENANCE', 'UTILITIES', 'TRANSPORT', 'MISC'];
interface CashEntry { id: string; type: 'OPENING' | 'INFLOW' | 'OUTFLOW'; amount: number; description: string; category?: string; recipient?: string; receiptRef?: string; recordedAt: string; }
interface CashRegisterSummary { businessDate: string; openingCash: number; inflows: number; outflows: number; netCash: number; entries: CashEntry[]; byCategory: Record<string, number>; }
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
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');
  const [entry, setEntry] = useState({ type: 'OUTFLOW' as 'INFLOW' | 'OUTFLOW', amount: '', description: '', category: 'FUEL', recipient: '', receiptRef: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try { setSummary(await apiFetch<CashRegisterSummary | null>(`/cash-register?businessDate=${selectedDate}`, {}, token())); }
    catch (error: any) { showToast('error', error?.message ?? 'Unable to load the cash record.'); }
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
  const deleteEntry = async (entryId: string) => { if (!window.confirm('Delete this cash movement?')) return; try { await apiFetch(`/cash-register/entries/${entryId}`, { method: 'DELETE' }, token()); showToast('success', 'Cash movement deleted.'); await load(); } catch (error: any) { showToast('error', error?.message ?? 'Unable to delete the cash movement.'); } };

  const columns = [
    { key: 'recordedAt', header: 'Recorded', render: (row: CashEntry) => new Date(row.recordedAt).toLocaleString() },
    { key: 'type', header: 'Movement', render: (row: CashEntry) => <span className={row.type === 'OUTFLOW' ? 'text-red-600 font-semibold' : row.type === 'INFLOW' ? 'text-emerald-700 font-semibold' : 'text-sky-700 font-semibold'}>{row.type === 'OUTFLOW' ? 'Money out' : row.type === 'INFLOW' ? 'Money in' : 'Cash at hand'}</span> },
    { key: 'description', header: 'Reason / description', render: (row: CashEntry) => row.description },
    { key: 'category', header: 'Category', render: (row: CashEntry) => row.category || '—' },
    { key: 'recipient', header: 'Received by', render: (row: CashEntry) => row.recipient || '—' },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (row: CashEntry) => <span className={row.type === 'OUTFLOW' ? 'text-red-600 font-semibold' : 'font-semibold'}>{row.type === 'OUTFLOW' ? '−' : row.type === 'INFLOW' ? '+' : ''}{formatCurrency(Number(row.amount))}</span> },
    { key: 'actions', header: '', align: 'right' as const, render: (row: CashEntry) => canManage && row.type !== 'OPENING' ? <Button variant="ghost" size="sm" onClick={() => void deleteEntry(row.id)} title="Delete movement"><Trash2 size={14} /></Button> : null },
  ];
  const openBalance = () => { setOpeningAmount(summary ? String(summary.openingCash) : ''); setOpeningNotes(''); setOpeningOpen(true); };
  const openOutflow = () => { setEntry({ type: 'OUTFLOW', amount: '', description: '', category: 'FUEL', recipient: '', receiptRef: '' }); setEntryOpen(true); };

  return <div className="space-y-6">
    <PageHeader title="Cash at Hand" subtitle="Record cash handed to Reception, including previous weeks or months, and every amount paid out." actions={<div className="flex items-center gap-2">{canManage && <><Button variant="outline" size="sm" onClick={openBalance}><DollarSign size={14} /> Record cash balance</Button><Button variant="primary" size="sm" onClick={openOutflow}><Plus size={14} /> Record money out</Button></>}</div>} />
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"><Button variant="outline" size="sm" onClick={() => shiftDate(-1)}><ChevronLeft size={14} /></Button><TextInput type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40" /><Button variant="outline" size="sm" onClick={() => shiftDate(1)}><ChevronRight size={14} /></Button><Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>Today</Button><Button variant="ghost" size="sm" onClick={() => void load()} loading={loading}><RefreshCw size={14} /> Refresh</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{([{ label: 'Cash handed to Reception', amount: summary?.openingCash ?? 0, Icon: DollarSign, note: 'Opening or brought-forward balance' }, { label: 'Money in', amount: summary?.inflows ?? 0, Icon: ArrowUp, note: 'Cash returned or added' }, { label: 'Money out', amount: summary?.outflows ?? 0, Icon: ArrowDown, note: 'Expenses and other payouts' }, { label: 'Expected cash at hand', amount: summary?.netCash ?? 0, Icon: Calculator, note: 'Opening + money in − money out' }] as Array<{ label: string; amount: number; Icon: React.ElementType; note: string }>).map(({ label, amount, Icon, note }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>{label}</span><Icon size={16} /></div><div className="mt-2 text-xl font-bold text-slate-800">{formatCurrency(amount)}</div><div className="mt-1 text-[11px] text-slate-500">{note}</div></div>)}</div>
    <DataTable columns={columns} data={summary?.entries ?? []} loading={loading} keyFn={(row) => row.id} emptyTitle="No cash record for this date" emptySubtitle="Choose any prior date to record its cash balance, then record money paid out for expenses or other uses." />
    <Modal open={openingOpen} onClose={() => setOpeningOpen(false)} title="Record cash at hand"><form onSubmit={saveOpening}><FormField label="Business date" required><TextInput type="date" value={selectedDate} readOnly /></FormField><FormField label="Cash handed to Reception (GHS)" required><TextInput type="number" min="0" step="0.01" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} required /></FormField><FormField label="Notes"><TextInput value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} placeholder="e.g. cash brought forward from last week" /></FormField><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpeningOpen(false)}>Cancel</Button><Button type="submit" loading={saving}>Save cash balance</Button></div></form></Modal>
    <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title={entry.type === 'OUTFLOW' ? 'Record money out' : 'Record money in'}><form onSubmit={saveEntry}><FormField label="Movement" required><SelectInput value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value as 'INFLOW' | 'OUTFLOW' })}><option value="OUTFLOW">Money out (expense / payout)</option><option value="INFLOW">Money in (cash returned / added)</option></SelectInput></FormField><FormField label="Amount (GHS)" required><TextInput type="number" min="0.01" step="0.01" value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} required /></FormField><FormField label="Reason / description" required><TextInput value={entry.description} onChange={(e) => setEntry({ ...entry, description: e.target.value })} placeholder="e.g. Generator fuel" required /></FormField>{entry.type === 'OUTFLOW' && <FormField label="Category" required><SelectInput value={entry.category} onChange={(e) => setEntry({ ...entry, category: e.target.value })}>{CASH_CATEGORIES.map((category) => <option key={category} value={category}>{category.replace('_', ' ')}</option>)}</SelectInput></FormField>}<FormField label="Received by"><TextInput value={entry.recipient} onChange={(e) => setEntry({ ...entry, recipient: e.target.value })} placeholder="Person or supplier" /></FormField><FormField label="Receipt reference"><TextInput value={entry.receiptRef} onChange={(e) => setEntry({ ...entry, receiptRef: e.target.value })} placeholder="Optional receipt or invoice number" /></FormField><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEntryOpen(false)}>Cancel</Button><Button type="submit" loading={saving}>Save movement</Button></div></form></Modal>
  </div>;
};

export default CashRegisterPage;
