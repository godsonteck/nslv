import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { reportsApi, roomsApi, staysApi, posApi } from '../services/apiService';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency, formatUserGreeting } from '@nslv/shared';
import { ArrowRight, BedDouble, CalendarCheck, CreditCard, LogIn, LogOut, RefreshCw, Users, UtensilsCrossed, Wine, Waves, Printer } from 'lucide-react';
import { villaAssets } from '../assets';
import { receiptCompanyBlock } from '../lib/company';
import { Button, LoadingState, statusBadge } from '../components/ui';
import { ShellPage, StatTile, Section } from '../components/common/WorkspaceUI';

const empty = {occupancyRate:0,occupiedRooms:0,reservedRooms:0,availableRooms:0,dirtyRooms:0,totalRooms:0,checkInsToday:0,checkOutsToday:0,revenueToday:0,restaurantRevenueToday:0,barRevenueToday:0,poolRevenueToday:0,outstandingBalanceTotal:0};

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

  const greeting = formatUserGreeting(user);

  const load = async (initial = false) => {
    try {
      initial ? setLoading(true) : setRefreshing(true);
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
  useEffect(() => { void load(true); }, []);

  if (loading) return <LoadingState message="Loading the live NSVilla workspace…" />;
  return (
    <ShellPage eyebrow="NSVILLA · PROPERTY CONTROL" title={`${greeting}. Run the property with clarity.`} subtitle="A live command centre for reservations, rooms, guests, revenue and department activity." actions={<><Button variant="outline" size="sm" onClick={() => void load()} loading={refreshing}><RefreshCw size={14} /> Refresh</Button>{canReserve && <Button size="sm" onClick={() => navigate('/reservations')}><CalendarCheck size={14} /> New reservation</Button>}</>}>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div>}
      <section className="relative overflow-hidden rounded-[24px] bg-[#163f4f] text-white shadow-[0_18px_50px_rgba(22,63,79,.18)]">
        <img src={villaAssets.villaExterior} className="absolute inset-0 h-full w-full object-cover opacity-25" alt="" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#163f4f] via-[#163f4f]/95 to-[#163f4f]/45"/>
        <div className="relative grid min-h-[260px] lg:grid-cols-[1.2fr_.8fr]">
          <div className="relative p-7 sm:p-9"><div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#d9bd91]">Today's operations</div><h2 className="mt-3 max-w-xl text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Every guest journey, connected.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/70">Move from arrival to checkout without losing the room, folio or department context.</p><div className="mt-6 flex flex-wrap gap-2">{canFrontDesk && <Button size="sm" className="!bg-[#d2b27d] !text-[#173f52]" onClick={() => navigate('/frontdesk')}><LogIn size={14} /> Open front desk</Button>}{canReports && <Button size="sm" variant="outline" className="!border-white/20 !bg-white/10 !text-white" onClick={() => navigate('/reports')}><ArrowRight size={14} /> View reports</Button>}</div></div>
          <div className="grid grid-cols-2 border-l border-white/10 bg-white/5"><Hero label="Occupancy" value={`${m.occupancyRate}%`} note={`${m.occupiedRooms} of ${m.totalRooms} occupied`} /><Hero label="Available" value={m.availableRooms} note="Ready to sell" /><Hero label="Arrivals" value={m.checkInsToday} note="Today's check-ins" /><Hero label="Departures" value={m.checkOutsToday} note="Today's check-outs" /></div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Collected today" value={formatCurrency(m.revenueToday)} note="Recorded payments" icon={CreditCard} accent />
        <StatTile label="Open folio balance" value={formatCurrency(m.outstandingBalanceTotal)} note="Outstanding across stays" icon={Users} />
        <StatTile label="Dirty rooms" value={m.dirtyRooms} note="Housekeeping attention" icon={BedDouble} />
        <StatTile label="Reserved rooms" value={m.reservedRooms} note="Future room commitments" icon={CalendarCheck} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Section title="Guests in house" subtitle="Active stays requiring attention" action={canFrontDesk ? <button onClick={() => navigate('/frontdesk')} className="text-[11px] font-extrabold text-[#8d693c]">Open front desk →</button> : undefined}>
          {stays.length === 0 ? <div className="p-6 text-center text-xs text-[#899397]">No guests are currently checked in.</div> : <div className="divide-y divide-[#edf0ed]">{stays.slice(0, 7).map(s => <div key={s.id} className="flex items-center gap-4 px-5 py-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf4f2] text-xs font-extrabold text-[#174b59]">{(s.guest?.firstName?.[0] || 'G') + (s.guest?.lastName?.[0] || '')}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-extrabold text-[#26363e]">{[s.guest?.firstName, s.guest?.lastName].filter(Boolean).join(' ') || 'Guest'}</div><div className="mt-1 text-[10px] text-[#8a9598]">Room {s.room?.number || '—'} · departure {s.checkOutDate ? new Date(s.checkOutDate).toLocaleDateString() : '—'}</div></div>{statusBadge(s.status || 'CHECKED_IN')}</div>)}</div>}
        </Section>
        <Section title="Department pulse" subtitle="Live revenue today">
          <div className="space-y-2 p-4"><Dept icon={UtensilsCrossed} label="Restaurant" value={m.restaurantRevenueToday} /><Dept icon={Wine} label="Bar" value={m.barRevenueToday} /><Dept icon={Waves} label="Pool" value={m.poolRevenueToday} /></div>
        </Section>
      </div>
      <Section title="Room attention" subtitle="Rooms currently marked dirty">
        {dirty.length === 0 ? <div className="p-6 text-center text-xs text-[#899397]">No rooms are waiting for housekeeping.</div> : <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">{dirty.slice(0, 8).map(r => <button key={r.id} onClick={() => navigate('/rooms')} disabled={!canRooms} className="rounded-2xl border border-[#e8ebe8] bg-[#fbfcfa] p-4 text-left hover:border-[#cfd8d3] disabled:cursor-default"><div className="text-lg font-extrabold text-[#20343e]">Room {r.number}</div><div className="mt-1 text-[10px] text-[#8a9598]">{r.roomType?.name || 'Room'}</div><div className="mt-3">{statusBadge(r.status)}</div></button>)}</div>}
      </Section>
    </ShellPage>
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
  const todayRevenue = kind === 'restaurant' ? m.restaurantRevenueToday : kind === 'bar' ? m.barRevenueToday : m.poolRevenueToday;

  const load = async (initial = false) => {
    try {
      initial ? setLoading(true) : setRefreshing(true);
      setError('');
      const [a, o] = await Promise.all([
        reportsApi.getDashboardMetrics(),
        kind === 'restaurant' ? posApi.getRestaurantOrders() : kind === 'bar' ? posApi.getBarOrders() : posApi.getPoolTransactions(),
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
  useEffect(() => { void load(true); }, []);
  const todayOrders = orders.filter((o) => String(o.createdAt || '').slice(0, 10) === new Date().toISOString().slice(0, 10));

  if (loading) return <LoadingState message={`Loading the ${deptLabel} dashboard…`} />;
  return (
    <ShellPage eyebrow={`NSVILLA · ${deptLabel.toUpperCase()} OPS`} title={`${greeting}. ${deptLabel} at a glance.`} subtitle="Your department's sales, orders and receipts — no room or guest data required." actions={<><Button variant="outline" size="sm" onClick={() => void load()} loading={refreshing}><RefreshCw size={14} /> Refresh</Button><Button size="sm" onClick={() => navigate(toPOS)}><ArrowRight size={14} /> Open {deptLabel} POS</Button></>}>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div>}
      <section className="relative overflow-hidden rounded-[24px] bg-[#163f4f] text-white shadow-[0_18px_50px_rgba(22,63,79,.18)]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#163f4f] via-[#163f4f]/95 to-[#163f4f]/45"/>
        <div className="relative grid min-h-[220px] lg:grid-cols-[1.2fr_.8fr]">
          <div className="relative p-7 sm:p-9"><div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#d9bd91]">Today's {deptLabel.toLowerCase()} sales</div><h2 className="mt-3 max-w-xl text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{formatCurrency(Number(todayRevenue || 0))}</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/70">Revenue recorded today across {deptLabel.toLowerCase()} orders and transactions.</p><div className="mt-6 flex flex-wrap gap-2"><Button size="sm" className="!bg-[#d2b27d] !text-[#173f52]" onClick={() => navigate(toPOS)}><ArrowRight size={14} /> Take an order</Button></div></div>
          <div className="grid grid-cols-2 border-l border-white/10 bg-white/5"><Hero label="Orders today" value={todayOrders.length} note="Posted at this workstation" /><Hero label="Items sold" value={todayOrders.reduce((s, o) => s + (o.orderItems?.length || 1), 0)} note="Across today's orders" /><Hero label="Sales today" value={formatCurrency(Number(todayRevenue || 0))} note="Department revenue" /><Hero label="Paid today" value={formatCurrency(Number(m.revenueToday || 0))} note="Recorded property payments" /></div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Orders today" value={todayOrders.length} note="Posted orders" icon={icon} accent />
        <StatTile label="Open folio balance" value={formatCurrency(m.outstandingBalanceTotal)} note="Outstanding across stays" icon={Users} />
        <StatTile label="All departments" value={formatCurrency(m.restaurantRevenueToday + m.barRevenueToday + m.poolRevenueToday)} note="Combined revenue today" icon={CreditCard} />
      </div>
      <Section title="Recent transactions" subtitle="Latest orders and receipts" action={<button onClick={() => navigate(toPOS)} className="text-[11px] font-extrabold text-[#8d693c]">New order →</button>}>
        {orders.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#899397]">No orders have been posted yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                <tr>
                  <th className="px-5 py-3">Order no.</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {orders.slice(0, 10).map((o) => (
                  <tr key={o.id} className="hover:bg-[#fbfcfa]">
                    <td className="px-5 py-3 font-mono text-[11px] font-extrabold text-[#26363e]">{o.orderNo || o.transactionNo}</td>
                    <td className="px-5 py-3 text-[11px] text-[#718086]">{o.paymentMethod}</td>
                    <td className="px-5 py-3">{statusBadge(o.paymentStatus || o.status || 'COMPLETED')}</td>
                    <td className="px-5 py-3 text-right text-[11px] font-extrabold text-[#26363e]">{formatCurrency(Number(o.totalAmount || 0))}</td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => printReceipt(o, kind)}><Printer size={13} /> Print</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title="Department pulse" subtitle="Live revenue across every outlet">
        <div className="space-y-2 p-4"><Dept icon={UtensilsCrossed} label="Restaurant" value={m.restaurantRevenueToday} /><Dept icon={Wine} label="Bar" value={m.barRevenueToday} /><Dept icon={Waves} label="Pool" value={m.poolRevenueToday} /></div>
      </Section>
    </ShellPage>
  );
};

export const Dashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const canRooms = useAuthStore((s) => s.hasPermission('rooms.view'));
  const roleName = user?.roles?.[0]?.name ?? '';

  // The consolidated F&B role has its own outlet workspace at /fnb.
  if (roleName === 'F&B' && !canRooms) {
    return <Navigate to="/fnb" replace />;
  }

  // Restaurant / Bar / Pool get a department-scoped dashboard. Everyone with
  // room management (Admin, Manager, Reception) sees the full property view.
  if (!canRooms) {
    const kind = roleName.toLowerCase() === 'restaurant' ? 'restaurant' : roleName.toLowerCase() === 'bar' ? 'bar' : roleName.toLowerCase() === 'pool' ? 'pool' : null;
    if (kind) return <DepartmentDashboard kind={kind} />;
  }
  return <PropertyDashboard />;
};

const Hero = ({ label, value, note }: { label: string; value: any; note: string }) => <div className="flex flex-col justify-center border-b border-r border-white/10 p-5 last:border-r-0"><div className="text-[9px] font-extrabold uppercase tracking-[.15em] text-white/50">{label}</div><div className="mt-2 text-2xl font-extrabold">{value}</div><div className="mt-1 text-[10px] text-white/50">{note}</div></div>;
const Dept = ({ icon: Icon, label, value }: { icon: any; label: string; value: any }) => <div className="flex items-center gap-3 rounded-2xl bg-[#fbfcfa] p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4ecdf] text-[#9b7648]"><Icon size={16} /></span><span className="flex-1 text-xs font-bold text-[#526168]">{label}</span><strong className="text-sm text-[#20343e]">{formatCurrency(Number(value || 0))}</strong></div>;
export default Dashboard;
