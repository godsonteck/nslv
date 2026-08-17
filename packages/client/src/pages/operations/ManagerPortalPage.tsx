// ============================================
// NS LUXURY VILLA — Manager Portal Workstation
// /manager — Operational Control Center for Hotel Management
// ============================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, staysApi, roomsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, formatUserGreeting } from '@nslv/shared';
import {
  PageHeader,
  MetricCard,
  DataTable,
  statusBadge,
  Button,
} from '../../components/ui';
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
          setActiveStays(staysRes.value.data.slice(0, 5));
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

  const activeStaysColumns = [
    {
      key: 'room',
      header: 'Room',
      render: (stay: any) => (
        <span className="font-mono font-bold text-[#1B4965]">
          Room {stay.room?.number || '—'}
        </span>
      ),
    },
    {
      key: 'guest',
      header: 'Guest Name',
      render: (stay: any) => (
        <div>
          <div className="font-bold text-[#1A202C]">
            {[stay.guest?.firstName, stay.guest?.lastName].filter(Boolean).join(' ') || 'In-House Guest'}
          </div>
          <div className="text-[11px] text-slate-500">{stay.guest?.phone || 'No Phone'}</div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Stay Period',
      render: (stay: any) => (
        <div className="text-xs text-slate-600 font-medium">
          {new Date(stay.checkInDate).toLocaleDateString()} — {new Date(stay.checkOutDate).toLocaleDateString()}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center' as const,
      render: (stay: any) => statusBadge(stay.status || 'CHECKED_IN'),
    },
    {
      key: 'action',
      header: '',
      align: 'right' as const,
      render: () => (
        <Button variant="outline" size="sm" onClick={() => navigate('/frontdesk')}>
          Inspect Folio <ArrowRight size={13} />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 select-none pb-8">
      <PageHeader
        title={greeting}
        subtitle="Real-time occupancy oversight, departmental revenue breakdown, and operational audit"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/reports')}>
              <FileBarChart size={14} /> Full Executive Reports
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/reservations')}>
              <CalendarDays size={14} /> Manage Bookings
            </Button>
          </div>
        }
      />

      {/* Top Key Performance Indicators Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Occupancy Rate"
          value={`${metrics.occupancyRate}%`}
          subtext={`${metrics.occupiedRooms} of ${metrics.totalRooms} rooms occupied`}
          indicator={<Building2 size={18} />}
          accent
        />
        <MetricCard
          label="Total Revenue Today"
          value={formatCurrency(metrics.todayRevenue)}
          subtext="Accommodations & Department POS"
          indicator={<TrendingUp size={18} />}
        />
        <MetricCard
          label="Today's Arrivals"
          value={metrics.todayArrivals}
          subtext={`${metrics.todayDepartures} Scheduled Departures`}
          indicator={<Clock size={18} />}
        />
        <MetricCard
          label="Unsettled Folios Balance"
          value={formatCurrency(metrics.openFoliosBalance)}
          subtext="Outstanding guest room balances"
          indicator={<AlertCircle size={18} />}
        />
      </div>

      {/* Departmental Sales Overview */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-[#1A202C] font-['Outfit'] flex items-center gap-2">
          <TrendingUp size={18} className="text-[#1B4965]" /> Departmental Sales Breakdown
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => navigate('/restaurant/pos')}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-500 cursor-pointer transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <UtensilsCrossed size={14} className="text-amber-600" /> Restaurant Sales
              </div>
              <div className="text-xl font-bold font-mono text-[#1A202C] mt-1">
                {formatCurrency(metrics.restaurantSales)}
              </div>
            </div>
            <ArrowRight size={16} className="text-slate-400" />
          </div>

          <div
            onClick={() => navigate('/bar/pos')}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-purple-500 cursor-pointer transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Wine size={14} className="text-purple-600" /> Bar & Lounge Sales
              </div>
              <div className="text-xl font-bold font-mono text-[#1A202C] mt-1">
                {formatCurrency(metrics.barSales)}
              </div>
            </div>
            <ArrowRight size={16} className="text-slate-400" />
          </div>

          <div
            onClick={() => navigate('/pool/services')}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-teal-500 cursor-pointer transition-all flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Waves size={14} className="text-teal-600" /> Pool Services Sales
              </div>
              <div className="text-xl font-bold font-mono text-[#1A202C] mt-1">
                {formatCurrency(metrics.poolSales)}
              </div>
            </div>
            <ArrowRight size={16} className="text-slate-400" />
          </div>
        </div>
      </div>

      {/* Operational Control Tables & Housekeeping Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Guest Stays (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1A202C] font-['Outfit']">
              Active In-House Guest Occupancy
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/frontdesk')}>
              View Front Desk Log →
            </Button>
          </div>

          <DataTable
            columns={activeStaysColumns}
            data={activeStays}
            loading={loading}
            keyFn={(s) => s.id}
            emptyTitle="No guests currently checked in"
            emptySubtitle="Active guest stays will appear in this manager oversight table."
          />
        </div>

        {/* Manager Operational Alerts (1 col) */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-[#1A202C] font-['Outfit']">
            Operational Alerts
          </h3>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={15} /> Housekeeping & Maintenance
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">{dirtyRooms.length} Dirty</span>
            </div>

            {dirtyRooms.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">All property rooms are clean & ready.</p>
            ) : (
              <div className="space-y-2">
                {dirtyRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => navigate('/rooms')}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-amber-400 flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#1A202C]">Room {room.number}</div>
                      <div className="text-[11px] text-slate-500">{room.roomType?.name || 'Standard'}</div>
                    </div>
                    {statusBadge('DIRTY')}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 space-y-2">
              <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate('/rooms')}>
                Inspect Rooms Board →
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/payments')}>
                Inspect Audit Transactions →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerPortalPage;
