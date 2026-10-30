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
    <div className="space-y-5 pb-16 animate-in fade-in duration-300">
      {/* ── Compact Header ── */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Wine size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>{greeting}</h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Bar & Lounge · Beverage Service Workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" loading={refreshing} onClick={() => load(false)}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/bar/pos')}
            className="glass ns-glass-hover text-[var(--ns-ink)] font-bold"
          >
            <Wine size={14} /> Open Bar POS <ArrowRight size={14} />
          </Button>
        </div>
      </div>

      {/* ── KPI Ribbon ── */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Bar Sales Today</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{formatCurrency(revenue)}</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Bar Orders Today</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{orders.filter(o => {
            const d = new Date(o.createdAt);
            const today = new Date();
            return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
          }).length} Orders</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Open Bar Orders</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{orders.filter(o => !['COMPLETED', 'SERVED', 'CANCELLED'].includes(o.status)).length} Active</div>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading bar workspace..." />
      ) : (
        <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
            <div className="flex items-center gap-2">
              <Wine size={14} className="text-[var(--ns-teal)]" />
              <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Recent Bar Orders</h2>
            </div>
          </div>
          {orders.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--ns-muted)]">
              <Wine size={32} className="mx-auto mb-2 opacity-30 text-[var(--ns-purple)]" />
              No bar orders recorded yet today.
            </div>
          ) : (
            <div className="divide-y divide-[var(--ns-glass-line)]">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-5 py-3.5 ns-glass-hover transition-colors text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[var(--ns-ink)]">
                        #{order.orderNumber || order.id?.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-[var(--ns-muted)]">{order.tableNumber ? `Seat ${order.tableNumber}` : 'Bar Counter'}</span>
                      {statusBadge(order.status)}
                    </div>
                    <div className="text-[11px] text-[var(--ns-muted)]">
                      {new Date(order.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      {order.items?.length ? ` · ${order.items.length} item${order.items.length !== 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-[var(--ns-purple)]">{formatCurrency(Number(order.totalAmount || 0))}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] text-[var(--ns-purple)] mt-1"
                      onClick={() => navigate('/bar/pos')}
                    >
                      View in POS <ArrowRight size={11} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="p-4 border-t border-[var(--ns-glass-line)]">
            <Button
              variant="primary"
              className="w-full glass ns-glass-hover text-[var(--ns-ink)] font-bold"
              onClick={() => navigate('/bar/pos')}
            >
              <Wine size={15} /> Open Full Bar POS <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarPortalPage;
