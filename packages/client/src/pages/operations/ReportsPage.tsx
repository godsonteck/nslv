import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { reportsApi } from '../../services/apiService';
import {
  BarChart3,
  CalendarDays,
  Download,
  RefreshCw,
  TrendingUp,
  UtensilsCrossed,
  Waves,
  Wine,
  Users,
  BedDouble,
  Clock,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  Percent,
  CheckCircle2,
  XCircle,
  Receipt,
  Wallet,
  Building2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
} from 'lucide-react';
import { Button, LoadingState, showToast } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
import { formatCurrency } from '@nslv/shared';

type ReportMode = 'daily' | 'weekly' | 'monthly' | 'custom';

export default function ReportsPage() {
  const [mode, setMode] = useState<ReportMode>('daily');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Selected date anchors
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDay, setSelectedDay] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(() => todayStr.slice(0, 7)); // YYYY-MM
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(todayStr);

  // Compute effective start and end dates based on active mode
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (mode === 'daily') {
      return {
        startDate: selectedDay,
        endDate: selectedDay,
        periodLabel: `Daily Report — ${new Date(selectedDay + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}`,
      };
    }
    if (mode === 'weekly') {
      const anchor = new Date(selectedDay + 'T00:00:00Z');
      const day = anchor.getUTCDay(); // 0 is Sunday
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(anchor);
      monday.setUTCDate(anchor.getUTCDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      const sStr = monday.toISOString().slice(0, 10);
      const eStr = sunday.toISOString().slice(0, 10);
      return {
        startDate: sStr,
        endDate: eStr,
        periodLabel: `Weekly Report — ${sStr} to ${eStr}`,
      };
    }
    if (mode === 'monthly') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const firstDay = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
      const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
      return {
        startDate: firstDay,
        endDate: lastDay,
        periodLabel: `Monthly Report — ${monthName}`,
      };
    }
    // Custom
    return {
      startDate: customStart,
      endDate: customEnd,
      periodLabel: `Custom Period Report — ${customStart} to ${customEnd}`,
    };
  }, [mode, selectedDay, selectedMonth, customStart, customEnd]);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reportsApi.getComprehensiveReport(startDate, endDate);
      setData(res.data || null);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to generate report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleExportCSV = () => {
    if (!data) return;

    const occ = data.occupancy || {};
    const ppl = data.people || {};
    const ops = data.operations || {};
    const fin = data.financials || {};
    const dept = fin.departmentRevenue || data.departmentRevenue || {};
    const cash = fin.cash || data.cash || {};
    const daily = data.dailyBreakdown || [];

    const rows: string[][] = [
      ['NS LUXURY VILLA MANAGEMENT SYSTEM — ' + periodLabel.toUpperCase()],
      [`Generated On: ${new Date().toLocaleString()}`],
      [`Report Window: ${startDate} to ${endDate} (${data.period?.daysInPeriod || 1} day(s))`],
      [''],
      ['=== 1. ROOM CAPACITY & OCCUPANCY ==='],
      ['Metric', 'Value'],
      ['Total Active Rooms', String(occ.totalRooms || 0)],
      ['Currently Occupied Rooms', String(occ.occupiedRooms || 0)],
      ['Reserved Rooms', String(occ.reservedRooms || 0)],
      ['Available Rooms', String(occ.availableRooms || 0)],
      ['Dirty / Housekeeping Rooms', String(occ.dirtyRooms || 0)],
      ['Maintenance / Out of Service', String(occ.maintenanceRooms || 0)],
      ['Occupancy Rate', `${occ.occupancyRate || 0}%`],
      ['Total Room Nights in Period', String(occ.totalRoomNights || 0)],
      [''],
      ['=== 2. PEOPLE & GUEST HEADCOUNT ==='],
      ['Metric', 'Value'],
      ['Total People Accommodated (Period)', String(ppl.totalPeopleAccommodated || 0)],
      ['Total Adults Accommodated', String(ppl.totalAdults || 0)],
      ['Total Children Accommodated', String(ppl.totalChildren || 0)],
      ['Currently In-House People Headcount', String(ppl.inHousePeopleTotal || 0)],
      ['In-House Adults', String(ppl.inHouseAdults || 0)],
      ['In-House Children', String(ppl.inHouseChildren || 0)],
      ['Total Registered Guests in Database', String(ppl.totalRegisteredGuests || 0)],
      ['New Guests Registered in Period', String(ppl.newGuestsInPeriod || 0)],
      [''],
      ['=== 3. OPERATIONS & STAYS ==='],
      ['Metric', 'Value'],
      ['Total Reservations in Period', String(ops.reservationsCount || 0)],
      ['Confirmed Reservations', String(ops.confirmedCount || 0)],
      ['Check-Ins / Arrivals', String(ops.checkInsCount || 0)],
      ['Check-Outs / Departures', String(ops.checkOutsCount || 0)],
      ['Late Check-Outs Count', String(ops.lateCheckOutsCount || 0)],
      ['Total Late Check-Out Fees Billed', `GHS ${(ops.totalLateCheckoutFees || 0).toFixed(2)}`],
      ['Late Check-Out Fees Refunded', `GHS ${(ops.totalLateCheckoutRefunds || 0).toFixed(2)}`],
      ['Net Late Check-Out Fees Collected', `GHS ${(ops.netLateCheckoutFees ?? ops.totalLateCheckoutFees ?? 0).toFixed(2)}`],
      ['Cancelled Reservations', String(ops.cancelledCount || 0)],
      ['No-Show Reservations', String(ops.noShowCount || 0)],
      [''],
      ['=== 4. DEPARTMENT REVENUE BREAKDOWN ==='],
      ['Department', 'Revenue (GHS)'],
      ['Room Accommodation', (dept.accommodation || 0).toFixed(2)],
      ['Restaurant Sales', (dept.restaurant || 0).toFixed(2)],
      ['Bar Sales', (dept.bar || 0).toFixed(2)],
      ['Pool Transactions', (dept.pool || 0).toFixed(2)],
      ['Late Check-out Charges', (dept.lateCheckout || 0).toFixed(2)],
      ['Total Accrued Revenue', (fin.accruedRevenue || data.accruedRevenue || 0).toFixed(2)],
      [''],
      ['=== 5. FINANCIAL METRICS & CASH FLOW ==='],
      ['Metric', 'Amount (GHS)'],
      ['Total Payments Collected', (fin.totalCollectedRevenue || data.totalCollectedRevenue || 0).toFixed(2)],
      ['Total Approved Operating Expenses', (fin.totalApprovedExpenses || 0).toFixed(2)],
      ['Net Operating Income (Accrued - Expenses)', (fin.netOperatingIncome || 0).toFixed(2)],
      ['Average Daily Rate (ADR)', (fin.averageDailyRate || 0).toFixed(2)],
      ['Cash Payments Inflow', (cash.payments || 0).toFixed(2)],
      ['Cash Refunds Outflow', (cash.refunds || 0).toFixed(2)],
      ['Cash Approved Expenses Outflow', (cash.approvedExpenses || 0).toFixed(2)],
      ['Net Cash Movement', (cash.netMovement || 0).toFixed(2)],
      ['Open Receivables (Unpaid Folios)', (fin.receivables || data.receivables || 0).toFixed(2)],
      ['Deposits Collected', (fin.deposits?.collected || data.deposits?.collected || 0).toFixed(2)],
      ['Deposits Required', (fin.deposits?.required || data.deposits?.required || 0).toFixed(2)],
      ['Total Refunds Processed', (fin.refunds || data.refunds || 0).toFixed(2)],
    ];

    rows.push(['']);
    rows.push(['=== 6. EVENTS & EVENT SPACES ===']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Events in Period', String(evts.totalInPeriod || 0)]);
    rows.push(['Confirmed Events', String(evts.confirmedCount || 0)]);
    rows.push(['Cancelled Events', String(evts.cancelledCount || 0)]);
    rows.push(['Total Event Guests', String(evts.totalGuestCount || 0)]);
    rows.push(['Active Event Spaces', String(evts.totalEventSpaces || 0)]);
    rows.push(['Upcoming Confirmed Events', String(evts.upcomingCount || 0)]);

    if ((evts.recentEvents || []).length > 0) {
      rows.push(['']);
      rows.push(['Events in Period Details:']);
      rows.push(['Title', 'Space', 'Start', 'End', 'Guests', 'Status', 'Contact', 'Booked By']);
      for (const e of evts.recentEvents || []) {
        rows.push([e.title, e.spaceName, new Date(e.startAt).toLocaleString(), new Date(e.endAt).toLocaleString(), String(e.guestCount), e.status, e.contactName || '—', e.createdByName || '—']);
      }
    }

    if (daily.length > 0) {
      rows.push(['']);
      rows.push(['=== 7. TIMELINE BREAKDOWN (DAY-BY-DAY) ===']);
      rows.push(['Date', 'Day', 'Revenue (GHS)', 'Accommodation', 'Restaurant', 'Bar', 'Pool', 'Late Fees', 'Expenses', 'Net Flow', 'Check-Ins', 'Check-Outs', 'People Accommodated']);
      for (const d of daily) {
        rows.push([
          d.date,
          d.dayName,
          d.revenue.toFixed(2),
          d.accommodation.toFixed(2),
          d.restaurant.toFixed(2),
          d.bar.toFixed(2),
          d.pool.toFixed(2),
          d.lateFees.toFixed(2),
          d.expenses.toFixed(2),
          d.net.toFixed(2),
          String(d.checkIns),
          String(d.checkOuts),
          String(d.peopleAccommodated),
        ]);
      }
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NSLV_${mode.toUpperCase()}_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `${mode.toUpperCase()} report exported as CSV.`);
  };

  const handlePrint = () => {
    window.print();
  };

  const occ = data?.occupancy || {};
  const ppl = data?.people || {};
  const ops = data?.operations || {};
  const fin = data?.financials || {};
  const dept = fin?.departmentRevenue || data?.departmentRevenue || {};
  const cash = fin?.cash || data?.cash || {};
  const expensesByCat = fin?.expensesByCategory || {};
  const dailyTimeline = data?.dailyBreakdown || [];
  const evts = data?.events || {};

  return (
    <ShellPage
      eyebrow="MANAGEMENT · EXECUTIVE INTELLIGENCE"
      title={periodLabel}
      subtitle="Complete database-derived occupancy, people headcount, operations, departmental revenues, and cash movement."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadReport}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer size={14} /> Print
          </Button>
          <Button variant="primary" size="sm" onClick={handleExportCSV}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
      }
    >
      {/* Mode Tabs */}
      <div className="bg-[#1C1F28] border border-[#2B303E] rounded-xl p-3 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Mode Selector */}
          <div className="flex items-center gap-1.5 bg-[#14161D] p-1 rounded-lg border border-[#2B303E]">
            <button
              onClick={() => setMode('daily')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                mode === 'daily'
                  ? 'bg-[#C5A880] text-[#10131A] shadow'
                  : 'text-[#A0A5AD] hover:text-[#F4F4F2] hover:bg-[#232733]'
              }`}
            >
              <Calendar size={14} /> Daily Report
            </button>
            <button
              onClick={() => setMode('weekly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                mode === 'weekly'
                  ? 'bg-[#C5A880] text-[#10131A] shadow'
                  : 'text-[#A0A5AD] hover:text-[#F4F4F2] hover:bg-[#232733]'
              }`}
            >
              <CalendarDays size={14} /> Weekly Report
            </button>
            <button
              onClick={() => setMode('monthly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                mode === 'monthly'
                  ? 'bg-[#C5A880] text-[#10131A] shadow'
                  : 'text-[#A0A5AD] hover:text-[#F4F4F2] hover:bg-[#232733]'
              }`}
            >
              <Layers size={14} /> Monthly Report
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${
                mode === 'custom'
                  ? 'bg-[#C5A880] text-[#10131A] shadow'
                  : 'text-[#A0A5AD] hover:text-[#F4F4F2] hover:bg-[#232733]'
              }`}
            >
              <BarChart3 size={14} /> Custom Range
            </button>
          </div>

          {/* Mode-specific Date Controls */}
          <div className="flex items-center gap-2">
            {mode === 'daily' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const d = new Date(selectedDay + 'T00:00:00Z');
                    d.setUTCDate(d.getUTCDate() - 1);
                    setSelectedDay(d.toISOString().slice(0, 10));
                  }}
                >
                  <ChevronLeft size={14} /> Previous Day
                </Button>
                <input
                  type="date"
                  className="ns-input h-9 px-3 text-xs bg-[#14161D] border-[#2B303E] text-[#F4F4F2] rounded font-mono"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const d = new Date(selectedDay + 'T00:00:00Z');
                    d.setUTCDate(d.getUTCDate() + 1);
                    setSelectedDay(d.toISOString().slice(0, 10));
                  }}
                >
                  Next Day <ChevronRight size={14} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedDay(todayStr)}>
                  Today
                </Button>
              </div>
            )}

            {mode === 'weekly' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const d = new Date(selectedDay + 'T00:00:00Z');
                    d.setUTCDate(d.getUTCDate() - 7);
                    setSelectedDay(d.toISOString().slice(0, 10));
                  }}
                >
                  <ChevronLeft size={14} /> Previous Week
                </Button>
                <input
                  type="date"
                  className="ns-input h-9 px-3 text-xs bg-[#14161D] border-[#2B303E] text-[#F4F4F2] rounded font-mono"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const d = new Date(selectedDay + 'T00:00:00Z');
                    d.setUTCDate(d.getUTCDate() + 7);
                    setSelectedDay(d.toISOString().slice(0, 10));
                  }}
                >
                  Next Week <ChevronRight size={14} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedDay(todayStr)}>
                  This Week
                </Button>
              </div>
            )}

            {mode === 'monthly' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const [y, m] = selectedMonth.split('-').map(Number);
                    const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
                    setSelectedMonth(prev);
                  }}
                >
                  <ChevronLeft size={14} /> Previous Month
                </Button>
                <input
                  type="month"
                  className="ns-input h-9 px-3 text-xs bg-[#14161D] border-[#2B303E] text-[#F4F4F2] rounded font-mono"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const [y, m] = selectedMonth.split('-').map(Number);
                    const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
                    setSelectedMonth(next);
                  }}
                >
                  Next Month <ChevronRight size={14} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedMonth(todayStr.slice(0, 7))}>
                  This Month
                </Button>
              </div>
            )}

            {mode === 'custom' && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase font-bold text-[#A0A5AD] flex items-center gap-1">
                  From
                  <input
                    type="date"
                    className="ns-input h-9 px-2 text-xs bg-[#14161D] border-[#2B303E] text-[#F4F4F2] rounded font-mono"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </label>
                <label className="text-[10px] uppercase font-bold text-[#A0A5AD] flex items-center gap-1">
                  To
                  <input
                    type="date"
                    className="ns-input h-9 px-2 text-xs bg-[#14161D] border-[#2B303E] text-[#F4F4F2] rounded font-mono"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState message={`Compiling ${mode.toUpperCase()} property report...`} />
      ) : (
        <div className="space-y-6">
          {/* Executive Overview Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Occupancy Rate"
              value={`${occ.occupancyRate ?? 0}%`}
              icon={Percent}
              accent
            />
            <StatTile
              label="People Accommodated"
              value={`${ppl.totalPeopleAccommodated ?? 0} Guests`}
              icon={Users}
            />
            <StatTile
              label="Total Revenue Collected"
              value={formatCurrency(Number(fin.totalCollectedRevenue ?? data?.totalCollectedRevenue ?? 0))}
              icon={TrendingUp}
              accent
            />
            <StatTile
              label="Net Operating Flow"
              value={formatCurrency(Number(cash.netMovement ?? 0))}
              icon={Wallet}
            />
          </div>

          {/* Section 1: Total Occupancy & Room Capacity */}
          <Section
            title="🏨 Room Capacity & Total Occupancy"
            subtitle={`Room allocation, available stock & utilization for ${startDate} to ${endDate}`}
          >
            <div className="p-5 space-y-4">
              {/* Progress bar visualizer */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-[#A0A5AD] mb-1.5">
                  <span>Current Occupancy: {occ.occupiedRooms || 0} of {occ.totalRooms || 0} active rooms</span>
                  <span className="text-[#C5A880] font-bold">{occ.occupancyRate || 0}% Occupied</span>
                </div>
                <div className="h-3 w-full bg-[#14161D] rounded-full overflow-hidden flex border border-[#2B303E]">
                  <div
                    className="bg-gradient-to-r from-[#C5A880] to-[#E3CBA8] transition-all duration-500"
                    style={{ width: `${Math.min(100, occ.occupancyRate || 0)}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 pt-2">
                <MetricBox label="Total Rooms" value={occ.totalRooms || 0} sub="Active inventory" />
                <MetricBox label="Occupied" value={occ.occupiedRooms || 0} sub="In-house stays" highlight="text-[#C5A880]" />
                <MetricBox label="Reserved" value={occ.reservedRooms || 0} sub="Upcoming bookings" highlight="text-blue-400" />
                <MetricBox label="Available" value={occ.availableRooms || 0} sub="Ready for walk-in" highlight="text-emerald-400" />
                <MetricBox label="Dirty / Cleaning" value={occ.dirtyRooms || 0} sub="Housekeeping" highlight="text-amber-400" />
                <MetricBox label="Maintenance" value={occ.maintenanceRooms || 0} sub="Out of service" highlight="text-red-400" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-[#2B303E]">
                <div className="p-3 bg-[#14161D] rounded border border-[#2B303E]">
                  <div className="text-[10px] uppercase font-bold text-[#A0A5AD]">Total Room Nights</div>
                  <div className="text-lg font-extrabold text-[#F4F4F2] mt-0.5">{occ.totalRoomNights || 0} nights</div>
                  <div className="text-[10px] text-[#6E737B]">Occupied nights in selected window</div>
                </div>
                <div className="p-3 bg-[#14161D] rounded border border-[#2B303E]">
                  <div className="text-[10px] uppercase font-bold text-[#A0A5AD]">Average Daily Rate (ADR)</div>
                  <div className="text-lg font-extrabold text-[#C5A880] mt-0.5">{formatCurrency(fin.averageDailyRate || 0)}</div>
                  <div className="text-[10px] text-[#6E737B]">Average revenue per occupied room</div>
                </div>
              </div>
            </div>
          </Section>

          {/* Section 2: Number of People & Guest Headcount */}
          <Section
            title="👥 Number of People & Guest Headcount"
            subtitle="Detailed headcount of adults, children, and guest traffic"
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[#2B303E] bg-[#14161D] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#C5A880]">
                  <Users size={16} /> Total People in Period
                </div>
                <div className="mt-2 text-2xl font-extrabold text-[#F4F4F2]">
                  {ppl.totalPeopleAccommodated || 0} Guests
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[#A0A5AD] pt-2 border-t border-[#2B303E]">
                  <span>Adults: <strong className="text-[#F4F4F2]">{ppl.totalAdults || 0}</strong></span>
                  <span>Children: <strong className="text-[#F4F4F2]">{ppl.totalChildren || 0}</strong></span>
                </div>
              </div>

              <div className="rounded-xl border border-[#2B303E] bg-[#14161D] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-400">
                  <BedDouble size={16} /> Current In-House Headcount
                </div>
                <div className="mt-2 text-2xl font-extrabold text-[#F4F4F2]">
                  {ppl.inHousePeopleTotal || 0} In-House
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[#A0A5AD] pt-2 border-t border-[#2B303E]">
                  <span>In-House Adults: <strong className="text-[#F4F4F2]">{ppl.inHouseAdults || 0}</strong></span>
                  <span>Children: <strong className="text-[#F4F4F2]">{ppl.inHouseChildren || 0}</strong></span>
                </div>
              </div>

              <div className="rounded-xl border border-[#2B303E] bg-[#14161D] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-400">
                  <Building2 size={16} /> Lifetime Guest Directory
                </div>
                <div className="mt-2 text-2xl font-extrabold text-[#F4F4F2]">
                  {ppl.totalRegisteredGuests || 0} Registered
                </div>
                <div className="mt-2 text-xs text-[#A0A5AD] pt-2 border-t border-[#2B303E]">
                  All unique guest accounts
                </div>
              </div>

              <div className="rounded-xl border border-[#2B303E] bg-[#14161D] p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-400">
                  <CalendarDays size={16} /> New Guests Registered
                </div>
                <div className="mt-2 text-2xl font-extrabold text-[#F4F4F2]">
                  {ppl.newGuestsInPeriod || 0} New Profiles
                </div>
                <div className="mt-2 text-xs text-[#A0A5AD] pt-2 border-t border-[#2B303E]">
                  Created during report window
                </div>
              </div>
            </div>
          </Section>

          {/* Section 3: Operations & Stays Turnover */}
          <Section
            title="📋 Operations & Stays Turnover"
            subtitle="Reservations, check-ins, check-outs, and late departures"
          >
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 bg-[#14161D] rounded-xl border border-[#2B303E]">
                <div className="text-xs font-bold uppercase text-[#A0A5AD]">Reservations</div>
                <div className="text-2xl font-extrabold text-[#F4F4F2] mt-1">{ops.reservationsCount || 0}</div>
                <div className="mt-2 text-xs text-[#6E737B]">
                  Confirmed: <span className="text-emerald-400 font-semibold">{ops.confirmedCount || 0}</span> · Cancelled: <span className="text-red-400 font-semibold">{ops.cancelledCount || 0}</span>
                </div>
              </div>

              <div className="p-4 bg-[#14161D] rounded-xl border border-[#2B303E]">
                <div className="text-xs font-bold uppercase text-[#A0A5AD]">Arrivals (Check-Ins)</div>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">{ops.checkInsCount || 0}</div>
                <div className="mt-2 text-xs text-[#6E737B]">Front desk arrival entries</div>
              </div>

              <div className="p-4 bg-[#14161D] rounded-xl border border-[#2B303E]">
                <div className="text-xs font-bold uppercase text-[#A0A5AD]">Departures (Check-Outs)</div>
                <div className="text-2xl font-extrabold text-blue-400 mt-1">{ops.checkOutsCount || 0}</div>
                <div className="mt-2 text-xs text-[#6E737B]">Settled & closed checkouts</div>
              </div>

              <div className="p-4 bg-[#14161D] rounded-xl border border-[#2B303E]">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase text-amber-400">Late Check-Outs</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 font-mono font-bold">
                    {ops.lateCheckOutsCount || 0} Stays
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-amber-300 mt-1">
                  {formatCurrency(ops.netLateCheckoutFees ?? ops.totalLateCheckoutFees ?? 0)}
                </div>
                <div className="mt-2 text-xs text-[#A0A5AD]">
                  Hourly departure charges
                </div>
                {(ops.totalLateCheckoutRefunds ?? 0) > 0 && (
                  <div className="mt-1 text-[10px] font-bold text-emerald-400">
                    {formatCurrency(ops.totalLateCheckoutRefunds)} refunded
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* Section 4: Department Revenue Breakdown */}
          <Section
            title="💰 Department Revenue Breakdown"
            subtitle={`Earned and accrued revenues during ${startDate} to ${endDate}`}
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
              <DeptCard
                icon={BedDouble}
                label="Accommodation"
                value={dept.accommodation}
                note="Room rate ledger items"
              />
              <DeptCard
                icon={UtensilsCrossed}
                label="Restaurant"
                value={dept.restaurant}
                note="Kitchen & dining orders"
              />
              <DeptCard
                icon={Wine}
                label="Bar & Lounge"
                value={dept.bar}
                note="Beverage POS sales"
              />
              <DeptCard
                icon={Waves}
                label="Pool Facility"
                value={dept.pool}
                note="Day passes & activities"
              />
              <DeptCard
                icon={Clock}
                label="Late Checkout Fees"
                value={dept.lateCheckout ?? ops.netLateCheckoutFees ?? 0}
                note="Hourly departure penalty fees"
              />
            </div>
            <div className="px-5 pb-5">
              <div className="p-4 bg-[#14161D] rounded-xl border border-[#2B303E] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase text-[#A0A5AD]">Total Accrued Revenue</div>
                  <div className="text-xs text-[#6E737B]">Sum of all accommodation, restaurant, bar, pool, and late checkout fees</div>
                </div>
                <div className="text-2xl font-extrabold text-[#C5A880]">
                  {formatCurrency(Number(fin.accruedRevenue || data?.accruedRevenue || 0))}
                </div>
              </div>
            </div>
          </Section>

          {/* Section 5: Financial Metrics & Cash Flow */}
          <Section
            title="💵 Financial Health, Cash Flow & Balances"
            subtitle="Ledger collections, disbursements, expenses, and outstanding receivables"
          >
            <div className="p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="p-4 bg-[#14161D] rounded-xl border border-[#2B303E]">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-400">
                    <ArrowUpRight size={16} /> Cash Inflow
                  </div>
                  <div className="text-xl font-extrabold text-[#F4F4F2] mt-1">
                    {formatCurrency(Number(cash.payments || 0))}
                  </div>
                  <div className="text-[10px] text-[#6E737B] mt-1">Cash collections at desk & POS</div>
                </div>

                <div className="p-4 bg-[#14161D] rounded-xl border border-[#2B303E]">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-red-400">
                    <ArrowDownRight size={16} /> Cash Outflow (Expenses)
                  </div>
                  <div className="text-xl font-extrabold text-red-400 mt-1">
                    {formatCurrency(Number(cash.approvedExpenses || 0))}
                  </div>
                  <div className="text-[10px] text-[#6E737B] mt-1">Approved cash expenses paid</div>
                </div>

                <div className="p-4 bg-[#14161D] rounded-xl border border-[#2B303E]">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#C5A880]">
                    <Wallet size={16} /> Net Cash Movement
                  </div>
                  <div className="text-xl font-extrabold text-[#C5A880] mt-1">
                    {formatCurrency(Number(cash.netMovement || 0))}
                  </div>
                  <div className="text-[10px] text-[#6E737B] mt-1">Cash in hand balance change</div>
                </div>

                <div className="p-4 bg-[#14161D] rounded-xl border border-[#2B303E]">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-400">
                    <Receipt size={16} /> Open Receivables
                  </div>
                  <div className="text-xl font-extrabold text-amber-300 mt-1">
                    {formatCurrency(Number(fin.receivables || data?.receivables || 0))}
                  </div>
                  <div className="text-[10px] text-[#6E737B] mt-1">Unpaid folio balances</div>
                </div>
              </div>

              {/* Expenses Breakdown if any */}
              {Object.keys(expensesByCat).length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-bold uppercase text-[#A0A5AD] mb-2">Approved Expenses by Category</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(expensesByCat).map(([cat, amount]) => (
                      <div key={cat} className="p-2.5 bg-[#14161D] rounded border border-[#2B303E] flex justify-between items-center text-xs">
                        <span className="text-[#A0A5AD] font-medium">{cat}</span>
                        <span className="font-bold text-[#F4F4F2]">{formatCurrency(Number(amount))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Section 6: Events & Event Spaces */}
          <Section
            title="🎉 Events & Event Spaces"
            subtitle={`Event bookings, guest counts, and space utilization for ${startDate} to ${endDate}`}
          >
            <div className="p-5 space-y-5">
              {/* Event Stat Tiles */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricBox label="Total Events" value={evts.totalInPeriod || 0} sub="In period" highlight="text-[#C5A880]" />
                <MetricBox label="Confirmed" value={evts.confirmedCount || 0} sub="Active bookings" highlight="text-emerald-400" />
                <MetricBox label="Cancelled" value={evts.cancelledCount || 0} sub="In period" highlight="text-red-400" />
                <MetricBox label="Event Guests" value={evts.totalGuestCount || 0} sub="Total attendees" highlight="text-blue-400" />
              </div>

              {/* Space Utilization */}
              {(evts.spaceUtilization || []).length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase text-[#A0A5AD] mb-2">Space Utilization</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(evts.spaceUtilization || []).map((sp: any) => (
                      <div key={sp.name} className="p-3 bg-[#14161D] rounded-lg border border-[#2B303E] flex justify-between items-center">
                        <div>
                          <div className="text-xs font-bold text-[#F4F4F2]">{sp.name}</div>
                          <div className="text-[10px] text-[#6E737B] mt-0.5">{sp.guests} guests</div>
                        </div>
                        <div className="text-lg font-extrabold text-[#C5A880]">{sp.bookings} <span className="text-[10px] font-normal text-[#6E737B]">booking{sp.bookings !== 1 ? 's' : ''}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events in Period Table */}
              {(evts.recentEvents || []).length > 0 ? (
                <div>
                  <div className="text-xs font-bold uppercase text-[#A0A5AD] mb-2">Events in Period</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-[#A0A5AD]">
                      <thead className="text-[10px] uppercase font-bold text-[#6E737B] bg-[#14161D] border-b border-[#2B303E]">
                        <tr>
                          <th className="p-2.5">Event Title</th>
                          <th className="p-2.5">Space</th>
                          <th className="p-2.5">Start</th>
                          <th className="p-2.5">End</th>
                          <th className="p-2.5 text-center">Guests</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Contact</th>
                          <th className="p-2.5">Booked By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2B303E]/50 text-[11px]">
                        {(evts.recentEvents || []).map((ev: any) => (
                          <tr key={ev.id} className="hover:bg-[#14161D]/60 transition-colors">
                            <td className="p-2.5 font-bold text-[#F4F4F2]">{ev.title}</td>
                            <td className="p-2.5 text-[#C5A880]">{ev.spaceName}</td>
                            <td className="p-2.5 font-mono">{new Date(ev.startAt).toLocaleString()}</td>
                            <td className="p-2.5 font-mono">{new Date(ev.endAt).toLocaleString()}</td>
                            <td className="p-2.5 text-center font-bold text-blue-400">{ev.guestCount}</td>
                            <td className="p-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                ev.status === 'CONFIRMED' ? 'bg-emerald-900/40 text-emerald-400' :
                                ev.status === 'CANCELLED' ? 'bg-red-900/40 text-red-400' :
                                'bg-amber-900/40 text-amber-400'
                              }`}>{ev.status}</span>
                            </td>
                            <td className="p-2.5 text-[#A0A5AD]">{ev.contactName || '—'}</td>
                            <td className="p-2.5">
                              <span className="flex items-center gap-1 text-[#F4F4F2] font-semibold">
                                👤 {ev.createdByName || 'Staff'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-[#6E737B] text-xs">No events recorded in this period.</div>
              )}

              {/* Upcoming Events */}
              {(evts.upcomingEvents || []).length > 0 && (
                <div className="pt-2 border-t border-[#2B303E]">
                  <div className="text-xs font-bold uppercase text-[#A0A5AD] mb-2">Upcoming Confirmed Events</div>
                  <div className="space-y-2">
                    {(evts.upcomingEvents || []).map((ev: any) => (
                      <div key={ev.id} className="flex items-center justify-between p-3 bg-[#14161D] rounded-lg border border-[#2B303E]">
                        <div>
                          <div className="text-xs font-bold text-[#F4F4F2]">{ev.title}</div>
                          <div className="text-[10px] text-[#6E737B] mt-0.5">{ev.spaceName} · {new Date(ev.startAt).toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-blue-400">{ev.guestCount} guests</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Section 7: Daily Timeline Breakdown Table (for Weekly/Monthly/Custom reports) */}
          {dailyTimeline.length > 1 && (
            <Section
              title="📅 Day-by-Day Timeline Audit"
              subtitle={`Complete day-by-day revenue, headcount, arrivals, and expense ledger`}
            >
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-xs text-left text-[#A0A5AD]">
                  <thead className="text-[10px] uppercase font-bold text-[#6E737B] bg-[#14161D] border-b border-[#2B303E]">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Day</th>
                      <th className="p-2.5 text-right">Revenue</th>
                      <th className="p-2.5 text-right">Room Accomm.</th>
                      <th className="p-2.5 text-right">Restaurant</th>
                      <th className="p-2.5 text-right">Bar</th>
                      <th className="p-2.5 text-right">Pool</th>
                      <th className="p-2.5 text-right">Late Fees</th>
                      <th className="p-2.5 text-right">Expenses</th>
                      <th className="p-2.5 text-right">Net Flow</th>
                      <th className="p-2.5 text-center">Check-Ins</th>
                      <th className="p-2.5 text-center">Check-Outs</th>
                      <th className="p-2.5 text-center">People</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B303E]/50 font-mono text-[11px]">
                    {dailyTimeline.map((d: any) => (
                      <tr key={d.date} className="hover:bg-[#14161D]/60 transition-colors">
                        <td className="p-2.5 font-bold text-[#F4F4F2]">{d.date}</td>
                        <td className="p-2.5 text-[#C5A880] font-sans font-semibold">{d.dayName}</td>
                        <td className="p-2.5 text-right font-bold text-[#F4F4F2]">{formatCurrency(d.revenue)}</td>
                        <td className="p-2.5 text-right">{formatCurrency(d.accommodation)}</td>
                        <td className="p-2.5 text-right">{formatCurrency(d.restaurant)}</td>
                        <td className="p-2.5 text-right">{formatCurrency(d.bar)}</td>
                        <td className="p-2.5 text-right">{formatCurrency(d.pool)}</td>
                        <td className="p-2.5 text-right text-amber-300">{formatCurrency(d.lateFees)}</td>
                        <td className="p-2.5 text-right text-red-400">{formatCurrency(d.expenses)}</td>
                        <td className={`p-2.5 text-right font-bold ${d.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(d.net)}
                        </td>
                        <td className="p-2.5 text-center text-emerald-400 font-bold">{d.checkIns}</td>
                        <td className="p-2.5 text-center text-blue-400 font-bold">{d.checkOuts}</td>
                        <td className="p-2.5 text-center font-sans font-bold text-[#F4F4F2]">{d.peopleAccommodated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}
    </ShellPage>
  );
}

const MetricBox: React.FC<{ label: string; value: string | number; sub: string; highlight?: string }> = ({
  label,
  value,
  sub,
  highlight = 'text-[#F4F4F2]',
}) => (
  <div className="p-3 bg-[#14161D] rounded-lg border border-[#2B303E]">
    <div className="text-[10px] uppercase font-bold text-[#A0A5AD]">{label}</div>
    <div className={`text-xl font-extrabold mt-0.5 ${highlight}`}>{value}</div>
    <div className="text-[10px] text-[#6E737B] mt-0.5">{sub}</div>
  </div>
);

const DeptCard: React.FC<{ icon: any; label: string; value: any; note: string }> = ({
  icon: Icon,
  label,
  value,
  note,
}) => (
  <div className="rounded-xl border border-[#2B303E] bg-[#14161D] p-4 flex flex-col justify-between">
    <div className="flex items-center gap-2 text-xs font-bold text-[#A0A5AD]">
      <Icon size={16} className="text-[#C5A880]" />
      <span>{label}</span>
    </div>
    <div className="mt-3 text-xl font-extrabold text-[#F4F4F2]">
      {formatCurrency(Number(value || 0))}
    </div>
    <div className="mt-2 text-[10px] text-[#6E737B] pt-1.5 border-t border-[#2B303E]">
      {note}
    </div>
  </div>
);
