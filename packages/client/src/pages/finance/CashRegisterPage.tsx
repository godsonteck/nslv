import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { formatCurrency, PERMISSIONS } from '@nslv/shared';
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Plus,
  Printer,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Button,
  DataTable,
  FormField,
  Modal,
  PageHeader,
  SelectInput,
  showToast,
  TextInput,
} from '../../components/ui';
import { apiFetch } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { cashRegisterApi } from '../../services/apiService';

const CASH_CATEGORIES = [
  { value: 'FUEL', label: 'Fuel' },
  { value: 'SUPPLIES', label: 'Supplies' },
  { value: 'STAFF_MEALS', label: 'Staff Meals' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'MISC', label: 'Miscellaneous' },
];

interface CashEntry {
  id: string;
  type: 'OPENING' | 'INFLOW' | 'OUTFLOW';
  amount: number;
  description: string;
  category?: string;
  recipient?: string;
  receiptRef?: string;
  recordedAt: string;
}

interface CashPayment {
  id: string;
  amount: number;
  type: 'PAYMENT';
  source?: string;
  sourceId?: string;
  reference?: string;
  description?: string;
  processedAt: string;
}

interface CashRegisterSummary {
  businessDate: string;
  openingCash: number;
  carriedForward: number;
  carriedFromDate?: string | null;
  inflows: number;
  outflows: number;
  cashSales: number;
  netCash: number;
  entries: CashEntry[];
  cashPayments: CashPayment[];
  byCategory: Record<string, number>;
}

const token = () => useAuthStore.getState().tokens?.accessToken ?? null;

const typeColors = {
  OPENING: 'bg-blue-100 text-blue-700',
  INFLOW: 'bg-emerald-100 text-emerald-700',
  OUTFLOW: 'bg-rose-100 text-rose-700',
};

const typeIcons = {
  OPENING: DollarSign,
  INFLOW: ArrowUp,
  OUTFLOW: ArrowDown,
};

const typeLabels = {
  OPENING: 'Opening Balance',
  INFLOW: 'Money In',
  OUTFLOW: 'Money Out',
};

export const CashRegisterPage: React.FC = () => {
  const { hasPermission, user } = useAuthStore();
  const isReception = user?.roles?.some((role) => role.name === 'Reception') ?? false;
  const canManage = hasPermission(PERMISSIONS.CASH_REGISTER_MANAGE) || isReception;

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(() => todayStr);
  const [summary, setSummary] = useState<CashRegisterSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openingOpen, setOpeningOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');

  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState({
    type: 'OUTFLOW' as 'INFLOW' | 'OUTFLOW',
    amount: '',
    description: '',
    category: 'FUEL',
    recipient: '',
    receiptRef: '',
  });

  const [momoDepositOpen, setMomoDepositOpen] = useState(false);
  const [momoDepositAmount, setMomoDepositAmount] = useState('');
  const [momoDepositDescription, setMomoDepositDescription] = useState('');
  const [momoDepositReference, setMomoDepositReference] = useState('');

  const token = () => useAuthStore.getState().tokens?.accessToken ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CashRegisterSummary | null>(`/cash-register?businessDate=${selectedDate}`, {}, token());
      setSummary(data);
      if (data) {
        const alert = await cashRegisterApi.getLowCashAlert(selectedDate, 200);
        if (alert.data?.isLow) showToast('warning', alert.data.message);
      }
    } catch (error: any) {
      showToast('error', error?.message ?? 'Unable to load the cash record.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { void load(); }, [load]);

  const shiftDate = (days: number) => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const saveOpening = async (event: React.FormEvent) => {
    event.preventDefault();
    if (openingAmount === '' || Number(openingAmount) < 0) return showToast('error', 'Enter a valid cash balance.');
    setSaving(true);
    try {
      await apiFetch('/cash-register/opening', {
        method: 'POST',
        body: JSON.stringify({ businessDate: selectedDate, amount: Number(openingAmount), notes: openingNotes || undefined }),
      }, token());
      showToast('success', 'Cash at hand balance recorded.');
      setOpeningOpen(false);
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Unable to record the cash balance.');
    } finally {
      setSaving(false);
    }
  };

  const saveEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entry.amount || Number(entry.amount) <= 0 || !entry.description.trim()) return showToast('error', 'Amount and description are required.');
    setSaving(true);
    try {
      await apiFetch('/cash-register/entries', {
        method: 'POST',
        body: JSON.stringify({
          businessDate: selectedDate,
          type: entry.type,
          amount: Number(entry.amount),
          description: entry.description.trim(),
          ...(entry.type === 'OUTFLOW' ? { category: entry.category } : {}),
          recipient: entry.recipient || undefined,
          receiptRef: entry.receiptRef || undefined,
        }),
      }, token());
      showToast('success', entry.type === 'OUTFLOW' ? 'Money-out record saved.' : 'Money-in record saved.');
      setEntryOpen(false);
      setEntry({ type: 'OUTFLOW', amount: '', description: '', category: 'FUEL', recipient: '', receiptRef: '' });
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Unable to record cash movement.');
    } finally {
      setSaving(false);
    }
  };

  const saveMomoDeposit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!momoDepositAmount || Number(momoDepositAmount) <= 0 || !momoDepositDescription.trim()) return showToast('error', 'Amount and description are required.');
    setSaving(true);
    try {
      await cashRegisterApi.recordBankDeposit({
        businessDate: selectedDate,
        amount: Number(momoDepositAmount),
        description: momoDepositDescription.trim(),
        reference: momoDepositReference || undefined,
      });
      showToast('success', 'MoMo deposit recorded.');
      setMomoDepositOpen(false);
      setMomoDepositAmount('');
      setMomoDepositDescription('');
      setMomoDepositReference('');
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Unable to record MoMo deposit.');
    } finally {
      setSaving(false);
    }
  };

  const openHandover = async () => {
    try {
      const res = await cashRegisterApi.getShiftHandover(selectedDate);
      if (res.data?.items) {
        const itemsHtml = res.data.items.map((i: { checked: boolean; label: string; value: string }) =>
          `${i.checked ? '✅' : '⬜'} ${i.label}: ${i.value}`
        ).join('\n');
        const msg = `SHIFT HANDOVER - ${new Date(selectedDate).toLocaleDateString()}
Expected cash: GHS ${res.data.expectedCash.toFixed(2)}
${res.data.incompleteCount > 0 ? `\n⚠️ ${res.data.incompleteCount} items pending:\n${itemsHtml}` : '\n✅ All checks complete'}

${itemsHtml}`;
        alert(msg);
      } else {
        showToast('error', 'No data for handover');
      }
    } catch (error: any) {
      showToast('error', error?.message ?? 'Unable to load handover');
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!window.confirm('Delete this cash movement?')) return;
    try {
      await apiFetch(`/cash-register/entries/${entryId}`, { method: 'DELETE' }, token());
      showToast('success', 'Cash movement deleted.');
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Unable to delete the cash movement.');
    }
  };

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

  const clearAllEntries = async () => {
    if (!window.confirm(`Reset the cash register for ${selectedDate}? This removes the opening balance and every manual cash entry for that date. Completed cash sales stay recorded for accounting. This cannot be undone.`)) return;
    try {
      await cashRegisterApi.clearAllEntries(selectedDate);
      showToast('success', 'Cash register reset. You can enter a new opening balance and new cash movements.');
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to clear entries');
    }
  };

  const columns = [
    { key: 'recordedAt', header: 'Time', render: (row: CashEntry) => new Date(row.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { key: 'type', header: 'Type', render: (row: CashEntry) => {
        const Icon = typeIcons[row.type];
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${typeColors[row.type]}`}>
            <Icon size={10} />
            {typeLabels[row.type]}
          </span>
        );
      } },
    { key: 'description', header: 'Description', render: (row: CashEntry) => row.description },
    { key: 'category', header: 'Category', render: (row: CashEntry) => row.category || '—' },
    { key: 'recipient', header: 'Recipient', render: (row: CashEntry) => row.recipient || '—' },
    { key: 'receiptRef', header: 'Receipt', render: (row: CashEntry) => row.receiptRef || '—' },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (row: CashEntry) => (
      <span className={row.type === 'OUTFLOW' ? 'text-rose-600 font-semibold' : row.type === 'INFLOW' ? 'text-emerald-600 font-semibold' : 'font-semibold'}>
        {row.type === 'OUTFLOW' ? '−' : row.type === 'INFLOW' ? '+' : ''}{formatCurrency(row.amount)}
      </span>
    ) },
    { key: 'actions', header: '', align: 'right' as const, render: (row: CashEntry) => canManage && row.type !== 'OPENING' ? (
      <div className="flex items-center gap-1 justify-end">
        <Button variant="ghost" size="sm" onClick={() => printReceipt(row)} title="Print receipt"><Printer size={14} /></Button>
        <Button variant="ghost" size="sm" onClick={() => void deleteEntry(row.id)} title="Delete movement" className="text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></Button>
      </div>
    ) : null },
  ];

  const paymentColumns = [
    { key: 'processedAt', header: 'Time', render: (row: CashPayment) => new Date(row.processedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { key: 'type', header: 'Movement', render: (row: CashPayment) => (
      <span className="text-emerald-700 font-semibold">Cash sale</span>
    ) },
    { key: 'description', header: 'Source', render: (row: CashPayment) => row.description || row.source || 'Cash payment' },
    { key: 'reference', header: 'Reference', render: (row: CashPayment) => row.reference || row.sourceId || '—' },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (row: CashPayment) => (
      <span className="text-emerald-700 font-semibold">+{formatCurrency(Number(row.amount))}</span>
    ) },
  ];

  const openBalance = () => { setOpeningAmount(summary ? String(summary.openingCash) : ''); setOpeningNotes(''); setOpeningOpen(true); };
  const openEntry = (type: 'INFLOW' | 'OUTFLOW') => { setEntry({ type, amount: '', description: '', category: 'FUEL', recipient: '', receiptRef: '' }); setEntryOpen(true); };

  if (!summary && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#16a4d4] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Low cash alert banner */}
      {summary && summary.netCash < 200 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-center gap-3">
          <ShieldAlert className="text-amber-600" size={24} />
          <div className="flex-1">
            <div className="font-bold text-amber-800">Low Cash Alert</div>
            <div className="text-sm text-amber-700">
              Cash at hand (GHS {summary.netCash.toFixed(2)}) is below GHS 200. Consider recording a MoMo deposit or requesting float top-up.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cash at Hand</h1>
          <p className="text-slate-500 mt-1">Live handover balance — brought forward + cash sales + cash received − money paid out</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={openBalance} className="gap-1.5">
                <DollarSign size={14} /> Set opening balance
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEntry('INFLOW')} className="gap-1.5">
                <ArrowUp size={14} /> Record cash in
              </Button>
              <Button variant="primary" size="sm" onClick={() => openEntry('OUTFLOW')} className="gap-1.5">
                <ArrowDown size={14} /> Record money out
              </Button>
<Button variant="outline" size="sm" onClick={() => { setMomoDepositAmount(''); setMomoDepositDescription(''); setMomoDepositReference(''); setMomoDepositOpen(true); }} className="gap-1.5">
                <Smartphone size={14} /> Record MoMo deposit
              </Button>
              <Button variant="secondary" size="sm" onClick={openHandover} className="gap-1.5">
                <Users size={14} /> Shift handover
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAllEntries} className="text-rose-600 hover:bg-rose-50 border-rose-200 gap-1.5">
                <Trash2 size={14} /> Clear entries
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <Button variant="outline" size="sm" onClick={() => shiftDate(-1)} aria-label="Previous day"><ChevronLeft size={14} /></Button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:border-[#16a4d4] focus:outline-none"
        />
        <Button variant="outline" size="sm" onClick={() => shiftDate(1)} aria-label="Next day"><ChevronRight size={14} /></Button>
        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>Today</Button>
        <Button variant="ghost" size="sm" onClick={() => void load()} loading={loading}><RefreshCw size={14} /> Refresh</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Brought forward"
          amount={summary?.carriedForward ?? 0}
          icon={<DollarSign size={16} />}
          note={summary?.carriedFromDate ? `Calculated from ${new Date(summary.carriedFromDate!).toLocaleDateString()}` : 'No counted balance recorded yet'}
          color="blue"
        />
        <SummaryCard
          label="Cash sales (POS)"
          amount={summary?.cashSales ?? 0}
          icon={<ArrowUp size={16} />}
          note="Completed cash payments, recorded automatically"
          color="emerald"
        />
        <SummaryCard
          label="Cash received"
          amount={summary?.inflows ?? 0}
          icon={<ArrowUp size={16} />}
          note="Manual additions recorded today"
          color="emerald"
        />
        <SummaryCard
          label="Cash out"
          amount={summary?.outflows ?? 0}
          icon={<ArrowDown size={16} />}
          note="Payouts recorded today"
          color="rose"
        />
        <SummaryCard
          label="Available cash at hand"
          amount={summary?.netCash ?? 0}
          icon={<Calculator size={16} />}
          note="Live balance for the next handover"
          color="slate"
        />
      </div>

      {/* Manual Entries Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Manual Entries</h2>
          <span className="text-sm text-slate-500">{summary?.entries?.length ?? 0} entries</span>
        </div>
        <DataTable
          columns={columns}
          data={summary?.entries ?? []}
          loading={loading}
          keyFn={(row) => row.id}
          emptyTitle="No cash record for this date"
          emptySubtitle="Choose any prior date to record its cash balance, then record money paid out for expenses or other uses."
        />
      </section>

      {/* POS Cash Sales Table */}
      {summary && summary.cashPayments && summary.cashPayments.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">POS Cash Sales</h2>
            <span className="text-sm text-slate-500">{summary.cashPayments.length} transactions</span>
          </div>
          <DataTable
            columns={paymentColumns}
            data={summary.cashPayments}
            loading={loading}
            keyFn={(row) => row.id}
            emptyTitle="No cash sales for this date"
            emptySubtitle="Completed cash payments appear here automatically and are included in the live handover balance."
          />
        </section>
      )}

      {/* Modals */}
      <Modal open={openingOpen} onClose={() => setOpeningOpen(false)} title="Set Opening Balance">
        <form onSubmit={saveOpening} className="space-y-4">
          <FormField label="Business date" required>
            <input type="date" value={selectedDate} readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm" />
          </FormField>
          <FormField label="Opening amount (GHS)" required>
            <TextInput type="number" min="0" step="0.01" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} placeholder="0.00" required />
          </FormField>
          <FormField label="Notes (optional)">
            <TextInput value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} placeholder="e.g. cash brought forward from last week" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpeningOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={saving}>Save opening balance</Button>
          </div>
        </form>
      </Modal>

      <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title={entry.type === 'OUTFLOW' ? 'Record money out' : 'Record money in'}>
        <form onSubmit={saveEntry} className="space-y-4">
          <FormField label="Movement" required>
            <SelectInput
              value={entry.type}
              onChange={(e) => setEntry({ ...entry, type: e.target.value as 'INFLOW' | 'OUTFLOW' })}
            >
              <option value="INFLOW">Money in (cash received / added)</option>
              <option value="OUTFLOW">Money out (expense / payout)</option>
            </SelectInput>
          </FormField>
          <FormField label="Amount (GHS)" required>
            <TextInput type="number" min="0.01" step="0.01" value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} placeholder="0.00" required />
          </FormField>
          <FormField label="Reason / description" required>
            <TextInput value={entry.description} onChange={(e) => setEntry({ ...entry, description: e.target.value })} placeholder="e.g. Generator fuel, Staff lunch, Guest refund" required />
          </FormField>
          {entry.type === 'OUTFLOW' && (
            <FormField label="Category" required>
              <SelectInput
                value={entry.category}
                onChange={(e) => setEntry({ ...entry, category: e.target.value })}
              >
                {CASH_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </SelectInput>
            </FormField>
          )}
          <FormField label="Recipient (who received the money)">
            <TextInput value={entry.recipient} onChange={(e) => setEntry({ ...entry, recipient: e.target.value })} placeholder="e.g. Kofi Mensah, Shell Station" />
          </FormField>
          <FormField label="Receipt reference (optional)">
            <TextInput value={entry.receiptRef} onChange={(e) => setEntry({ ...entry, receiptRef: e.target.value })} placeholder="Receipt # or invoice reference" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEntryOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={saving}>Save {entry.type === 'OUTFLOW' ? 'money out' : 'money in'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={momoDepositOpen} onClose={() => setMomoDepositOpen(false)} title="Record MoMo Deposit">
        <form onSubmit={saveMomoDeposit} className="space-y-4">
          <FormField label="Business date" required>
            <input type="date" value={selectedDate} readOnly className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm" />
          </FormField>
          <FormField label="Amount (GHS)" required>
            <TextInput type="number" min="0.01" step="0.01" value={momoDepositAmount} onChange={(e) => setMomoDepositAmount(e.target.value)} placeholder="0.00" required />
          </FormField>
          <FormField label="Description" required>
            <TextInput value={momoDepositDescription} onChange={(e) => setMomoDepositDescription(e.target.value)} placeholder="e.g. Cash deposited to MTN MoMo" required />
          </FormField>
          <FormField label="Reference (optional)">
            <TextInput value={momoDepositReference} onChange={(e) => setMomoDepositReference(e.target.value)} placeholder="Transaction ID / reference" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setMomoDepositOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={saving}><Smartphone size={14} /> Save MoMo deposit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// Summary Card Component
const SummaryCard: React.FC<{
  label: string;
  amount: number;
  icon: React.ReactNode;
  note: string;
  color: 'blue' | 'emerald' | 'rose' | 'slate';
}> = ({ label, amount, icon, note, color }) => {
  const colors = {
    blue: { border: 'border-blue-500', iconBg: 'bg-blue-100', iconColor: 'text-blue-700', amountColor: 'text-blue-700' },
    emerald: { border: 'border-emerald-500', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700', amountColor: 'text-emerald-700' },
    rose: { border: 'border-rose-500', iconBg: 'bg-rose-100', iconColor: 'text-rose-700', amountColor: 'text-rose-700' },
    slate: { border: 'border-slate-500', iconBg: 'bg-slate-100', iconColor: 'text-slate-700', amountColor: 'text-slate-900' },
  };
  const c = colors[color];

  return (
    <div className={`rounded-xl border-l-4 ${c.border} bg-white p-4.5 shadow-sm border-slate-200 space-y-2`}>
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-[10px] font-extrabold uppercase tracking-wider">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.iconBg} ${c.iconColor}`}>{icon}</span>
      </div>
      <div className={`text-xl font-extrabold leading-tight ${c.amountColor}`}>{formatCurrency(amount)}</div>
      <div className="text-[10px] text-slate-500 font-semibold">{note}</div>
    </div>
  );
};

export default CashRegisterPage;
