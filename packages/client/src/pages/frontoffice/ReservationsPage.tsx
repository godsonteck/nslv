import React, { useEffect, useState } from 'react';
import { reservationsApi, roomsApi, guestsApi } from '../../services/apiService';
import { CalendarDays, Plus, RefreshCw, Users, Link2, X, Minus, MoreHorizontal } from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';

const uid = () => Math.random().toString(36).slice(2, 10);

type Person = { key: string; mode: 'existing' | 'new'; guestId: string; firstName: string; lastName: string; phone: string; email: string };
type RoomLine = { key: string; roomId: string; adults: string; children: string; primaryKey: string; additionalKeys: string[] };

const emptyPerson: Person = { key: uid(), mode: 'existing', guestId: '', firstName: '', lastName: '', phone: '', email: '' };
const emptyRoomLine = (primaryKey: string): RoomLine => ({ key: uid(), roomId: '', adults: '1', children: '0', primaryKey, additionalKeys: [] });

const guestName = (g: any) => (g ? `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim() || '—' : '—');

export const ReservationsPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Single-room booking
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('existing');
  const [guestFilter, setGuestFilter] = useState('');
  const [newGuest, setNewGuest] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [form, setForm] = useState({ guestId: '', roomId: '', checkInDate: '', checkOutDate: '', adults: '1', children: '0', additionalGuestIds: [] as string[] });

  // Multi-room (one party) booking
  const [multi, setMulti] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [roomLines, setRoomLines] = useState<RoomLine[]>([]);
  const [bookingDates, setBookingDates] = useState({ checkInDate: '', checkOutDate: '' });
  const [availableRoomIds, setAvailableRoomIds] = useState<Set<string> | null>(null);

  // Manage guests on an existing reservation
  const [manageOpen, setManageOpen] = useState(false);
  const [manageRes, setManageRes] = useState<any>(null);
  const [manageIds, setManageIds] = useState<string[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const [r, rm, g] = await Promise.all([
        reservationsApi.list({ search: q || undefined, status: status === 'ALL' ? undefined : status }),
        roomsApi.getRooms(),
        guestsApi.list(),
      ]);
      setData(r.data || []);
      setRooms(rm.data || []);
      setGuests(g.data || []);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load reservations');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [q, status]);

  useEffect(() => {
    const dates = multi ? bookingDates : form;
    if (!dates.checkInDate || !dates.checkOutDate || dates.checkOutDate <= dates.checkInDate) {
      setAvailableRoomIds(null);
      return;
    }
    let cancelled = false;
    reservationsApi.checkAvailability(dates.checkInDate, dates.checkOutDate)
      .then((result) => {
        if (!cancelled) setAvailableRoomIds(new Set((result.data || []).map((room: any) => room.id)));
      })
      .catch((error) => {
        if (!cancelled) {
          setAvailableRoomIds(null);
          showToast('error', error instanceof Error ? error.message : 'Unable to check room availability');
        }
      });
    return () => { cancelled = true; };
  }, [multi, bookingDates.checkInDate, bookingDates.checkOutDate, form.checkInDate, form.checkOutDate]);

  const bookableRooms = availableRoomIds === null ? [] : rooms.filter((room) => availableRoomIds.has(room.id));

  const resetSingle = () => {
    setGuestMode('existing');
    setGuestFilter('');
    setNewGuest({ firstName: '', lastName: '', phone: '', email: '' });
    setForm({ guestId: '', roomId: '', checkInDate: '', checkOutDate: '', adults: '1', children: '0', additionalGuestIds: [] });
  };

  const startMulti = () => {
    setMulti(true);
    if (people.length === 0 && roomLines.length === 0) {
      const p = { ...emptyPerson };
      setPeople([p]);
      setRoomLines([emptyRoomLine(p.key)]);
    }
  };

  const closeModal = () => {
    setOpen(false);
    setMulti(false);
    setPeople([]);
    setRoomLines([]);
    setBookingDates({ checkInDate: '', checkOutDate: '' });
    resetSingle();
  };

  const toggleFormGuest = (id: string) =>
    setForm((f) => ({
      ...f,
      additionalGuestIds: f.additionalGuestIds.includes(id) ? f.additionalGuestIds.filter((x) => x !== id) : [...f.additionalGuestIds, id],
    }));

  const createNewGuests = async (targets: Person[]) => {
    const map = new Map<string, string>();
    for (const p of targets) {
      if (p.mode === 'existing') {
        if (!p.guestId) throw new Error('Choose an existing guest for every person.');
        map.set(p.key, p.guestId);
      } else {
        if (!p.firstName.trim() || !p.lastName.trim()) throw new Error('Enter a first and last name for each new guest.');
        const created = await guestsApi.create({
          firstName: p.firstName.trim(),
          lastName: p.lastName.trim(),
          phone: p.phone.trim() || undefined,
          email: p.email.trim() || undefined,
        });
        map.set(p.key, created.data?.id ?? created.id);
      }
    }
    return map;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (multi) {
        if (roomLines.length === 0) throw new Error('Add at least one room to the booking.');
        const keyToGuest = await createNewGuests(people);
        const roomsPayload = roomLines.map((line) => {
          if (!line.roomId) throw new Error('Every room needs a room selected.');
          const primaryGuestId = keyToGuest.get(line.primaryKey);
          if (!primaryGuestId) throw new Error('Every room needs a primary guest.');
          return {
            roomId: line.roomId,
            guestId: primaryGuestId,
            adults: Number(line.adults) || 1,
            children: Number(line.children) || 0,
            additionalGuestIds: line.additionalKeys.map((k) => keyToGuest.get(k)!).filter(Boolean),
          };
        });
        const res = await reservationsApi.createMulti({
          checkInDate: bookingDates.checkInDate,
          checkOutDate: bookingDates.checkOutDate,
          rooms: roomsPayload,
        });
        const count = res.data?.reservations?.length ?? roomsPayload.length;
        showToast('success', `Booking created — ${count} room${count === 1 ? '' : 's'} under ${res.data?.bookingId ?? 'one party'}`);
      } else {
        let guestId = form.guestId;
        if (guestMode === 'new') {
          if (!newGuest.firstName.trim() || !newGuest.lastName.trim()) throw new Error('Enter the new guest first and last name.');
          const created = await guestsApi.create({
            firstName: newGuest.firstName.trim(),
            lastName: newGuest.lastName.trim(),
            phone: newGuest.phone.trim() || undefined,
            email: newGuest.email.trim() || undefined,
          });
          guestId = created.data?.id ?? created.id;
        }
        await reservationsApi.create({
          guestId,
          roomId: form.roomId,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          adults: Number(form.adults),
          children: Number(form.children),
          additionalGuestIds: form.additionalGuestIds,
        });
        showToast('success', guestMode === 'new' ? 'Guest created and reservation booked' : 'Reservation created');
      }
      closeModal();
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to create reservation');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this reservation?')) return;
    try {
      await reservationsApi.cancel(id, 'Cancelled from NSVilla front office');
      showToast('success', 'Reservation cancelled');
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to cancel reservation');
    }
  };

  const openManageGuests = (r: any) => {
    setManageRes(r);
    setManageIds([]);
    setManageOpen(true);
  };

  const saveManageGuests = async () => {
    if (!manageRes) return;
    try {
      setSaving(true);
      await reservationsApi.addGuests(manageRes.id, manageIds);
      showToast('success', 'Guests added to the reservation');
      setManageOpen(false);
      setManageRes(null);
      setManageIds([]);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to add guests');
    } finally {
      setSaving(false);
    }
  };

  const confirmed = data.filter((x) => ['CONFIRMED', 'PENDING'].includes(String(x.status).toUpperCase())).length;
  const active = data.filter((x) => String(x.status).toUpperCase() === 'CHECKED_IN').length;

  const filteredGuests = guests.filter((g) =>
    !guestFilter || `${g.firstName} ${g.lastName} ${g.phone || ''} ${g.email || ''}`.toLowerCase().includes(guestFilter.toLowerCase()),
  );

  const guestAttached = (g: any) => (manageRes?.guests || []).some((x: any) => x.guestId === g.id);

  // Group rows so a party (shared bookingId) stays together
  const grouped = [...data].sort((a, b) => {
    const ka = a.bookingId || a.id;
    const kb = b.bookingId || b.id;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const partyInfo = new Map<string, { count: number; total: number }>();
  data.forEach((r) => {
    if (!r.bookingId) return;
    const cur = partyInfo.get(r.bookingId) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(r.totalAmount || 0);
    partyInfo.set(r.bookingId, cur);
  });

  return (
    <ShellPage
      eyebrow="FRONT OFFICE · RESERVATIONS"
      title="Reservations"
      subtitle="Plan arrivals, protect room availability and keep every booking connected to the guest record."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> New reservation
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Reservations in view" value={data.length} icon={CalendarDays} />
        <StatTile label="Confirmed / pending" value={confirmed} note="Current filtered result" />
        <StatTile label="Checked in" value={active} note="Active stays" />
      </div>
      <Section title="Booking ledger" subtitle="Search by guest, reservation or room">
        <Toolbar search={q} onSearch={setQ} placeholder="Search guest, booking code or room…">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="ns-input h-10 px-3 text-xs">
            <option>ALL</option>
            <option>CONFIRMED</option>
            <option>PENDING</option>
            <option>CHECKED_IN</option>
            <option>CHECKED_OUT</option>
            <option>CANCELLED</option>
          </select>
        </Toolbar>
        {loading ? (
          <LoadingState />
        ) : data.length === 0 ? (
          <div className="p-5">
            <div className="rounded-2xl border border-dashed border-[#dfe4e0] p-12 text-center">
              <CalendarDays className="mx-auto text-[#a0aaad]" />
              <h3 className="mt-3 text-sm font-extrabold">No reservations yet</h3>
              <p className="mt-1 text-xs text-[#899397]">Your fresh property database is ready for its first booking.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                <tr>
                  <th className="px-5 py-3">Reservation</th>
                  <th className="px-5 py-3">Guests</th>
                  <th className="px-5 py-3">Room</th>
                  <th className="px-5 py-3">Stay</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {grouped.map((r, idx) => {
                  const prev = grouped[idx - 1];
                  const showPartyHeader = !!r.bookingId && prev?.bookingId !== r.bookingId;
                  const party = partyInfo.get(r.bookingId);
                  const allGuests = r.guests?.length ? [...r.guests].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)) : [];
                  const extra = allGuests.length - 1;
                  return (
                    <React.Fragment key={r.id}>
                      {showPartyHeader && (
                        <tr className="bg-[#eef3f0]">
                          <td colSpan={7} className="px-5 py-2">
                            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-[#174b59]">
                              <Link2 size={13} />
                              Party booking {r.bookingId}
                              <span className="rounded-full bg-[#dce8e2] px-2 py-0.5 text-[9px]">{party?.count} room{party?.count === 1 ? '' : 's'}</span>
                              <span className="ml-auto normal-case text-[#5d6a6f]">
                                Combined {Number(party?.total || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-[#fbfcfa]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-[#8d693c]">{r.confirmationNo || r.id.slice(0, 8)}</span>
                            {r.bookingId && <span className="rounded-md bg-[#eef3f0] px-1.5 py-0.5 text-[9px] font-extrabold text-[#174b59]" title="Part of a multi-room booking">PARTY</span>}
                          </div>
                          <div className="mt-1 text-[10px] text-[#9aa3a6]">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</div>
                        </td>
                        <td className="px-5 py-4 text-xs text-[#26363e]">
                          {allGuests.length ? (
                            <>
                              <span className="font-extrabold">{guestName(allGuests[0].guest)}</span>
                              {extra > 0 && <span className="ml-1.5 text-[10px] text-[#8a9598]">+{extra} more</span>}
                              {allGuests.slice(1).map((g) => (
                                <div key={g.id} className="text-[11px] text-[#667278]">{guestName(g.guest)}</div>
                              ))}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-[#667278]">
                          {r.room ? `Room ${r.room.number}` : 'Unassigned'}
                          <div className="text-[10px] text-[#9aa3a6]">{r.room?.roomType?.name || '—'}</div>
                        </td>
                        <td className="px-5 py-4 text-[11px] text-[#667278]">
                          {new Date(r.checkInDate).toLocaleDateString()} → {new Date(r.checkOutDate).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-xs font-extrabold text-[#20343e]">
                          {Number(r.totalAmount || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}
                        </td>
                        <td className="px-5 py-4">{statusBadge(r.status || 'PENDING')}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openManageGuests(r)} className="rounded-lg p-2 text-[#899397] hover:bg-[#eef3f0] hover:text-[#174b59]" title="Manage guests on this reservation">
                              <Users size={16} />
                            </button>
                            {!['CANCELLED', 'CHECKED_OUT'].includes(String(r.status).toUpperCase()) && (
                              <button onClick={() => cancel(r.id)} className="rounded-lg p-2 text-[#899397] hover:bg-red-50 hover:text-red-600" title="Cancel reservation">
                                <MoreHorizontal size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Modal open={open} onClose={closeModal} title="New reservation" size="lg">
        <form onSubmit={save} className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setMulti(false)} className={`rounded-xl px-3 py-2 text-[10px] font-extrabold ${!multi ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
              Single room
            </button>
            <button type="button" onClick={startMulti} className={`rounded-xl px-3 py-2 text-[10px] font-extrabold ${multi ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
              Multiple rooms (one party)
            </button>
          </div>

          {multi ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Arrival" required>
                  <TextInput type="date" required value={bookingDates.checkInDate} onChange={(e) => setBookingDates({ ...bookingDates, checkInDate: e.target.value })} />
                </FormField>
                <FormField label="Departure" required>
                  <TextInput type="date" required value={bookingDates.checkOutDate} onChange={(e) => setBookingDates({ ...bookingDates, checkOutDate: e.target.value })} />
                </FormField>
              </div>

              <div className="rounded-2xl border border-[#e7ebe8] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">Guests in this booking</div>
                  <Button size="sm" type="button" variant="outline" onClick={() => setPeople((p) => [...p, { ...emptyPerson, key: uid() }])}>
                    <Plus size={13} /> Add guest
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {people.map((p, i) => (
                    <div key={p.key} className="rounded-xl border border-[#eef1ee] bg-[#fbfcfa] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, mode: 'existing' } : x)))} className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${p.mode === 'existing' ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
                            Existing
                          </button>
                          <button type="button" onClick={() => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, mode: 'new' } : x)))} className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${p.mode === 'new' ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
                            New guest
                          </button>
                        </div>
                        {people.length > 1 && (
                          <button type="button" onClick={() => setPeople((arr) => arr.filter((x) => x.key !== p.key))} className="text-[#b23a3a]">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {p.mode === 'existing' ? (
                        <div className="mt-2">
                          <FormField label={`Person ${i + 1}`}>
                            <SelectInput value={p.guestId} onChange={(e) => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, guestId: e.target.value } : x)))}>
                              <option value="">Select guest</option>
                              {guests.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.firstName} {g.lastName}
                                  {g.phone ? ` · ${g.phone}` : ''}
                                </option>
                              ))}
                            </SelectInput>
                          </FormField>
                        </div>
                      ) : (
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <FormField label={`First name · Person ${i + 1}`}>
                            <TextInput value={p.firstName} onChange={(e) => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, firstName: e.target.value } : x)))} placeholder="First name" />
                          </FormField>
                          <FormField label="Last name">
                            <TextInput value={p.lastName} onChange={(e) => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, lastName: e.target.value } : x)))} placeholder="Last name" />
                          </FormField>
                          <FormField label="Phone">
                            <TextInput value={p.phone} onChange={(e) => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, phone: e.target.value } : x)))} placeholder="+233 …" />
                          </FormField>
                          <FormField label="Email">
                            <TextInput type="email" value={p.email} onChange={(e) => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, email: e.target.value } : x)))} placeholder="guest@example.com" />
                          </FormField>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#e7ebe8] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">Rooms in this booking</div>
                  <Button size="sm" type="button" variant="outline" onClick={() => setRoomLines((l) => [...l, emptyRoomLine(people[0]?.key || '')])}>
                    <Plus size={13} /> Add room
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {roomLines.map((line, i) => {
                    const taken = roomLines.filter((x) => x.key !== line.key).map((x) => x.roomId);
                    return (
                      <div key={line.key} className="rounded-xl border border-[#eef1ee] bg-[#fbfcfa] p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-extrabold text-[#20343e]">Room {i + 1}</div>
                          {roomLines.length > 1 && (
                            <button type="button" onClick={() => setRoomLines((arr) => arr.filter((x) => x.key !== line.key))} className="text-[#b23a3a]">
                              <Minus size={14} />
                            </button>
                          )}
                        </div>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <FormField label="Room" required>
                            <SelectInput required value={line.roomId} onChange={(e) => setRoomLines((arr) => arr.map((x) => (x.key === line.key ? { ...x, roomId: e.target.value } : x)))}>
                              <option value="">Select room</option>
                              {bookableRooms
                                .filter((r) => !taken.includes(r.id))
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    Room {r.number} · {r.roomType?.name || 'Room'} ({Number(r.roomType?.basePrice || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })})
                                  </option>
                                ))}
                            </SelectInput>
                          </FormField>
                          <FormField label="Primary guest (this room)" required>
                            <SelectInput required value={line.primaryKey} onChange={(e) => setRoomLines((arr) => arr.map((x) => (x.key === line.key ? { ...x, primaryKey: e.target.value } : x)))}>
                              <option value="">Select person</option>
                              {people.map((p, pi) => (
                                <option key={p.key} value={p.key}>
                                  Person {pi + 1} — {p.mode === 'existing' ? guests.find((g) => g.id === p.guestId) ? `${guests.find((g) => g.id === p.guestId).firstName} ${guests.find((g) => g.id === p.guestId).lastName}` : 'guest not chosen' : p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : 'new guest'}
                                </option>
                              ))}
                            </SelectInput>
                          </FormField>
                          <FormField label="Adults">
                            <TextInput type="number" min="1" value={line.adults} onChange={(e) => setRoomLines((arr) => arr.map((x) => (x.key === line.key ? { ...x, adults: e.target.value } : x)))} />
                          </FormField>
                          <FormField label="Children">
                            <TextInput type="number" min="0" value={line.children} onChange={(e) => setRoomLines((arr) => arr.map((x) => (x.key === line.key ? { ...x, children: e.target.value } : x)))} />
                          </FormField>
                        </div>
                        <FormField label="Additional guests sharing this room">
                          {people.length === 0 ? (
                            <p className="text-xs text-[#8a9598]">Add guests above first.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {people
                                .filter((p) => p.key !== line.primaryKey)
                                .map((p, pi) => {
                                  const active = line.additionalKeys.includes(p.key);
                                  const label = p.mode === 'existing' ? guestName(guests.find((g) => g.id === p.guestId)) : p.firstName || `Person ${pi + 1}`;
                                  return (
                                    <button
                                      key={p.key}
                                      type="button"
                                      onClick={() =>
                                        setRoomLines((arr) =>
                                          arr.map((x) =>
                                            x.key === line.key
                                              ? { ...x, additionalKeys: active ? x.additionalKeys.filter((k) => k !== p.key) : [...x.additionalKeys, p.key] }
                                              : x,
                                          ),
                                        )
                                      }
                                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${active ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}
                                    >
                                      {label || 'Person'}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </FormField>
                      </div>
                    );
                  })}
                  {roomLines.length === 0 && (
                    <button type="button" onClick={() => setRoomLines((l) => [...l, emptyRoomLine(people[0]?.key || '')])} className="w-full rounded-xl border border-dashed border-[#dfe4e0] py-6 text-xs font-bold text-[#8a9598] hover:border-[#174b59] hover:text-[#174b59]">
                      + Add the first room
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-[#e7ebe8] p-4">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setGuestMode('existing')} className={`rounded-xl px-3 py-2 text-[10px] font-extrabold ${guestMode === 'existing' ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
                    Select existing guest
                  </button>
                  <button type="button" onClick={() => setGuestMode('new')} className={`rounded-xl px-3 py-2 text-[10px] font-extrabold ${guestMode === 'new' ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
                    Enter new guest details
                  </button>
                </div>
                {guestMode === 'existing' ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <FormField label="Find existing guest">
                      <TextInput value={guestFilter} onChange={(e) => setGuestFilter(e.target.value)} placeholder="Search by name, phone or email…" />
                    </FormField>
                    <FormField label="Guest" required>
                      <SelectInput required value={form.guestId} onChange={(e) => setForm({ ...form, guestId: e.target.value })}>
                        <option value="">Select guest</option>
                        {filteredGuests.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.firstName} {g.lastName}
                            {g.phone ? ` · ${g.phone}` : ''}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <FormField label="First name" required>
                      <TextInput required value={newGuest.firstName} onChange={(e) => setNewGuest({ ...newGuest, firstName: e.target.value })} placeholder="New guest first name" />
                    </FormField>
                    <FormField label="Last name" required>
                      <TextInput required value={newGuest.lastName} onChange={(e) => setNewGuest({ ...newGuest, lastName: e.target.value })} placeholder="New guest last name" />
                    </FormField>
                    <FormField label="Phone">
                      <TextInput value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="+233 …" />
                    </FormField>
                    <FormField label="Email">
                      <TextInput type="email" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} placeholder="guest@example.com" />
                    </FormField>
                  </div>
                )}
                <div className="mt-4">
                  <FormField label="Additional guests sharing this room">
                    {guests.length === 0 ? (
                      <p className="text-xs text-[#8a9598]">No guests in the directory yet.</p>
                    ) : (
                      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                        {guests.filter((g) => g.id !== form.guestId).map((g) => {
                          const active = form.additionalGuestIds.includes(g.id);
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => toggleFormGuest(g.id)}
                              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${active ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}
                            >
                              {g.firstName} {g.lastName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </FormField>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Room" required>
                  <SelectInput required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                    <option value="">Select room</option>
                    {bookableRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.number} · {r.roomType?.name || 'Room'} ({Number(r.roomType?.basePrice || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })})
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Adults" required>
                  <TextInput type="number" min="1" required value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Arrival" required>
                  <TextInput type="date" required value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} />
                </FormField>
                <FormField label="Departure" required>
                  <TextInput type="date" required value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} />
                </FormField>
              </div>
            </>
          )}

          <div className="rounded-2xl bg-[#f7f8f6] p-4 text-[11px] leading-5 text-[#778286]">
            Availability and pricing must be validated by the server. The client does not reserve a room until the API confirms the booking.
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>
              {multi ? 'Book party' : guestMode === 'new' ? 'Create guest & reserve' : 'Create reservation'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title={manageRes ? `Guests on ${manageRes.confirmationNo || 'reservation'}` : 'Manage guests'} size="lg">
        <div className="space-y-5">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">Currently on the reservation</div>
            <div className="mt-2 space-y-1.5">
              {(manageRes?.guests?.length ? [...manageRes.guests].sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary)) : []).map((g: any) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border border-[#eef1ee] bg-[#fbfcfa] px-3 py-2 text-xs">
                  <span className={g.isPrimary ? 'font-extrabold text-[#20343e]' : 'text-[#667278]'}>
                    {guestName(g.guest)} {g.isPrimary && <span className="ml-1 rounded-md bg-[#eef3f0] px-1.5 py-0.5 text-[9px] font-extrabold text-[#174b59]">PRIMARY</span>}
                  </span>
                  <span className="text-[10px] text-[#8a9598]">{g.guest?.phone || g.guest?.email || ''}</span>
                </div>
              ))}
              {(!manageRes?.guests || manageRes.guests.length === 0) && <p className="text-xs text-[#8a9598]">No guests attached yet.</p>}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">Add more guests</div>
            <div className="mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {guests.filter((g) => !guestAttached(g)).length === 0 ? (
                <p className="text-xs text-[#8a9598]">All guests are already on this reservation.</p>
              ) : (
                guests
                  .filter((g) => !guestAttached(g))
                  .map((g) => {
                    const active = manageIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setManageIds((ids) => (active ? ids.filter((x) => x !== g.id) : [...ids, g.id]))}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${active ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}
                      >
                        {g.firstName} {g.lastName}
                      </button>
                    );
                  })
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setManageOpen(false)}>Close</Button>
            <Button type="button" loading={saving} onClick={() => void saveManageGuests()} disabled={manageIds.length === 0}>
              Add {manageIds.length > 0 ? `${manageIds.length} guest${manageIds.length === 1 ? '' : 's'}` : 'guests'}
            </Button>
          </div>
        </div>
      </Modal>
    </ShellPage>
  );
};

export default ReservationsPage;
