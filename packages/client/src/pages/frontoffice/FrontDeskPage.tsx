import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reservationsApi, staysApi, roomsApi } from '../../services/apiService';
import { clearGetCache } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { formatUserGreeting } from '@nslv/shared';
import { LogIn, LogOut, RefreshCw, UserRound, BedDouble, Waves, ArrowRight, WalletCards } from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { TenderSplit, makeTenderRow, parseTenders, tendersCoverTotal, type TenderRow } from '../../components/ui/TenderSplit';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';

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
  // Admin-configured checkout policy
  const [checkoutPolicy, setCheckoutPolicy] = useState({ hourlyRate: 50, checkoutTime: '12:00' });
  const [form, setForm] = useState({
    idVerified: true,
    idDocumentType: 'PASSPORT',
    idDocumentNumber: '',
    roomCondition: 'CLEAN',
    paymentMethod: 'CASH',
  });
  const [splitOpen, setSplitOpen] = useState(false);
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
          ...(splitTenders ? { tenders: splitTenders } : { paymentMethod: form.paymentMethod }),
        });
      }
      showToast('success', action.type === 'in' ? 'Guest checked in' : 'Payment recorded and guest checked out');
      setAction(null);
      void load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to complete operation');
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

  // The server settles the exact outstanding folio balance plus any late fee.
  const checkoutTotal =
    action?.type === 'out'
      ? (() => {
          const f =
            (action.row.reservation?.folios || []).find((x: any) => x.status === 'OPEN') ??
            (action.row.reservation?.folios || [])[0] ??
            null;
          return (f ? Number(f.balance) || 0 : 0) + (activeLateInfo?.fee ?? 0);
        })()
      : 0;

  const openCheckout = (stay: any) => {
    setSplitOpen(false);
    setTenders([makeTenderRow()]);
    setAction({ type: 'out', row: stay });
  };

  return (
    <ShellPage
      eyebrow="RECEPTION · FRONT DESK"
      title={greeting}
      subtitle="Arrivals, in-house guests and payment-safe departures."
      actions={
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="Arrivals due" value={arrivals.length} icon={LogIn} accent />
        <StatTile label="In house" value={stays.length} icon={UserRound} />
        <StatTile label="Ready rooms" value={rooms.filter((room) => ['AVAILABLE', 'READY'].includes(room.status)).length} icon={BedDouble} />
        <StatTile
          label="Departures"
          value={stays.filter((stay) => String(departureDate(stay) || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length}
          icon={LogOut}
        />
      </div>

      {permissions.includes('pool.view') && (
        <button
          onClick={() => navigate('/pool/services')}
          className="group ns-card flex w-full items-center gap-4 p-5 text-left transition hover:border-[#b9d6da] hover:shadow-sm"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e9f4f5] text-[#2e7f8c]"><Waves size={19} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-extrabold text-[#20343e]">Pool desk</div>
            <div className="mt-0.5 text-[11px] text-[#8a9598]">Record pool attendance and manage pool services</div>
          </div>
          <ArrowRight size={16} className="text-[#2e7f8c] transition group-hover:translate-x-0.5" />
        </button>
      )}

      <button
        onClick={() => navigate('/cash-at-hand')}
        className="group ns-card flex w-full items-center gap-4 p-5 text-left transition hover:border-[#b9d6da] hover:shadow-sm"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef5e9] text-[#547a3b]"><WalletCards size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold text-[#20343e]">Cash at hand</div>
          <div className="mt-0.5 text-[11px] text-[#8a9598]">Record cash handed to Reception and money taken out for expenses or other purposes</div>
        </div>
        <ArrowRight size={16} className="text-[#547a3b] transition group-hover:translate-x-0.5" />
      </button>

      <Section title="Arrival desk" subtitle="Due arrivals include late arrivals from prior nights. Check-in starts at 2:00 PM.">
        <Toolbar search={q} onSearch={setQ} placeholder="Find a guest or reservation…" />
        {loading ? (
          <LoadingState />
        ) : arrivals.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#899397]">No arrivals are due.</div>
        ) : (
          <div className="divide-y divide-[#edf0ed]">
            {arrivals.map((reservation) => (
              <div key={reservation.id} className="flex items-center gap-4 px-5 py-4">
                <UserRound size={18} className="text-[#16a4d4]" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold">
                    {[reservation.guests?.[0]?.guest?.firstName, reservation.guests?.[0]?.guest?.lastName].filter(Boolean).join(' ') || 'Guest'}
                  </div>
                  <div className="mt-1 text-[10px] text-[#8a9598]">
                    Room {reservation.room?.number || '—'} · checkout {new Date(reservation.checkOutDate).toLocaleDateString()} 12:00 PM
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setForm({ ...form, idVerified: true });
                    setAction({ type: 'in', row: reservation });
                  }}
                >
                  <LogIn size={14} /> Check in
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Guests in house" subtitle="Active stays and checkout actions. Standard checkout deadline is 12:00 PM (Late fee: GHS 50/hr).">
        <div className="divide-y divide-[#edf0ed]">
          {loading ? (
            <LoadingState />
          ) : stays.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#899397]">No active stays.</div>
          ) : (
            stays.map((stay) => {
              const late = getLateInfo(stay);
              return (
                <div key={stay.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#14232b]">
                        {[stay.guest?.firstName, stay.guest?.lastName].filter(Boolean).join(' ') || 'Guest'}
                      </span>
                      {late && (
                        <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800">
                          LATE +GHS {late.fee} ({late.lateHours}h)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-[#8a9598]">
                      Room {stay.room?.number || '—'} · Departure {departureDate(stay) ? new Date(departureDate(stay)).toLocaleDateString() : '—'} 12:00 PM · 👤 Checked in by <span className="font-semibold text-[#26363e]">{stay.checkedInByUser?.name || 'Staff'}</span> at {stay.actualCheckIn ? new Date(stay.actualCheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                  {statusBadge(stay.status || 'CHECKED_IN')}
                  <Button size="sm" variant={late ? 'primary' : 'outline'} onClick={() => openCheckout(stay)}>
                    <LogOut size={14} /> Check out
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </Section>

      <Modal open={!!action} onClose={() => setAction(null)} title={action?.type === 'in' ? 'Guest check-in' : 'Settle and check out'}>
        <form onSubmit={submit} className="space-y-4">
          {action?.type === 'in' ? (
            <>
              <FormField label="ID document type">
                <SelectInput value={form.idDocumentType} onChange={(e) => setForm({ ...form, idDocumentType: e.target.value })}>
                  <option>PASSPORT</option>
                  <option>NATIONAL_ID</option>
                  <option>DRIVERS_LICENSE</option>
                </SelectInput>
              </FormField>
              <FormField label="ID document number">
                <TextInput value={form.idDocumentNumber} onChange={(e) => setForm({ ...form, idDocumentNumber: e.target.value })} />
              </FormField>
            </>
          ) : (
            <>
              {activeLateInfo ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span>⏰ Late Checkout Policy Applied</span>
                    <span className="rounded bg-amber-200/80 px-2 py-0.5 font-mono text-[11px] font-extrabold text-amber-900">
                      +GHS {activeLateInfo.fee.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800 leading-relaxed">
                    Checkout is past 12:00 PM ({activeLateInfo.lateHours} hour{activeLateInfo.lateHours > 1 ? 's' : ''} late). An automated late fee of <strong>GHS 50.00/hour</strong> (total GHS {activeLateInfo.fee.toFixed(2)}) is charged to the folio before settlement.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-[#f7f8f6] p-3 text-xs text-[#667278]">
                  The selected method records the exact outstanding folio balance before checkout. A guest credit must be refunded first.
                </div>
              )}
              <FormField label="Room condition">
                <SelectInput value={form.roomCondition} onChange={(e) => setForm({ ...form, roomCondition: e.target.value })}>
                  <option value="CLEAN">Clean</option>
                  <option value="DIRTY">Needs cleaning</option>
                  <option value="DAMAGED">Damaged</option>
                </SelectInput>
              </FormField>

              <div className="rounded-xl bg-[#f7f8f6] p-3 text-xs text-[#27383F]">
                <div className="flex items-center justify-between font-bold">
                  <span>Amount due at settlement</span>
                  <span className="ns-number">GHS {checkoutTotal.toFixed(2)}</span>
                </div>
                {activeLateInfo && (
                  <p className="mt-1 text-[11px] text-[#A06010]">Includes the late checkout fee of GHS {activeLateInfo.fee.toFixed(2)}.</p>
                )}
              </div>

              <FormField label="Settlement method">
                <SelectInput value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} disabled={splitOpen}>
                  <option>CASH</option>
                  <option>CARD</option>
                  <option>MOBILE_MONEY</option>
                  <option>BANK_TRANSFER</option>
                </SelectInput>
              </FormField>

              <label className="flex items-center gap-2 text-xs font-bold text-[#4A5568]">
                <input
                  type="checkbox"
                  checked={splitOpen}
                  onChange={(e) => {
                    setSplitOpen(e.target.checked);
                    setTenders([makeTenderRow()]);
                  }}
                  className="h-3.5 w-3.5 accent-[#174B59]"
                />
                Split settlement across methods (e.g. cash + mobile money)
              </label>

              {splitOpen && checkoutTotal > 0 && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <TenderSplit total={checkoutTotal} rows={tenders} onChange={setTenders} />
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={splitOpen && !tendersCoverTotal(tenders, checkoutTotal)}>
              {action?.type === 'in' ? 'Confirm check-in' : 'Settle & check out'}
            </Button>
          </div>
        </form>
      </Modal>
    </ShellPage>
  );
};

export default FrontDeskPage;
