import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, roomsApi, staysApi, posApi } from '../services/apiService';
import { clearGetCache } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency, formatUserGreeting } from '@nslv/shared';
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  CreditCard,
  LogIn,
  LogOut,
  RefreshCw,
  Users,
  UtensilsCrossed,
  Wine,
  Waves,
  Printer,
  Sparkles,
  TrendingUp,
  Clock,
  ShieldCheck,
  ChevronRight,
  DoorOpen,
  Receipt,
  Layers,
} from 'lucide-react';
import { villaAssets } from '../assets';
import { receiptCompanyBlock } from '../lib/company';
import { Button, LoadingState, statusBadge } from '../components/ui';

const empty = {
  occupancyRate: 0,
  occupiedRooms: 0,
  reservedRooms: 0,
  availableRooms: 0,
  dirtyRooms: 0,
  totalRooms: 0,
  checkInsToday: 0,
  checkOutsToday: 0,
  revenueToday: 0,
  restaurantRevenueToday: 0,
  barRevenueToday: 0,
  poolRevenueToday: 0,
  outstandingBalanceTotal: 0,
};

const printReceipt = (order: any, kind: 'restaurant' | 'bar' | 'pool') => {
  const win = window.open('', '_blank', 'width=380,height=560');
  if (!win) return;
  const title = kind === 'restaurant' ? 'RESTAURANT RECEIPT' : kind === 'bar' ? 'BAR RECEIPT' : 'POOL RECEIPT';
  const paymentLabel =
    order.paymentMethod === 'ROOM_CHARGE'
      ? `Charged to folio${order.room ? ` · Room ${order.room?.number ?? ''}` : ''}`
      : order.paymentMethod;
  const no = order.orderNo || order.transactionNo || '—';
  const lines =
    kind === 'pool'
      ? `<tr><td>${order.service?.name || 'Pool service'}</td><td class="r">${order.quantity || 1} × ${formatCurrency(Number(order.unitPrice || 0))}</td><td class="r">${formatCurrency(Number(order.totalAmount || 0))}</td></tr>`
      : (order.orderItems || [])
          .map(
            (li: any) =>
              `<tr><td>${li.item?.name || 'Item'}</td><td class="r">${li.quantity} × ${formatCurrency(Number(li.unitPrice || 0))}</td><td class="r">${formatCurrency(Number(li.totalPrice || 0))}</td></tr>`,
          )
          .join('');
  const logoUrl = new URL(villaAssets.logo, window.location.href).href;
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
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
    ${receiptCompanyBlock()}<div class="sub">${title} · OFFICIAL RECEIPT</div>
    <div class="row"><span>Order No</span><span>${no}</span></div>
    <div class="row"><span>Date</span><span>${new Date(order.createdAt).toLocaleString()}</span></div>
    <div class="row"><span>Payment</span><span>${paymentLabel}</span></div>
    <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Total</th></tr></thead><tbody>${lines}</tbody></table>
    <div class="total"><span>Amount paid</span><span>${formatCurrency(Number(order.totalAmount || 0))}</span></div>
    <div class="foot">Currency: GHS · This is a computer-generated receipt.<br/>Thank you for visiting NS Luxury Villa.</div>
    <div class="noprint" style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 24px;font-size:12px">Print receipt</button></div>
    </body></html>`);
  win.document.close();
};

/** Full property command centre — used by roles that manage rooms & guests. */
const PropertyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [m, setM] = useState<any>(empty);
  const [stays, setStays] = useState<any[]>([]);
  const [dirty, setDirty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const has = useAuthStore((s) => s.hasPermission);
  const canReserve = has('reservations.create');
  const canFrontDesk = has('checkin.perform') || has('checkout.perform');
  const canReports = has('reports.view');
  const canRooms = has('rooms.view');
  const canPayments = has('payments.view');

  const greeting = formatUserGreeting(user);
  const nowStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const load = async (initial = false) => {
    try {
      initial ? setLoading(true) : setRefreshing(true);
      if (!initial) clearGetCache();
      setError('');
      const a = await reportsApi.getDashboardMetrics();
      const b = canRooms ? await staysApi.getActiveStays() : null;
      const c = canRooms ? await roomsApi.getRooms({ status: 'DIRTY' }) : null;
      setM({ ...empty, ...(a || {}) });
      setStays(b?.data || []);
      setDirty(c?.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load live property data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  if (loading) return <LoadingState message="Loading luxury villa live command workspace…" />;

  const totalDeptRevenue =
    Number(m.restaurantRevenueToday || 0) + Number(m.barRevenueToday || 0) + Number(m.poolRevenueToday || 0);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c59a58]/30 bg-[#fbf8f2] px-3 py-1 text-[11px] font-bold tracking-wider text-[#9b6e2e] uppercase shadow-xs">
            <Sparkles size={13} className="text-[#c59a58]" />
            NS Luxury Villa &bull; Executive Command
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0f172a]">
            {greeting}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-xs font-medium text-[#64748b]">
            <Clock size={13} className="text-[#94a3b8]" />
            <span>{nowStr}</span>
            <span>&bull;</span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live System Sync
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            loading={refreshing}
            className="border-[#cbd5e1] hover:bg-white bg-white/70 shadow-xs text-xs font-semibold"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </Button>
          {canReserve && (
            <Button
              size="sm"
              onClick={() => navigate('/reservations')}
              className="bg-gradient-to-r from-[#174b59] to-[#0f3440] hover:from-[#133e4a] hover:to-[#0a232b] text-white shadow-md text-xs font-semibold gap-1.5"
            >
              <CalendarCheck size={14} /> New Reservation
            </Button>
          )}
          {canFrontDesk && (
            <Button
              size="sm"
              onClick={() => navigate('/frontdesk')}
              className="bg-gradient-to-r from-[#c59a58] to-[#9b6e2e] hover:from-[#b08749] hover:to-[#845b23] text-white shadow-md text-xs font-semibold gap-1.5"
            >
              <LogIn size={14} /> Front Desk
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 shadow-xs">
          {error}
        </div>
      )}

      {/* ── Executive Hero Card ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1a24] via-[#102433] to-[#08121a] text-white shadow-[0_20px_50px_rgba(12,26,36,0.35)] border border-white/10">
        <img
          src={villaAssets.villaExterior}
          className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-overlay"
          alt=""
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c1a24] via-[#0c1a24]/90 to-transparent" />

        <div className="relative grid min-h-[240px] lg:grid-cols-[1.25fr_1fr]">
          {/* Left Column: Slogan & Quick Actions */}
          <div className="p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-md bg-[#c59a58]/20 px-2.5 py-1 text-[10px] font-extrabold tracking-widest text-[#f5d99b] uppercase border border-[#c59a58]/40">
                <ShieldCheck size={12} /> Hospitality Operations
              </div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-white max-w-lg">
                &ldquo;Arrive as a guest, stay as family&rdquo;
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-slate-300/80 max-w-md leading-relaxed">
                Complete guest lifecycle oversight &mdash; live reservations, check-ins, guest folios, and multi-outlet billing.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {canFrontDesk && (
                <button
                  onClick={() => navigate('/frontdesk')}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f1a83f] to-[#d48c26] px-4 py-2 text-xs font-extrabold text-[#201608] shadow-lg hover:brightness-105 transition-all"
                >
                  <LogIn size={14} /> Open Front Desk
                </button>
              )}
              {canReports && (
                <button
                  onClick={() => navigate('/reports')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-xs"
                >
                  <TrendingUp size={14} /> Operations Analytics
                </button>
              )}
              {canPayments && (
                <button
                  onClick={() => navigate('/payments')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-xs"
                >
                  <Receipt size={14} /> Audit Payments
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Hero Metrics Matrix */}
          <div className="grid grid-cols-2 border-t lg:border-t-0 lg:border-l border-white/10 bg-white/[0.03] backdrop-blur-xs">
            {/* Occupancy */}
            <div className="p-5 sm:p-6 border-b border-r border-white/10 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#93c5fd]">Occupancy Rate</span>
              <div className="my-2">
                <span className="text-3xl font-black text-white">{m.occupancyRate}%</span>
                <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#38bdf8] to-[#10b981] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, m.occupancyRate))}%` }}
                  />
                </div>
              </div>
              <span className="text-[11px] text-slate-300 font-medium">
                {m.occupiedRooms} of {m.totalRooms} rooms occupied
              </span>
            </div>

            {/* Available */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#86efac]">Available Rooms</span>
              <div className="my-2">
                <span className="text-3xl font-black text-[#4ade80]">{m.availableRooms}</span>
              </div>
              <span className="text-[11px] text-slate-300 font-medium">Ready for immediate check-in</span>
            </div>

            {/* Check-ins */}
            <div className="p-5 sm:p-6 border-r border-white/10 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#fde047]">Arrivals Today</span>
              <div className="my-2">
                <span className="text-3xl font-black text-[#facc15]">{m.checkInsToday}</span>
              </div>
              <span className="text-[11px] text-slate-300 font-medium">Due at Reception desk</span>
            </div>

            {/* Check-outs */}
            <div className="p-5 sm:p-6 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#cbd5e1]">Departures Today</span>
              <div className="my-2">
                <span className="text-3xl font-black text-slate-200">{m.checkOutsToday}</span>
              </div>
              <span className="text-[11px] text-slate-300 font-medium">Scheduled room exits</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key Performance Indicators ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Collections */}
        <div
          onClick={() => navigate('/payments')}
          className="group cursor-pointer rounded-2xl border border-[#cbd5e1]/70 bg-white p-5 shadow-xs hover:border-[#10b981]/50 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Total Collections Today</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[#0f172a]">{formatCurrency(m.revenueToday)}</div>
          <div className="mt-1 flex items-center justify-between text-xs text-emerald-700 font-semibold">
            <span>Settled transactions</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              View <ChevronRight size={11} />
            </span>
          </div>
        </div>

        {/* Outstanding Folio Balance */}
        <div
          onClick={() => navigate('/guest-bills')}
          className="group cursor-pointer rounded-2xl border border-[#cbd5e1]/70 bg-white p-5 shadow-xs hover:border-[#f59e0b]/50 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Open Folio Balance</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[#0f172a]">
            {formatCurrency(m.outstandingBalanceTotal)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-amber-700 font-semibold">
            <span>Outstanding across in-house folios</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              View <ChevronRight size={11} />
            </span>
          </div>
        </div>

        {/* Dirty Rooms */}
        <div
          onClick={() => navigate('/rooms')}
          className="group cursor-pointer rounded-2xl border border-[#cbd5e1]/70 bg-white p-5 shadow-xs hover:border-[#ef4444]/50 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Housekeeping Required</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 group-hover:scale-105 transition-transform">
              <BedDouble size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[#0f172a]">{m.dirtyRooms} <span className="text-sm font-semibold text-[#64748b]">Rooms</span></div>
          <div className="mt-1 flex items-center justify-between text-xs text-rose-700 font-semibold">
            <span>Dirty or awaiting inspection</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              View <ChevronRight size={11} />
            </span>
          </div>
        </div>

        {/* Reserved Rooms */}
        <div
          onClick={() => navigate('/reservations')}
          className="group cursor-pointer rounded-2xl border border-[#cbd5e1]/70 bg-white p-5 shadow-xs hover:border-[#0284c7]/50 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Reserved Commitments</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:scale-105 transition-transform">
              <CalendarCheck size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[#0f172a]">{m.reservedRooms} <span className="text-sm font-semibold text-[#64748b]">Rooms</span></div>
          <div className="mt-1 flex items-center justify-between text-xs text-sky-700 font-semibold">
            <span>Advance & upcoming reservations</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              View <ChevronRight size={11} />
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Operations Section ── */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Left: Active Stays (Guests in House) */}
        <div className="rounded-2xl border border-[#cbd5e1]/70 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
                <Users size={16} className="text-[#174b59]" />
                Guests Currently in House
              </h2>
              <p className="text-[11px] text-[#64748b] mt-0.5">Active checked-in stays and room assignments</p>
            </div>
            {canFrontDesk && (
              <button
                onClick={() => navigate('/frontdesk')}
                className="text-xs font-bold text-[#c59a58] hover:text-[#9b6e2e] flex items-center gap-1 transition-colors"
              >
                Front Desk Desk &rarr;
              </button>
            )}
          </div>

          {stays.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#94a3b8]">
              No guests are currently checked in to rooms.
            </div>
          ) : (
            <div className="divide-y divide-[#f1f5f9]">
              {stays.slice(0, 6).map((s) => {
                const guestFullName =
                  [s.guest?.firstName, s.guest?.lastName].filter(Boolean).join(' ') || 'Guest';
                const initials =
                  (s.guest?.firstName?.[0] || 'G') + (s.guest?.lastName?.[0] || '');
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#174b59] to-[#0e3440] text-xs font-black text-white shadow-xs">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-[#0f172a] flex items-center gap-2">
                          <span>{guestFullName}</span>
                          <span className="rounded-md border border-[#c59a58]/40 bg-[#fbf8f2] px-1.5 py-0.5 text-[10px] font-black text-[#9b6e2e]">
                            Room {s.room?.number || '—'}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#64748b] flex items-center gap-2">
                          <span>
                            Departs {s.checkOutDate ? new Date(s.checkOutDate).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {statusBadge(s.status || 'CHECKED_IN')}
                      <button
                        onClick={() => navigate('/guest-bills')}
                        className="rounded-lg border border-[#cbd5e1] p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        title="View Folio / Bill"
                      >
                        <Receipt size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Department Sales Pulse */}
        <div className="rounded-2xl border border-[#cbd5e1]/70 bg-white shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4 bg-slate-50/50">
              <div>
                <h2 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#c59a58]" />
                  Department Pulse
                </h2>
                <p className="text-[11px] text-[#64748b] mt-0.5">Live outlet sales recorded today</p>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {formatCurrency(totalDeptRevenue)}
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Restaurant */}
              <div
                onClick={() => navigate('/restaurant/pos')}
                className="group cursor-pointer rounded-xl border border-[#e2e8f0] p-4 hover:border-[#174b59]/40 hover:bg-slate-50/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <UtensilsCrossed size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0f172a] group-hover:text-[#174b59]">Restaurant</div>
                      <div className="text-[10px] text-[#64748b]">Food & dining services</div>
                    </div>
                  </div>
                  <strong className="text-sm font-extrabold text-[#0f172a]">
                    {formatCurrency(Number(m.restaurantRevenueToday || 0))}
                  </strong>
                </div>
              </div>

              {/* Bar */}
              <div
                onClick={() => navigate('/bar/pos')}
                className="group cursor-pointer rounded-xl border border-[#e2e8f0] p-4 hover:border-[#174b59]/40 hover:bg-slate-50/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <Wine size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0f172a] group-hover:text-[#174b59]">Bar & Lounge</div>
                      <div className="text-[10px] text-[#64748b]">Cocktails, wines & beverages</div>
                    </div>
                  </div>
                  <strong className="text-sm font-extrabold text-[#0f172a]">
                    {formatCurrency(Number(m.barRevenueToday || 0))}
                  </strong>
                </div>
              </div>

              {/* Pool */}
              <div
                onClick={() => navigate('/pool/services')}
                className="group cursor-pointer rounded-xl border border-[#e2e8f0] p-4 hover:border-[#174b59]/40 hover:bg-slate-50/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                      <Waves size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0f172a] group-hover:text-[#174b59]">Swimming Pool</div>
                      <div className="text-[10px] text-[#64748b]">Passes, towels & leisure</div>
                    </div>
                  </div>
                  <strong className="text-sm font-extrabold text-[#0f172a]">
                    {formatCurrency(Number(m.poolRevenueToday || 0))}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#e2e8f0] bg-slate-50/70 p-4 flex items-center justify-between text-xs">
            <span className="text-[#64748b] font-medium">Daily outlets performance</span>
            <button
              onClick={() => navigate('/reports')}
              className="text-[#174b59] font-bold hover:underline flex items-center gap-1"
            >
              Outlet breakdowns &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ── Housekeeping Alert Section ── */}
      <div className="rounded-2xl border border-[#cbd5e1]/70 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
              <BedDouble size={16} className="text-rose-600" />
              Housekeeping Attention Required
            </h2>
            <p className="text-[11px] text-[#64748b] mt-0.5">Rooms requiring turnover or inspection</p>
          </div>
          {canRooms && (
            <button
              onClick={() => navigate('/rooms')}
              className="text-xs font-bold text-[#174b59] hover:underline flex items-center gap-1"
            >
              Rooms Management &rarr;
            </button>
          )}
        </div>

        {dirty.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#94a3b8]">
            All rooms are clean and ready. Housekeeping is up to date.
          </div>
        ) : (
          <div className="grid gap-3.5 p-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {dirty.slice(0, 8).map((r) => (
              <button
                key={r.id}
                onClick={() => navigate('/rooms')}
                disabled={!canRooms}
                className="rounded-xl border border-rose-200/80 bg-rose-50/30 p-4 text-left hover:border-rose-300 hover:bg-rose-50/60 transition-all duration-150 disabled:cursor-default"
              >
                <div className="flex items-center justify-between">
                  <div className="text-base font-black text-[#0f172a]">Room {r.number}</div>
                  {statusBadge(r.status)}
                </div>
                <div className="mt-1 text-[11px] text-[#64748b]">
                  {r.roomType?.name || 'Standard Room'} &bull; Floor {r.floor ?? 1}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Department workstation dashboard — for Restaurant / Bar / Pool roles. */
const DepartmentDashboard: React.FC<{ kind: 'restaurant' | 'bar' | 'pool' }> = ({ kind }) => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [m, setM] = useState<any>(empty);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const greeting = formatUserGreeting(user);
  const deptLabel = kind === 'restaurant' ? 'Restaurant' : kind === 'bar' ? 'Bar' : 'Pool';
  const icon = kind === 'restaurant' ? UtensilsCrossed : kind === 'bar' ? Wine : Waves;
  const toPOS = kind === 'restaurant' ? '/restaurant/pos' : kind === 'bar' ? '/bar/pos' : '/pool/services';
  const todayRevenue =
    kind === 'restaurant' ? m.restaurantRevenueToday : kind === 'bar' ? m.barRevenueToday : m.poolRevenueToday;

  const load = async (initial = false) => {
    try {
      initial ? setLoading(true) : setRefreshing(true);
      if (!initial) clearGetCache();
      setError('');
      const [a, o] = await Promise.all([
        reportsApi.getDashboardMetrics(),
        kind === 'restaurant'
          ? posApi.getRestaurantOrders()
          : kind === 'bar'
          ? posApi.getBarOrders()
          : posApi.getPoolTransactions(),
      ]);
      setM({ ...empty, ...(a || {}) });
      setOrders(o.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load department data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  const todayOrders = orders.filter(
    (o) => String(o.createdAt || '').slice(0, 10) === new Date().toISOString().slice(0, 10),
  );

  if (loading) return <LoadingState message={`Loading the ${deptLabel} workstation…`} />;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c59a58]/30 bg-[#fbf8f2] px-3 py-1 text-[11px] font-bold tracking-wider text-[#9b6e2e] uppercase shadow-xs">
            <Sparkles size={13} className="text-[#c59a58]" />
            NS Luxury Villa &bull; {deptLabel} Workstation
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0f172a]">
            {greeting}
          </h1>
          <p className="mt-1 text-xs text-[#64748b]">
            Your department's live sales, active orders, and printed receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            loading={refreshing}
            className="border-[#cbd5e1] hover:bg-white bg-white/70 shadow-xs text-xs font-semibold"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(toPOS)}
            className="bg-gradient-to-r from-[#174b59] to-[#0f3440] hover:from-[#133e4a] hover:to-[#0a232b] text-white shadow-md text-xs font-semibold gap-1.5"
          >
            <ArrowRight size={14} /> Open {deptLabel} POS
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 shadow-xs">
          {error}
        </div>
      )}

      {/* Hero Sales Card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1a24] via-[#102433] to-[#08121a] text-white shadow-[0_20px_50px_rgba(12,26,36,0.35)] border border-white/10 p-6 sm:p-8">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 items-center">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#f5d99b]">
              Today's {deptLabel} Revenue
            </div>
            <div className="mt-2 text-3xl sm:text-4xl font-black text-white">
              {formatCurrency(Number(todayRevenue || 0))}
            </div>
            <p className="mt-2 text-xs text-slate-300 max-w-md">
              Cumulative department sales processed across active guest folios, card, cash, and MoMo.
            </p>
            <div className="mt-5">
              <Button
                size="sm"
                onClick={() => navigate(toPOS)}
                className="bg-gradient-to-r from-[#f1a83f] to-[#d48c26] text-[#201608] font-bold text-xs shadow-md"
              >
                <ArrowRight size={14} /> Take New Order
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Orders Today</div>
              <div className="mt-1 text-2xl font-black text-white">{todayOrders.length}</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Items Sold</div>
              <div className="mt-1 text-2xl font-black text-white">
                {todayOrders.reduce((s, o) => s + (o.orderItems?.length || 1), 0)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Transactions Table */}
      <div className="rounded-2xl border border-[#cbd5e1]/70 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-extrabold text-[#0f172a]">Recent {deptLabel} Transactions</h2>
            <p className="text-[11px] text-[#64748b] mt-0.5">Orders and receipts posted today</p>
          </div>
          <button
            onClick={() => navigate(toPOS)}
            className="text-xs font-bold text-[#174b59] hover:underline"
          >
            New Order &rarr;
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#94a3b8]">No orders posted yet today.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[#e2e8f0] bg-slate-50 text-[10px] uppercase font-bold tracking-wider text-[#64748b]">
                <tr>
                  <th className="px-6 py-3.5">Order No.</th>
                  <th className="px-6 py-3.5">Payment</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {orders.slice(0, 10).map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-xs font-bold text-[#0f172a]">
                      {o.orderNo || o.transactionNo}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-[#64748b]">{o.paymentMethod}</td>
                    <td className="px-6 py-3.5">{statusBadge(o.paymentStatus || o.status || 'COMPLETED')}</td>
                    <td className="px-6 py-3.5 text-right font-extrabold text-xs text-[#0f172a]">
                      {formatCurrency(Number(o.totalAmount || 0))}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => printReceipt(o, kind)} className="gap-1 text-xs">
                        <Printer size={13} /> Print
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const canRooms = useAuthStore((s) => s.hasPermission('rooms.view'));
  const roleName = user?.roles?.[0]?.name ?? '';

  if (!canRooms) {
    const kind =
      roleName.toLowerCase() === 'restaurant'
        ? 'restaurant'
        : roleName.toLowerCase() === 'bar'
        ? 'bar'
        : roleName.toLowerCase() === 'pool'
        ? 'pool'
        : null;
    if (kind) return <DepartmentDashboard kind={kind} />;
  }
  return <PropertyDashboard />;
};

export default Dashboard;
