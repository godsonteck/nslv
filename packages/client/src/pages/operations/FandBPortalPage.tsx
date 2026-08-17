import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { posApi, reportsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, formatUserGreeting } from '@nslv/shared';
import { UtensilsCrossed, Wine, Waves, RefreshCw, ArrowRight, ClipboardCheck } from 'lucide-react';
import { Button, showToast, LoadingState } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
import { statusBadge } from '../../components/ui';

type OutletKind = 'restaurant' | 'bar' | 'pool';

const OUTLETS: { kind: OutletKind; label: string; to: string; icon: typeof UtensilsCrossed; tone: string }[] = [
  { kind: 'restaurant', label: 'Restaurant', to: '/restaurant/pos', icon: UtensilsCrossed, tone: 'bg-[#fdf0e3] text-[#b07b3a]' },
  { kind: 'bar', label: 'Bar & lounge', to: '/bar/pos', icon: Wine, tone: 'bg-[#f1ecfb] text-[#7b5bb5]' },
  { kind: 'pool', label: 'Pool services', to: '/pool/services', icon: Waves, tone: 'bg-[#e9f4f5] text-[#2e7f8c]' },
];

export const FandBPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const greeting = formatUserGreeting(user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revenue, setRevenue] = useState({ restaurant: 0, bar: 0, pool: 0, revenueToday: 0 });
  const [orders, setOrders] = useState<any[]>([]);

  const load = async (initial = false) => {
    try {
      initial ? setLoading(true) : setRefreshing(true);
      const [dash, rOrders, bOrders, poolTx] = await Promise.allSettled([
        reportsApi.getDashboardMetrics(),
        posApi.getRestaurantOrders(),
        posApi.getBarOrders(),
        posApi.getPoolTransactions(),
      ]);
      if (dash.status === 'fulfilled' && dash.value) {
        const d = dash.value;
        setRevenue({
          restaurant: Number(d.restaurantRevenueToday || 0),
          bar: Number(d.barRevenueToday || 0),
          pool: Number(d.poolRevenueToday || 0),
          revenueToday: Number(d.revenueToday || 0),
        });
      }
      const combined: any[] = [];
      if (rOrders.status === 'fulfilled') combined.push(...(rOrders.value.data || []).map((o: any) => ({ ...o, _kind: 'restaurant' as OutletKind })));
      if (bOrders.status === 'fulfilled') combined.push(...(bOrders.value.data || []).map((o: any) => ({ ...o, _kind: 'bar' as OutletKind })));
      if (poolTx.status === 'fulfilled') combined.push(...(poolTx.value.data || []).map((o: any) => ({ ...o, _kind: 'pool' as OutletKind })));
      combined.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setOrders(combined.slice(0, 12));
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load the F&B workspace.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(true); }, []);

  const combinedRevenue = revenue.restaurant + revenue.bar + revenue.pool;

  return (
    <ShellPage
      eyebrow="F&B · FOOD, BEVERAGE & POOL"
      title={greeting}
      subtitle="Restaurant, bar and pool services from a single point of sale — orders, charges and receipts together."
      actions={<Button variant="outline" size="sm" onClick={() => void load()} loading={refreshing}><RefreshCw size={14} /> Refresh</Button>}
    >
      {loading ? <LoadingState message="Loading the F&B workspace…" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Sales today" value={formatCurrency(combinedRevenue)} note="Across all outlets" icon={Wine} accent />
            <StatTile label="Recent activity" value={orders.length} note="Latest orders & transactions" icon={ClipboardCheck} />
            <StatTile label="Property revenue" value={formatCurrency(revenue.revenueToday)} note="Recorded today" icon={Waves} />
          </div>

          <Section title="Your outlets" subtitle="Open a live workstation or record pool attendance">
            <div className="grid gap-4 p-4 sm:grid-cols-3">
              {OUTLETS.map(({ kind, label, to, icon: Icon, tone }) => (
                <button key={kind} onClick={() => navigate(to)} className="group rounded-2xl border border-[#e8ebe8] bg-[#fbfcfa] p-5 text-left transition hover:border-[#cfd8d3] hover:shadow-sm">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}><Icon size={19} /></span>
                  <div className="mt-4 text-sm font-extrabold text-[#26363e]">{label}</div>
                  <div className="mt-1 text-[10px] text-[#8a9598]">{kind === 'pool' ? 'Attendance & services' : 'Take orders and post receipts'}</div>
                  <div className="mt-4 flex items-center gap-1 text-[11px] font-extrabold text-[#8d693c]">Open <ArrowRight size={12} className="transition group-hover:translate-x-0.5" /></div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Recent activity" subtitle="Latest receipts across the outlets">
            {orders.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#899397]">No orders or transactions have been posted yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                    <tr>
                      <th className="px-5 py-3">Outlet</th>
                      <th className="px-5 py-3">No.</th>
                      <th className="px-5 py-3">Payment</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0ed]">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-[#fbfcfa]">
                        <td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#26363e]">{OUTLETS.find((x) => x.kind === o._kind)?.label || '—'}</span></td>
                        <td className="px-5 py-3 font-mono text-[11px] font-extrabold text-[#26363e]">{o.orderNo || o.transactionNo || '—'}</td>
                        <td className="px-5 py-3 text-[11px] text-[#718086]">{o.paymentMethod || '—'}</td>
                        <td className="px-5 py-3">{statusBadge(o.paymentStatus || o.status || 'COMPLETED')}</td>
                        <td className="px-5 py-3 text-right text-[11px] font-extrabold text-[#26363e]">{formatCurrency(Number(o.totalAmount || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </ShellPage>
  );
};

export default FandBPortalPage;