import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomsApi, reservationsApi } from '../../services/apiService';
import { clearGetCache } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import {
  BedDouble,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Layers,
  CalendarDays,
  X,
  User,
  Users,
  CheckCircle2,
  Sparkles,
  Search,
  Filter,
  SlidersHorizontal,
  DoorOpen,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
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
    const roomReservations = reservations
      .filter((res: any) => {
        const matchRoom = (res.roomId && res.roomId === r.id) || (res.room?.id && res.room.id === r.id);
        const activeStatus = !['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(String(res.status).toUpperCase());
        return matchRoom && activeStatus;
      })
      .sort((a: any, b: any) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime());

    const today = new Date().toISOString().slice(0, 10);

    if (dateFilter) {
      const matchingRes = roomReservations.find((res: any) => {
        if (['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(String(res.status).toUpperCase())) return false;
        const cin = String(res.checkInDate).slice(0, 10);
        const cout = String(res.checkOutDate).slice(0, 10);
        if (endDateFilter && endDateFilter > dateFilter) {
          return cin < endDateFilter && cout > dateFilter;
        }
        return cin <= dateFilter && dateFilter < cout;
      });

      if (matchingRes) {
        const eff = String(matchingRes.status).toUpperCase() === 'CHECKED_IN' ? 'OCCUPIED' : 'RESERVED';
        return { effectiveStatus: eff, activeReservation: matchingRes, upcomingReservation: null };
      }

      if (['MAINTENANCE', 'OUT_OF_SERVICE'].includes(r.status)) {
        return { effectiveStatus: r.status, activeReservation: null, upcomingReservation: null };
      }

      return { effectiveStatus: 'AVAILABLE', activeReservation: null, upcomingReservation: null };
    }

    // Default view (today):
    const inHouseRes = roomReservations.find((res: any) => String(res.status).toUpperCase() === 'CHECKED_IN');
    if (inHouseRes) {
      return { effectiveStatus: 'OCCUPIED', activeReservation: inHouseRes, upcomingReservation: null };
    }

    const activeResToday = roomReservations.find((res: any) => {
      if (['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(String(res.status).toUpperCase())) return false;
      const cin = String(res.checkInDate).slice(0, 10);
      const cout = String(res.checkOutDate).slice(0, 10);
      return cin <= today && today < cout;
    });

    if (activeResToday) {
      return { effectiveStatus: 'RESERVED', activeReservation: activeResToday, upcomingReservation: null };
    }

    const upcomingRes = roomReservations.find((res: any) => {
      if (['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(String(res.status).toUpperCase())) return false;
      const cin = String(res.checkInDate).slice(0, 10);
      return cin > today;
    });

    if (['MAINTENANCE', 'OUT_OF_SERVICE', 'DIRTY', 'CLEANING'].includes(r.status)) {
      return { effectiveStatus: r.status, activeReservation: null, upcomingReservation: upcomingRes };
    }

    return { effectiveStatus: 'AVAILABLE', activeReservation: null, upcomingReservation: upcomingRes };
  };

  const roomStates = new Map<string, { effectiveStatus: string; activeReservation: any }>();
  rooms.forEach((r) => {
    roomStates.set(r.id, getRoomDateState(r));
  });

  const counts = Object.fromEntries(
    statuses.slice(1).map((s) => [
      s,
      rooms.filter((r) => (roomStates.get(r.id)?.effectiveStatus || r.status) === s).length,
    ]),
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
        ? `Room type "${t.name}" is used by ${used} room(s). It will be deactivated instead of deleted. Continue?`
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
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* ── Compact Header ── */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <BedDouble size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>
              Room Board & Inventory
            </h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>
              Real-time statuses, reservations & housekeeping
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reservations')}
            className="border-[var(--ns-glass-line)] ns-glass-hover glass text-[var(--ns-ink)] shadow-xs text-[11px] font-semibold gap-1.5"
          >
            <CalendarDays size={12} className="text-[var(--ns-teal)]" /> Reservations
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clearGetCache(); void load(); }}
            className="border-[var(--ns-glass-line)] ns-glass-hover glass text-[var(--ns-ink)] shadow-xs text-[11px] font-semibold gap-1.5"
          >
            <RefreshCw size={12} /> Refresh
          </Button>
          {canStatus && (
            <Button
              variant="outline"
              size="sm"
              loading={saving}
              onClick={syncBookingStatuses}
              className="border-[var(--ns-glass-line)] ns-glass-hover glass text-[var(--ns-ink)] shadow-xs text-[11px] font-semibold gap-1.5"
            >
              <RefreshCw size={12} className="text-[var(--ns-gold)]" /> Sync
            </Button>
          )}
          {canManage && (
            <Button
              size="sm"
              onClick={() => navigate('/admin/rooms')}
              className="glass text-[var(--ns-teal)] shadow-md text-[11px] font-bold gap-1.5 ns-glass-hover"
            >
              <Layers size={12} /> Config
            </Button>
          )}
        </div>
      </div>

      {/* ── Status Counts Ribbon ── */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setStatus('ALL')}
          className={`glass-subtle ns-glass-hover rounded-xl px-4 py-2.5 text-left border transition-all shrink-0 ${
            status === 'ALL'
              ? 'glass text-[var(--ns-ink)] border-[var(--ns-gold)] shadow-xs ns-glass-selected'
              : 'border-[var(--ns-glass-line)] hover:border-[var(--ns-teal)] text-[var(--ns-ink)]'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>All</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{rooms.length}</div>
        </button>

        {statuses.slice(1).map((s) => {
          const isSelected = status === s;
          const count = counts[s] || 0;
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`glass-subtle ns-glass-hover rounded-xl px-4 py-2.5 text-left border transition-all shrink-0 ${
                isSelected
                  ? 'glass text-[var(--ns-teal)] border-[var(--ns-gold)] shadow-xs ns-glass-selected'
                  : 'glass border-[var(--ns-glass-line)] hover:border-[var(--ns-teal)] text-[var(--ns-ink)]'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ns-muted)] truncate">
                {s.replaceAll('_', ' ')}
              </div>
              <div className="text-xl font-black mt-0.5 text-[var(--ns-ink)]">{count}</div>
            </button>
          );
        })}
      </div>

      {/* ── Main Room Board Section ── */}
      <div className="rounded-2xl border border-[var(--ns-glass-line)] glass-subtle shadow-xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-[var(--ns-glass-line)] p-4 ns-glass-band gap-3">
          {/* Search */}
          <div className="relative w-full lg:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ns-muted)]" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search room number..."
              className="w-full rounded-xl border border-[var(--ns-glass-line)] glass-input pl-9 pr-3 py-1.5 text-xs text-[var(--ns-ink)] focus:border-[var(--ns-teal)] focus:outline-none placeholder-[var(--ns-muted)]"
            />
          </div>

          {/* Date Filter & Fast Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-xl border border-[var(--ns-glass-line)] glass-subtle px-3 py-1.5 shadow-xs">
              <CalendarDays size={14} className="text-[var(--ns-teal)] mr-2 shrink-0" />
              <label htmlFor="roomDateFilter" className="text-[11px] font-bold text-[var(--ns-muted)] mr-2 whitespace-nowrap cursor-pointer">
                Filter Date:
              </label>
              <input
                id="roomDateFilter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border-0 bg-transparent text-xs font-bold text-[var(--ns-ink)] focus:outline-none p-0 cursor-pointer glass-input"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => { setDateFilter(''); setEndDateFilter(''); }}
                  className="ml-2 text-[var(--ns-muted)] hover:text-[var(--ns-danger)] glass-subtle ns-glass-hover"
                  title="Clear date filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {dateFilter && (
              <div className="flex items-center rounded-xl border border-[var(--ns-glass-line)] glass-subtle px-3 py-1.5 shadow-xs">
                <span className="text-[11px] font-bold text-[var(--ns-muted)] mr-2 whitespace-nowrap">To:</span>
                <input
                  type="date"
                  min={dateFilter}
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="border-0 bg-transparent text-xs font-bold text-[var(--ns-ink)] focus:outline-none p-0 cursor-pointer glass-input"
                />
                {endDateFilter && (
                  <button
                    type="button"
                    onClick={() => setEndDateFilter('')}
                    className="ml-2 text-[var(--ns-muted)] hover:text-[var(--ns-danger)] glass-subtle ns-glass-hover"
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
              className={`glass-subtle ns-glass-hover px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                dateFilter === new Date().toISOString().slice(0, 10) && !endDateFilter
                  ? 'border-[var(--ns-gold)] glass text-[var(--ns-teal)] ns-glass-selected'
                  : 'border-[var(--ns-glass-line)] glass text-[var(--ns-muted)] hover:border-[var(--ns-glass-line)] hover:text-[var(--ns-ink)]'
              }`}
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
              className={`glass-subtle ns-glass-hover px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                dateFilter === new Date(Date.now() + 86400000).toISOString().slice(0, 10) && !endDateFilter
                  ? 'border-[var(--ns-gold)] glass text-[var(--ns-teal)] ns-glass-selected'
                  : 'border-[var(--ns-glass-line)] glass text-[var(--ns-muted)] hover:border-[var(--ns-glass-line)] hover:text-[var(--ns-ink)]'
              }`}
            >
              Tomorrow
            </button>
          </div>
        </div>

        {/* Active Date Availability Banner */}
        {dateFilter && (
          <div className="flex items-center justify-between border-b border-[var(--ns-info)] ns-glass-band px-6 py-2.5 text-xs text-[var(--ns-info)]">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-[var(--ns-info)]" />
              <span>
                Showing room availability for{' '}
                <strong>
                  {new Date(dateFilter + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {endDateFilter ? ` &rarr; ${new Date(endDateFilter + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}` : ''}
                </strong>
                {' '}| <span className="font-bold text-[var(--ns-success)]">{counts.AVAILABLE || 0} Available</span>,{' '}
                <span className="font-bold text-[var(--ns-warning)]">{counts.RESERVED || 0} Reserved</span>
                {(counts.OCCUPIED || 0) > 0 && <span className="font-bold text-[var(--ns-info)]">, {counts.OCCUPIED} Occupied</span>}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setDateFilter(''); setEndDateFilter(''); }}
              className="flex items-center gap-1 rounded-md glass px-2 py-0.5 text-[11px] font-bold text-[var(--ns-info)] border border-[var(--ns-info)] ns-glass-hover transition-colors"
            >
              <X size={12} /> Clear Filter
            </button>
          </div>
        )}

        {/* Room Cards Grid */}
        {loading ? (
          <LoadingState />
        ) : displayRooms.length === 0 ? (
          <div className="p-12 text-center">
            <BedDouble className="mx-auto text-[var(--ns-muted)]" size={36} />
            <h3 className="mt-3 text-sm font-extrabold text-[var(--ns-ink)]">
              {dateFilter ? `No ${status === 'ALL' ? '' : status.toLowerCase().replaceAll('_', ' ') + ' '}rooms on selected date` : 'No rooms found'}
            </h3>
            <p className="mt-1 text-xs text-[var(--ns-muted)]">
              {dateFilter ? 'Try clearing the date filter or selecting a different status pill.' : 'No rooms match your search query.'}
            </p>
            {(dateFilter || status !== 'ALL' || q) && (
              <button
                type="button"
                onClick={() => { setDateFilter(''); setEndDateFilter(''); setStatus('ALL'); setQ(''); }}
                className="mt-4 rounded-xl glass px-4 py-2 text-xs font-bold text-[var(--ns-teal)] ns-glass-hover"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayRooms.map((r) => {
              const { effectiveStatus, activeReservation, upcomingReservation } = (roomStates.get(r.id) as any) || {
                effectiveStatus: r.status || 'AVAILABLE',
                activeReservation: null,
                upcomingReservation: null,
              };
              return (
                <div
                  key={r.id}
                  className="group rounded-2xl border border-[var(--ns-glass-line)] glass-subtle p-5 shadow-xs hover:border-[var(--ns-teal)] hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Room Number & Status */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-2xl font-black text-[var(--ns-ink)]">Room {r.number}</div>
                        <div className="mt-0.5 text-xs font-medium text-[var(--ns-muted)]">
                          {r.roomType?.name || 'Standard Room'}
                          {r.roomType?.basePrice != null ? ` | GH₵ ${r.roomType.basePrice}/night` : ''}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          {activeReservation?.bookingId && (
                            <span className="rounded-md glass-subtle px-1.5 py-0.5 text-[9px] font-black text-[var(--ns-info)] border border-[var(--ns-info)]">
                              GROUP
                            </span>
                          )}
                          {statusBadge(effectiveStatus)}
                        </div>
                        {dateFilter && effectiveStatus !== r.status && (
                          <span className="text-[9px] text-[var(--ns-muted)] font-medium" title="Physical status">
                            DB: {r.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Available Now Next Guest pill */}
                    {effectiveStatus === 'AVAILABLE' && upcomingReservation && !dateFilter && (
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--ns-success)] glass-subtle px-3 py-1.5 text-[11px] text-[var(--ns-success)]">
                        <span>Available now | Next arrival:</span>
                        <span className="font-black font-mono">
                          {new Date(upcomingReservation.checkInDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}

                    {/* Active reservation banner */}
                    {activeReservation && (
                      <div className="mt-3 rounded-xl border border-[var(--ns-info)] glass-subtle p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-[var(--ns-info)]">
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            {activeReservation.bookingId ? (
                              <Users size={13} className="text-[var(--ns-info)] shrink-0" />
                            ) : (
                              <User size={13} className="text-[var(--ns-info)] shrink-0" />
                            )}
                            {guestName(activeReservation.guests?.[0]?.guest)}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--ns-info)]">
                            {activeReservation.confirmationNo || activeReservation.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--ns-info)]">
                          Stay: {new Date(activeReservation.checkInDate).toLocaleDateString()} &rarr; {new Date(activeReservation.checkOutDate).toLocaleDateString()}
                        </div>
                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <button
                            type="button"
                            onClick={() => navigate('/reservations')}
                            className="font-bold text-[var(--ns-teal)] hover:underline glass-subtle ns-glass-hover"
                          >
                            View Details &rarr;
                          </button>
                          {activeReservation.bookingId && (
                            <span className="text-[9px] font-mono text-[var(--ns-info)]">
                              {activeReservation.bookingId}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Available on selected date */}
                    {dateFilter && !activeReservation && effectiveStatus === 'AVAILABLE' && (
                      <div className="mt-3 rounded-xl border border-[var(--ns-success)] glass-subtle px-3 py-1.5 text-xs font-semibold text-[var(--ns-success)] flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-[var(--ns-success)]" />
                        <span>Ready for reservation on this date</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Floor & Quick Condition */}
                  <div className="mt-5 pt-3 border-t border-[var(--ns-glass-line)] flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs text-[var(--ns-muted)]">
                      <span>{r.floor != null ? `Floor ${r.floor}` : 'Ground Floor'}</span>
                      {canManage && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(r)}
                            className="text-[var(--ns-muted)] hover:text-[var(--ns-teal)] p-1 glass-subtle ns-glass-hover"
                            title="Edit room details"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => remove(r)}
                            className="text-[var(--ns-muted)] hover:text-[var(--ns-danger)] p-1 glass-subtle ns-glass-hover"
                            title="Delete room"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {canStatus && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-[var(--ns-muted)]">Status</span>
                        <SelectInput
                          value={r.status || 'AVAILABLE'}
                          onChange={(e) => void setRoomStatus(r, e.target.value)}
                          className="h-8 flex-1 text-xs glass-input"
                        >
                          {statuses.slice(1).map((s) => (
                            <option key={s} value={s} disabled={s === 'RESERVED' || s === 'OCCUPIED'}>
                              {s.replaceAll('_', ' ')}
                            </option>
                          ))}
                        </SelectInput>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Room Types Management ── */}
      <div className="rounded-2xl border border-[var(--ns-glass-line)] glass-subtle shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-6 py-4 ns-glass-band">
          <div>
            <h2 className="text-sm font-extrabold text-[var(--ns-ink)] flex items-center gap-2">
              <Layers size={16} className="text-[var(--ns-teal)]" />
              Room Types &amp; Pricing Categories
            </h2>
            <p className="text-[11px] text-[var(--ns-muted)] mt-0.5">
              Configured room tiers, base nightly rates, guest capacities, and included amenities.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openAddType} className="glass text-[var(--ns-teal)] text-xs gap-1 ns-glass-hover">
              <Plus size={14} /> Add Category
            </Button>
          )}
        </div>

        {loading ? (
          <LoadingState />
        ) : (
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {types.map((t) => {
              const roomsCount = t._count?.rooms ?? rooms.filter((r) => r.roomTypeId === t.id).length;
              return (
                <div
                  key={t.id}
                  className="rounded-2xl border border-[var(--ns-glass-line)] glass-subtle p-5 shadow-xs hover:border-[var(--ns-teal)] hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-extrabold text-[var(--ns-ink)]">{t.name}</h3>
                        <div className="text-xs font-bold text-[var(--ns-gold)] mt-0.5">
                          {formatCurrency(t.basePrice)} <span className="text-[10px] text-[var(--ns-muted)] font-normal">/ night</span>
                        </div>
                      </div>
                      {!t.isActive && (
                        <span className="rounded-full glass-subtle px-2 py-0.5 text-[9px] font-black text-[var(--ns-warning)] uppercase">
                          Inactive
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-2 text-xs text-[var(--ns-muted)] line-clamp-2 leading-relaxed">{t.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--ns-muted)] font-medium">
                      <span>Max {t.maxAdults} Adults</span>
                      <span className="text-[var(--ns-muted)]">|</span>
                      <span>{t.maxChildren} Children</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {t.amenities?.length ? (
                        t.amenities.map((a: any) => (
                          <span
                            key={a.amenityId}
                            className="rounded-md glass-subtle border border-[var(--ns-glass-line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ns-muted)]"
                          >
                            {a.amenity?.name || 'Amenity'}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[var(--ns-muted)]">No amenities set</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--ns-glass-line)] flex items-center justify-between text-xs text-[var(--ns-muted)]">
                    <span>{roomsCount} room{roomsCount === 1 ? '' : 's'} assigned</span>
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditType(t)} className="text-[var(--ns-muted)] hover:text-[var(--ns-teal)] p-1 glass-subtle ns-glass-hover">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => removeType(t)} className="text-[var(--ns-muted)] hover:text-[var(--ns-danger)] p-1 glass-subtle ns-glass-hover">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit Room Modal ── */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit Room ${editing.number}` : 'Add Room to Inventory'}>
        <form onSubmit={save} className="space-y-4 p-6">
          <FormField label="Room Number" required>
            <TextInput required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="e.g. 101" />
          </FormField>
          <FormField label="Room Type Category" required>
            <SelectInput required value={form.roomTypeId} onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}>
              <option value="">Select type...</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({formatCurrency(t.basePrice)}/night)
                </option>
              ))}
            </SelectInput>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Floor Number">
              <TextInput value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="e.g. 1" />
            </FormField>
            <FormField label="Room Notes">
              <TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Pool view balcony" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--ns-glass-line)]">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="glass text-[var(--ns-teal)] ns-glass-hover">
              {editing ? 'Save Changes' : 'Create Room'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Add / Edit Room Type Modal ── */}
      <Modal open={typeOpen} onClose={() => setTypeOpen(false)} title={editingType ? `Edit Category · ${editingType.name}` : 'Create Room Category'}>
        <form onSubmit={saveType} className="space-y-4 p-6">
          <FormField label="Category Name" required>
            <TextInput required value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="e.g. Executive Deluxe Suite" />
          </FormField>
          <FormField label="Base Nightly Rate (GHS)" required>
            <TextInput required type="number" min="0" step="0.01" value={typeForm.basePrice} onChange={(e) => setTypeForm({ ...typeForm, basePrice: e.target.value })} placeholder="e.g. 450.00" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Max Adults">
              <TextInput type="number" min="1" value={typeForm.maxAdults} onChange={(e) => setTypeForm({ ...typeForm, maxAdults: e.target.value })} />
            </FormField>
            <FormField label="Max Children">
              <TextInput type="number" min="0" value={typeForm.maxChildren} onChange={(e) => setTypeForm({ ...typeForm, maxChildren: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Category Description">
            <TextInput value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} placeholder="Features, bed size, view..." />
          </FormField>
          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--ns-glass-line)]">
            <Button type="button" variant="ghost" onClick={() => setTypeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={typeSaving} className="glass text-[var(--ns-teal)] ns-glass-hover">
              {editingType ? 'Save Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RoomsPage;

