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
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
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
} from 'lucide-react';

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
    <ShellPage
      eyebrow="Management"
      title={greeting}
      subtitle="Real-time occupancy oversight, departmental POS revenue, and operational audit."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reports')}
            className="gap-1.5 border-[var(--ns-line)] text-[var(--ns-ink)] hover:bg-[var(--ns-surface-2)]"
          >
            <FileBarChart size={13} className="text-[#c59a58]" /> Full Reports
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/reservations')}
            className="gap-1.5 bg-[#c59a58] hover:bg-[#b88738] text-white shadow-sm font-semibold"
          >
            <CalendarDays size={13} /> Manage Bookings
          </Button>
        </div>
      }
    >
      {/* ── Key Performance Metrics ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Occupancy Rate"
          value={`${metrics.occupancyRate}%`}
          note={`${metrics.occupiedRooms} of ${metrics.totalRooms} rooms occupied`}
          icon={Building2}
          accent
        />
        <StatTile
          label="Total Revenue Today"
          value={formatCurrency(metrics.todayRevenue)}
          note="Accommodations + Department POS"
          icon={TrendingUp}
        />
        <StatTile
          label="Arrivals & Departures"
          value={`${metrics.todayArrivals} in / ${metrics.todayDepartures} out`}
          note="Today's guest turnover"
          icon={Clock}
        />
        <StatTile
          label="Unsettled Folios"
          value={formatCurrency(metrics.openFoliosBalance)}
          note="Outstanding in-house guest balances"
          icon={AlertCircle}
        />
      </div>

      {/* ── Departmental POS Sales Breakdown ── */}
      <Section
        title="Departmental Revenue"
        subtitle="Live sales recorded across the property's dining, bar, and recreation outlets today."
      >
        <div className="p-5 grid gap-4 sm:grid-cols-3">
          <div
            onClick={() => navigate('/restaurant/pos')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-5 shadow-sm hover:border-[#c59a58]/40 hover:shadow-md transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] flex items-center gap-1.5">
                <UtensilsCrossed size={13} className="text-amber-600" /> Restaurant Dining
              </span>
              <ArrowRight size={14} className="text-[var(--ns-muted)] group-hover:text-[#c59a58] transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--ns-ink)] font-mono">
              {formatCurrency(metrics.restaurantSales)}
            </div>
            <div className="text-[11px] text-[var(--ns-muted)]">Kitchen orders & room service</div>
          </div>

          <div
            onClick={() => navigate('/bar/pos')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-5 shadow-sm hover:border-[#c59a58]/40 hover:shadow-md transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] flex items-center gap-1.5">
                <Wine size={13} className="text-purple-600" /> Bar & Lounge
              </span>
              <ArrowRight size={14} className="text-[var(--ns-muted)] group-hover:text-[#c59a58] transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--ns-ink)] font-mono">
              {formatCurrency(metrics.barSales)}
            </div>
            <div className="text-[11px] text-[var(--ns-muted)]">Beverages, cocktails & wine</div>
          </div>

          <div
            onClick={() => navigate('/pool/services')}
            className="group cursor-pointer rounded-2xl border border-[var(--ns-line)] bg-[var(--ns-surface)] p-5 shadow-sm hover:border-[#c59a58]/40 hover:shadow-md transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)] flex items-center gap-1.5">
                <Waves size={13} className="text-teal-600" /> Pool Services
              </span>
              <ArrowRight size={14} className="text-[var(--ns-muted)] group-hover:text-[#c59a58] transition-colors" />
            </div>
            <div className="text-2xl font-black text-[var(--ns-ink)] font-mono">
              {formatCurrency(metrics.poolSales)}
            </div>
            <div className="text-[11px] text-[var(--ns-muted)]">Day passes, towels & poolside drinks</div>
          </div>
        </div>
      </Section>

      {/* ── Operational Grid: Active Guests & Housekeeping ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active In-House Guest Occupancy (2 cols) */}
        <div className="lg:col-span-2">
          <Section
            title="In-House Guest Stays"
            subtitle="Currently checked-in guests and assigned room suites."
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/frontdesk')}
                className="gap-1 text-xs text-[#b88738] font-bold"
              >
                Front Desk Log <ArrowRight size={12} />
              </Button>
            }
          >
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
                    <tr className="border-b border-[var(--ns-line)] bg-[var(--ns-surface-2)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                      <th className="py-3 px-5">Room</th>
                      <th className="py-3 px-5">Guest Name</th>
                      <th className="py-3 px-5">Stay Dates</th>
                      <th className="py-3 px-5 text-center">Status</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ns-line)]">
                    {activeStays.map((stay) => (
                      <tr key={stay.id} className="hover:bg-[var(--ns-surface-2)] transition-colors">
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
                            className="h-7 text-xs font-semibold border-[var(--ns-line)] text-[var(--ns-ink)] hover:bg-[var(--ns-surface-2)]"
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
          </Section>
        </div>

        {/* Housekeeping & Property Maintenance (1 col) */}
        <div>
          <Section
            title="Operational Alerts"
            subtitle="Housekeeping room status and pending room turns."
            action={
              <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                {dirtyRooms.length} Dirty
              </span>
            }
          >
            <div className="p-4 space-y-3">
              {dirtyRooms.length === 0 ? (
                <div className="py-8 text-center text-xs text-emerald-700 dark:text-emerald-300 flex flex-col items-center gap-2">
                  <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
                  <span>All villa rooms are cleaned and ready for guests.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {dirtyRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => navigate('/rooms')}
                      className="p-3 rounded-xl border border-[var(--ns-line)] hover:border-amber-400 bg-[var(--ns-surface)] flex items-center justify-between cursor-pointer transition-all shadow-sm"
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

              <div className="pt-2 border-t border-[var(--ns-line)] space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold border-[var(--ns-line)] text-[var(--ns-ink)] hover:bg-[var(--ns-surface-2)]"
                  onClick={() => navigate('/rooms')}
                >
                  Inspect Rooms Board &rarr;
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold border-[#e5ebeb]"
                  onClick={() => navigate('/cash-register')}
                >
                  Inspect Front Desk Cash Drawer &rarr;
                </Button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </ShellPage>
  );
};

export default ManagerPortalPage;
