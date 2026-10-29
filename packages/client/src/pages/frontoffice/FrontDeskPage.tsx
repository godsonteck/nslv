import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reservationsApi, staysApi, roomsApi } from '../../services/apiService';
import { clearGetCache } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, formatUserGreeting } from '@nslv/shared';
import {
  LogIn,
  LogOut,
  RefreshCw,
  UserRound,
  BedDouble,
  Waves,
  ArrowRight,
  WalletCards,
  BarChart3,
  Search,
  Clock,
  Sparkles,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  DoorOpen,
  UserCheck,
  CreditCard,
  Building,
} from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { TenderSplit, makeTenderRow, parseTenders, tendersCoverTotal, type TenderRow } from '../../components/ui/TenderSplit';

const hotelBoundary = (value: unknown, timeStr: string | number = 12) => {
  const hour = typeof timeStr === 'string' ? parseInt(timeStr.split(':')[0] || '12', 10) : timeStr;
  const min = typeof timeStr === 'string' ? parseInt(timeStr.split(':')[1] || '0', 10) : 0;
  return new Date(`${String(value).slice(0, 10)}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`);
};

const isArrivalDue = (reservation: any, now = new Date()) =>
  ['PENDING', 'CONFIRMED'].includes(String(reservation.status).toUpperCase()) &&
  now >= hotelBoundary(reservation.checkInDate, 14) &&
  now < hotelBoundary(reservation.checkOutDate, 12);

export const FrontDeskPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const permissions = user?.permissions ?? [];
  const greeting = formatUserGreeting(user);

  const [stays, setStays] = useState<any[]>([]);
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [rawReservations, setRawReservations] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<{ type: 'in' | 'out'; row: any } | null>(null);
  const [checkoutPolicy, setCheckoutPolicy] = useState({ hourlyRate: 50, checkoutTime: '12:00' });
  const [form, setForm] = useState({
    idVerified: true,
    idDocumentType: 'PASSPORT',
    idDocumentNumber: '',
    roomCondition: 'CLEAN',
    paymentMethod: 'CASH',
  });
  const [splitOpen, setSplitOpen] = useState(false);
  const [chargeLateCheckoutFee, setChargeLateCheckoutFee] = useState(true);
  const [lateFeeReason, setLateFeeReason] = useState('');
  const [allowOwing, setAllowOwing] = useState(false);
  const [owingReason, setOwingReason] = useState('');
  const [tenders, setTenders] = useState<TenderRow[]>([makeTenderRow()]);

  const nowFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const load = async () => {
    try {
      setLoading(true);
      const [r, s, rm, policy] = await Promise.all([
        reservationsApi.list({ search: q || undefined }),
        staysApi.getActiveStays(),
        roomsApi.getRooms(),
        staysApi.getCheckoutPolicy().catch(() => null),
      ]);
      const resList = r.data || [];
      setRawReservations(resList);
      setArrivals(resList.filter((reservation: any) => isArrivalDue(reservation)));
      setStays(s.data || []);
      setRooms(rm.data || []);
      if (policy?.data) setCheckoutPolicy(policy.data);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load front desk');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [q]);

  const refresh = () => {
    clearGetCache();
    void load();
  };

  // Authoritative date-aware room availability for TODAY
  // Rooms with future reservations remain AVAILABLE today until the arrival date!
  const getRoomAvailabilityToday = (room: any, allRes: any[]) => {
    const today = new Date().toISOString().slice(0, 10);
    const roomReservations = allRes.filter((res: any) => {
      const matchRoom = (res.roomId && res.roomId === room.id) || (res.room?.id && res.room.id === room.id);
      const activeStatus = !['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(String(res.status).toUpperCase());
      return matchRoom && activeStatus;
    });

    // 1. In-house checked-in guest -> OCCUPIED
    const inHouse = roomReservations.find((res: any) => String(res.status).toUpperCase() === 'CHECKED_IN');
    if (inHouse) return { status: 'OCCUPIED', reservation: inHouse };

    // 2. Active reservation covering TODAY -> RESERVED
    const activeResToday = roomReservations.find((res: any) => {
      const cin = String(res.checkInDate).slice(0, 10);
      const cout = String(res.checkOutDate).slice(0, 10);
      return cin <= today && today < cout;
    });
    if (activeResToday) return { status: 'RESERVED', reservation: activeResToday };

    // 3. Operational conditions
    if (['MAINTENANCE', 'OUT_OF_SERVICE', 'DIRTY', 'CLEANING'].includes(room.status)) {
      return { status: room.status, reservation: null };
    }

    // 4. AVAILABLE today
    return { status: 'AVAILABLE', reservation: null };
  };

  const roomAvailabilityMap = new Map<string, { status: string; reservation: any }>();
  rooms.forEach((r) => {
    roomAvailabilityMap.set(r.id, getRoomAvailabilityToday(r, rawReservations));
  });

  const availableRoomsToday = rooms.filter((r) => roomAvailabilityMap.get(r.id)?.status === 'AVAILABLE');
  const reservedRoomsToday = rooms.filter((r) => roomAvailabilityMap.get(r.id)?.status === 'RESERVED');
  const occupiedRoomsToday = rooms.filter((r) => roomAvailabilityMap.get(r.id)?.status === 'OCCUPIED');
  const dirtyRoomsToday = rooms.filter((r) => ['DIRTY', 'CLEANING'].includes(r.status));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action) return;
    try {
      setBusy(true);
      if (action.type === 'in') {
        await staysApi.checkIn({ reservationId: action.row.id, ...form });
      } else {
        const splitTenders = splitOpen ? parseTenders(tenders) : undefined;
        await staysApi.checkOut({
          reservationId: action.row.reservationId || action.row.id,
          roomCondition: form.roomCondition,
          chargeLateCheckoutFee,
          ...(activeLateInfo && !chargeLateCheckoutFee ? { lateCheckoutFeeReason: lateFeeReason.trim() || undefined } : {}),
          ...(allowOwing ? { allowOwing: true, owingReason: owingReason.trim() || undefined } : {}),
          ...(splitTenders ? { tenders: splitTenders } : (allowOwing && !form.paymentMethod ? {} : { paymentMethod: form.paymentMethod })),
        });
      }
      showToast('success', action.type === 'in' ? 'Guest successfully checked in!' : allowOwing ? 'Guest checked out with outstanding balance.' : 'Payment recorded & guest checked out.');
      setAction(null);
      void load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to complete front desk operation');
      if (e instanceof Error && /outstanding balance/i.test(e.message)) void load();
    } finally {
      setBusy(false);
    }
  };

  const departureDate = (stay: any) => stay.reservation?.checkOutDate;

  const getLateInfo = (stay: any) => {
    const d = departureDate(stay);
    if (!d) return null;
    const deadline = hotelBoundary(d, checkoutPolicy.checkoutTime);
    const now = new Date();
    if (now <= deadline) return null;
    const diffMs = now.getTime() - deadline.getTime();
    const lateHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    const fee = lateHours * checkoutPolicy.hourlyRate;
    return { lateHours, fee, hourlyRate: checkoutPolicy.hourlyRate };
  };

  const activeLateInfo = action?.type === 'out' ? getLateInfo(action.row) : null;

  /** Itemised folio charges for the checkout modal */
  const checkoutLineItems: { label: string; amount: number; type: string; voided?: boolean }[] =
    action?.type === 'out'
      ? (() => {
          const folio =
            (action.row.reservation?.folios || []).find((x: any) => x.status === 'OPEN') ??
            (action.row.reservation?.folios || [])[0] ??
            null;
          const items: { label: string; amount: number; type: string; voided?: boolean }[] = [];
          if (folio?.items) {
            for (const item of folio.items) {
              if (item.voidedAt) continue; // skip voided items
              items.push({ label: item.description || item.type, amount: Number(item.amount), type: item.type });
            }
          }
          // Late checkout fee line — shown separately so staff can toggle it
          if (activeLateInfo) {
            items.push({
              label: `Late checkout fee (${activeLateInfo.lateHours}h × GHS ${activeLateInfo.hourlyRate.toFixed(2)}/hr)`,
              amount: activeLateInfo.fee,
              type: 'LATE_FEE',
              voided: !chargeLateCheckoutFee,
            });
          }
          return items;
        })()
      : [];

  const checkoutTotal = checkoutLineItems
    .filter((l) => !l.voided)
    .reduce((sum, l) => sum + l.amount, 0);

  const openCheckout = (stay: any) => {
    setSplitOpen(false);
    setChargeLateCheckoutFee(true);
    setLateFeeReason('');
    setAllowOwing(false);
    setOwingReason('');
    setTenders([makeTenderRow()]);
    setAction({ type: 'out', row: stay });
    void staysApi
      .getCheckoutPolicy()
      .then((policy) => {
        if (policy?.data) setCheckoutPolicy(policy.data);
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-7 pb-16 animate-in fade-in duration-300">
      {/* ── Editorial Front Desk Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#c59a58]/35 bg-gradient-to-r from-[#0c151c] via-[#111e28] to-[#0a1218] p-7 sm:p-9 text-white shadow-[0_16px_40px_rgba(10,18,24,0.35)]">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c59a58]/50 bg-[#c59a58]/15 px-3 py-1 text-[10px] font-black tracking-widest text-[#f0d49f] uppercase">
                <Sparkles size={11} className="text-[#c59a58]" /> Reception Terminal
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-bold text-sky-300">
                <Clock size={11} /> Standard Checkout: {checkoutPolicy.checkoutTime}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white font-serif">
              {greeting}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/85 max-w-xl font-medium leading-relaxed">
              {nowFormatted}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigate('/reception/report')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-xs"
            >
              <BarChart3 size={14} className="text-[#38bdf8]" />
              <span>Reception Report</span>
            </button>
            <button
              onClick={() => navigate('/cash-at-hand')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-xs"
            >
              <WalletCards size={14} className="text-emerald-400" />
              <span>Cash at Hand</span>
            </button>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Dynamic Room Availability Bar (Tallies 100% with Overview and Rooms Page) ── */}
      <div className="ns-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--ns-line)] pb-3">
          <div className="flex items-center gap-2">
            <DoorOpen size={16} className="text-[#c59a58]" />
            <span className="text-xs font-black uppercase tracking-wider text-[#c59a58]">
              Room Rack Inventory
            </span>
          </div>
          <span className="text-xs text-[var(--ns-muted)] font-medium">
            Total property rooms: <strong className="text-[var(--ns-ink)]">{rooms.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Ready to Sell / Available Today */}
          <div className="ns-card p-4 border-l-2 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Ready to Sell (Available)</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{availableRoomsToday.length}</div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Clean & available today</div>
          </div>

          {/* Reserved for Today */}
          <div className="ns-card p-4 border-l-2 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Reserved Today</span>
              <Calendar size={13} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{reservedRoomsToday.length}</div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Arrivals due / active bookings</div>
          </div>

          {/* In-House Occupied */}
          <div className="ns-card p-4 border-l-2 border-l-blue-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">In-House Stays</span>
              <UserCheck size={13} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{occupiedRoomsToday.length}</div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Currently occupied rooms</div>
          </div>

          {/* Housekeeping Turnover */}
          <div className="ns-card p-4 border-l-2 border-l-rose-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Housekeeping Turnover</span>
              <Building size={13} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{dirtyRoomsToday.length}</div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Dirty / cleaning in progress</div>
          </div>
        </div>

        {/* Live Available Rooms Key Rack (Interactive walk-in selection) */}
        {availableRoomsToday.length > 0 && (
          <div className="pt-2 border-t border-[var(--ns-line)]">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Ready Rooms Available for Walk-Ins ({availableRoomsToday.length})</span>
              <span className="text-[#c59a58] font-semibold lowercase">click room to view</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableRoomsToday.map((room) => (
                <div
                  key={room.id}
                  onClick={() => navigate('/reservations')}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40 px-3 py-1.5 hover:bg-emerald-500/20 hover:border-emerald-500 transition-all shadow-xs"
                  title="Click to book room in reservations"
                >
                  <DoorOpen size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100">Room {room.number}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {room.roomType?.name ? `(${room.roomType.name})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Operations: Arrivals Queue & In-House Departures ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Arrivals Due Desk */}
        <div className="ns-card overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--ns-line)] px-6 py-4 bg-slate-50/80 dark:bg-slate-900/60 gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <LogIn size={16} className="text-blue-500 dark:text-blue-400" />
                  Expected Arrivals Queue ({arrivals.length})
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Guest check-in starts at 2:00 PM | Identity verification required
                </p>
              </div>

              <div className="relative w-full sm:w-56">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filter arrivals..."
                  className="ns-input w-full pl-8 pr-3 py-1 text-xs"
                />
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : arrivals.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500">
                No arrivals currently waiting in the check-in queue.
              </div>
            ) : (
              <div className="divide-y divide-[var(--ns-line)] max-h-[520px] overflow-y-auto">
                {arrivals.map((reservation) => {
                  const guestFullName =
                    [reservation.guests?.[0]?.guest?.firstName, reservation.guests?.[0]?.guest?.lastName]
                      .filter(Boolean)
                      .join(' ') || 'Guest';
                  return (
                    <div
                      key={reservation.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/60 text-blue-600 dark:text-blue-400 text-xs font-black shadow-xs">
                          <UserRound size={17} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{guestFullName}</span>
                            <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-600 dark:text-blue-400">
                              Room {reservation.room?.number || 'Unassigned'}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                            <span>Checkout: {new Date(reservation.checkOutDate).toLocaleDateString()} 12:00 PM</span>
                            <span className="text-slate-400">|</span>
                            <span>Ref: {reservation.confirmationNo || reservation.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setForm({ ...form, idVerified: true });
                          setAction({ type: 'in', row: reservation });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#174b59] to-[#0f3440] hover:from-[#133e4a] hover:to-[#0a232b] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs shrink-0 self-end sm:self-auto transition-all"
                      >
                        <LogIn size={13} />
                        <span>Check In</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* In-House Guests & Departure Settlement Desk */}
        <div className="ns-card overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--ns-line)] px-6 py-4 bg-slate-50/80 dark:bg-slate-900/60">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <LogOut size={16} className="text-amber-600 dark:text-amber-400" />
                  In-House Stays and Checkout ({stays.length})
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Standard checkout deadline: 12:00 PM | Late departures: +GHS {checkoutPolicy.hourlyRate}/hr
                </p>
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : stays.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500">
                No active in-house stays currently registered.
              </div>
            ) : (
              <div className="divide-y divide-[var(--ns-line)] max-h-[520px] overflow-y-auto">
                {stays.map((stay) => {
                  const late = getLateInfo(stay);
                  const guestFullName =
                    [stay.guest?.firstName, stay.guest?.lastName].filter(Boolean).join(' ') || 'Guest';
                  return (
                    <div
                      key={stay.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{guestFullName}</span>
                          <span className="rounded-md border border-[#c59a58]/40 bg-[#c59a58]/10 px-2 py-0.5 text-[10px] font-black text-[#c59a58]">
                            Room {stay.room?.number || 'Unassigned'}
                          </span>
                          {late && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400 animate-pulse">
                              <AlertTriangle size={11} /> LATE +GHS {late.fee} ({late.lateHours}h)
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                          <span>
                            Departs {departureDate(stay) ? new Date(departureDate(stay)).toLocaleDateString() : 'Active'} 12:00 PM
                          </span>
                          <span className="text-slate-400">|</span>
                          <span>Checked in by {stay.checkedInByUser?.name || 'Reception Staff'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {statusBadge(stay.status || 'CHECKED_IN')}
                        <button
                          onClick={() => openCheckout(stay)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs ${
                            late
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'border border-[var(--ns-line)] bg-[var(--ns-surface)] hover:bg-[var(--ns-surface-2)] text-[var(--ns-ink)]'
                          }`}
                        >
                          <LogOut size={13} />
                          <span>Check Out</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Check-In & Check-Out Modal ── */}
      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={action?.type === 'in' ? 'Guest Arrival & Check-In Verification' : 'Folio Settlement & Departure'}
      >
        <form onSubmit={submit} className="space-y-4">
          {action?.type === 'in' ? (
            <>
              <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 p-3.5 text-xs text-blue-200 leading-relaxed">
                <span className="font-bold text-blue-300">Identity Document Verification:</span> Check passport or national ID against booking particulars prior to key handover.
              </div>
              <FormField label="ID Document Type">
                <SelectInput
                  value={form.idDocumentType}
                  onChange={(e) => setForm({ ...form, idDocumentType: e.target.value })}
                >
                  <option value="PASSPORT">Passport</option>
                  <option value="NATIONAL_ID">National ID (Ghana Card)</option>
                  <option value="DRIVERS_LICENSE">Driver's License</option>
                </SelectInput>
              </FormField>
              <FormField label="ID Document Number">
                <TextInput
                  value={form.idDocumentNumber}
                  onChange={(e) => setForm({ ...form, idDocumentNumber: e.target.value })}
                  placeholder="e.g. GHA-123456789-0"
                />
              </FormField>
            </>
          ) : (
            <>
              {/* ── Folio Breakdown ── */}
              <div className="rounded-xl border border-[#c59a58]/40 bg-slate-50 dark:bg-slate-900/60 overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 bg-[#c59a58]/10 border-b border-[#c59a58]/30 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#c59a58]">Folio Breakdown — What this payment covers</span>
                  <Receipt size={13} className="text-[#c59a58]" />
                </div>
                <div className="divide-y divide-[var(--ns-line)]">
                  {checkoutLineItems.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 italic">No charges posted to folio yet.</div>
                  )}
                  {checkoutLineItems.map((line, idx) => {
                    const isLateFee = line.type === 'LATE_FEE';
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-2 px-4 py-2.5 text-xs ${
                          line.voided ? 'opacity-40' : ''
                        } ${isLateFee ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isLateFee ? (
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-700 dark:text-amber-400">
                              <input
                                type="checkbox"
                                checked={chargeLateCheckoutFee}
                                onChange={(e) => setChargeLateCheckoutFee(e.target.checked)}
                                className="h-3.5 w-3.5 accent-[#c59a58] shrink-0"
                              />
                              <span className={line.voided ? 'line-through' : ''}>{line.label}</span>
                              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase">Late fee</span>
                            </label>
                          ) : (
                            <span className="text-slate-700 dark:text-slate-300 truncate">{line.label}</span>
                          )}
                        </div>
                        <span className={`font-bold tabular-nums shrink-0 ${isLateFee && chargeLateCheckoutFee ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'} ${line.voided ? 'line-through text-slate-400' : ''}`}>
                          GHS {line.amount.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Late fee waiver reason — shown inline when toggled off */}
                {activeLateInfo && !chargeLateCheckoutFee && (
                  <div className="px-4 pb-3 pt-1 border-t border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/10">
                    <FormField label="Reason for waiving late fee (audit note)">
                      <TextInput
                        value={lateFeeReason}
                        onChange={(e) => setLateFeeReason(e.target.value)}
                        placeholder="e.g., Authorized manager courtesy waiver"
                      />
                    </FormField>
                  </div>
                )}
                {/* Total row */}
                <div className="px-4 py-3 border-t-2 border-[#c59a58]/40 bg-[#c59a58]/5 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total Amount Due</span>
                  <span className="text-xl font-black text-[#c59a58]">GHS {checkoutTotal.toFixed(2)}</span>
                </div>
              </div>

              <FormField label="Room Turnover Condition">
                <SelectInput
                  value={form.roomCondition}
                  onChange={(e) => setForm({ ...form, roomCondition: e.target.value })}
                >
                  <option value="CLEAN">Clean &amp; Inspected</option>
                  <option value="DIRTY">Needs Turnover Cleaning</option>
                  <option value="DAMAGED">Requires Damage Inspection</option>
                </SelectInput>
              </FormField>

              <FormField label="Payment Method">
                <SelectInput
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  disabled={splitOpen}
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="MOBILE_MONEY">Mobile Money (MTN / Telecel)</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </SelectInput>
              </FormField>

              {checkoutTotal > 0 && (
                <div className="rounded-xl border border-amber-300/70 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/20 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowOwing}
                      onChange={(e) => setAllowOwing(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#c59a58]"
                    />
                    <span>Allow check-out with outstanding balance (Guest owes / Pay later)</span>
                  </label>
                  {allowOwing && (
                    <div className="pt-1">
                      <FormField label="Reason or promise to pay (optional audit note)">
                        <TextInput
                          value={owingReason}
                          onChange={(e) => setOwingReason(e.target.value)}
                          placeholder="e.g., Guest will send via Mobile Money this evening"
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitOpen}
                  onChange={(e) => {
                    setSplitOpen(e.target.checked);
                    setTenders([makeTenderRow()]);
                  }}
                  className="h-3.5 w-3.5 accent-[#c59a58]"
                />
                Split payment across multiple methods (e.g. Cash + MoMo)
              </label>

              {splitOpen && checkoutTotal > 0 && (
                <div className="rounded-xl border border-[var(--ns-line)] p-3 bg-slate-50 dark:bg-slate-900/60">
                  <TenderSplit total={checkoutTotal} rows={tenders} onChange={setTenders} />
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ns-line)]">
            <Button type="button" variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={busy}
              disabled={splitOpen && !allowOwing && !tendersCoverTotal(tenders, checkoutTotal)}
              className="bg-gradient-to-r from-[#174b59] to-[#0f3440] text-white"
            >
              {action?.type === 'in'
                ? 'Confirm Check-In'
                : allowOwing && (!splitOpen || !tendersCoverTotal(tenders, checkoutTotal))
                ? 'Complete Check-Out (Owing Balance)'
                : 'Settle & Complete Check-Out'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FrontDeskPage;

