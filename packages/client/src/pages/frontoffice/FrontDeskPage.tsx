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
          ...(splitTenders ? { tenders: splitTenders } : { paymentMethod: form.paymentMethod }),
        });
      }
      showToast('success', action.type === 'in' ? 'Guest successfully checked in!' : 'Payment recorded & guest checked out.');
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

  const checkoutTotal =
    action?.type === 'out'
      ? (() => {
          const f =
            (action.row.reservation?.folios || []).find((x: any) => x.status === 'OPEN') ??
            (action.row.reservation?.folios || [])[0] ??
            null;
          return (f ? Number(f.balance) || 0 : 0) + (chargeLateCheckoutFee ? activeLateInfo?.fee ?? 0 : 0);
        })()
      : 0;

  const openCheckout = (stay: any) => {
    setSplitOpen(false);
    setChargeLateCheckoutFee(true);
    setLateFeeReason('');
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
                <Sparkles size={11} className="text-[#c59a58]" /> Reception &bull; Front Desk Terminal
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-bold text-sky-300">
                <Clock size={11} /> Standard Checkout: {checkoutPolicy.checkoutTime}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white font-serif">
              {greeting}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/85 max-w-xl font-medium leading-relaxed">
              Real-time arrival processing, room key dispatch, and payment-safe departures &bull; {nowFormatted}
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
      <div className="rounded-2xl border border-[#cbd5e1]/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <DoorOpen size={16} className="text-[#174b59]" />
            <span className="text-xs font-black uppercase tracking-wider text-[#174b59]">
              Front Desk Live Room Rack &bull; Today's Inventory Status
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total property rooms: <strong className="text-slate-900">{rooms.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Ready to Sell / Available Today */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Ready to Sell (Available)</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="mt-2 text-3xl font-black text-emerald-950">{availableRoomsToday.length}</div>
            <div className="mt-1 text-[11px] text-emerald-700 font-medium">Clean & available today</div>
          </div>

          {/* Reserved for Today */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Reserved Today</span>
              <Calendar size={13} className="text-amber-700" />
            </div>
            <div className="mt-2 text-3xl font-black text-amber-950">{reservedRoomsToday.length}</div>
            <div className="mt-1 text-[11px] text-amber-700 font-medium">Arrivals due / active bookings</div>
          </div>

          {/* In-House Occupied */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">In-House Stays</span>
              <UserCheck size={13} className="text-sky-700" />
            </div>
            <div className="mt-2 text-3xl font-black text-sky-950">{occupiedRoomsToday.length}</div>
            <div className="mt-1 text-[11px] text-sky-700 font-medium">Currently occupied rooms</div>
          </div>

          {/* Housekeeping Turnover */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Housekeeping Turnover</span>
              <Building size={13} className="text-rose-700" />
            </div>
            <div className="mt-2 text-3xl font-black text-rose-950">{dirtyRoomsToday.length}</div>
            <div className="mt-1 text-[11px] text-rose-700 font-medium">Dirty / cleaning in progress</div>
          </div>
        </div>

        {/* Live Available Rooms Key Rack (Interactive walk-in selection) */}
        {availableRoomsToday.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Ready Rooms Available for Walk-Ins ({availableRoomsToday.length})</span>
              <span className="text-[#174b59] font-normal lowercase">click room to view</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableRoomsToday.map((room) => (
                <div
                  key={room.id}
                  onClick={() => navigate('/reservations')}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/40 px-3 py-1.5 hover:bg-emerald-100/70 hover:border-emerald-400 transition-all shadow-2xs"
                  title="Click to book room in reservations"
                >
                  <DoorOpen size={13} className="text-emerald-700" />
                  <span className="text-xs font-black text-emerald-950">Room {room.number}</span>
                  <span className="text-[10px] text-emerald-800 font-medium">
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
        <div className="rounded-2xl border border-[#cbd5e1]/80 bg-white shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/60 gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
                  <LogIn size={16} className="text-sky-700" />
                  Expected Arrivals Queue ({arrivals.length})
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Guest check-in starts at 2:00 PM &bull; Identity verification required
                </p>
              </div>

              <div className="relative w-full sm:w-56">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filter arrivals..."
                  className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1 text-xs text-[#0f172a] focus:border-[#174b59] focus:outline-none"
                />
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : arrivals.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No arrivals currently waiting in the check-in queue.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                {arrivals.map((reservation) => {
                  const guestFullName =
                    [reservation.guests?.[0]?.guest?.firstName, reservation.guests?.[0]?.guest?.lastName]
                      .filter(Boolean)
                      .join(' ') || 'Guest';
                  return (
                    <div
                      key={reservation.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800 text-xs font-black shadow-xs">
                          <UserRound size={17} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-[#0f172a] flex items-center gap-2">
                            <span>{guestFullName}</span>
                            <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-black text-sky-800">
                              Room {reservation.room?.number || 'Unassigned'}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            <span>Checkout: {new Date(reservation.checkOutDate).toLocaleDateString()} 12:00 PM</span>
                            <span>&bull;</span>
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
        <div className="rounded-2xl border border-[#cbd5e1]/80 bg-white shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/60">
              <div>
                <h2 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
                  <LogOut size={16} className="text-amber-700" />
                  In-House Guests &bull; Checkout Desk ({stays.length})
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Standard checkout deadline: 12:00 PM &bull; Late departures: +GHS {checkoutPolicy.hourlyRate}/hr
                </p>
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : stays.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No active in-house stays currently registered.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                {stays.map((stay) => {
                  const late = getLateInfo(stay);
                  const guestFullName =
                    [stay.guest?.firstName, stay.guest?.lastName].filter(Boolean).join(' ') || 'Guest';
                  return (
                    <div
                      key={stay.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#0f172a]">{guestFullName}</span>
                          <span className="rounded-md border border-[#c59a58]/40 bg-[#fbf8f2] px-2 py-0.5 text-[10px] font-black text-[#9b6e2e]">
                            Room {stay.room?.number || '—'}
                          </span>
                          {late && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 animate-pulse">
                              <AlertTriangle size={11} /> LATE +GHS {late.fee} ({late.lateHours}h)
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                          <span>
                            Departs {departureDate(stay) ? new Date(departureDate(stay)).toLocaleDateString() : '—'} 12:00 PM
                          </span>
                          <span>&bull;</span>
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
                              : 'border border-slate-300 hover:bg-slate-100 text-slate-800'
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
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-xs text-sky-900 leading-relaxed">
                <span className="font-bold">Identity Document Verification:</span> Check passport or national ID against booking particulars prior to key handover.
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
              {activeLateInfo ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span>Late Checkout Policy Applied</span>
                    <span className="rounded bg-amber-200/80 px-2 py-0.5 font-mono text-[11px] font-extrabold text-amber-900">
                      +GHS {activeLateInfo.fee.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800 leading-relaxed">
                    Departure is {activeLateInfo.lateHours} hour{activeLateInfo.lateHours > 1 ? 's' : ''} past the {checkoutPolicy.checkoutTime} deadline at GHS {checkoutPolicy.hourlyRate.toFixed(2)}/hour.
                  </p>
                  <label className="mt-3 flex items-center gap-2 font-semibold text-amber-950">
                    <input
                      type="checkbox"
                      checked={chargeLateCheckoutFee}
                      onChange={(e) => setChargeLateCheckoutFee(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#174B59]"
                    />
                    Charge late checkout fee (GHS {activeLateInfo.fee.toFixed(2)})
                  </label>
                  {!chargeLateCheckoutFee && (
                    <FormField label="Reason for waiving late fee (audit note)">
                      <TextInput
                        value={lateFeeReason}
                        onChange={(e) => setLateFeeReason(e.target.value)}
                        placeholder="e.g., Authorized manager courtesy..."
                      />
                    </FormField>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                  The selected payment method will settle the remaining balance on the guest's folio before releasing the room.
                </div>
              )}

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

              <div className="rounded-xl bg-gradient-to-r from-slate-900 to-[#102433] p-4 text-white shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Total Amount Due at Checkout</span>
                  <span className="text-xl font-black text-white">GHS {checkoutTotal.toFixed(2)}</span>
                </div>
                {activeLateInfo && chargeLateCheckoutFee && (
                  <p className="mt-1 text-[11px] text-amber-300">
                    Includes late checkout fee of GHS {activeLateInfo.fee.toFixed(2)}.
                  </p>
                )}
              </div>

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

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={splitOpen}
                  onChange={(e) => {
                    setSplitOpen(e.target.checked);
                    setTenders([makeTenderRow()]);
                  }}
                  className="h-3.5 w-3.5 accent-[#174B59]"
                />
                Split payment across multiple methods (e.g. Cash + MoMo)
              </label>

              {splitOpen && checkoutTotal > 0 && (
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <TenderSplit total={checkoutTotal} rows={tenders} onChange={setTenders} />
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={busy}
              disabled={splitOpen && !tendersCoverTotal(tenders, checkoutTotal)}
              className="bg-gradient-to-r from-[#174b59] to-[#0f3440] text-white"
            >
              {action?.type === 'in' ? 'Confirm Check-In' : 'Settle & Complete Check-Out'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FrontDeskPage;
