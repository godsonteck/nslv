// ============================================
// NS LUXURY VILLA — Master Dashboard Page
// Section #15 requirement: Dynamic role-aware dashboard
// ============================================

import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '@nslv/shared';
import {
  BedDouble,
  CalendarCheck,
  CreditCard,
  Utensils,
  Wine,
  Waves,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const userName = user ? `${user.firstName} ${user.lastName}` : 'Staff';
  const roleName = user?.roles?.[0]?.name || 'Staff';

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1C2536] via-[#151C28] to-[#1C2536] border border-[#2D3748] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#E2B768] uppercase tracking-wider mb-1">
            <ShieldCheck size={14} /> Logged in as {roleName}
          </div>
          <h1 className="text-2xl font-bold text-[#F3F4F6] font-['Outfit']">
            Welcome back, {userName}
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            NS Luxury Villa Management Workspace · Ho, Ghana
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-[#8C2D19]/20 border border-[#8C2D19]/40 rounded-xl text-center">
            <div className="text-[11px] text-[#9CA3AF]">Occupancy Rate</div>
            <div className="text-lg font-bold text-[#F3F4F6] font-mono">78%</div>
          </div>
          <div className="px-4 py-2 bg-[#C49A45]/20 border border-[#C49A45]/40 rounded-xl text-center">
            <div className="text-[11px] text-[#9CA3AF]">Today's Revenue</div>
            <div className="text-lg font-bold text-[#E2B768] font-mono">
              {formatCurrency(2450)}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Rooms */}
        <div className="bg-[#1C2536] border border-[#2D3748] rounded-xl p-5 hover:border-[#C49A45]/50 transition-all">
          <div className="flex items-center justify-between text-[#9CA3AF]">
            <span className="text-xs font-medium">Available Rooms</span>
            <div className="p-2 bg-[#10B981]/10 text-[#10B981] rounded-lg">
              <BedDouble size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F3F4F6] font-mono">5</span>
            <span className="text-xs text-[#9CA3AF]">of 12 total</span>
          </div>
          <div className="mt-3 text-xs text-[#10B981] flex items-center gap-1">
            <CheckCircle2 size={12} /> 3 ready for check-in
          </div>
        </div>

        {/* Today's Arrivals */}
        <div className="bg-[#1C2536] border border-[#2D3748] rounded-xl p-5 hover:border-[#C49A45]/50 transition-all">
          <div className="flex items-center justify-between text-[#9CA3AF]">
            <span className="text-xs font-medium">Today's Arrivals</span>
            <div className="p-2 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg">
              <CalendarCheck size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F3F4F6] font-mono">4</span>
            <span className="text-xs text-[#9CA3AF]">guests</span>
          </div>
          <div className="mt-3 text-xs text-[#3B82F6] flex items-center gap-1">
            <Clock size={12} /> Next arrival at 2:00 PM
          </div>
        </div>

        {/* Restaurant & Bar Sales */}
        {hasPermission('restaurant.view') && (
          <div className="bg-[#1C2536] border border-[#2D3748] rounded-xl p-5 hover:border-[#C49A45]/50 transition-all">
            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="text-xs font-medium">F&B Sales Today</span>
              <div className="p-2 bg-[#C49A45]/10 text-[#C49A45] rounded-lg">
                <Utensils size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#F3F4F6] font-mono">
                {formatCurrency(850)}
              </span>
            </div>
            <div className="mt-3 text-xs text-[#E2B768] flex items-center gap-1">
              <TrendingUp size={12} /> +15% vs yesterday
            </div>
          </div>
        )}

        {/* Pool Entries */}
        {hasPermission('pool.view') && (
          <div className="bg-[#1C2536] border border-[#2D3748] rounded-xl p-5 hover:border-[#C49A45]/50 transition-all">
            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="text-xs font-medium">Pool Entries</span>
              <div className="p-2 bg-[#2C5E43]/20 text-[#2C5E43] rounded-lg">
                <Waves size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#F3F4F6] font-mono">14</span>
              <span className="text-xs text-[#9CA3AF]">visitors</span>
            </div>
            <div className="mt-3 text-xs text-[#9CA3AF] flex items-center gap-1">
              <CheckCircle2 size={12} /> Capacity: 14/30
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Operational Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Operations Table */}
        <div className="lg:col-span-2 bg-[#1C2536] border border-[#2D3748] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2D3748]">
            <h2 className="text-sm font-bold text-[#F3F4F6] uppercase tracking-wider font-['Outfit']">
              Today's Guest Schedule
            </h2>
            <span className="text-xs text-[#C49A45] font-medium">4 Scheduled</span>
          </div>

          <div className="space-y-3">
            {[
              {
                guest: 'Kwame Mensah',
                room: 'Room 201 (Ensuite)',
                type: 'Arrival',
                time: '2:00 PM',
                status: 'Confirmed',
                balance: 'GHS 450.00',
              },
              {
                guest: 'Sarah Jenkins',
                room: 'Room 104 (Apartment)',
                type: 'Departure',
                time: '11:00 AM',
                status: 'Pending Checkout',
                balance: 'GHS 120.00',
              },
              {
                guest: 'Kofi Annan Jr.',
                room: 'Room 203 (Ensuite)',
                type: 'Stayover',
                time: 'All Day',
                status: 'Occupied',
                balance: 'GHS 0.00',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 bg-[#151C28] border border-[#2D3748] rounded-xl text-xs hover:border-[#C49A45]/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#8C2D19]/30 text-[#E2B768] font-bold flex items-center justify-center text-xs">
                    {item.guest.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-[#F3F4F6]">{item.guest}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{item.room}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-[#F3F4F6]">{item.balance}</div>
                  <div className="text-[11px] text-[#C49A45]">{item.type} · {item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Activity & Alerts */}
        <div className="bg-[#1C2536] border border-[#2D3748] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2D3748]">
            <h2 className="text-sm font-bold text-[#F3F4F6] uppercase tracking-wider font-['Outfit']">
              Live Activity Stream
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                text: 'Room 204 charged GHS 85.00 for Fried Rice at Restaurant',
                time: '10 mins ago',
                icon: <Utensils size={14} className="text-[#C49A45]" />,
              },
              {
                text: 'New Reservation confirmed for Room 102 (12-15 Aug)',
                time: '25 mins ago',
                icon: <CalendarCheck size={14} className="text-[#10B981]" />,
              },
              {
                text: 'Room 105 status changed to DIRTY by Housekeeping',
                time: '45 mins ago',
                icon: <AlertCircle size={14} className="text-[#F59E0B]" />,
              },
            ].map((act, idx) => (
              <div key={idx} className="flex gap-3 text-xs">
                <div className="mt-0.5 p-1.5 bg-[#151C28] border border-[#2D3748] rounded-lg h-fit">
                  {act.icon}
                </div>
                <div>
                  <p className="text-[#F3F4F6] leading-relaxed">{act.text}</p>
                  <span className="text-[10px] text-[#9CA3AF] mt-0.5 block">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
