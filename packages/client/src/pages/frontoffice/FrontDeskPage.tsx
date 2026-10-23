import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reservationsApi, staysApi, roomsApi } from '../../services/apiService';
import { clearGetCache } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { formatUserGreeting } from '@nslv/shared';
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

  const load = async () => {
    try {
      setLoading(true);
      const [r, s, rm, policy] = await Promise.all([
        reservationsApi.list({ search: q || undefined }),
        staysApi.getActiveStays(),
        roomsApi.getRooms(),
        staysApi.getCheckoutPolicy().catch(() => null),
      ]);
      setArrivals((r.data || []).filter((reservation) => isArrivalDue(reservation)));
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
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c59a58]/30 bg-[#fbf8f2] px-3 py-1 text-[11px] font-bold tracking-wider text-[#9b6e2e] uppercase shadow-xs">
            <Sparkles size={13} className="text-[#c59a58]" />
            Reception &bull; Front Desk Terminal
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0f172a]">
            {greeting}
          </h1>
          <p className="mt-1 text-xs text-[#64748b]">
            Real-time arrival processing, active guest management, and payment-safe departures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reception/report')}
            className="border-[#cbd5e1] hover:bg-white bg-white/70 shadow-xs text-xs font-semibold gap-1.5"
          >
            <BarChart3 size={14} className="text-[#174b59]" /> Reception Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/cash-at-hand')}
            className="border-[#cbd5e1] hover:bg-white bg-white/70 shadow-xs text-xs font-semibold gap-1.5"
          >
            <WalletCards size={14} className="text-emerald-700" /> Cash at Hand
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="border-[#cbd5e1] hover:bg-white bg-white/70 shadow-xs text-xs font-semibold"
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Front Desk KPI Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Arrivals Due */}
        <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white to-sky-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">Arrivals Due</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <LogIn size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-[#0f172a]">{arrivals.length}</div>
          <div className="mt-1 text-xs text-sky-700 font-medium">Ready for check-in terminal</div>
        </div>

        {/* In House */}
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">In House</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <UserRound size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-[#0f172a]">{stays.length}</div>
          <div className="mt-1 text-xs text-emerald-700 font-medium">Active registered guests</div>
        </div>

        {/* Ready Rooms */}
        <div className="rounded-2xl border border-[#c59a58]/40 bg-gradient-to-br from-white to-[#fbf8f2] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9b6e2e]">Ready Rooms</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100/80 text-[#9b6e2e]">
              <BedDouble size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-[#0f172a]">
            {rooms.filter((room) => ['AVAILABLE', 'READY'].includes(room.status)).length}
          </div>
          <div className="mt-1 text-xs text-[#9b6e2e] font-medium">Clean & inspected rooms</div>
        </div>

        {/* Departures */}
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Departures Today</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <LogOut size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-[#0f172a]">
            {stays.filter((stay) => String(departureDate(stay) || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium">Scheduled checkouts</div>
        </div>
      </div>

      {/* ── Quick Action Operational Banners ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          onClick={() => navigate('/reception/report')}
          className="group flex w-full items-center gap-4 rounded-2xl border border-[#cbd5e1]/70 bg-white p-4 text-left shadow-xs hover:border-[#174b59]/50 hover:shadow-md transition-all"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#174b59] group-hover:scale-105 transition-transform">
            <BarChart3 size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-[#0f172a]">Daily Reception Report</div>
            <div className="mt-0.5 text-[11px] text-[#64748b]">MoMo, Cash, shift totals & booked stays</div>
          </div>
          <ArrowRight size={15} className="text-[#174b59] transition group-hover:translate-x-1" />
        </button>

        <button
          onClick={() => navigate('/cash-at-hand')}
          className="group flex w-full items-center gap-4 rounded-2xl border border-[#cbd5e1]/70 bg-white p-4 text-left shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 group-hover:scale-105 transition-transform">
            <WalletCards size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-[#0f172a]">Cash at Hand Drawer</div>
            <div className="mt-0.5 text-[11px] text-[#64748b]">Track drawer balances, payouts & floats</div>
          </div>
          <ArrowRight size={15} className="text-emerald-700 transition group-hover:translate-x-1" />
        </button>

        {permissions.includes('pool.view') && (
          <button
            onClick={() => navigate('/pool/services')}
            className="group flex w-full items-center gap-4 rounded-2xl border border-[#cbd5e1]/70 bg-white p-4 text-left shadow-xs hover:border-[#2e7f8c]/50 hover:shadow-md transition-all"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-[#2e7f8c] group-hover:scale-105 transition-transform">
              <Waves size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#0f172a]">Pool & Amenities Desk</div>
              <div className="mt-0.5 text-[11px] text-[#64748b]">Record pool entries & outdoor services</div>
            </div>
            <ArrowRight size={15} className="text-[#2e7f8c] transition group-hover:translate-x-1" />
          </button>
        )}
      </div>

      {/* ── Arrival Desk Section ── */}
      <div className="rounded-2xl border border-[#cbd5e1]/70 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e2e8f0] px-6 py-4 bg-slate-50/50 gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
              <LogIn size={16} className="text-sky-600" />
              Arrival Desk
            </h2>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Check-in commences at 2:00 PM. Includes expected arrivals and confirmed bookings due today.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search arrivals or guests..."
              className="w-full rounded-xl border border-[#cbd5e1] pl-9 pr-3 py-1.5 text-xs text-[#0f172a] focus:border-[#174b59] focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : arrivals.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#94a3b8]">
            No arrivals currently waiting for check-in.
          </div>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {arrivals.map((reservation) => {
              const guestName =
                [reservation.guests?.[0]?.guest?.firstName, reservation.guests?.[0]?.guest?.lastName]
                  .filter(Boolean)
                  .join(' ') || 'Guest';
              return (
                <div
                  key={reservation.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 text-xs font-black shadow-xs">
                      <UserRound size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-[#0f172a] flex items-center gap-2">
                        <span>{guestName}</span>
                        <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-black text-sky-800">
                          Room {reservation.room?.number || 'Unassigned'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#64748b] flex items-center gap-2 flex-wrap">
                        <span>Checkout: {new Date(reservation.checkOutDate).toLocaleDateString()} 12:00 PM</span>
                        <span>&bull;</span>
                        <span>Ref: {reservation.confirmationNo || reservation.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      setForm({ ...form, idVerified: true });
                      setAction({ type: 'in', row: reservation });
                    }}
                    className="bg-gradient-to-r from-[#174b59] to-[#0f3440] hover:from-[#133e4a] hover:to-[#0a232b] text-white text-xs font-semibold gap-1.5 shadow-xs shrink-0 self-end sm:self-auto"
                  >
                    <LogIn size={14} /> Process Check In
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Active Stays / In-House Guests ── */}
      <div className="rounded-2xl border border-[#cbd5e1]/70 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
              <UserRound size={16} className="text-emerald-700" />
              In-House Guests &amp; Departure Actions
            </h2>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Standard checkout time is 12:00 PM &bull; Late departures trigger policy fee of GHS {checkoutPolicy.hourlyRate}/hr.
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : stays.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#94a3b8]">No active guest stays recorded.</div>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {stays.map((stay) => {
              const late = getLateInfo(stay);
              const guestName =
                [stay.guest?.firstName, stay.guest?.lastName].filter(Boolean).join(' ') || 'Guest';
              return (
                <div
                  key={stay.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-bold text-[#0f172a]">{guestName}</span>
                      <span className="rounded-md border border-[#c59a58]/40 bg-[#fbf8f2] px-2 py-0.5 text-[10px] font-black text-[#9b6e2e]">
                        Room {stay.room?.number || '—'}
                      </span>
                      {late && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 animate-pulse">
                          <AlertTriangle size={11} /> LATE +GHS {late.fee} ({late.lateHours}h)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-[#64748b] flex items-center gap-2 flex-wrap">
                      <span>
                        Departure: {departureDate(stay) ? new Date(departureDate(stay)).toLocaleDateString() : '—'} 12:00 PM
                      </span>
                      <span>&bull;</span>
                      <span>Checked in by {stay.checkedInByUser?.name || 'Reception Staff'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    {statusBadge(stay.status || 'CHECKED_IN')}
                    <Button
                      size="sm"
                      variant={late ? 'primary' : 'outline'}
                      onClick={() => openCheckout(stay)}
                      className={`text-xs font-semibold gap-1.5 ${
                        late
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'border-[#cbd5e1] hover:bg-slate-100 text-[#0f172a]'
                      }`}
                    >
                      <LogOut size={14} /> Settle &amp; Check Out
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Check-In / Check-Out Modal ── */}
      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={action?.type === 'in' ? 'Guest Arrival & Check-In' : 'Folio Settlement & Check-Out'}
      >
        <form onSubmit={submit} className="space-y-4">
          {action?.type === 'in' ? (
            <>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-xs text-sky-900 leading-relaxed">
                <span className="font-bold">Identity Verification:</span> Verify the guest photo identity document and room key handover before checking in.
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
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-[#64748b]">
                  The chosen payment method settles the remaining open balance on the guest's stay folio.
                </div>
              )}

              <FormField label="Room Turnover Condition">
                <SelectInput
                  value={form.roomCondition}
                  onChange={(e) => setForm({ ...form, roomCondition: e.target.value })}
                >
                  <option value="CLEAN">Clean &amp; Inspected</option>
                  <option value="DIRTY">Needs Turnover Cleaning</option>
                  <option value="DAMAGED">Requires Maintenance / Damage Assessment</option>
                </SelectInput>
              </FormField>

              <div className="rounded-xl bg-gradient-to-r from-slate-900 to-[#102433] p-4 text-white shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Total Amount Due at Checkout</span>
                  <span className="text-xl font-black text-white">GHS {checkoutTotal.toFixed(2)}</span>
                </div>
                {activeLateInfo && chargeLateCheckoutFee && (
                  <p className="mt-1 text-[11px] text-amber-300">
                    Includes late checkout surcharge of GHS {activeLateInfo.fee.toFixed(2)}.
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
