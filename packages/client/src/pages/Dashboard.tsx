import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, roomsApi, staysApi, posApi, reservationsApi } from '../services/apiService';
import { clearGetCache } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '@nslv/shared';
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
  MapPin,
  CheckCircle2,
  AlertCircle,
  Activity,
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

  const nowFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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

  if (loading) return <LoadingState message="Connecting to NS Luxury Villa live property command..." />;

  const totalDeptRevenue =
    Number(m.restaurantRevenueToday || 0) + Number(m.barRevenueToday || 0) + Number(m.poolRevenueToday || 0);

  return (
    <div className="space-y-7 pb-16 animate-in fade-in duration-300">
      {/* ── Editorial Villa Header ── */}
      <div className="glass clay-card relative overflow-hidden rounded-3xl p-7 sm:p-9 border text-[var(--ns-ink)]">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ns-gold)] glass-subtle px-3 py-1 text-[10px] font-black tracking-widest text-[var(--ns-gold)] uppercase">
                <Sparkles size={11} className="text-[var(--ns-gold)]" /> Home
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ns-success)] glass-subtle px-3 py-1 text-[10px] font-bold text-[var(--ns-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Today
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--ns-ink)] font-serif">
              Your place, in one view
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ns-muted)] max-w-xl font-medium leading-relaxed">
              Lokoe, Ho, Ghana · {nowFormatted}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void load()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl clay-btn clay-btn-secondary px-3.5 py-2 text-xs font-bold text-[var(--ns-ink)] disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            {canFrontDesk && (
              <button
                onClick={() => navigate('/frontdesk')}
                className="inline-flex items-center gap-2 rounded-xl clay-btn clay-btn-primary px-4 py-2 text-xs font-black text-white shadow-md transition-all"
              >
                <LogIn size={14} />
                <span>Front desk</span>
              </button>
            )}
            {canReserve && (
              <button
                onClick={() => navigate('/reservations')}
                className="inline-flex items-center gap-2 rounded-xl clay-btn clay-btn-accent px-4 py-2 text-xs font-black text-white shadow-md transition-all"
              >
                <CalendarCheck size={14} />
                <span>New stay</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[var(--ns-danger)] glass-subtle px-4 py-3 text-xs font-semibold text-[var(--ns-danger)] shadow-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Authoritative Room Availability Ledger ── */}
      <div className="rounded-2xl border border-[var(--ns-glass-line)] glass clay-card p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--ns-glass-line)] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--ns-teal)]">
              <BedDouble size={16} />
              <span>Room status today</span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--ns-muted)]">
              Rooms booked for later dates stay <strong>available today</strong> until their arrival date begins.
            </p>
          </div>
          <button
            onClick={() => navigate('/rooms')}
            className="text-xs font-bold text-[var(--ns-gold)] hover:text-[var(--ns-gold)] flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            <span>Open room board</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 4-Sector Dynamic Availability Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Available Rooms */}
          <div
            onClick={() => navigate('/rooms')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-success)] glass p-4 shadow-2xs hover:border-[var(--ns-success)] hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ns-success)]">Available</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--ns-success)]">{m.availableRooms}</div>
            <div className="mt-1 text-[11px] text-[var(--ns-success)] font-medium">Ready for check-in</div>
          </div>

          {/* Reserved Rooms */}
          <div
            onClick={() => navigate('/reservations')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-warning)] glass p-4 shadow-2xs hover:border-[var(--ns-warning)] hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ns-warning)]">Booked today</span>
              <CalendarCheck size={14} className="text-[var(--ns-warning)]" />
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--ns-warning)]">{m.reservedRooms}</div>
            <div className="mt-1 text-[11px] text-[var(--ns-warning)] font-medium">Arrivals and active stays</div>
          </div>

          {/* Occupied Rooms */}
          <div
            onClick={() => navigate('/frontdesk')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-info)] glass p-4 shadow-2xs hover:border-[var(--ns-info)] hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ns-info)]">Checked in</span>
              <Users size={14} className="text-[var(--ns-info)]" />
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--ns-info)]">{m.occupiedRooms}</div>
            <div className="mt-1 text-[11px] text-[var(--ns-info)] font-medium">Guests currently in-house</div>
          </div>

          {/* Housekeeping / Dirty */}
          <div
            onClick={() => navigate('/rooms')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-danger)] glass p-4 shadow-2xs hover:border-[var(--ns-danger)] hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ns-danger)]">Needs turnover</span>
              <DoorOpen size={14} className="text-[var(--ns-danger)]" />
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--ns-danger)]">{m.dirtyRooms}</div>
            <div className="mt-1 text-[11px] text-[var(--ns-danger)] font-medium">Awaiting housekeeping</div>
          </div>
        </div>

        {/* Visual Room Distribution Ribbon */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--ns-muted)]">
            <span>Room mix ({m.totalRooms} total rooms)</span>
            <span className="text-[var(--ns-teal)] font-black">{m.occupancyRate}% occupancy</span>
          </div>
          <div className="h-2.5 w-full ns-glass-band rounded-full overflow-hidden flex border border-[var(--ns-glass-line)]">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${m.totalRooms ? (m.availableRooms / m.totalRooms) * 100 : 0}%` }}
              title={`Available: ${m.availableRooms}`}
            />
            <div
              className="bg-amber-500 transition-all duration-500"
              style={{ width: `${m.totalRooms ? (m.reservedRooms / m.totalRooms) * 100 : 0}%` }}
              title={`Reserved: ${m.reservedRooms}`}
            />
            <div
              className="bg-sky-500 transition-all duration-500"
              style={{ width: `${m.totalRooms ? (m.occupiedRooms / m.totalRooms) * 100 : 0}%` }}
              title={`Occupied: ${m.occupiedRooms}`}
            />
            <div
              className="bg-rose-500 transition-all duration-500"
              style={{ width: `${m.totalRooms ? (m.dirtyRooms / m.totalRooms) * 100 : 0}%` }}
              title={`Dirty: ${m.dirtyRooms}`}
            />
          </div>
        </div>
      </div>

      {/* ── Financial & Operations Command Suite ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Collections */}
        <div
          onClick={() => navigate('/payments')}
          className="group cursor-pointer rounded-2xl border border-[var(--ns-glass-line)] glass p-5 shadow-xs hover:border-[var(--ns-success)] hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">Collected Today</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl ns-glass-band text-[var(--ns-success)] group-hover:scale-105 transition-transform">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[var(--ns-ink)]">{formatCurrency(m.revenueToday)}</div>
          <div className="mt-1 flex items-center justify-between text-xs font-semibold text-[var(--ns-success)]">
            <span>Posted ledger receipts</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              View <ChevronRight size={11} />
            </span>
          </div>
        </div>

        {/* Open Folios */}
        <div
          onClick={() => navigate('/guest-bills')}
          className="group cursor-pointer rounded-2xl border border-[var(--ns-glass-line)] glass p-5 shadow-xs hover:border-[var(--ns-warning)] hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">Open Folio Balance</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl ns-glass-band text-[var(--ns-warning)] group-hover:scale-105 transition-transform">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[var(--ns-ink)]">
            {formatCurrency(m.outstandingBalanceTotal)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs font-semibold text-[var(--ns-warning)]">
            <span>Across in-house guest folios</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              View <ChevronRight size={11} />
            </span>
          </div>
        </div>

        {/* Arrivals Today */}
        <div
          onClick={() => navigate('/frontdesk')}
          className="group cursor-pointer rounded-2xl border border-[var(--ns-glass-line)] glass p-5 shadow-xs hover:border-[var(--ns-info)] hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">Today's Arrivals</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl ns-glass-band text-[var(--ns-info)] group-hover:scale-105 transition-transform">
              <LogIn size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[var(--ns-ink)]">{m.checkInsToday}</div>
          <div className="mt-1 flex items-center justify-between text-xs font-semibold text-[var(--ns-info)]">
            <span>Processed check-ins today</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              View <ChevronRight size={11} />
            </span>
          </div>
        </div>

        {/* Departures Today */}
        <div
          onClick={() => navigate('/frontdesk')}
          className="group cursor-pointer rounded-2xl border border-[var(--ns-glass-line)] glass p-5 shadow-xs hover:border-[var(--ns-glass-line)] hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">Today's Departures</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl ns-glass-band text-[var(--ns-muted)] group-hover:scale-105 transition-transform">
              <LogOut size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-[var(--ns-ink)]">{m.checkOutsToday}</div>
          <div className="mt-1 flex items-center justify-between text-xs font-semibold text-[var(--ns-muted)]">
            <span>Completed checkouts today</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
              View <ChevronRight size={11} />
            </span>
          </div>
        </div>
      </div>

      {/* ── Active In-House Stays & Department Pulse ── */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* In-House Guests Concierge Ledger */}
        <div className="rounded-2xl border border-[var(--ns-glass-line)] glass shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-6 py-4 ns-glass-band">
            <div>
              <h2 className="text-sm font-extrabold text-[var(--ns-ink)] flex items-center gap-2">
                <Users size={16} className="text-[var(--ns-teal)]" />
                In-House Active Stays
              </h2>
              <p className="text-[11px] text-[var(--ns-muted)] mt-0.5">Checked-in guests currently occupying villa rooms</p>
            </div>
            {canFrontDesk && (
              <button
                onClick={() => navigate('/frontdesk')}
                className="text-xs font-bold text-[var(--ns-gold)] hover:text-[var(--ns-gold)] flex items-center gap-1 transition-colors"
              >
                Front Desk Terminal &rarr;
              </button>
            )}
          </div>

          {stays.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--ns-muted)]">
              No guests currently occupying villa rooms.
            </div>
          ) : (
            <div className="divide-y divide-[var(--ns-glass-line)]">
              {stays.slice(0, 6).map((s) => {
                const guestFullName =
                  [s.guest?.firstName, s.guest?.lastName].filter(Boolean).join(' ') || 'Guest';
                const initials =
                  (s.guest?.firstName?.[0] || 'G') + (s.guest?.lastName?.[0] || '');
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 ns-glass-hover transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ns-glass-band text-xs font-black text-[var(--ns-ink)] shadow-xs">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-[var(--ns-ink)] flex items-center gap-2">
                          <span>{guestFullName}</span>
                          <span className="rounded-md border border-[var(--ns-gold)] glass-subtle px-2 py-0.5 text-[10px] font-black text-[var(--ns-gold)]">
                            Room {s.room?.number || '—'}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--ns-muted)] flex items-center gap-2">
                          <span>Departure: {s.checkOutDate ? new Date(s.checkOutDate).toLocaleDateString() : '—'}</span>
                          <span>&bull;</span>
                          <span>Checked in: {s.actualCheckIn ? new Date(s.actualCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {statusBadge(s.status || 'CHECKED_IN')}
                      <button
                        onClick={() => navigate('/guest-bills')}
                        className="rounded-lg border border-[var(--ns-glass-line)] p-1.5 text-[var(--ns-muted)] ns-glass-hover hover:text-[var(--ns-ink)] transition-colors"
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

        {/* Department Revenue Pulse */}
        <div className="rounded-2xl border border-[var(--ns-glass-line)] glass shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-6 py-4 ns-glass-band">
              <div>
                <h2 className="text-sm font-extrabold text-[var(--ns-ink)] flex items-center gap-2">
                  <TrendingUp size={16} className="text-[var(--ns-gold)]" />
                  Department Pulse
                </h2>
                <p className="text-[11px] text-[var(--ns-muted)] mt-0.5">Live revenue across property outlets</p>
              </div>
              <span className="text-xs font-black text-[var(--ns-success)] glass-subtle px-2.5 py-1 rounded-full border border-[var(--ns-success)]">
                {formatCurrency(totalDeptRevenue)}
              </span>
            </div>

            <div className="p-5 space-y-3.5">
              {/* Restaurant */}
              <div
                onClick={() => navigate('/restaurant/pos')}
                className="group cursor-pointer rounded-xl border border-[var(--ns-glass-line)] p-4 hover:border-[var(--ns-teal)] ns-glass-hover transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg ns-glass-band text-[var(--ns-warning)]">
                      <UtensilsCrossed size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--ns-ink)] group-hover:text-[var(--ns-teal)]">Restaurant Station</div>
                      <div className="text-[10px] text-[var(--ns-muted)]">Fine dining, breakfasts & orders</div>
                    </div>
                  </div>
                  <strong className="text-sm font-extrabold text-[var(--ns-ink)]">
                    {formatCurrency(Number(m.restaurantRevenueToday || 0))}
                  </strong>
                </div>
              </div>

              {/* Bar */}
              <div
                onClick={() => navigate('/bar/pos')}
                className="group cursor-pointer rounded-xl border border-[var(--ns-glass-line)] p-4 hover:border-[var(--ns-teal)] ns-glass-hover transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg ns-glass-band text-[var(--ns-purple)]">
                      <Wine size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--ns-ink)] group-hover:text-[var(--ns-teal)]">Bar &amp; Lounge</div>
                      <div className="text-[10px] text-[var(--ns-muted)]">Cocktails, wines & beverages</div>
                    </div>
                  </div>
                  <strong className="text-sm font-extrabold text-[var(--ns-ink)]">
                    {formatCurrency(Number(m.barRevenueToday || 0))}
                  </strong>
                </div>
              </div>

              {/* Pool */}
              <div
                onClick={() => navigate('/pool/services')}
                className="group cursor-pointer rounded-xl border border-[var(--ns-glass-line)] p-4 hover:border-[var(--ns-teal)] ns-glass-hover transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg ns-glass-band text-[var(--ns-info)]">
                      <Waves size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--ns-ink)] group-hover:text-[var(--ns-teal)]">Swimming Pool</div>
                      <div className="text-[10px] text-[var(--ns-muted)]">Pool passes, towels & leisure</div>
                    </div>
                  </div>
                  <strong className="text-sm font-extrabold text-[var(--ns-ink)]">
                    {formatCurrency(Number(m.poolRevenueToday || 0))}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--ns-glass-line)] ns-glass-band p-4 flex items-center justify-between text-xs">
            <span className="text-[var(--ns-muted)] font-medium">Daily outlets performance</span>
            <button
              onClick={() => navigate('/reports')}
              className="text-[var(--ns-teal)] font-bold hover:underline flex items-center gap-1"
            >
              Outlets Analytics &rarr;
            </button>
          </div>
        </div>
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

  if (loading) return <LoadingState message={`Connecting to ${deptLabel} workstation...`} />;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ns-gold)] glass-subtle px-3 py-1 text-[11px] font-bold tracking-wider text-[var(--ns-gold)] uppercase shadow-xs">
            <Sparkles size={13} className="text-[var(--ns-gold)]" />
            {deptLabel} Workstation
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ns-ink)]">
            {deptLabel} Operations
          </h1>
          <p className="mt-1 text-xs text-[var(--ns-muted)]">
            Real-time orders, receipts, and revenue reconciliation for this outlet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            loading={refreshing}
            className="border-[var(--ns-glass-line)] ns-glass-hover glass text-[var(--ns-ink)] shadow-xs text-xs font-semibold"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(toPOS)}
            className="glass ns-glass-hover text-[var(--ns-ink)] shadow-md text-xs font-semibold gap-1.5"
          >
            <ArrowRight size={14} /> Open {deptLabel} POS
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--ns-danger)] glass-subtle px-4 py-3 text-xs font-semibold text-[var(--ns-danger)] shadow-xs">
          {error}
        </div>
      )}

      {/* Hero Sales Card */}
      <section className="glass-subtle relative overflow-hidden rounded-3xl text-[var(--ns-ink)] p-6 sm:p-8">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 items-center">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--ns-gold)]">
              Today's {deptLabel} Revenue
            </div>
            <div className="mt-2 text-3xl sm:text-4xl font-black text-[var(--ns-ink)]">
              {formatCurrency(Number(todayRevenue || 0))}
            </div>
            <p className="mt-2 text-xs text-[var(--ns-muted)] max-w-md">
              Cumulative department sales processed across active guest folios, card, cash, and MoMo.
            </p>
            <div className="mt-5">
              <Button
                size="sm"
                onClick={() => navigate(toPOS)}
                className="glass text-[var(--ns-ink)] font-bold text-xs shadow-md"
              >
                <ArrowRight size={14} /> Take New Order
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl glass-subtle border border-[var(--ns-glass-line)] p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">Orders Today</div>
              <div className="mt-1 text-2xl font-black text-[var(--ns-ink)]">{todayOrders.length}</div>
            </div>
            <div className="rounded-xl glass-subtle border border-[var(--ns-glass-line)] p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">Items Sold</div>
              <div className="mt-1 text-2xl font-black text-[var(--ns-ink)]">
                {todayOrders.reduce((s, o) => s + (o.orderItems?.length || 1), 0)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Transactions Table */}
      <div className="rounded-2xl border border-[var(--ns-glass-line)] glass shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-6 py-4 ns-glass-band">
          <div>
            <h2 className="text-sm font-extrabold text-[var(--ns-ink)]">Recent {deptLabel} Transactions</h2>
            <p className="text-[11px] text-[var(--ns-muted)] mt-0.5">Orders and receipts posted today</p>
          </div>
          <button
            onClick={() => navigate(toPOS)}
            className="text-xs font-bold text-[var(--ns-teal)] hover:underline"
          >
            New Order &rarr;
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="p-10 text-center text-xs text-[var(--ns-muted)]">No orders posted yet today.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--ns-glass-line)] ns-glass-band text-[10px] uppercase font-bold tracking-wider text-[var(--ns-muted)]">
                <tr>
                  <th className="px-6 py-3.5">Order No.</th>
                  <th className="px-6 py-3.5">Payment</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-glass-line)]">
                {orders.slice(0, 10).map((o) => (
                  <tr key={o.id} className="ns-glass-hover transition-colors">
                    <td className="px-6 py-3.5 font-mono text-xs font-bold text-[var(--ns-ink)]">
                      {o.orderNo || o.transactionNo}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-[var(--ns-muted)]">{o.paymentMethod}</td>
                    <td className="px-6 py-3.5">{statusBadge(o.paymentStatus || o.status || 'COMPLETED')}</td>
                    <td className="px-6 py-3.5 text-right font-extrabold text-xs text-[var(--ns-ink)]">
                      {formatCurrency(Number(o.totalAmount || 0))}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => printReceipt(o, kind)} className="gap-1 text-xs border-[var(--ns-glass-line)] text-[var(--ns-ink)]">
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

