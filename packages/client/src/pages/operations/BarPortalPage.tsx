// ============================================
// NS LUXURY VILLA — Bar & Lounge Workspace Portal
// Dedicated landing page for Bar-role staff
// ============================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { posApi, reportsApi } from '../../services/apiService';
import { clearGetCache } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, formatUserGreeting } from '@nslv/shared';
import { Wine, RefreshCw, ArrowRight, ClipboardCheck, TrendingUp, ShoppingBag } from 'lucide-react';
import { Button, showToast, LoadingState } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
import { statusBadge } from '../../components/ui';

export const BarPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const greeting = formatUserGreeting(user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revenue, setRevenue] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);

  const load = async (initial = false) => {
    try {
      initial ? setLoading(true) : setRefreshing(true);
      if (!initial) clearGetCache();
      const [dash, bOrders] = await Promise.allSettled([
        reportsApi.getDashboardMetrics(),
        posApi.getBarOrders(),
      ]);
      if (dash.status === 'fulfilled' && dash.value) {
        setRevenue(Number(dash.value.barRevenueToday || 0));
      }
      if (bOrders.status === 'fulfilled') {
        const sorted = [...(bOrders.value.data || [])].sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );
        setOrders(sorted.slice(0, 12));
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load bar workspace.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(true); }, []);

  return (
    <ShellPage
      eyebrow="BAR & LOUNGE · BEVERAGE SERVICE WORKSPACE"
      title={greeting}
      subtitle="Your bar dashboard — manage drink orders, track today's bar service, and open the POS."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" loading={refreshing} onClick={() => load(false)}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/bar/pos')}
            className="bg-[#7b5bb5] hover:bg-[#6a4da0] text-white font-bold"
          >
            <Wine size={14} /> Open Bar POS <ArrowRight size={14} />
          </Button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Bar Sales Today"
          value={formatCurrency(revenue)}
          note="Completed & served orders"
          icon={TrendingUp}
          accent
        />
        <StatTile
          label="Bar Orders Today"
          value={`${orders.filter(o => {
            const d = new Date(o.createdAt);
            const today = new Date();
            return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
          }).length} Orders`}
          note="From bar POS"
          icon={ClipboardCheck}
        />
        <StatTile
          label="Open Bar Orders"
          value={`${orders.filter(o => !['COMPLETED', 'SERVED', 'CANCELLED'].includes(o.status)).length} Active`}
          note="Pending / in progress"
          icon={ShoppingBag}
          accent
        />
      </div>

      {loading ? (
        <LoadingState message="Loading bar workspace..." />
      ) : (
        <Section
          title="Recent Bar Orders"
          subtitle="Live order feed — latest drink orders from your bar and lounge."
        >
          {orders.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#6E737B]">
              <Wine size={32} className="mx-auto mb-2 opacity-30 text-[#7b5bb5]" />
              No bar orders recorded yet today.
            </div>
          ) : (
            <div className="divide-y divide-[#2B303E]/50">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-[#14161D]/60 transition-colors text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#F4F4F2]">
                        #{order.orderNumber || order.id?.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-[#A0A5AD]">{order.tableNumber ? `Seat ${order.tableNumber}` : 'Bar Counter'}</span>
                      {statusBadge(order.status)}
                    </div>
                    <div className="text-[11px] text-[#6E737B]">
                      {new Date(order.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      {order.items?.length ? ` · ${order.items.length} item${order.items.length !== 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-[#7b5bb5]">{formatCurrency(Number(order.totalAmount || 0))}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] text-[#7b5bb5] mt-1"
                      onClick={() => navigate('/bar/pos')}
                    >
                      View in POS <ArrowRight size={11} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="p-4 border-t border-[#2B303E]">
            <Button
              variant="primary"
              className="w-full bg-[#7b5bb5] hover:bg-[#6a4da0] text-white font-bold"
              onClick={() => navigate('/bar/pos')}
            >
              <Wine size={15} /> Open Full Bar POS <ArrowRight size={14} />
            </Button>
          </div>
        </Section>
      )}
    </ShellPage>
  );
};

export default BarPortalPage;
