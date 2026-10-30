// ============================================
// NS LUXURY VILLA — Manager Portal Workstation
// Operational Control Center for Hotel Management
// ============================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, staysApi, roomsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, formatUserGreeting } from '@nslv/shared';
import { Button, statusBadge, LoadingState } from '../../components/ui';
import {
  Building2,
  TrendingUp,
  Clock,
  AlertCircle,
  CalendarDays,
  UtensilsCrossed,
  Wine,
  Waves,
  FileBarChart,
  ArrowRight,
  ShieldAlert,
  BedDouble,
  UserCheck,
  CheckCircle2,
  Sparkles,
  BadgeCheck,
  AlertTriangle,
} from 'lucide-react';
import { showToast } from '../../components/ui';

export const ManagerPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const greeting = formatUserGreeting(user);
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    occupancyRate: 0,
    occupiedRooms: 0,
    totalRooms: 0,
    todayArrivals: 0,
    todayDepartures: 0,
    todayRevenue: 0,
    openFoliosBalance: 0,
    dirtyRoomsCount: 0,
    restaurantSales: 0,
    barSales: 0,
    poolSales: 0,
  });

  const [activeStays, setActiveStays] = useState<any[]>([]);
  const [dirtyRooms, setDirtyRooms] = useState<any[]>([]);
  const [clearingDebts, setClearingDebts] = useState(false);
  const [clearResult, setClearResult] = useState<{ cleared: number; totalAmountCleared: number } | null>(null);

  const handleClearPostCheckoutDebts = async () => {
    if (!window.confirm(
      'This will mark all post-checkout outstanding balances as fully paid, charging only the original nights-stayed amount (no late fees or extra charges).\n\nThis action cannot be undone. Proceed?'
    )) return;
    try {
      setClearingDebts(true);
      const result = await staysApi.clearPostCheckoutDebts();
      setClearResult(result.data);
      showToast('success', `Cleared ${result.data.cleared} post-checkout balance(s) totalling GHS ${result.data.totalAmountCleared.toFixed(2)}.`);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to clear post-checkout debts');
    } finally {
      setClearingDebts(false);
    }
  };

  useEffect(() => {
    const fetchManagerData = async () => {
      try {
        setLoading(true);
        const [dashRes, staysRes, roomsRes, reportRes] = await Promise.allSettled([
          reportsApi.getDashboardMetrics(),
          staysApi.getActiveStays(),
          roomsApi.getRooms({ status: 'DIRTY' }),
          reportsApi.getComprehensiveReport(),
        ]);

        if (dashRes.status === 'fulfilled' && dashRes.value) {
          const d = dashRes.value;
          setMetrics((prev) => ({
            ...prev,
            occupancyRate: d.occupancyRate ?? 0,
            occupiedRooms: d.occupiedRooms ?? 0,
            totalRooms: d.totalRooms ?? 0,
            todayArrivals: d.checkInsToday ?? 0,
            todayDepartures: d.checkOutsToday ?? 0,
            todayRevenue: d.revenueToday ?? 0,
            openFoliosBalance: d.outstandingBalanceTotal ?? 0,
            dirtyRoomsCount: d.dirtyRooms ?? 0,
          }));
        }

        if (reportRes.status === 'fulfilled' && reportRes.value.data) {
          const r = reportRes.value.data;
          setMetrics((prev) => ({
            ...prev,
            restaurantSales: r.departmentRevenue?.restaurant ?? 0,
            barSales: r.departmentRevenue?.bar ?? 0,
            poolSales: r.departmentRevenue?.pool ?? 0,
          }));
        }

        if (staysRes.status === 'fulfilled' && staysRes.value.data) {
          setActiveStays(staysRes.value.data.slice(0, 6));
        }

        if (roomsRes.status === 'fulfilled' && roomsRes.value.data) {
          setDirtyRooms(roomsRes.value.data.slice(0, 5));
        }
      } catch (e) {
        console.error('Failed to load manager portal data', e);
      } finally {
        setLoading(false);
      }
    };

    fetchManagerData();
  }, []);

  return (
    <div className="workspace-page space-y-5 pb-16 animate-in fade-in duration-300">
      <header className="workspace-page__header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Building2 size={15} />
          </div>
          <div>
            <div className="workspace-page__eyebrow">Management overview</div>
            <h1 className="workspace-page__title text-xl">{greeting}</h1>
            <p className="workspace-page__subtitle text-[11px]">Property performance, service pressure, and cash position at a glance.</p>
          </div>
        </div>
        <div className="workspace-page__actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reports')}
            className="gap-1.5 border-[var(--ns-glass-line)] text-[var(--ns-ink)] ns-glass-hover"
          >
            <FileBarChart size={13} className="text-[var(--ns-gold)]" /> Full Reports
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/reservations')}
            className="gap-1.5 glass ns-glass-hover text-[var(--ns-ink)] shadow-sm font-semibold"
          >
            <CalendarDays size={13} /> Manage Bookings
          </Button>
        </div>
      </header>

      {/* ── KPI Ribbon ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-subtle clay-card rounded-3xl px-4 py-3 text-left border border-[var(--ns-glass-line)]">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Occupancy Rate</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{metrics.occupancyRate}%</div>
        </div>
        <div className="glass-subtle clay-card rounded-3xl px-4 py-3 text-left border border-[var(--ns-glass-line)]">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Total Revenue Today</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{formatCurrency(metrics.todayRevenue)}</div>
        </div>
        <div className="glass-subtle clay-card rounded-3xl px-4 py-3 text-left border border-[var(--ns-glass-line)]">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Arrivals & Departures</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{metrics.todayArrivals} in / {metrics.todayDepartures} out</div>
        </div>
        <div className="glass-subtle clay-card rounded-3xl px-4 py-3 text-left border border-[var(--ns-glass-line)]">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Unsettled Folios</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{formatCurrency(metrics.openFoliosBalance)}</div>
        </div>
      </div>

      {/* ── Departmental POS Sales Breakdown ── */}
      <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-[var(--ns-teal)]" />
            <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Departmental Revenue</h2>
          </div>
        </div>
        <div className="p-5 grid gap-4 sm:grid-cols-3">
          <div
            onClick={() => navigate('/restaurant/pos')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-glass-line)] glass p-5 shadow-sm hover:border-[var(--ns-gold)] hover:shadow-md transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] flex items-center gap-1.5">
                <UtensilsCrossed size={13} className="text-[var(--ns-warning)]" /> Restaurant Dining
              </span>
              <ArrowRight size={14} className="text-[var(--ns-muted)] group-hover:text-[var(--ns-gold)] transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--ns-ink)] font-mono">
              {formatCurrency(metrics.restaurantSales)}
            </div>
            <div className="text-[11px] text-[var(--ns-muted)]">Kitchen orders & room service</div>
          </div>

          <div
            onClick={() => navigate('/bar/pos')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-glass-line)] glass p-5 shadow-sm hover:border-[var(--ns-gold)] hover:shadow-md transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] flex items-center gap-1.5">
                <Wine size={13} className="text-[var(--ns-purple)]" /> Bar & Lounge
              </span>
              <ArrowRight size={14} className="text-[var(--ns-muted)] group-hover:text-[var(--ns-gold)] transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--ns-ink)] font-mono">
              {formatCurrency(metrics.barSales)}
            </div>
            <div className="text-[11px] text-[var(--ns-muted)]">Beverages, cocktails & wine</div>
          </div>

          <div
            onClick={() => navigate('/pool/services')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-glass-line)] glass p-5 shadow-sm hover:border-[var(--ns-gold)] hover:shadow-md transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] flex items-center gap-1.5">
                <Waves size={13} className="text-[var(--ns-teal)]" /> Pool Services
              </span>
              <ArrowRight size={14} className="text-[var(--ns-muted)] group-hover:text-[var(--ns-gold)] transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--ns-ink)] font-mono">
              {formatCurrency(metrics.poolSales)}
            </div>
            <div className="text-[11px] text-[var(--ns-muted)]">Day passes, towels & poolside drinks</div>
          </div>
        </div>
      </div>

      {/* ── Operational Grid: Active Guests & Housekeeping ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active In-House Guest Occupancy (2 cols) */}
        <div className="lg:col-span-2">
          <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-[var(--ns-teal)]" />
                <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>In-House Guest Stays</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/frontdesk')}
                className="gap-1 text-xs text-[var(--ns-gold)] font-bold"
              >
                Front Desk Log <ArrowRight size={12} />
              </Button>
            </div>
            {loading ? (
              <div className="p-10"><LoadingState /></div>
            ) : activeStays.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--ns-muted)]">
                No guests are currently checked in.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--ns-glass-line)] ns-glass-band text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                      <th className="py-3 px-5">Room</th>
                      <th className="py-3 px-5">Guest Name</th>
                      <th className="py-3 px-5">Stay Dates</th>
                      <th className="py-3 px-5 text-center">Status</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ns-glass-line)]">
                    {activeStays.map((stay) => (
                      <tr key={stay.id} className="ns-glass-hover transition-colors">
                        <td className="py-3 px-5 font-mono font-bold text-[var(--ns-ink)]">
                          Room {stay.room?.number || '—'}
                        </td>
                        <td className="py-3 px-5">
                          <div className="font-bold text-[var(--ns-ink)]">
                            {[stay.guest?.firstName, stay.guest?.lastName].filter(Boolean).join(' ') || 'In-House Guest'}
                          </div>
                          <div className="text-[10px] text-[var(--ns-muted)]">{stay.guest?.phone || 'No phone'}</div>
                        </td>
                        <td className="py-3 px-5 text-[var(--ns-muted)] text-[11px]">
                          {new Date(stay.checkInDate).toLocaleDateString('en-GH')} &minus; {new Date(stay.checkOutDate).toLocaleDateString('en-GH')}
                        </td>
                        <td className="py-3 px-5 text-center">
                          {statusBadge(stay.status || 'CHECKED_IN')}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/guest-bills')}
                            className="h-7 text-xs font-semibold border-[var(--ns-glass-line)] text-[var(--ns-ink)] ns-glass-hover"
                          >
                            Inspect Folio
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

        {/* Housekeeping & Property Maintenance (1 col) */}
        <div>
          <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[var(--ns-teal)]" />
                <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Operational Alerts</h2>
              </div>
              <span className="font-mono text-xs font-bold text-[var(--ns-warning)]">
                {dirtyRooms.length} Dirty
              </span>
            </div>
            <div className="p-4 space-y-3">
              {dirtyRooms.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--ns-success)] flex flex-col items-center gap-2">
                  <CheckCircle2 size={24} className="text-[var(--ns-success)]" />
                  <span>All villa rooms are cleaned and ready for guests.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {dirtyRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => navigate('/rooms')}
                      className="p-3 rounded-xl border border-[var(--ns-glass-line)] hover:border-[var(--ns-warning)] glass flex items-center justify-between cursor-pointer transition-all shadow-sm"
                    >
                      <div>
                        <div className="font-bold text-xs text-[var(--ns-ink)]">Room {room.number}</div>
                        <div className="text-[10px] text-[var(--ns-muted)]">{room.roomType?.name || 'Suite'}</div>
                      </div>
                      {statusBadge('DIRTY')}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-[var(--ns-glass-line)] space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold border-[var(--ns-glass-line)] text-[var(--ns-ink)] ns-glass-hover"
                  onClick={() => navigate('/rooms')}
                >
                  Inspect Rooms Board &rarr;
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold border-[var(--ns-glass-line)]"
                  onClick={() => navigate('/cash-register')}
                >
                  Inspect Front Desk Cash Drawer &rarr;
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Admin: Post-Checkout Debt Clearance ── */}
      <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-[var(--ns-teal)]" />
            <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Post-Checkout Debt Clearance</h2>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl border-2 border-[var(--ns-warning)] glass-subtle p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-[var(--ns-warning)] uppercase tracking-wide">
              <AlertTriangle size={15} className="shrink-0" />
              <span>Admin-Only Action — Irreversible</span>
            </div>
            <p className="text-[11px] text-[var(--ns-ink)] leading-relaxed">
              This will find every checked-out reservation with an open outstanding balance and mark it as fully settled,
              charging only the original <strong>reservation total</strong> (nights × room rate).
              Any late fees or extra checkout charges are voided. A payment record is created in the audit trail.
            </p>
          </div>

          {clearResult && (
            <div className="rounded-xl border border-[var(--ns-success)] glass-subtle p-4 flex items-center gap-3">
              <BadgeCheck size={20} className="text-[var(--ns-success)] shrink-0" />
              <div className="text-xs">
                <div className="font-black text-[var(--ns-success)]">Cleanup Complete</div>
                <div className="text-[var(--ns-ink)] mt-0.5">
                  {clearResult.cleared} reservation{clearResult.cleared !== 1 ? 's' : ''} cleared · Total settled: <strong>GHS {clearResult.totalAmountCleared.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearPostCheckoutDebts}
            loading={clearingDebts}
            disabled={clearingDebts}
            className="gap-2 border-[var(--ns-warning)] text-[var(--ns-warning)] font-bold"
          >
            <BadgeCheck size={14} />
            Clear All Post-Checkout Outstanding Balances
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ManagerPortalPage;
