import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomsApi, reservationsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { BedDouble, Plus, RefreshCw, Pencil, Trash2, Layers, CalendarDays, X, User, CheckCircle2 } from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
import { formatCurrency } from '@nslv/shared';

const statuses = ['ALL', 'AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE'];

const emptyForm = { number: '', roomTypeId: '', floor: '', notes: '' };
const emptyTypeForm = { name: '', description: '', basePrice: '', maxAdults: '2', maxChildren: '0', amenityIds: [] as string[] };
const guestName = (g: any) => (g ? `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim() || '—' : '—');

export const RoomsPage: React.FC = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [status, setStatus] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [typeOpen, setTypeOpen] = useState(false);
  const [typeSaving, setTypeSaving] = useState(false);
  const [editingType, setEditingType] = useState<any | null>(null);
  const [typeForm, setTypeForm] = useState(emptyTypeForm);

  const canManage = useAuthStore((s) => s.hasPermission('rooms.manage'));
  const canStatus = useAuthStore((s) => s.hasPermission('rooms.status'));
  const canReservations = useAuthStore((s) => s.hasPermission('reservations.view'));

  const load = async () => {
    try {
      setLoading(true);
      const [r, t, a, res] = await Promise.all([
        roomsApi.getRooms({ search: q || undefined }),
        roomsApi.getRoomTypes(),
        roomsApi.getAmenities(),
        canReservations ? reservationsApi.list().catch(() => ({ success: true, data: [] })) : Promise.resolve({ success: true, data: [] }),
      ]);
      setRooms(r.data || []);
      setTypes(t.data || []);
      setAmenities(a.data || []);
      setReservations(res.data || []);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load rooms');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [q]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({ number: r.number, roomTypeId: r.roomTypeId, floor: r.floor != null ? String(r.floor) : '', notes: r.notes || '' });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...form,
        floor: form.floor === '' ? (editing ? null : undefined) : Number(form.floor),
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        await roomsApi.updateRoom(editing.id, payload);
      } else {
        await roomsApi.createRoom(payload);
      }
      showToast('success', editing ? 'Room updated' : 'Room created');
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to save room');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: any) => {
    if (!window.confirm(`Delete Room ${r.number}? This cannot be undone.`)) return;
    try {
      setSaving(true);
      await roomsApi.deleteRoom(r.id);
      showToast('success', 'Room deleted');
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to delete room');
    } finally {
      setSaving(false);
    }
  };

  const setRoomStatus = async (r: any, next: string) => {
    if (next === r.status) return;
    try {
      await roomsApi.updateStatus(r.id, next);
      showToast('success', `Room ${r.number} marked ${next.replaceAll('_', ' ')}`);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to update room status');
    }
  };

  const syncBookingStatuses = async () => {
    try {
      setSaving(true);
      const result = await roomsApi.syncBookingStatuses();
      showToast('success', `Booking states synced: ${result.data.reserved} reserved, ${result.data.occupied} occupied`);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to sync booking states');
    } finally {
      setSaving(false);
    }
  };

  const getRoomDateState = (r: any) => {
    if (!dateFilter) {
      return { effectiveStatus: r.status || 'AVAILABLE', activeReservation: null };
    }

    const roomReservations = reservations.filter((res: any) =>
      res.roomId === r.id &&
      !['CANCELLED', 'NO_SHOW'].includes(String(res.status).toUpperCase())
    );

    const matchingRes = roomReservations.find((res: any) => {
      const cin = String(res.checkInDate).slice(0, 10);
      const cout = String(res.checkOutDate).slice(0, 10);
      if (endDateFilter && endDateFilter > dateFilter) {
        return cin < endDateFilter && cout > dateFilter;
      }
      return cin <= dateFilter && dateFilter <= cout;
    });

    if (matchingRes) {
      const eff = String(matchingRes.status).toUpperCase() === 'CHECKED_IN' ? 'OCCUPIED' : 'RESERVED';
      return { effectiveStatus: eff, activeReservation: matchingRes };
    }

    if (['MAINTENANCE', 'OUT_OF_SERVICE'].includes(r.status)) {
      return { effectiveStatus: r.status, activeReservation: null };
    }

    return { effectiveStatus: 'AVAILABLE', activeReservation: null };
  };

  const roomStates = new Map<string, { effectiveStatus: string; activeReservation: any }>();
  rooms.forEach((r) => {
    roomStates.set(r.id, getRoomDateState(r));
  });

  const counts = Object.fromEntries(
    statuses.slice(1).map((s) => [
      s,
      rooms.filter((r) => (roomStates.get(r.id)?.effectiveStatus || r.status) === s).length,
    ])
  );

  const displayRooms = rooms.filter((r) => {
    if (status === 'ALL') return true;
    const eff = roomStates.get(r.id)?.effectiveStatus || r.status;
    return eff === status;
  });

  const openAddType = () => {
    setEditingType(null);
    setTypeForm(emptyTypeForm);
    setTypeOpen(true);
  };

  const openEditType = (t: any) => {
    setEditingType(t);
    setTypeForm({
      name: t.name,
      description: t.description || '',
      basePrice: String(t.basePrice ?? ''),
      maxAdults: String(t.maxAdults ?? 2),
      maxChildren: String(t.maxChildren ?? 0),
      amenityIds: (t.amenities || []).map((x: any) => x.amenityId),
    });
    setTypeOpen(true);
  };

  const toggleAmenity = (id: string) =>
    setTypeForm((f) => ({
      ...f,
      amenityIds: f.amenityIds.includes(id) ? f.amenityIds.filter((x) => x !== id) : [...f.amenityIds, id],
    }));

  const saveType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTypeSaving(true);
      const body = {
        name: typeForm.name,
        description: typeForm.description || undefined,
        basePrice: Number(typeForm.basePrice),
        maxAdults: Number(typeForm.maxAdults),
        maxChildren: Number(typeForm.maxChildren),
        amenityIds: typeForm.amenityIds,
      };
      if (editingType) await roomsApi.updateRoomType(editingType.id, body);
      else await roomsApi.createRoomType(body);
      showToast('success', editingType ? 'Room type updated' : 'Room type created');
      setTypeOpen(false);
      setEditingType(null);
      setTypeForm(emptyTypeForm);
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to save room type');
    } finally {
      setTypeSaving(false);
    }
  };

  const removeType = async (t: any) => {
    const used = t._count?.rooms || 0;
    const msg =
      used > 0
        ? `Room type "${t.name}" is used by ${used} room(s). It will be deactivated (hidden) instead of deleted so existing rooms stay valid. Continue?`
        : `Delete room type "${t.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      setTypeSaving(true);
      await roomsApi.deleteRoomType(t.id);
      showToast('success', used > 0 ? 'Room type deactivated' : 'Room type deleted');
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to delete room type');
    } finally {
      setTypeSaving(false);
    }
  };

  return (
    <ShellPage
      eyebrow="FRONT OFFICE · ROOMS"
      title="Room inventory"
      subtitle="See the property at a glance, change room state and keep availability operationally accurate."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate('/reservations')}>
            <CalendarDays size={14} /> View reservations
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
          {canStatus && (
            <Button variant="outline" size="sm" loading={saving} onClick={syncBookingStatuses}>
              <RefreshCw size={14} /> Sync booking states
            </Button>
          )}
          {canManage && (
            <Button size="sm" onClick={() => navigate('/admin/rooms')}>
              <Layers size={14} /> Manage Room Configuration
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <StatTile label="Total" value={rooms.length} icon={BedDouble} />
        {statuses.slice(1).map((s) => (
          <StatTile
            key={s}
            label={s.replaceAll('_', ' ')}
            value={counts[s] || 0}
            note={dateFilter ? 'On selected date' : undefined}
          />
        ))}
      </div>
      <Section title="Room board" subtitle={dateFilter ? `Availability on ${new Date(dateFilter + 'T00:00:00').toLocaleDateString()}` : 'Live room state from the property database'}>
        <Toolbar search={q} onSearch={setQ} placeholder="Search room number…">
          {/* Prominent Date Availability Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center rounded-xl border border-[#dfe4e1] bg-white px-2.5 h-10 shadow-sm focus-within:border-[#16a4d4] focus-within:ring-1 focus-within:ring-[#16a4d4]">
              <CalendarDays size={14} className="text-[#16a4d4] mr-2 flex-shrink-0" />
              <label htmlFor="roomDateFilter" className="text-[11px] font-bold text-[#657278] mr-2 whitespace-nowrap cursor-pointer">
                Filter date:
              </label>
              <input
                id="roomDateFilter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border-0 bg-transparent text-xs font-semibold text-[#1f2d33] focus:outline-none focus:ring-0 p-0 cursor-pointer"
                title="Filter room availability by date"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => { setDateFilter(''); setEndDateFilter(''); }}
                  className="ml-2 rounded-full p-1 text-[#8a9598] hover:bg-[#f0f3f2] hover:text-[#e04f4f]"
                  title="Clear date filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {dateFilter && (
              <div className="flex items-center rounded-xl border border-[#dfe4e1] bg-white px-2.5 h-10 shadow-sm focus-within:border-[#16a4d4]">
                <span className="text-[11px] font-bold text-[#657278] mr-1.5 whitespace-nowrap">to:</span>
                <input
                  type="date"
                  min={dateFilter}
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="border-0 bg-transparent text-xs font-semibold text-[#1f2d33] focus:outline-none focus:ring-0 p-0 cursor-pointer"
                  title="Optional departure date for stay range"
                />
                {endDateFilter && (
                  <button
                    type="button"
                    onClick={() => setEndDateFilter('')}
                    className="ml-1 text-[#8a9598] hover:text-[#e04f4f]"
                    title="Clear departure date"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                if (dateFilter === today && !endDateFilter) {
                  setDateFilter('');
                } else {
                  setDateFilter(today);
                  setEndDateFilter('');
                }
              }}
              className={`h-10 px-3 rounded-xl border text-xs font-bold transition ${
                dateFilter === new Date().toISOString().slice(0, 10) && !endDateFilter
                  ? 'border-[#16a4d4] bg-[#16a4d4] text-white shadow-sm'
                  : 'border-[#dfe4e1] bg-white text-[#4a555a] hover:border-[#16a4d4] hover:text-[#16a4d4]'
              }`}
              title="Check room availability today"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                const tomorrow = d.toISOString().slice(0, 10);
                if (dateFilter === tomorrow && !endDateFilter) {
                  setDateFilter('');
                } else {
                  setDateFilter(tomorrow);
                  setEndDateFilter('');
                }
              }}
              className={`h-10 px-3 rounded-xl border text-xs font-bold transition ${
                dateFilter === new Date(Date.now() + 86400000).toISOString().slice(0, 10) && !endDateFilter
                  ? 'border-[#16a4d4] bg-[#16a4d4] text-white shadow-sm'
                  : 'border-[#dfe4e1] bg-white text-[#4a555a] hover:border-[#16a4d4] hover:text-[#16a4d4]'
              }`}
              title="Check room availability tomorrow"
            >
              Tomorrow
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide ${
                  status === s ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'
                }`}
              >
                {s.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        </Toolbar>

        {/* Active Date Availability Banner */}
        {dateFilter && (
          <div className="flex items-center justify-between border-b border-[#e1e9e7] bg-[#edf6f8] px-5 py-2.5 text-xs text-[#176274]">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-[#16a4d4]" />
              <span>
                Showing room availability for{' '}
                <strong className="font-bold text-[#0c404d]">
                  {new Date(dateFilter + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {endDateFilter ? ` → ${new Date(endDateFilter + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}` : ''}
                </strong>
                {' '}— <span className="font-semibold">{counts.AVAILABLE || 0} Available</span>,{' '}
                <span className="font-semibold">{counts.RESERVED || 0} Reserved</span>
                {(counts.OCCUPIED || 0) > 0 && <span className="font-semibold">, {counts.OCCUPIED} Occupied</span>}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setDateFilter(''); setEndDateFilter(''); }}
              className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-[#16a4d4] hover:bg-[#dbeef4] border border-[#b8dde6]"
            >
              <X size={12} /> Clear date filter
            </button>
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : displayRooms.length === 0 ? (
          <div className="p-5">
            <div className="rounded-2xl border border-dashed border-[#dfe4e0] p-12 text-center">
              <CalendarDays className="mx-auto text-[#a0aaad]" size={28} />
              <h3 className="mt-3 text-sm font-extrabold text-[#20343e]">
                {dateFilter ? `No ${status === 'ALL' ? '' : status.toLowerCase().replaceAll('_', ' ') + ' '}rooms on selected date` : 'No rooms found'}
              </h3>
              <p className="mt-1 text-xs text-[#899397]">
                {dateFilter ? 'Try clearing the date filter or selecting a different status filter.' : 'No rooms match your search query.'}
              </p>
              {(dateFilter || status !== 'ALL' || q) && (
                <button
                  type="button"
                  onClick={() => { setDateFilter(''); setEndDateFilter(''); setStatus('ALL'); setQ(''); }}
                  className="mt-4 rounded-xl bg-[#16a4d4] px-4 py-2 text-[11px] font-extrabold text-white hover:bg-[#138db8]"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayRooms.map((r) => {
              const { effectiveStatus, activeReservation } = roomStates.get(r.id) || {
                effectiveStatus: r.status || 'AVAILABLE',
                activeReservation: null,
              };
              return (
                <div key={r.id} className="group rounded-[20px] border border-[#e7ebe8] bg-[#fbfcfa] p-4 transition hover:-translate-y-0.5 hover:border-[#cfd8d3] hover:bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xl font-extrabold tracking-tight text-[#20343e]">Room {r.number}</div>
                        <div className="mt-1 text-[10px] text-[#8a9598]">
                          {r.roomType?.name || 'Room type'}
                          {r.roomType?.basePrice != null ? ` · GH₵ ${r.roomType.basePrice}/night` : ''}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {statusBadge(effectiveStatus)}
                        {dateFilter && effectiveStatus !== r.status && (
                          <span className="text-[9px] text-[#8a9598]" title="Physical database condition">
                            Live: {r.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date-specific reservation card */}
                    {dateFilter && activeReservation && (
                      <div className="mt-3 rounded-xl border border-[#bee3ec] bg-[#f0f8fa] p-2.5 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-[#0e7490]">
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            <User size={12} className="flex-shrink-0" />
                            {guestName(activeReservation.guests?.[0]?.guest)}
                          </span>
                          <span className="font-mono text-[10px] text-[#0e7490] flex-shrink-0">
                            {activeReservation.confirmationNo || activeReservation.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-[#537780]">
                          Stay: {new Date(activeReservation.checkInDate).toLocaleDateString()} → {new Date(activeReservation.checkOutDate).toLocaleDateString()}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/reservations')}
                          className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-[#16a4d4] hover:underline"
                        >
                          View in reservations →
                        </button>
                      </div>
                    )}

                    {/* Available badge on selected date */}
                    {dateFilter && !activeReservation && effectiveStatus === 'AVAILABLE' && (
                      <div className="mt-3 rounded-xl border border-[#d6ebd9] bg-[#f4fbf5] px-2.5 py-1.5 text-[11px] font-medium text-[#2d7738] flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-[#2d7738] flex-shrink-0" />
                        <span>Available on this date</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-[#e9ecea] pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#8a9598]">{r.floor != null ? `Floor ${r.floor}` : 'Floor not set'}</span>
                      <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                        {canManage && (
                          <>
                            <button onClick={() => openEdit(r)} className="text-[10px] font-extrabold text-[#16a4d4]" title="Edit room">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => remove(r)} className="text-[10px] font-extrabold text-[#b23a3a]" title="Delete room">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {canStatus && (
                      <label className="flex items-center gap-2">
                        <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#8a9598]">Condition</span>
                        <SelectInput
                          value={r.status || 'AVAILABLE'}
                          onChange={(e) => void setRoomStatus(r, e.target.value)}
                          className="h-8 flex-1 text-[10px]"
                        >
                          {statuses.slice(1).map((s) => (
                            <option key={s} value={s} disabled={s === 'RESERVED' || s === 'OCCUPIED'}>
                              {s.replaceAll('_', ' ')}
                            </option>
                          ))}
                        </SelectInput>
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
      <Section
        title="Room types"
        subtitle="Define the property's room categories, pricing and included amenities."
        action={
          canManage && (
            <Button size="sm" onClick={openAddType}>
              <Plus size={14} /> Add type
            </Button>
          )
        }
      >
        {loading ? (
          <LoadingState />
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {types.map((t) => {
              const roomsCount = t._count?.rooms ?? rooms.filter((r) => r.roomTypeId === t.id).length;
              return (
                <div key={t.id} className="group rounded-[20px] border border-[#e7ebe8] bg-[#fbfcfa] p-4 transition hover:-translate-y-0.5 hover:border-[#cfd8d3] hover:bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 rounded-xl bg-[#e5f0f2] p-2 text-[#16a4d4]">
                        <Layers size={15} />
                      </div>
                      <div>
                        <div className="font-extrabold tracking-tight text-[#20343e]">{t.name}</div>
                        <div className="mt-0.5 text-[10px] text-[#8a9598]">
                          {formatCurrency(t.basePrice)}/night · {t.maxAdults} adults, {t.maxChildren} children
                        </div>
                      </div>
                    </div>
                    {!t.isActive && (
                      <span className="rounded-full bg-[#f3e3c3] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#8a6d1f]">
                        Inactive
                      </span>
                    )}
                  </div>
                  {t.description && <p className="mt-3 text-[11px] leading-relaxed text-[#718086]">{t.description}</p>}
                  <div className="mt-4 flex flex-col gap-3 border-t border-[#e9ecea] pt-3">
                    <div className="flex flex-wrap gap-1">
                      {t.amenities?.length ? (
                        t.amenities.map((a: any) => (
                          <span key={a.amenityId} className="rounded-lg bg-[#e5f0f2] px-2 py-0.5 text-[9px] font-bold text-[#16a4d4]">
                            {a.amenity?.name || 'Amenity'}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[#8a9598]">No amenities</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#8a9598]">
                        {roomsCount} room{roomsCount === 1 ? '' : 's'}
                      </span>
                      {canManage && (
                        <div className="flex gap-2">
                          <button onClick={() => openEditType(t)} className="text-[10px] font-extrabold text-[#16a4d4]" title="Edit type">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => removeType(t)} className="text-[10px] font-extrabold text-[#b23a3a]" title="Delete type">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {types.length === 0 && (
              <p className="text-sm text-[#8a9598]">No room types yet. Add one to start assigning rooms.</p>
            )}
          </div>
        )}
      </Section>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit Room ${editing.number}` : 'Add room'}>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Room number" required>
            <TextInput required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          </FormField>
          <FormField label="Room type" required>
            <SelectInput required value={form.roomTypeId} onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}>
              <option value="">Select type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Floor">
              <TextInput value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            </FormField>
            <FormField label="Notes">
              <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create room'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={typeOpen} onClose={() => setTypeOpen(false)} title={editingType ? `Edit ${editingType.name}` : 'Add room type'}>
        <form onSubmit={saveType} className="space-y-4">
          <FormField label="Type name" required>
            <TextInput required value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} />
          </FormField>
          <FormField label="Description">
            <TextInput value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Base price (GH₵)" required>
              <TextInput
                required
                type="number"
                min="1"
                step="0.01"
                value={typeForm.basePrice}
                onChange={(e) => setTypeForm({ ...typeForm, basePrice: e.target.value })}
              />
            </FormField>
            <FormField label="Max adults" required>
              <TextInput
                required
                type="number"
                min="0"
                value={typeForm.maxAdults}
                onChange={(e) => setTypeForm({ ...typeForm, maxAdults: e.target.value })}
              />
            </FormField>
            <FormField label="Max children" required>
              <TextInput
                required
                type="number"
                min="0"
                value={typeForm.maxChildren}
                onChange={(e) => setTypeForm({ ...typeForm, maxChildren: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Amenities">
            {amenities.length === 0 ? (
              <p className="text-xs text-[#8a9598]">No amenities configured yet.</p>
            ) : (
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-[#e7ebe8] bg-white p-2.5">
                {amenities.map((a) => {
                  const active = typeForm.amenityIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                        active ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-[#fbfcfa] text-[#718086]'
                      }`}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            )}
          </FormField>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" type="button" onClick={() => setTypeOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={typeSaving}>
              {typeSaving ? 'Saving…' : editingType ? 'Save changes' : 'Create type'}
            </Button>
          </div>
        </form>
      </Modal>
    </ShellPage>
  );
};

export default RoomsPage;
