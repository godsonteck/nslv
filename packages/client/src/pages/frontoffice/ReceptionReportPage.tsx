// ============================================
// NS LUXURY VILLA — Reception Report Page
// Real-time Front Desk Financial, MoMo, Booking & Expense Operations
// ============================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { reportsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { formatCurrency, formatUserGreeting } from '@nslv/shared';
import {
  Smartphone,
  Banknote,
  Users,
  BedDouble,
  Receipt,
  Wallet,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Calendar,
  Layers,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  Phone,
  FileText,
  Clock,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Button, LoadingState, showToast, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';

type PeriodMode = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type ActiveTab = 'payments' | 'categories' | 'expenses' | 'reconciliation';

export default function ReceptionReportPage() {
  const user = useAuthStore((s) => s.user);
  const { theme } = useThemeStore();
  const villaName = theme?.villaName || 'NS Luxury Villa';
  const greeting = formatUserGreeting(user);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [mode, setMode] = useState<PeriodMode>('today');
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [activeTab, setActiveTab] = useState<ActiveTab>('payments');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { startDate, endDate, periodTitle } = useMemo(() => {
    if (mode === 'today') {
      return {
        startDate: todayStr,
        endDate: todayStr,
        periodTitle: `Today's Shift — ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}`,
      };
    }
    if (mode === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      return {
        startDate: yStr,
        endDate: yStr,
        periodTitle: `Yesterday — ${y.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`,
      };
    }
    if (mode === 'week') {
      const now = new Date();
      const d = now.getDay();
      const diffToMonday = d === 0 ? -6 : 1 - d;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const sStr = monday.toISOString().slice(0, 10);
      const eStr = sunday.toISOString().slice(0, 10);
      return { startDate: sStr, endDate: eStr, periodTitle: `This Week (${sStr} → ${eStr})` };
    }
    if (mode === 'month') {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      return {
        startDate: first,
        endDate: last,
        periodTitle: `Month of ${now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`,
      };
    }
    return {
      startDate: customStart,
      endDate: customEnd,
      periodTitle: `Custom: ${customStart} → ${customEnd}`,
    };
  }, [mode, todayStr, customStart, customEnd]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsApi.getReceptionReport(startDate, endDate);
      setData(res.data || null);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to generate reception report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { void load(); }, [load]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (!data) return;
    const fin = data.financialSummary || {};
    const bkg = data.bookingSummary || {};
    const exp = data.expensesSummary || {};
    const rec = data.cashReconciliation || {};
    const rows: string[][] = [
      [`${villaName} — Reception Shift & Operations Report`],
      [`Period: ${periodTitle}`, `Generated: ${new Date().toLocaleString()}`, `By: ${user?.firstName || 'Staff'} ${user?.lastName || ''}`],
      [],
      ['=== FINANCIAL COLLECTIONS ==='],
      ['Method', 'Amount (GHS)', 'Count'],
      ['Mobile Money', String(fin.momo?.totalAmount || 0), String(fin.momo?.count || 0)],
      ['Cash', String(fin.cash?.totalAmount || 0), String(fin.cash?.count || 0)],
      ['Card', String(fin.card?.totalAmount || 0), String(fin.card?.count || 0)],
      ['Bank Transfer', String(fin.bankTransfer?.totalAmount || 0), String(fin.bankTransfer?.count || 0)],
      ['Total Gross', String(fin.totalCollections || 0)],
      ['Refunds', String(fin.totalRefunds || 0)],
      ['Net Collections', String(fin.netCollections || 0)],
      [],
      ['=== BOOKINGS ==='],
      ['Category', 'Rate', 'Bookings', 'Nights', 'Adults', 'Children', 'People', 'Revenue', 'Deposit', 'Rooms'],
    ];
    for (const cat of bkg.categories || []) {
      rows.push([cat.categoryName, String(cat.basePrice || 0), String(cat.bookingsCount || 0), String(cat.roomNights || 0), String(cat.adults || 0), String(cat.children || 0), String(cat.totalPeople || 0), String(cat.totalRevenue || 0), String(cat.depositCollected || 0), cat.roomsList || '—']);
    }
    rows.push([], ['Total Bookings', String(bkg.totalBookings || 0)], ['Total People', String(bkg.totalPeople || 0)], ['Total Rooms', String(bkg.totalRoomsBooked || 0)]);
    rows.push([], ['=== EXPENSES TAKEN ==='], ['Date', 'Time', 'Category', 'Description', 'Recipient', 'Receipt', 'Amount', 'Recorded By']);
    for (const out of exp.disbursementsList || []) {
      rows.push([out.date || '', out.time || '', out.category || '', `"${(out.description || '').replace(/"/g, '""')}"`, out.recipient || '', out.receiptRef || '', String(out.amount || 0), out.recordedBy || '']);
    }
    rows.push([], ['=== CASH RECONCILIATION ===']);
    rows.push(['Opening Float', String(rec.openingCashFloat || 0)]);
    rows.push(['Cash Collections', String(rec.cashCollectionsReceived || 0)]);
    rows.push(['Manual Inflows', String(rec.manualInflows || 0)]);
    rows.push(['Expenses Taken', String(rec.moneyTakenForExpenses || 0)]);
    rows.push(['Cash Refunds', String(rec.cashRefundsPaid || 0)]);
    rows.push(['MoMo Deposits', String(rec.cashDepositedToBank || 0)]);
    rows.push(['Expected Cash at Hand', String(rec.expectedCashAtHand || 0)]);
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reception_Report_${startDate}_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('success', 'CSV downloaded');
  };

  const fin = data?.financialSummary || {};
  const bkg = data?.bookingSummary || {};
  const exp = data?.expensesSummary || {};
  const rec = data?.cashReconciliation || {};
  const ops = data?.operationalHighlights || {};

  const TABS: { id: ActiveTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'payments', label: 'Payments', icon: CreditCard, count: fin.allPaymentRecords?.length },
    { id: 'categories', label: 'Rooms & Bookings', icon: BedDouble, count: bkg.categories?.length },
    { id: 'expenses', label: 'Expenses', icon: Receipt, count: exp.disbursementsCount },
    { id: 'reconciliation', label: 'Reconciliation', icon: Wallet },
  ];

  return (
    <ShellPage
      eyebrow="RECEPTION · FRONT DESK REPORTING"
      title="Shift & Operations Report"
      subtitle="MoMo collections, cash, bookings, room categories, expense payouts, and cash reconciliation."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer size={14} /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <FileSpreadsheet size={14} /> CSV
          </Button>
          <Button variant="primary" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      }
    >
      {/* ── Period Selector ── */}
      <div className="ns-card p-3 flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex items-center gap-1 bg-[#0f141d] p-1 rounded-lg border border-[#1e2535]">
          {(['today', 'yesterday', 'week', 'month', 'custom'] as PeriodMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                mode === m ? 'bg-[#c59a58] text-[#0c1921] shadow' : 'text-[#4a5568] hover:text-[#c59a58]'
              }`}
            >
              {m === 'today' ? "Today" : m === 'yesterday' ? 'Yesterday' : m === 'week' ? 'This Week' : m === 'month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>
        {mode === 'custom' && (
          <div className="flex items-center gap-2 text-[11px] text-[#6e7a8a]">
            <label className="flex items-center gap-1">
              From
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="ns-input h-8 px-2 text-xs bg-[#0f141d] border-[#1e2535] text-[#e8e6e0] rounded ml-1" />
            </label>
            <label className="flex items-center gap-1">
              To
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="ns-input h-8 px-2 text-xs bg-[#0f141d] border-[#1e2535] text-[#e8e6e0] rounded ml-1" />
            </label>
          </div>
        )}
        <span className="ml-auto text-[10px] font-bold text-[#c59a58] bg-[#1a1505] border border-[#3a2a10] px-2.5 py-1.5 rounded-lg">
          {periodTitle}
        </span>
      </div>

      {loading ? (
        <LoadingState />
      ) : !data ? (
        <div className="ns-card p-12 text-center text-[#4a5568] text-xs">No data found for this period.</div>
      ) : (
        <>
          {/* ── KPI Strip ── */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Mobile Money', value: formatCurrency(fin.momo?.totalAmount || 0), sub: `${fin.momo?.count || 0} transactions`, icon: Smartphone, color: '#c59a58' },
              { label: 'Cash Received', value: formatCurrency(fin.cash?.totalAmount || 0), sub: `${fin.cash?.count || 0} receipts`, icon: Banknote, color: '#4ade80' },
              { label: 'Card Payments', value: formatCurrency(fin.card?.totalAmount || 0), sub: `${fin.card?.count || 0} transactions`, icon: CreditCard, color: '#60a5fa' },
              { label: 'People Booked', value: `${bkg.totalPeople || 0} guests`, sub: `${bkg.adults || 0} adults · ${bkg.children || 0} children`, icon: Users, color: '#a78bfa' },
              { label: 'Expenses Taken', value: formatCurrency(exp.totalTakenForExpenses || 0), sub: `${exp.disbursementsCount || 0} outflows`, icon: Receipt, color: '#f87171' },
              { label: 'Cash in Hand', value: formatCurrency(rec.expectedCashAtHand || 0), sub: 'Shift balance', icon: Wallet, color: '#34d399' },
            ].map((tile) => (
              <div key={tile.label} className="ns-card p-4" style={{ borderTop: `2px solid ${tile.color}20` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#4a5568]">{tile.label}</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: `${tile.color}18` }}>
                    <tile.icon size={12} style={{ color: tile.color }} />
                  </span>
                </div>
                <div className="text-sm font-extrabold text-[#e8e6e0]">{tile.value}</div>
                <div className="mt-0.5 text-[9px] text-[#4a5568]">{tile.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="flex items-center gap-0 border-b border-[#1e2535] print:hidden">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-[#c59a58] text-[#c59a58]'
                    : 'border-transparent text-[#4a5568] hover:text-[#e8e6e0]'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${activeTab === tab.id ? 'bg-[#c59a58]/20 text-[#c59a58]' : 'bg-[#1e2535] text-[#4a5568]'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ═══ TAB 1: PAYMENTS ═══ */}
          {activeTab === 'payments' && (
            <div className="space-y-5">
              {/* Method summary */}
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: 'Mobile Money', amt: fin.momo?.totalAmount || 0, count: fin.momo?.count || 0, color: '#c59a58' },
                  { label: 'Cash', amt: fin.cash?.totalAmount || 0, count: fin.cash?.count || 0, color: '#4ade80' },
                  { label: 'Card', amt: fin.card?.totalAmount || 0, count: fin.card?.count || 0, color: '#60a5fa' },
                  { label: 'Bank Transfer', amt: fin.bankTransfer?.totalAmount || 0, count: fin.bankTransfer?.count || 0, color: '#a78bfa' },
                ].map((m) => (
                  <div key={m.label} className="ns-card p-4 flex items-center gap-3">
                    <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: m.color }} />
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#4a5568]">{m.label}</div>
                      <div className="text-sm font-extrabold" style={{ color: m.color }}>{formatCurrency(m.amt)}</div>
                      <div className="text-[9px] text-[#4a5568]">{m.count} transactions</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* MoMo Ledger */}
              <Section title={`Mobile Money Ledger (${fin.momo?.transactions?.length || 0})`} subtitle="All MoMo payments with references and guest details">
                {!fin.momo?.transactions?.length ? (
                  <div className="p-8 text-center text-xs text-[#4a5568]">No MoMo payments in this period.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-[#1e2535]">
                        <tr>
                          {['Time', 'Guest & Phone', 'Room / Conf #', 'MoMo Reference', 'Staff', 'Amount'].map((h) => (
                            <th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#4a5568]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0f141d]">
                        {fin.momo.transactions.map((t: any) => (
                          <tr key={t.id} className="hover:bg-[#0f141d]/60 transition-colors text-xs">
                            <td className="px-4 py-3 font-mono text-[#6e7a8a] text-[10px]">
                              {new Date(t.processedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[#e8e6e0]">{t.guestName}</div>
                              <div className="text-[10px] text-[#4a5568] flex items-center gap-1">
                                <Phone size={9} /> {t.phone}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[#e8e6e0]">{t.roomNumber}</div>
                              <div className="text-[10px] font-mono text-[#4a5568]">{t.confirmationNo}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded border border-[#3a2a10] bg-[#1a1505] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#c59a58]">
                                {t.reference}
                              </span>
                              <div className="text-[9px] text-[#4a5568] mt-0.5 truncate max-w-[180px]">{t.description}</div>
                            </td>
                            <td className="px-4 py-3 text-[11px] text-[#6e7a8a] font-medium">{t.processedBy}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-[#c59a58]">{formatCurrency(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-[#2a3040]">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-right text-[10px] font-bold uppercase text-[#4a5568]">Total MoMo Collected</td>
                          <td className="px-4 py-3 text-right font-extrabold text-[#c59a58]">{formatCurrency(fin.momo?.totalAmount || 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Section>

              {/* All Payments Audit Trail */}
              <Section title={`All Payment Collections (${fin.allPaymentRecords?.length || 0})`} subtitle="Complete audit trail across all payment methods">
                {!fin.allPaymentRecords?.length ? (
                  <div className="p-8 text-center text-xs text-[#4a5568]">No payment records found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-[#1e2535]">
                        <tr>
                          {['Time', 'Method', 'Guest', 'Room / Conf #', 'Staff', 'Amount'].map((h) => (
                            <th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#4a5568]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0f141d]">
                        {fin.allPaymentRecords.map((p: any) => (
                          <tr key={p.id} className="hover:bg-[#0f141d]/60 transition-colors text-xs">
                            <td className="px-4 py-3 font-mono text-[#6e7a8a] text-[10px]">
                              {new Date(p.processedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                p.method === 'MOBILE_MONEY' ? 'bg-[#1a1505] text-[#c59a58] border border-[#3a2a10]' :
                                p.method === 'CASH' ? 'bg-emerald-900/30 text-emerald-400' :
                                p.method === 'CARD' ? 'bg-blue-900/30 text-blue-400' :
                                'bg-purple-900/30 text-purple-400'
                              }`}>
                                {p.method === 'MOBILE_MONEY' ? 'MoMo' : p.method}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[#e8e6e0]">{p.guestName}</div>
                              {p.reference !== '—' && <div className="text-[9px] font-mono text-[#4a5568]">{p.reference}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[#e8e6e0]">{p.roomNumber}</div>
                              <div className="text-[9px] font-mono text-[#4a5568]">{p.confirmationNo}</div>
                            </td>
                            <td className="px-4 py-3 text-[11px] text-[#6e7a8a]">{p.processedBy}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-[#e8e6e0]">{formatCurrency(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-[#2a3040]">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-right text-[10px] font-bold uppercase text-[#4a5568]">Total Gross Collections</td>
                          <td className="px-4 py-3 text-right font-extrabold text-[#e8e6e0]">{formatCurrency(fin.totalCollections || 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ═══ TAB 2: ROOMS & CATEGORIES ═══ */}
          {activeTab === 'categories' && (
            <div className="space-y-5">
              {/* Category cards */}
              <Section title="Room Category Breakdown" subtitle="Revenue and headcount by room type">
                {!bkg.categories?.length ? (
                  <div className="p-8 text-center text-xs text-[#4a5568]">No rooms booked in this period.</div>
                ) : (
                  <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bkg.categories.map((cat: any) => (
                      <div key={cat.categoryName} className="ns-card p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-extrabold text-[#e8e6e0]">{cat.categoryName}</div>
                            <div className="text-[9px] text-[#4a5568] mt-0.5">{formatCurrency(cat.basePrice)}/night</div>
                          </div>
                          <span className="rounded-full bg-[#c59a58]/15 text-[#c59a58] font-bold text-[9px] px-2 py-0.5 border border-[#c59a58]/30">
                            {cat.percentageShare}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-y border-[#1e2535] py-3 text-center">
                          {[
                            { label: 'Bookings', value: cat.bookingsCount },
                            { label: 'Nights', value: cat.roomNights },
                            { label: 'Guests', value: cat.totalPeople },
                          ].map((s) => (
                            <div key={s.label}>
                              <div className="text-[8px] font-bold uppercase tracking-wider text-[#4a5568]">{s.label}</div>
                              <div className="text-sm font-extrabold text-[#e8e6e0] mt-0.5">{s.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#4a5568]">Category Revenue</span>
                          <span className="font-extrabold text-[#c59a58]">{formatCurrency(cat.totalRevenue)}</span>
                        </div>
                        {cat.roomsList && (
                          <div className="text-[9px] text-[#4a5568] truncate">Rooms: <span className="text-[#6e7a8a] font-medium">{cat.roomsList}</span></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Bookings list */}
              <Section title={`Bookings (${bkg.bookingsList?.length || 0})`} subtitle="Guest reservations with headcounts and room assignments">
                {!bkg.bookingsList?.length ? (
                  <div className="p-8 text-center text-xs text-[#4a5568]">No bookings in this period.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-[#1e2535]">
                        <tr>
                          {['Conf #', 'Guest & Phone', 'Room / Category', 'Dates', 'People', 'Status', 'Amount'].map((h) => (
                            <th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#4a5568]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0f141d]">
                        {bkg.bookingsList.map((b: any) => (
                          <tr key={b.id} className="hover:bg-[#0f141d]/60 transition-colors text-xs">
                            <td className="px-4 py-3 font-mono font-bold text-[#c59a58] text-[10px]">{b.confirmationNo}</td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[#e8e6e0]">{b.guestName}</div>
                              <div className="text-[9px] text-[#4a5568] flex items-center gap-1"><Phone size={9} />{b.phone}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[#e8e6e0]">Room {b.roomNumber}</div>
                              <div className="text-[9px] text-[#4a5568]">{b.categoryName}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-[#e8e6e0]">{b.checkInDate} → {b.checkOutDate}</div>
                              <div className="text-[9px] text-[#4a5568]">{b.nights} night{b.nights !== 1 ? 's' : ''}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded bg-[#1e2535] px-2 py-0.5 text-[9px] font-bold text-[#e8e6e0]">
                                {b.totalPeople} ({b.adults}A / {b.children}C)
                              </span>
                            </td>
                            <td className="px-4 py-3">{statusBadge(b.status)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="font-extrabold text-[#e8e6e0]">{formatCurrency(b.totalAmount)}</div>
                              {b.depositAmount > 0 && (
                                <div className="text-[9px] text-emerald-400">Dep: {formatCurrency(b.depositAmount)}</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-[#2a3040]">
                        <tr>
                          <td colSpan={6} className="px-4 py-3 text-[10px] text-[#4a5568]">
                            Total: <strong className="text-[#e8e6e0]">{bkg.totalPeople || 0} people</strong> · {bkg.adults || 0} adults · {bkg.children || 0} children
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-[#c59a58]">
                            {formatCurrency((bkg.categories || []).reduce((s: number, c: any) => s + (c.totalRevenue || 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ═══ TAB 3: EXPENSES ═══ */}
          {activeTab === 'expenses' && (
            <div className="space-y-5">
              {/* Category breakdown */}
              {(exp.byCategory || []).length > 0 && (
                <div className="grid gap-3 sm:grid-cols-4">
                  {(exp.byCategory || []).map((cat: any) => (
                    <div key={cat.category} className="ns-card p-4 border-l-2 border-red-500/60">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#4a5568] truncate">{cat.category}</div>
                      <div className="text-sm font-extrabold text-red-400 mt-1">{formatCurrency(cat.amount)}</div>
                      <div className="text-[9px] text-[#4a5568]">{cat.percentage}% of payouts</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Disbursements table */}
              <Section title={`Expense Disbursements (${exp.disbursementsList?.length || 0})`} subtitle="Cash taken from reception for operational purposes">
                {!exp.disbursementsList?.length ? (
                  <div className="p-8 text-center text-xs text-[#4a5568]">No expense disbursements in this period.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-[#1e2535]">
                        <tr>
                          {['Date / Time', 'Category', 'Description', 'Recipient', 'Voucher', 'Staff', 'Amount'].map((h) => (
                            <th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#4a5568]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0f141d]">
                        {exp.disbursementsList.map((d: any) => (
                          <tr key={d.id} className="hover:bg-[#0f141d]/60 transition-colors text-xs">
                            <td className="px-4 py-3 font-mono text-[#6e7a8a] text-[10px]">{d.date} {d.time}</td>
                            <td className="px-4 py-3">
                              <span className="rounded bg-red-900/30 text-red-400 font-bold px-1.5 py-0.5 text-[9px] uppercase">{d.category}</span>
                            </td>
                            <td className="px-4 py-3 text-[#e8e6e0] font-medium max-w-[200px] truncate">{d.description}</td>
                            <td className="px-4 py-3 font-bold text-[#e8e6e0]">{d.recipient}</td>
                            <td className="px-4 py-3 font-mono text-[10px] text-[#4a5568]">{d.receiptRef}</td>
                            <td className="px-4 py-3 text-[11px] text-[#6e7a8a]">{d.recordedBy}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-red-400">-{formatCurrency(d.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-[#2a3040]">
                        <tr>
                          <td colSpan={6} className="px-4 py-3 text-right text-[10px] font-bold uppercase text-[#4a5568]">Total Taken from Reception</td>
                          <td className="px-4 py-3 text-right font-extrabold text-red-400">-{formatCurrency(exp.totalTakenForExpenses || 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ═══ TAB 4: RECONCILIATION ═══ */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                {/* Cash Ledger */}
                <div className="ns-card p-6 space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#4a5568] border-b border-[#1e2535] pb-3">
                    Cash Reconciliation Ledger
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: 'Opening Float (+)', value: rec.openingCashFloat || 0, color: '#e8e6e0', sign: '+' },
                      { label: 'Cash Collections (+)', value: rec.cashCollectionsReceived || 0, color: '#4ade80', sign: '+' },
                      ...(rec.manualInflows > 0 ? [{ label: 'Other Inflows (+)', value: rec.manualInflows, color: '#4ade80', sign: '+' }] : []),
                      { label: 'Expenses Taken (-)', value: rec.moneyTakenForExpenses || 0, color: '#f87171', sign: '-' },
                      ...(rec.cashRefundsPaid > 0 ? [{ label: 'Cash Refunds (-)', value: rec.cashRefundsPaid, color: '#f87171', sign: '-' }] : []),
                      ...(rec.cashDepositedToBank > 0 ? [{ label: 'MoMo Deposits from Cash (-)', value: rec.cashDepositedToBank, color: '#fbbf24', sign: '-' }] : []),
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#0f141d]">
                        <span className="text-[#6e7a8a] font-medium">{row.label}</span>
                        <span className="font-mono font-extrabold" style={{ color: row.color }}>
                          {row.sign === '-' ? '-' : '+'}{formatCurrency(row.value)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t-2 border-[#c59a58]/30 pt-3 flex items-center justify-between">
                      <span className="font-extrabold text-[#e8e6e0] uppercase text-[10px] tracking-widest">Expected Cash at Hand</span>
                      <span className="font-mono font-extrabold text-[#c59a58] text-base">{formatCurrency(rec.expectedCashAtHand || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Shift Sign-off */}
                <div className="ns-card p-6 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#4a5568] border-b border-[#1e2535] pb-3">
                      Shift Handover
                    </div>
                    <div className="mt-4 space-y-2 bg-[#0f141d] rounded-lg p-4 text-xs text-[#6e7a8a]">
                      <div><span className="font-bold text-[#e8e6e0]">Receptionist:</span> {user?.firstName} {user?.lastName}</div>
                      <div><span className="font-bold text-[#e8e6e0]">Check-ins:</span> {ops.checkInsCount || 0}</div>
                      <div><span className="font-bold text-[#e8e6e0]">Check-outs:</span> {ops.checkOutsCount || 0}</div>
                      <div><span className="font-bold text-[#e8e6e0]">In-House Guests:</span> {ops.activeStaysCount || 0}</div>
                      <div><span className="font-bold text-[#e8e6e0]">Period:</span> {periodTitle}</div>
                    </div>
                    <p className="text-[10px] text-[#4a5568] mt-3">
                      This report certifies all cash, MoMo, and expense records for the specified shift period.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-[#1e2535] grid grid-cols-2 gap-4 text-center">
                    <div className="border-t border-dashed border-[#2a3040] pt-2 text-[9px] text-[#4a5568]">Receptionist Signature</div>
                    <div className="border-t border-dashed border-[#2a3040] pt-2 text-[9px] text-[#4a5568]">Manager / Auditor</div>
                  </div>
                </div>
              </div>

              {/* MoMo Deposits from Cash */}
              {rec.momoDepositsList?.length > 0 && (
                <Section title={`MoMo Deposits from Cash (${rec.momoDepositsList.length})`} subtitle="Cash taken from drawer and sent via mobile money — reduces physical cash balance">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-[#1e2535]">
                        <tr>
                          {['Date', 'Time', 'Description', 'MoMo Ref', 'Staff', 'Cash Taken'].map((h) => (
                            <th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#4a5568]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0f141d]">
                        {rec.momoDepositsList.map((m: any) => (
                          <tr key={m.id} className="hover:bg-[#0f141d]/60 transition-colors text-xs">
                            <td className="px-4 py-3 font-mono text-[#6e7a8a] text-[10px]">{m.date}</td>
                            <td className="px-4 py-3 font-mono text-[#6e7a8a] text-[10px]">{m.time}</td>
                            <td className="px-4 py-3 text-[#e8e6e0]">{m.description}</td>
                            <td className="px-4 py-3">
                              <span className="rounded border border-[#3a2a10] bg-[#1a1505] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#c59a58]">
                                {m.reference}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[11px] text-[#6e7a8a]">{m.recordedBy}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-amber-400">-{formatCurrency(m.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-[#2a3040]">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-right text-[10px] font-bold uppercase text-[#4a5568]">Total Sent via MoMo</td>
                          <td className="px-4 py-3 text-right font-extrabold text-amber-400">
                            -{formatCurrency(rec.momoDepositsFromCash || rec.cashDepositedToBank || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Section>
              )}
            </div>
          )}
        </>
      )}
    </ShellPage>
  );
}
