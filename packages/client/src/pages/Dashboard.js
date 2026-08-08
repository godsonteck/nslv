import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '@nslv/shared';
import { BedDouble, CalendarCheck, Utensils, Waves, TrendingUp, ShieldCheck, CheckCircle2, AlertCircle, Clock, } from 'lucide-react';
export const Dashboard = () => {
    const { user, hasPermission } = useAuthStore();
    const userName = user ? `${user.firstName} ${user.lastName}` : 'Staff';
    const roleName = user?.roles?.[0]?.name || 'Staff';
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gradient-to-r from-[#1C2536] via-[#151C28] to-[#1C2536] border border-[#2D3748] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-semibold text-[#E2B768] uppercase tracking-wider mb-1", children: [_jsx(ShieldCheck, { size: 14 }), " Logged in as ", roleName] }), _jsxs("h1", { className: "text-2xl font-bold text-[#F3F4F6] font-['Outfit']", children: ["Welcome back, ", userName] }), _jsx("p", { className: "text-xs text-[#9CA3AF] mt-0.5", children: "NS Luxury Villa Management Workspace \u00B7 Ho, Ghana" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "px-4 py-2 bg-[#8C2D19]/20 border border-[#8C2D19]/40 rounded-xl text-center", children: [_jsx("div", { className: "text-[11px] text-[#9CA3AF]", children: "Occupancy Rate" }), _jsx("div", { className: "text-lg font-bold text-[#F3F4F6] font-mono", children: "78%" })] }), _jsxs("div", { className: "px-4 py-2 bg-[#C49A45]/20 border border-[#C49A45]/40 rounded-xl text-center", children: [_jsx("div", { className: "text-[11px] text-[#9CA3AF]", children: "Today's Revenue" }), _jsx("div", { className: "text-lg font-bold text-[#E2B768] font-mono", children: formatCurrency(2450) })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-[#1C2536] border border-[#2D3748] rounded-xl p-5 hover:border-[#C49A45]/50 transition-all", children: [_jsxs("div", { className: "flex items-center justify-between text-[#9CA3AF]", children: [_jsx("span", { className: "text-xs font-medium", children: "Available Rooms" }), _jsx("div", { className: "p-2 bg-[#10B981]/10 text-[#10B981] rounded-lg", children: _jsx(BedDouble, { size: 18 }) })] }), _jsxs("div", { className: "mt-3 flex items-baseline gap-2", children: [_jsx("span", { className: "text-2xl font-bold text-[#F3F4F6] font-mono", children: "5" }), _jsx("span", { className: "text-xs text-[#9CA3AF]", children: "of 12 total" })] }), _jsxs("div", { className: "mt-3 text-xs text-[#10B981] flex items-center gap-1", children: [_jsx(CheckCircle2, { size: 12 }), " 3 ready for check-in"] })] }), _jsxs("div", { className: "bg-[#1C2536] border border-[#2D3748] rounded-xl p-5 hover:border-[#C49A45]/50 transition-all", children: [_jsxs("div", { className: "flex items-center justify-between text-[#9CA3AF]", children: [_jsx("span", { className: "text-xs font-medium", children: "Today's Arrivals" }), _jsx("div", { className: "p-2 bg-[#3B82F6]/10 text-[#3B82F6] rounded-lg", children: _jsx(CalendarCheck, { size: 18 }) })] }), _jsxs("div", { className: "mt-3 flex items-baseline gap-2", children: [_jsx("span", { className: "text-2xl font-bold text-[#F3F4F6] font-mono", children: "4" }), _jsx("span", { className: "text-xs text-[#9CA3AF]", children: "guests" })] }), _jsxs("div", { className: "mt-3 text-xs text-[#3B82F6] flex items-center gap-1", children: [_jsx(Clock, { size: 12 }), " Next arrival at 2:00 PM"] })] }), hasPermission('restaurant.view') && (_jsxs("div", { className: "bg-[#1C2536] border border-[#2D3748] rounded-xl p-5 hover:border-[#C49A45]/50 transition-all", children: [_jsxs("div", { className: "flex items-center justify-between text-[#9CA3AF]", children: [_jsx("span", { className: "text-xs font-medium", children: "F&B Sales Today" }), _jsx("div", { className: "p-2 bg-[#C49A45]/10 text-[#C49A45] rounded-lg", children: _jsx(Utensils, { size: 18 }) })] }), _jsx("div", { className: "mt-3 flex items-baseline gap-2", children: _jsx("span", { className: "text-2xl font-bold text-[#F3F4F6] font-mono", children: formatCurrency(850) }) }), _jsxs("div", { className: "mt-3 text-xs text-[#E2B768] flex items-center gap-1", children: [_jsx(TrendingUp, { size: 12 }), " +15% vs yesterday"] })] })), hasPermission('pool.view') && (_jsxs("div", { className: "bg-[#1C2536] border border-[#2D3748] rounded-xl p-5 hover:border-[#C49A45]/50 transition-all", children: [_jsxs("div", { className: "flex items-center justify-between text-[#9CA3AF]", children: [_jsx("span", { className: "text-xs font-medium", children: "Pool Entries" }), _jsx("div", { className: "p-2 bg-[#2C5E43]/20 text-[#2C5E43] rounded-lg", children: _jsx(Waves, { size: 18 }) })] }), _jsxs("div", { className: "mt-3 flex items-baseline gap-2", children: [_jsx("span", { className: "text-2xl font-bold text-[#F3F4F6] font-mono", children: "14" }), _jsx("span", { className: "text-xs text-[#9CA3AF]", children: "visitors" })] }), _jsxs("div", { className: "mt-3 text-xs text-[#9CA3AF] flex items-center gap-1", children: [_jsx(CheckCircle2, { size: 12 }), " Capacity: 14/30"] })] }))] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 bg-[#1C2536] border border-[#2D3748] rounded-2xl p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4 pb-3 border-b border-[#2D3748]", children: [_jsx("h2", { className: "text-sm font-bold text-[#F3F4F6] uppercase tracking-wider font-['Outfit']", children: "Today's Guest Schedule" }), _jsx("span", { className: "text-xs text-[#C49A45] font-medium", children: "4 Scheduled" })] }), _jsx("div", { className: "space-y-3", children: [
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
                                ].map((item, idx) => (_jsxs("div", { className: "flex items-center justify-between p-3.5 bg-[#151C28] border border-[#2D3748] rounded-xl text-xs hover:border-[#C49A45]/30 transition-all", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-[#8C2D19]/30 text-[#E2B768] font-bold flex items-center justify-center text-xs", children: item.guest.charAt(0) }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-[#F3F4F6]", children: item.guest }), _jsx("div", { className: "text-[11px] text-[#9CA3AF]", children: item.room })] })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "font-mono text-[#F3F4F6]", children: item.balance }), _jsxs("div", { className: "text-[11px] text-[#C49A45]", children: [item.type, " \u00B7 ", item.time] })] })] }, idx))) })] }), _jsxs("div", { className: "bg-[#1C2536] border border-[#2D3748] rounded-2xl p-6", children: [_jsx("div", { className: "flex items-center justify-between mb-4 pb-3 border-b border-[#2D3748]", children: _jsx("h2", { className: "text-sm font-bold text-[#F3F4F6] uppercase tracking-wider font-['Outfit']", children: "Live Activity Stream" }) }), _jsx("div", { className: "space-y-4", children: [
                                    {
                                        text: 'Room 204 charged GHS 85.00 for Fried Rice at Restaurant',
                                        time: '10 mins ago',
                                        icon: _jsx(Utensils, { size: 14, className: "text-[#C49A45]" }),
                                    },
                                    {
                                        text: 'New Reservation confirmed for Room 102 (12-15 Aug)',
                                        time: '25 mins ago',
                                        icon: _jsx(CalendarCheck, { size: 14, className: "text-[#10B981]" }),
                                    },
                                    {
                                        text: 'Room 105 status changed to DIRTY by Housekeeping',
                                        time: '45 mins ago',
                                        icon: _jsx(AlertCircle, { size: 14, className: "text-[#F59E0B]" }),
                                    },
                                ].map((act, idx) => (_jsxs("div", { className: "flex gap-3 text-xs", children: [_jsx("div", { className: "mt-0.5 p-1.5 bg-[#151C28] border border-[#2D3748] rounded-lg h-fit", children: act.icon }), _jsxs("div", { children: [_jsx("p", { className: "text-[#F3F4F6] leading-relaxed", children: act.text }), _jsx("span", { className: "text-[10px] text-[#9CA3AF] mt-0.5 block", children: act.time })] })] }, idx))) })] })] })] }));
};
