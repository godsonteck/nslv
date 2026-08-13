import React, { useEffect, useState } from 'react';
import { roomsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { BedDouble, Plus, RefreshCw, Pencil, Trash2, Layers } from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
import { formatCurrency } from '@nslv/shared';

const statuses = ['ALL', 'AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE'];

const emptyForm = { number: '', roomTypeId: '', floor: '', notes: '' };
const emptyTypeForm = { name: '', description: '', basePrice: '', maxAdults: '2', maxChildren: '0', amenityIds: [] as string[] };

export const RoomsPage: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [status, setStatus] = useState('ALL');
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

  const load = async () => {
    try {
      setLoading(true);
      const [r, t, a] = await Promise.all([
        roomsApi.getRooms({ status: status === 'ALL' ? undefined : status, search: q || undefined }),
        roomsApi.getRoomTypes(),
        roomsApi.getAmenities(),
      ]);
      setRooms(r.data || []);
      setTypes(t.data || []);
      setAmenities(a.data || []);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load rooms');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [status, q]);

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

  const counts = Object.fromEntries(statuses.slice(1).map((s) => [s, rooms.filter((r) => r.status === s).length]));

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
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => window.location.href = '/admin/rooms'}>
              <Layers size={14} /> Manage Room Configuration
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <StatTile label="Total" value={rooms.length} icon={BedDouble} />
        {statuses.slice(1).map((s) => (
          <StatTile key={s} label={s.replaceAll('_', ' ')} value={counts[s] || 0} />
        ))}
      </div>
      <Section title="Room board" subtitle="Live room state from the property database">
        <Toolbar search={q} onSearch={setQ} placeholder="Search room number…">
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide ${
                  status === s ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'
                }`}
              >
                {s.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        </Toolbar>
        {loading ? (
          <LoadingState />
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rooms.map((r) => (
              <div key={r.id} className="group rounded-[20px] border border-[#e7ebe8] bg-[#fbfcfa] p-4 transition hover:-translate-y-0.5 hover:border-[#cfd8d3] hover:bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xl font-extrabold tracking-tight text-[#20343e]">Room {r.number}</div>
                    <div className="mt-1 text-[10px] text-[#8a9598]">
                      {r.roomType?.name || 'Room type'}
                      {r.roomType?.basePrice != null ? ` · GH₵ ${r.roomType.basePrice}/night` : ''}
                    </div>
                  </div>
                  {statusBadge(r.status || 'AVAILABLE')}
                </div>
                <div className="mt-5 flex flex-col gap-3 border-t border-[#e9ecea] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#8a9598]">{r.floor != null ? `Floor ${r.floor}` : 'Floor not set'}</span>
                    <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(r)} className="text-[10px] font-extrabold text-[#174b59]" title="Edit room">
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
            ))}
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
                      <div className="mt-0.5 rounded-xl bg-[#e7f0ec] p-2 text-[#174b59]">
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
                          <span key={a.amenityId} className="rounded-lg bg-[#e7f0ec] px-2 py-0.5 text-[9px] font-bold text-[#174b59]">
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
                          <button onClick={() => openEditType(t)} className="text-[10px] font-extrabold text-[#174b59]" title="Edit type">
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
                        active ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-[#fbfcfa] text-[#718086]'
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
