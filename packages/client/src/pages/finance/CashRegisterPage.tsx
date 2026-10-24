import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { formatCurrency, PERMISSIONS } from '@nslv/shared';
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  DollarSign,
  FileText,
  HelpCircle,
  Lock,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Button,
  DataTable,
  FormField,
  Modal,
  SelectInput,
  showToast,
  TextInput,
} from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
import { useAuthStore } from '../../stores/authStore';
import { cashRegisterApi, CashRegisterSummary, CashEntryRecord } from '../../services/apiService';
import { printCashHandoverSlip, CashHandoverSlipData } from '../../lib/company';

const CASH_CATEGORIES = [
  { value: 'FUEL', label: 'Generator & Vehicle Fuel' },
  { value: 'SUPPLIES', label: 'Guest & Kitchen Supplies' },
  { value: 'STAFF_MEALS', label: 'Staff Meals & Catering' },
  { value: 'MAINTENANCE', label: 'Villa Repairs & Maintenance' },
  { value: 'UTILITIES', label: 'Water, Electricity & Waste' },
  { value: 'TRANSPORT', label: 'Transport & Errands' },
  { value: 'MISC', label: 'Miscellaneous Operational' },
];

export const CashRegisterPage: React.FC = () => {
  const { hasPermission, user } = useAuthStore();
  const isReception = user?.roles?.some((role: any) => {
    const roleName = typeof role === 'string' ? role : role?.name;
    return roleName?.toLowerCase() === 'reception';
  }) ?? false;
  const canManage = hasPermission(PERMISSIONS.CASH_REGISTER_MANAGE) || isReception;

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(() => todayStr);
  const [summary, setSummary] = useState<CashRegisterSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'ENTRIES' | 'PAYMENTS' | 'CATEGORIES'>('ENTRIES');

  // Modals state
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

  // End-of-Day Handover Modal state
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverAmount, setHandoverAmount] = useState('');
  const [handoverRecipient, setHandoverRecipient] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cashRegisterApi.getSummary(selectedDate);
      setSummary(res.data);
    } catch (error: any) {
      showToast('error', error?.message ?? 'Unable to load cash register.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftDate = (days: number) => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  // Calculations & Safety fallbacks
  const openingCash = summary?.openingCash ?? 0;
  const cashSales = summary?.cashSales ?? 0;
  const manualInflows = summary?.manualInflows ?? 0;
  const totalCollections = summary?.totalCashCollected ?? (cashSales + manualInflows);
  const manualOutflows = summary?.manualOutflows ?? summary?.outflows ?? 0;
  const momoDeposits = summary?.momoDeposits ?? 0;
  const totalDeductions = manualOutflows;
  const expectedTotal = summary?.expectedCash ?? Math.max(0, openingCash + totalCollections - totalDeductions);
  const handovers = summary?.handovers ?? summary?.totalHandedOver ?? 0;
  const cashAtHand = summary?.availableCashAtHand ?? summary?.netCash ?? Math.max(0, expectedTotal - handovers);
  const isHandedOver = summary?.isHandedOver ?? (handovers > 0 && cashAtHand <= 0.01);

  // Handover entries
  const handoverEntries = useMemo(() => {
    return (summary?.entries ?? []).filter((e) => e.category === 'HANDOVER');
  }, [summary?.entries]);

  // General entries (non-handover)
  const displayEntries = useMemo(() => {
    return (summary?.entries ?? []).filter((e) => e.type !== 'OPENING');
  }, [summary?.entries]);

  // Actions
  const handleSaveOpening = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(openingAmount);
    if (!Number.isFinite(amt) || amt < 0) return showToast('error', 'Please enter a valid non-negative float amount.');
    setSaving(true);
    try {
      await cashRegisterApi.setOpeningCash({
        businessDate: selectedDate,
        amount: amt,
        notes: openingNotes.trim() || undefined,
      });
      showToast('success', 'Morning change float recorded.');
      setOpeningOpen(false);
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to set morning float.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(entry.amount);
    if (!Number.isFinite(amt) || amt <= 0) return showToast('error', 'Amount must be greater than zero.');
    if (!entry.description.trim()) return showToast('error', 'Please enter a description.');
    setSaving(true);
    try {
      await cashRegisterApi.addEntry({
        businessDate: selectedDate,
        type: entry.type,
        amount: amt,
        description: entry.description.trim(),
        category: entry.type === 'OUTFLOW' ? entry.category : undefined,
        recipient: entry.recipient.trim() || undefined,
        receiptRef: entry.receiptRef.trim() || undefined,
      });
      showToast('success', entry.type === 'OUTFLOW' ? 'Cash payout recorded.' : 'Cash inflow recorded.');
      setEntryOpen(false);
      setEntry({
        type: 'OUTFLOW',
        amount: '',
        description: '',
        category: 'FUEL',
        recipient: '',
        receiptRef: '',
      });
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to record entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMomoDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(momoDepositAmount);
    if (!Number.isFinite(amt) || amt <= 0) return showToast('error', 'Amount must be greater than zero.');
    if (!momoDepositDescription.trim()) return showToast('error', 'Please enter wallet/deposit description.');
    setSaving(true);
    try {
      await cashRegisterApi.recordBankDeposit({
        businessDate: selectedDate,
        amount: amt,
        description: momoDepositDescription.trim(),
        reference: momoDepositReference.trim() || undefined,
      });
      showToast('success', 'Cash deduction for MoMo deposit recorded.');
      setMomoDepositOpen(false);
      setMomoDepositAmount('');
      setMomoDepositDescription('');
      setMomoDepositReference('');
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to record MoMo deposit.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHandoverModal = () => {
    setHandoverAmount(cashAtHand > 0 ? String(cashAtHand) : (expectedTotal > 0 ? String(expectedTotal) : '0'));
    setHandoverRecipient('');
    setHandoverNotes('');
    setHandoverOpen(true);
  };

  const handleSaveHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(handoverAmount);
    if (!Number.isFinite(amt) || amt <= 0) return showToast('error', 'Handover amount must be greater than zero.');
    if (!handoverRecipient.trim()) return showToast('error', 'Recipient name (Management/Accounts) is required.');
    setSaving(true);
    try {
      await cashRegisterApi.recordHandover({
        businessDate: selectedDate,
        amount: amt,
        recipient: handoverRecipient.trim(),
        notes: handoverNotes.trim() || undefined,
      });
      showToast('success', 'Close-of-Day cash handover to Management recorded!');
      setHandoverOpen(false);
      await load();

      // Trigger automatic handover slip print
      const staffName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'Reception Staff';
      printCashHandoverSlip({
        businessDate: selectedDate,
        handedOverBy: staffName,
        receivedBy: handoverRecipient.trim(),
        openingFloat: openingCash,
        cashSales,
        manualInflows,
        totalCollected: totalCollections,
        expenses: manualOutflows - momoDeposits,
        momoDeposits,
        totalDeductions,
        expectedAmount: expectedTotal,
        handoverAmount: amt,
        remainingCash: Math.max(0, cashAtHand - amt),
        notes: handoverNotes.trim() || undefined,
        byCategory: summary?.byCategory,
      });
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to record handover.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryRecord: CashEntryRecord) => {
    if (!window.confirm(`Delete cash movement "${entryRecord.description}"? This cannot be undone.`)) return;
    try {
      await cashRegisterApi.deleteEntry(entryRecord.id);
      showToast('success', 'Entry deleted.');
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to delete entry.');
    }
  };

  const handlePrintHandoverSlip = (entryItem?: CashEntryRecord) => {
    const staffName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'Reception Staff';
    const recipient = entryItem?.recipient || 'Villa Management';
    const handoverAmt = entryItem ? Number(entryItem.amount) : (handovers > 0 ? handovers : cashAtHand);

    const slipData: CashHandoverSlipData = {
      businessDate: selectedDate,
      voucherRef: entryItem?.receiptRef || undefined,
      handoverTime: entryItem?.recordedAt || undefined,
      handedOverBy: staffName,
      receivedBy: recipient,
      openingFloat: openingCash,
      cashSales,
      manualInflows,
      totalCollected: totalCollections,
      expenses: manualOutflows - momoDeposits,
      momoDeposits,
      totalDeductions,
      expectedAmount: expectedTotal,
      handoverAmount: handoverAmt,
      remainingCash: isHandedOver ? 0 : Math.max(0, cashAtHand - handoverAmt),
      notes: entryItem?.description || summary?.openingNotes || undefined,
      byCategory: summary?.byCategory,
    };

    printCashHandoverSlip(slipData);
  };

  const handlePrintIndividualSlip = (row: CashEntryRecord) => {
    const slipHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Receipt - ${row.receiptRef || row.id.slice(-6)}</title>
        <style>
          body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; color: #111; }
          .header { text-align: center; border-bottom: 1px dashed #666; padding-bottom: 10px; margin-bottom: 12px; }
          .title { font-size: 14px; font-weight: bold; }
          .sub { font-size: 10px; color: #555; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px; }
          .bold { font-weight: bold; }
          .total { border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 6px 0; margin-top: 10px; font-size: 13px; font-weight: bold; }
          .footer { text-align: center; font-size: 9px; color: #777; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">NS LUXURY VILLA</div>
          <div class="sub">Front Desk Cash Voucher</div>
          <div class="sub">Ho, Volta Region, Ghana</div>
        </div>
        <div class="row"><span>Date:</span><span>${new Date(row.recordedAt).toLocaleString('en-GH')}</span></div>
        <div class="row"><span>Type:</span><span class="bold">${row.type}</span></div>
        <div class="row"><span>Category:</span><span>${row.category || 'GENERAL'}</span></div>
        <div class="row"><span>Ref:</span><span>${row.receiptRef || '—'}</span></div>
        <div class="row"><span>Recipient:</span><span>${row.recipient || '—'}</span></div>
        <div style="margin-top:8px;font-size:11px;"><strong>Description:</strong> ${row.description}</div>
        <div class="total row">
          <span>Amount:</span>
          <span>${row.type === 'OUTFLOW' ? '−' : '+'}GH₵ ${Number(row.amount).toFixed(2)}</span>
        </div>
        <div style="margin-top:20px;border-top:1px dashed #999;padding-top:4px;font-size:10px;">
          <div>Recorded By: ${row.recordedBy || 'Staff'}</div>
          <div style="margin-top:20px;border-bottom:1px solid #333;"></div>
          <div style="text-align:center;font-size:9px;">Authorized Signature</div>
        </div>
        <div class="footer">NS Luxury Villa • Thank you</div>
      </body>
      </html>
    `;
    const win = window.open('', '_blank', 'width=360,height=560');
    if (win) {
      win.document.write(slipHtml);
      win.document.close();
      win.print();
    }
  };

  const handleResetRegister = async () => {
    if (!window.confirm(`Reset manual cash drawer entries for ${selectedDate}? POS cash sales are not removed. This will allow recording a fresh day register.`)) return;
    try {
      await cashRegisterApi.clearAllEntries(selectedDate);
      showToast('success', 'Day cash drawer entries reset.');
      await load();
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to reset.');
    }
  };

  return (
    <ShellPage
      eyebrow="Front Desk Finance"
      title="Cash at Hand"
      subtitle="Daily drawer reconciliation and close-of-day handover."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenHandoverModal}
                className="gap-1.5 bg-[#c59a58] hover:bg-[#b88738] text-white shadow-sm font-semibold"
              >
                <UserCheck size={14} /> Hand Over to Management
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEntry({
                    type: 'OUTFLOW',
                    amount: '',
                    description: '',
                    category: 'FUEL',
                    recipient: '',
                    receiptRef: '',
                  });
                  setEntryOpen(true);
                }}
                className="gap-1.5 border-[var(--ns-line)] hover:border-[#c59a58]/50 transition-colors"
                style={{ color: 'var(--ns-ink)', backgroundColor: 'var(--ns-surface)' }}
              >
                <TrendingDown size={14} className="text-rose-500" /> Record Cash Out
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEntry({
                    type: 'INFLOW',
                    amount: '',
                    description: '',
                    category: 'MISC',
                    recipient: '',
                    receiptRef: '',
                  });
                  setEntryOpen(true);
                }}
                className="gap-1.5 border-[var(--ns-line)] hover:border-[#c59a58]/50 transition-colors"
                style={{ color: 'var(--ns-ink)', backgroundColor: 'var(--ns-surface)' }}
              >
                <TrendingUp size={14} className="text-emerald-500" /> Record Cash In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMomoDepositAmount('');
                  setMomoDepositDescription('');
                  setMomoDepositReference('');
                  setMomoDepositOpen(true);
                }}
                className="gap-1.5 border-[var(--ns-line)] hover:border-[#c59a58]/50 transition-colors"
                style={{ color: 'var(--ns-ink)', backgroundColor: 'var(--ns-surface)' }}
              >
                <Smartphone size={14} className="text-amber-500" /> MoMo Wallet Deposit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpeningAmount(openingCash > 0 ? String(openingCash) : '');
                  setOpeningNotes(summary?.openingNotes || '');
                  setOpeningOpen(true);
                }}
                className="gap-1.5 hover:bg-[var(--ns-surface-2)] transition-colors"
                style={{ color: 'var(--ns-muted)' }}
              >
                <Coins size={14} /> Morning Float
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* Date Navigator */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--ns-line)] p-3.5 shadow-sm"
        style={{ backgroundColor: 'var(--ns-surface)' }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => shiftDate(-1)}
            aria-label="Previous Day"
            className="h-9 w-9 p-0 border-[var(--ns-line)]"
            style={{ color: 'var(--ns-ink)' }}
          >
            <ChevronLeft size={16} />
          </Button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 rounded-xl border border-[var(--ns-line)] px-3 text-sm font-semibold focus:border-[#c59a58] focus:outline-none focus:ring-1 focus:ring-[#c59a58]"
            style={{ backgroundColor: 'var(--ns-surface-2)', color: 'var(--ns-ink)' }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => shiftDate(1)}
            aria-label="Next Day"
            className="h-9 w-9 p-0 border-[var(--ns-line)]"
            style={{ color: 'var(--ns-ink)' }}
          >
            <ChevronRight size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDate(todayStr)}
            className="h-9 text-xs font-bold text-[#c59a58] hover:bg-[#c59a58]/10"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-GH', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            loading={loading}
            className="h-9 gap-1.5 text-xs font-bold text-[#c59a58] hover:bg-[#c59a58]/10"
          >
            <RefreshCw size={13} /> Refresh
          </Button>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetRegister}
              className="h-9 gap-1 text-[11px] font-bold text-rose-500 hover:bg-rose-500/10"
              title="Reset manual drawer entries"
            >
              <Trash2 size={13} /> Reset Day
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {isHandedOver ? (
        <div
          className="relative overflow-hidden rounded-2xl border border-[var(--ns-line)] p-5 shadow-sm"
          style={{ backgroundColor: 'var(--ns-surface)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#c59a58]">
                  Handover Complete
                </span>
                <h3 className="mt-0.5 text-base font-bold font-serif" style={{ color: 'var(--ns-ink)' }}>
                  Cash Handover Recorded ({formatCurrency(handovers)})
                </h3>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--ns-muted)' }}>
                  Drawer balanced and handed over to Management.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrintHandoverSlip(handoverEntries[0])}
              className="gap-1.5 border-[var(--ns-line)] hover:border-[#c59a58]/50"
              style={{ color: 'var(--ns-ink)', backgroundColor: 'var(--ns-surface-2)' }}
            >
              <Printer size={14} className="text-[#c59a58]" /> Print Slip
            </Button>
          </div>
        </div>
      ) : cashAtHand > 0 ? (
        <div
          className="relative overflow-hidden rounded-2xl border border-amber-500/40 p-5 shadow-sm"
          style={{ backgroundColor: 'var(--ns-surface)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <Lock size={18} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                  Pending Handover
                </span>
                <h3 className="mt-0.5 text-base font-bold font-serif" style={{ color: 'var(--ns-ink)' }}>
                  Cash in Drawer: {formatCurrency(cashAtHand)}
                </h3>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--ns-muted)' }}>
                  Count and record handover before ending shift.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenHandoverModal}
              className="gap-1.5 bg-[#c59a58] hover:bg-[#b88738] text-white font-semibold"
            >
              <UserCheck size={14} /> Hand Over Cash
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-2xl border border-[var(--ns-line)] p-4 shadow-sm"
          style={{ backgroundColor: 'var(--ns-surface)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--ns-surface-2)', color: 'var(--ns-teal)' }}
            >
              <Clock size={16} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>
                Drawer Ready
              </span>
              <p className="text-xs font-semibold" style={{ color: 'var(--ns-ink)' }}>
                Current drawer balance is GH₵ 0.00. Ready for daily entries or morning float.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metric Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Morning Float"
          value={formatCurrency(openingCash)}
          note={openingCash > 0 ? 'Counted change float' : 'Started at zero'}
          icon={Coins}
        />
        <StatTile
          label="Cash Inflows"
          value={formatCurrency(totalCollections)}
          note="POS sales and recorded inflows"
          icon={TrendingUp}
          accent={totalCollections > 0}
        />
        <StatTile
          label="Drawer Deductions"
          value={formatCurrency(totalDeductions)}
          note="Expenses and bank deposits"
          icon={TrendingDown}
        />
        <StatTile
          label="Handed Over"
          value={formatCurrency(handovers)}
          note={isHandedOver ? 'Closed and handed over' : 'Pending close of day'}
          icon={UserCheck}
          accent={isHandedOver}
        />
        <StatTile
          label="Cash at Hand"
          value={formatCurrency(cashAtHand)}
          note={
            cashAtHand === 0 && isHandedOver
              ? 'Balanced after handover'
              : cashAtHand > 0
              ? 'Physical cash in till'
              : 'Drawer empty'
          }
          icon={Wallet}
          accent={cashAtHand > 0}
        />
      </div>

      {/* ── Tabs Navigation ── */}
      <div
        className="flex border-b border-[var(--ns-line)] rounded-t-2xl px-5 pt-3"
        style={{ backgroundColor: 'var(--ns-surface)' }}
      >
        <button
          onClick={() => setActiveTab('ENTRIES')}
          className={`relative flex items-center gap-2 pb-3 pt-1 px-4 text-xs font-bold transition-colors ${
            activeTab === 'ENTRIES'
              ? 'border-b-2 border-[#c59a58]'
              : 'opacity-70 hover:opacity-100'
          }`}
          style={{ color: activeTab === 'ENTRIES' ? 'var(--ns-ink)' : 'var(--ns-muted)' }}
        >
          <Banknote size={15} />
          <span>Drawer Cash Ledger</span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{ backgroundColor: 'var(--ns-surface-2)', color: 'var(--ns-ink)' }}
          >
            {displayEntries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`relative flex items-center gap-2 pb-3 pt-1 px-4 text-xs font-bold transition-colors ${
            activeTab === 'PAYMENTS'
              ? 'border-b-2 border-[#c59a58]'
              : 'opacity-70 hover:opacity-100'
          }`}
          style={{ color: activeTab === 'PAYMENTS' ? 'var(--ns-ink)' : 'var(--ns-muted)' }}
        >
          <Receipt size={15} />
          <span>Front Desk & POS Cash Sales</span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{ backgroundColor: 'var(--ns-surface-2)', color: 'var(--ns-ink)' }}
          >
            {summary?.cashPayments?.length ?? 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`relative flex items-center gap-2 pb-3 pt-1 px-4 text-xs font-bold transition-colors ${
            activeTab === 'CATEGORIES'
              ? 'border-b-2 border-[#c59a58]'
              : 'opacity-70 hover:opacity-100'
          }`}
          style={{ color: activeTab === 'CATEGORIES' ? 'var(--ns-ink)' : 'var(--ns-muted)' }}
        >
          <FileText size={15} />
          <span>Expenses by Category</span>
        </button>
      </div>

      {/* Tab Content: Drawer Cash Ledger */}
      {activeTab === 'ENTRIES' && (
        <Section
          title="Daily Drawer Activity Log"
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--ns-muted)' }}>
                {displayEntries.length} movement{displayEntries.length !== 1 ? 's' : ''}
              </span>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr
                  className="border-b border-[var(--ns-line)] text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ backgroundColor: 'var(--ns-surface-2)', color: 'var(--ns-muted)' }}
                >
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-line)]">
                {displayEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs" style={{ color: 'var(--ns-muted)' }}>
                      No manual drawer cash movements recorded for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  displayEntries.map((row) => {
                    const isHandover = row.category === 'HANDOVER';
                    const isOutflow = row.type === 'OUTFLOW';
                    const isMomo = row.category === 'MOMO_DEPOSIT';

                    return (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-[var(--ns-surface-2)]"
                        style={{
                          backgroundColor: isHandover ? 'rgba(197,154,88,0.06)' : undefined,
                        }}
                      >
                        <td className="py-3 px-4 font-mono text-[11px]" style={{ color: 'var(--ns-muted)' }}>
                          {new Date(row.recordedAt).toLocaleTimeString('en-GH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          {isHandover ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#c59a58]/20 px-2 py-0.5 text-[10px] font-bold text-[#c59a58]">
                              <UserCheck size={11} /> Handover
                            </span>
                          ) : isMomo ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                              <Smartphone size={11} /> MoMo
                            </span>
                          ) : isOutflow ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-500">
                              <ArrowDown size={11} /> Out
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                              <ArrowUp size={11} /> In
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium max-w-xs truncate" style={{ color: 'var(--ns-ink)' }}>
                          {row.description}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[11px]" style={{ color: 'var(--ns-muted)' }}>
                          {row.category || 'General'}
                        </td>
                        <td className="py-3 px-4 font-medium" style={{ color: 'var(--ns-ink)' }}>
                          {row.recipient || 'None'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]" style={{ color: 'var(--ns-muted)' }}>
                          {row.receiptRef || 'None'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm font-bold">
                          <span
                            className={
                              isHandover
                                ? 'text-[#c59a58]'
                                : isOutflow
                                ? 'text-rose-500'
                                : 'text-emerald-500'
                            }
                          >
                            {isOutflow ? '-' : '+'}
                            {formatCurrency(Number(row.amount))}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isHandover ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintHandoverSlip(row)}
                                className="h-7 w-7 p-0 text-[#c59a58] hover:bg-[#c59a58]/10"
                                title="Print Slip"
                              >
                                <Printer size={13} />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintIndividualSlip(row)}
                                className="h-7 w-7 p-0 hover:bg-[var(--ns-surface-2)]"
                                style={{ color: 'var(--ns-muted)' }}
                                title="Print Slip"
                              >
                                <Printer size={13} />
                              </Button>
                            )}
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteEntry(row)}
                                className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50"
                                title="Delete entry"
                              >
                                <Trash2 size={13} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Tab Content: POS & Room Cash Payments ── */}
      {activeTab === 'PAYMENTS' && (
        <Section
          title="Direct Cash Revenue Today"
          subtitle="Guest payments made in cash at Front Desk or dining POS. These automatically flow into drawer cash and must be handed over."
          action={
            <div className="text-xs font-bold text-[var(--ns-ink)]">
              Total Cash Revenue: {formatCurrency(cashSales)}
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--ns-line)] bg-[var(--ns-surface-2)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Description / Folio</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-line)]">
                {(summary?.cashPayments ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-[var(--ns-muted)]">
                      No cash sales or reservation payments recorded on this date.
                    </td>
                  </tr>
                ) : (
                  (summary?.cashPayments ?? []).map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--ns-surface-2)] transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--ns-muted)]">
                        {new Date(p.processedAt).toLocaleTimeString('en-GH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#173c4d]/10 px-2 py-0.5 text-[10px] font-bold text-[#173c4d] dark:text-[#7dd3fc]">
                          {p.source || 'FRONT_DESK'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--ns-ink)]">
                        {p.description || `Payment #${p.sourceId?.slice(0, 8)}`}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[var(--ns-muted)]">
                        {p.reference || p.sourceId || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-bold text-emerald-600">
                        +{formatCurrency(Number(p.amount))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Tab Content: Expenses by Category ── */}
      {activeTab === 'CATEGORIES' && (
        <Section
          title="Operational Expense Breakdown"
          subtitle="Summary of physical cash paid out from the reception till for villa operations."
        >
          <div className="p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(summary?.byCategory ?? {}).map(([cat, amt]) => (
                <div
                  key={cat}
                  className="rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-4 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                      {cat}
                    </span>
                    <div className="mt-1 text-base font-bold text-[var(--ns-ink)]">
                      {formatCurrency(Number(amt))}
                    </div>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs">
                    {manualOutflows > 0 ? `${Math.round((Number(amt) / manualOutflows) * 100)}%` : '0%'}
                  </div>
                </div>
              ))}
            </div>
            {Object.keys(summary?.byCategory ?? {}).length === 0 && (
              <div className="py-10 text-center text-xs text-[var(--ns-muted)]">
                No expenses or payouts recorded today.
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Modal: Close-of-Day Handover ── */}
      <Modal
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        title="Close-of-Day Cash Handover to Management"
      >
        <form onSubmit={handleSaveHandover} className="space-y-4">
          <div className="rounded-xl border border-[#c59a58]/30 bg-[#c59a58]/10 p-4 text-xs text-[var(--ns-muted)] space-y-2">
            <div className="flex items-center gap-2 font-bold text-[var(--ns-ink)]">
              <Lock size={15} className="text-[#c59a58]" />
              Official Handover Policy
            </div>
            <p>
              Reception does <strong>not</strong> keep cash overnight. All physical drawer cash is counted and handed over to Management or Accounts. This resets the cash-at-hand to <strong>GH₵ 0.00</strong>.
            </p>
            <div className="flex justify-between border-t border-[var(--ns-line)] pt-2 font-semibold text-[var(--ns-ink)]">
              <span>Current Cash in Till:</span>
              <span className="font-mono text-sm font-bold text-[#b88738]">
                {formatCurrency(cashAtHand)}
              </span>
            </div>
          </div>

          <FormField label="Business Date" required>
            <input
              type="date"
              value={selectedDate}
              readOnly
              className="w-full rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface-2)] px-3.5 py-2.5 text-sm font-semibold text-[var(--ns-ink)]"
            />
          </FormField>

          <FormField label="Handover Amount (GHS)" required>
            <TextInput
              type="number"
              min="0.01"
              step="0.01"
              value={handoverAmount}
              onChange={(e) => setHandoverAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </FormField>

          <FormField label="Recipient Name (Management / Accounts Officer)" required>
            <TextInput
              value={handoverRecipient}
              onChange={(e) => setHandoverRecipient(e.target.value)}
              placeholder="e.g. Madam Comfort (General Manager) or Accounts Office"
              required
            />
          </FormField>

          <FormField label="Shift Notes / Audit Verification (optional)">
            <TextInput
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="e.g. Count verified with POS settlement & receipts"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-line)]">
            <Button type="button" variant="ghost" onClick={() => setHandoverOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              className="bg-[#173c4d] hover:bg-[#133240] text-[#fcf9f2] font-semibold gap-1.5"
            >
              <Send size={14} className="text-[#c59a58]" /> Confirm & Hand Over Cash
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Record Cash In / Out Movement ── */}
      <Modal
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        title={entry.type === 'OUTFLOW' ? 'Record Cash Payout (Money Out)' : 'Record Cash Addition (Money In)'}
      >
        <form onSubmit={handleSaveEntry} className="space-y-4">
          <FormField label="Movement Type" required>
            <SelectInput
              value={entry.type}
              onChange={(e) => setEntry({ ...entry, type: e.target.value as 'INFLOW' | 'OUTFLOW' })}
            >
              <option value="OUTFLOW">Money Out (Expense / Operational Payout)</option>
              <option value="INFLOW">Money In (Cash Added / Replenishment)</option>
            </SelectInput>
          </FormField>

          <FormField label="Amount (GHS)" required>
            <TextInput
              type="number"
              min="0.01"
              step="0.01"
              value={entry.amount}
              onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
              placeholder="0.00"
              required
            />
          </FormField>

          <FormField label="Reason / Description" required>
            <TextInput
              value={entry.description}
              onChange={(e) => setEntry({ ...entry, description: e.target.value })}
              placeholder="e.g. Generator diesel top-up, Plumbing repair parts"
              required
            />
          </FormField>

          {entry.type === 'OUTFLOW' && (
            <FormField label="Expense Category" required>
              <SelectInput
                value={entry.category}
                onChange={(e) => setEntry({ ...entry, category: e.target.value })}
              >
                {CASH_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          )}

          <FormField label="Recipient Name (Who received the cash)">
            <TextInput
              value={entry.recipient}
              onChange={(e) => setEntry({ ...entry, recipient: e.target.value })}
              placeholder="e.g. Shell Filling Station, Kofi Carpenter"
            />
          </FormField>

          <FormField label="Receipt / Invoice Reference (optional)">
            <TextInput
              value={entry.receiptRef}
              onChange={(e) => setEntry({ ...entry, receiptRef: e.target.value })}
              placeholder="e.g. INV-2026-089"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-line)]">
            <Button type="button" variant="ghost" onClick={() => setEntryOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Save {entry.type === 'OUTFLOW' ? 'Money Out' : 'Money In'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: MoMo Wallet Deposit from Drawer Cash ── */}
      <Modal
        open={momoDepositOpen}
        onClose={() => setMomoDepositOpen(false)}
        title="Record Mobile Money Deposit (from Drawer Cash)"
      >
        <form onSubmit={handleSaveMomoDeposit} className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
            <strong>Drawer Cash Deduction:</strong> Physical cash taken from the drawer to deposit into the villa MoMo merchant wallet will reduce the available cash at hand.
          </div>

          <FormField label="Amount to Transfer to MoMo (GHS)" required>
            <TextInput
              type="number"
              min="0.01"
              step="0.01"
              value={momoDepositAmount}
              onChange={(e) => setMomoDepositAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </FormField>

          <FormField label="Wallet / Agent Description" required>
            <TextInput
              value={momoDepositDescription}
              onChange={(e) => setMomoDepositDescription(e.target.value)}
              placeholder="e.g. Deposited cash to MTN Merchant 0535572774"
              required
            />
          </FormField>

          <FormField label="MoMo Transaction ID / Reference (optional)">
            <TextInput
              value={momoDepositReference}
              onChange={(e) => setMomoDepositReference(e.target.value)}
              placeholder="e.g. MoMo Trans ID 29381029102"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-line)]">
            <Button type="button" variant="ghost" onClick={() => setMomoDepositOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
            >
              <Smartphone size={14} /> Record MoMo Deduction
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Set Morning Float ── */}
      <Modal
        open={openingOpen}
        onClose={() => setOpeningOpen(false)}
        title="Morning Change Float"
      >
        <form onSubmit={handleSaveOpening} className="space-y-4">
          <div className="rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface-2)] p-3.5 text-xs text-[var(--ns-muted)]">
            Each business day starts fresh with <strong>GH₵ 0.00</strong> because cash is handed over to Management daily. If Management gave a change float for this morning, enter it below.
          </div>

          <FormField label="Morning Change Float (GHS)" required>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </FormField>

          <FormField label="Notes (optional)">
            <TextInput
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              placeholder="e.g. Morning petty cash float issued by Manager"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-line)]">
            <Button type="button" variant="ghost" onClick={() => setOpeningOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Save Morning Float
            </Button>
          </div>
        </form>
      </Modal>
    </ShellPage>
  );
};

export default CashRegisterPage;
