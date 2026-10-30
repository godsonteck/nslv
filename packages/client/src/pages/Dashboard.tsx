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
import { KpiRibbon } from '../components/common/WorkspaceUI';

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
    <div className="workspace-page space-y-5 pb-16 animate-in fade-in duration-300">
      <header className="workspace-page__header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Sparkles size={15} />
          </div>
          <div>
            <div className="workspace-page__eyebrow">Property operations</div>
            <h1 className="workspace-page__title text-xl">
              Command Center
            </h1>
            <p className="workspace-page__subtitle text-[11px]">
              {nowFormatted}
            </p>
          </div>
        </div>
        <div className="workspace-page__actions">
          <button
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl clay-btn clay-btn-secondary px-3 py-2 text-[11px] font-bold text-[var(--ns-ink)] disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          {canFrontDesk && (
            <button
              onClick={() => navigate('/frontdesk')}
              className="inline-flex items-center gap-1.5 rounded-xl clay-btn clay-btn-primary px-3.5 py-2 text-[11px] font-black text-white shadow-md"
            >
              <LogIn size={12} /> Front Desk
            </button>
          )}
          {canReserve && (
            <button
              onClick={() => navigate('/reservations')}
              className="inline-flex items-center gap-1.5 rounded-xl clay-btn clay-btn-accent px-3.5 py-2 text-[11px] font-black text-white shadow-md"
            >
              <CalendarCheck size={12} /> New Stay
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-[var(--ns-danger)] glass-subtle px-4 py-3 text-xs font-semibold text-[var(--ns-danger)] shadow-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* ── KPI Ribbon ── */}
      <KpiRibbon
        items={[
          {
            label: 'Revenue Today',
            value: formatCurrency(m.revenueToday),
            accent: 'var(--ns-success)',
            onClick: () => navigate('/payments'),
          },
          {
            label: 'Occupancy',
            value: `${m.occupancyRate}%`,
            accent: 'var(--ns-teal)',
            onClick: () => navigate('/rooms'),
          },
          {
            label: 'Available',
            value: m.availableRooms,
            accent: 'var(--ns-success)',
            onClick: () => navigate('/rooms'),
          },
          {
            label: 'Reserved',
            value: m.reservedRooms,
            accent: 'var(--ns-warning)',
            onClick: () => navigate('/reservations'),
          },
          {
            label: 'Checked In',
            value: m.occupiedRooms,
            accent: 'var(--ns-info)',
            onClick: () => navigate('/frontdesk'),
          },
          {
            label: 'Check-ins',
            value: m.checkInsToday,
            onClick: () => navigate('/frontdesk'),
          },
          {
            label: 'Check-outs',
            value: m.checkOutsToday,
            onClick: () => navigate('/frontdesk'),
          },
          {
            label: 'Open Folios',
            value: formatCurrency(m.outstandingBalanceTotal),
            accent: 'var(--ns-warning)',
            onClick: () => navigate('/guest-bills'),
          },
        ]}
      />

      {/* ── Room Distribution Bar ── */}
      <div className="glass rounded-2xl border border-[var(--ns-glass-line)] px-5 py-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BedDouble size={14} className="text-[var(--ns-teal)]" />
            <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--ns-ink)' }}>
              Room Status
            </span>
          </div>
          <button
            onClick={() => navigate('/rooms')}
            className="text-[11px] font-bold text-[var(--ns-gold)] hover:text-[var(--ns-gold)] flex items-center gap-1 transition-colors"
          >
            Room Board <ChevronRight size={12} />
          </button>
        </div>
        <div className="h-3 w-full ns-glass-band rounded-full overflow-hidden flex border border-[var(--ns-glass-line)]">
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
        <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Available ({m.availableRooms})</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Reserved ({m.reservedRooms})</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> Occupied ({m.occupiedRooms})</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Needs turnover ({m.dirtyRooms})</span>
        </div>
      </div>

      {/* ── Main Split: Stays + Revenue ── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* In-House Active Stays */}
        <div className="glass rounded-2xl border border-[var(--ns-glass-line)] shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-[var(--ns-teal)]" />
              <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>In-House Active Stays</h2>
              <span className="text-[10px] font-bold glass-subtle rounded-full px-2 py-0.5 border border-[var(--ns-glass-line)]" style={{ color: 'var(--ns-muted)' }}>
                {stays.length}
              </span>
            </div>
            {canFrontDesk && (
              <button
                onClick={() => navigate('/frontdesk')}
                className="text-[11px] font-bold text-[var(--ns-gold)] hover:text-[var(--ns-gold)] flex items-center gap-1 transition-colors"
              >
                Front Desk <ChevronRight size={12} />
              </button>
            )}
          </div>

          {stays.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--ns-muted)]">
              No guests currently occupying villa rooms.
            </div>
          ) : (
            <div className="divide-y divide-[var(--ns-glass-line)]">
              {stays.slice(0, 8).map((s) => {
                const guestFullName =
                  [s.guest?.firstName, s.guest?.lastName].filter(Boolean).join(' ') || 'Guest';
                const initials =
                  (s.guest?.firstName?.[0] || 'G') + (s.guest?.lastName?.[0] || '');
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 ns-glass-hover transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ns-glass-band text-[10px] font-black text-[var(--ns-ink)] shadow-xs border border-[var(--ns-glass-line)]">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-[var(--ns-ink)] flex items-center gap-2">
                          <span>{guestFullName}</span>
                          <span className="rounded-md border border-[var(--ns-gold)] glass-subtle px-1.5 py-0.5 text-[9px] font-black text-[var(--ns-gold)]">
                            Rm {s.room?.number || '—'}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-[var(--ns-muted)] flex items-center gap-2">
                          <span>Out: {s.checkOutDate ? new Date(s.checkOutDate).toLocaleDateString() : '—'}</span>
                          <span>&middot;</span>
                          <span>In: {s.actualCheckIn ? new Date(s.actualCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(s.status || 'CHECKED_IN')}
                      <button
                        onClick={() => navigate('/guest-bills')}
                        className="rounded-lg border border-[var(--ns-glass-line)] p-1.5 text-[var(--ns-muted)] ns-glass-hover hover:text-[var(--ns-ink)] transition-colors"
                        title="View Folio / Bill"
                      >
                        <Receipt size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Department Pulse + Dirty Rooms */}
        <div className="space-y-5">
          {/* Department Revenue Pulse */}
          <div className="glass rounded-2xl border border-[var(--ns-glass-line)] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-[var(--ns-gold)]" />
                <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Outlet Revenue</h2>
              </div>
              <span className="text-xs font-black text-[var(--ns-success)] glass-subtle px-2.5 py-1 rounded-full border border-[var(--ns-success)]">
                {formatCurrency(totalDeptRevenue)}
              </span>
            </div>

            <div className="p-4 space-y-2.5">
              <div
                onClick={() => navigate('/restaurant/pos')}
                className="group cursor-pointer rounded-xl border border-[var(--ns-glass-line)] p-3.5 hover:border-[var(--ns-teal)] ns-glass-hover transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg ns-glass-band text-[var(--ns-warning)]">
                      <UtensilsCrossed size={14} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-[var(--ns-ink)] group-hover:text-[var(--ns-teal)]">Restaurant</div>
                      <div className="text-[9px] text-[var(--ns-muted)]">Dining & orders</div>
                    </div>
                  </div>
                  <strong className="text-xs font-extrabold text-[var(--ns-ink)]">
                    {formatCurrency(Number(m.restaurantRevenueToday || 0))}
                  </strong>
                </div>
              </div>

              <div
                onClick={() => navigate('/bar/pos')}
                className="group cursor-pointer rounded-xl border border-[var(--ns-glass-line)] p-3.5 hover:border-[var(--ns-teal)] ns-glass-hover transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg ns-glass-band text-[var(--ns-purple)]">
                      <Wine size={14} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-[var(--ns-ink)] group-hover:text-[var(--ns-teal)]">Bar & Lounge</div>
                      <div className="text-[9px] text-[var(--ns-muted)]">Cocktails & beverages</div>
                    </div>
                  </div>
                  <strong className="text-xs font-extrabold text-[var(--ns-ink)]">
                    {formatCurrency(Number(m.barRevenueToday || 0))}
                  </strong>
                </div>
              </div>

              <div
                onClick={() => navigate('/pool/services')}
                className="group cursor-pointer rounded-xl border border-[var(--ns-glass-line)] p-3.5 hover:border-[var(--ns-teal)] ns-glass-hover transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg ns-glass-band text-[var(--ns-info)]">
                      <Waves size={14} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-[var(--ns-ink)] group-hover:text-[var(--ns-teal)]">Pool</div>
                      <div className="text-[9px] text-[var(--ns-muted)]">Passes & leisure</div>
                    </div>
                  </div>
                  <strong className="text-xs font-extrabold text-[var(--ns-ink)]">
                    {formatCurrency(Number(m.poolRevenueToday || 0))}
                  </strong>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--ns-glass-line)] ns-glass-band px-5 py-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Daily outlet performance</span>
              <button
                onClick={() => navigate('/reports')}
                className="text-[10px] font-bold text-[var(--ns-teal)] hover:underline flex items-center gap-1"
              >
                Analytics <ChevronRight size={10} />
              </button>
            </div>
          </div>

          {/* Dirty Rooms Alert */}
          {dirty.length > 0 && (
            <div className="glass rounded-2xl border border-[var(--ns-danger)]/40 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3 ns-glass-band">
                <div className="flex items-center gap-2">
                  <DoorOpen size={14} className="text-[var(--ns-danger)]" />
                  <h2 className="text-xs font-black" style={{ color: 'var(--ns-ink)' }}>Housekeeping Alert</h2>
                </div>
                <span className="text-[10px] font-black text-[var(--ns-danger)] glass-subtle px-2 py-0.5 rounded-full border border-[var(--ns-danger)]/30">
                  {dirty.length} room{dirty.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                {dirty.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    onClick={() => navigate('/rooms')}
                    className="flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer ns-glass-hover transition-colors"
                  >
                    <span className="text-[11px] font-bold text-[var(--ns-ink)]">Room {r.number}</span>
                    <span className="text-[9px] font-bold text-[var(--ns-danger)]">{r.status}</span>
                  </div>
                ))}
                {dirty.length > 4 && (
                  <button
                    onClick={() => navigate('/rooms')}
                    className="w-full text-center text-[10px] font-bold text-[var(--ns-gold)] py-1.5 hover:underline"
                  >
                    +{dirty.length - 4} more
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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

  const Icon = icon;

  return (
    <div className="workspace-page space-y-5 pb-12 animate-in fade-in duration-200">
      <header className="workspace-page__header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Icon size={15} />
          </div>
          <div>
            <div className="workspace-page__eyebrow">Department operations</div>
            <h1 className="workspace-page__title text-xl">
              {deptLabel} Workstation
            </h1>
            <p className="workspace-page__subtitle text-[11px]">
              Orders, receipts & revenue
            </p>
          </div>
        </div>
        <div className="workspace-page__actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            loading={refreshing}
            className="border-[var(--ns-glass-line)] ns-glass-hover glass text-[var(--ns-ink)] shadow-xs text-[11px] font-semibold"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(toPOS)}
            className="glass ns-glass-hover text-[var(--ns-ink)] shadow-md text-[11px] font-bold gap-1.5"
          >
            <ArrowRight size={12} /> Open POS
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-[var(--ns-danger)] glass-subtle px-4 py-3 text-xs font-semibold text-[var(--ns-danger)] shadow-xs">
          {error}
        </div>
      )}

      {/* ── Revenue Hero + Stats Row ── */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="glass clay-card rounded-3xl border border-[var(--ns-glass-line)] p-6 space-y-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--ns-gold)]">
            Today's {deptLabel} Revenue
          </div>
          <div className="text-3xl font-black" style={{ color: 'var(--ns-ink)' }}>
            {formatCurrency(Number(todayRevenue || 0))}
          </div>
          <p className="text-[11px] text-[var(--ns-muted)] max-w-md">
            Cumulative department sales across guest folios, card, cash, and MoMo.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="glass-subtle clay-card rounded-3xl border border-[var(--ns-glass-line)] px-5 py-4 text-center min-w-[112px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">Orders</div>
            <div className="mt-1 text-2xl font-black" style={{ color: 'var(--ns-ink)' }}>{todayOrders.length}</div>
          </div>
          <div className="glass-subtle clay-card rounded-3xl border border-[var(--ns-glass-line)] px-5 py-4 text-center min-w-[112px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">Items</div>
            <div className="mt-1 text-2xl font-black" style={{ color: 'var(--ns-ink)' }}>
              {todayOrders.reduce((s, o) => s + (o.orderItems?.length || 1), 0)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="glass rounded-2xl border border-[var(--ns-glass-line)] shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
          <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>
            Recent Transactions
          </h2>
          <button
            onClick={() => navigate(toPOS)}
            className="text-[11px] font-bold text-[var(--ns-teal)] hover:underline flex items-center gap-1"
          >
            New Order <ChevronRight size={11} />
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="p-10 text-center text-xs text-[var(--ns-muted)]">No orders posted yet today.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--ns-glass-line)] ns-glass-band text-[10px] uppercase font-bold tracking-wider text-[var(--ns-muted)]">
                <tr>
                  <th className="px-5 py-3">Order No.</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-glass-line)]">
                {orders.slice(0, 10).map((o) => (
                  <tr key={o.id} className="ns-glass-hover transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-[var(--ns-ink)]">
                      {o.orderNo || o.transactionNo}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--ns-muted)]">{o.paymentMethod}</td>
                    <td className="px-5 py-3">{statusBadge(o.paymentStatus || o.status || 'COMPLETED')}</td>
                    <td className="px-5 py-3 text-right font-extrabold text-xs text-[var(--ns-ink)]">
                      {formatCurrency(Number(o.totalAmount || 0))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => printReceipt(o, kind)} className="gap-1 text-[10px] border-[var(--ns-glass-line)] text-[var(--ns-ink)]">
                        <Printer size={11} /> Print
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
