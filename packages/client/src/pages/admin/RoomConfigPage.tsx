// ============================================
// NS LUXURY VILLA — Room Configuration Page
// /admin/rooms — Admin management of Room Types and Room Inventory
// ============================================

import React, { useEffect, useState } from 'react';
import { roomsApi } from '../../services/apiService';
import { BedDouble, Plus, RefreshCw, Pencil, Trash2, Layers, Building } from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, Badge, DataTable } from '../../components/ui';
import { formatCurrency } from '@nslv/shared';

const emptyRoomForm = { number: '', name: '', roomTypeId: '', floor: '', notes: '' };
const emptyTypeForm = { name: '', description: '', basePrice: '', maxAdults: '2', maxChildren: '0' };

type Tab = 'types' | 'rooms';

export const RoomConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('types');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [rooms, setRooms] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);

  // Room Type Modal
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeSaving, setTypeSaving] = useState(false);
  const [editingType, setEditingType] = useState<any | null>(null);
  const [typeForm, setTypeForm] = useState(emptyTypeForm);

  // Room Inventory Modal
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomSaving, setRoomSaving] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [roomForm, setRoomForm] = useState(emptyRoomForm);

  const loadAll = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const [rRes, tRes] = await Promise.all([
        roomsApi.getRooms(),
        roomsApi.getRoomTypes(),
      ]);

      setRooms(rRes.data || []);
      setTypes(tRes.data || []);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load room configuration');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAll(true);
  }, []);

  // ── ROOM TYPE HANDLERS ──
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
    });
    setTypeOpen(true);
  };

  const saveType = async (e: React.FormEvent) => {
    e.preventDefault();
    const basePrice = Number(typeForm.basePrice);
    const maxAdults = Number(typeForm.maxAdults);
    const maxChildren = Number(typeForm.maxChildren);

    if (!typeForm.name.trim()) {
      showToast('error', 'Room type name is required');
      return;
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      showToast('error', 'Base rate must be greater than zero');
      return;
    }
    if (!Number.isInteger(maxAdults) || maxAdults < 0 || !Number.isInteger(maxChildren) || maxChildren < 0) {
      showToast('error', 'Maximum adults and children must be whole numbers of zero or more');
      return;
    }
    if (typeSaving) {
      return;
    }
    try {
      setTypeSaving(true);
      const body = {
        name: typeForm.name.trim(),
        description: typeForm.description || undefined,
        basePrice,
        maxAdults,
        maxChildren,
      };
      if (editingType) await roomsApi.updateRoomType(editingType.id, body);
      else await roomsApi.createRoomType(body);
      showToast('success', editingType ? 'Room type updated' : 'Room type created');
      setTypeOpen(false);
      await loadAll();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to save room type');
    } finally {
      setTypeSaving(false);
    }
  };

  const removeType = async (t: any) => {
    const used = t._count?.rooms || 0;
    const msg = used > 0
      ? `Room type "${t.name}" is assigned to ${used} room(s). It will be deactivated instead of deleted. Continue?`
      : `Delete room type "${t.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await roomsApi.deleteRoomType(t.id);
      showToast('success', used > 0 ? 'Room type deactivated' : 'Room type deleted');
      void loadAll();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to delete room type');
    }
  };

  // ── ROOM HANDLERS ──
  const openAddRoom = () => {
    if (types.length === 0) {
      showToast('error', 'Create a room type before adding a room');
      setActiveTab('types');
      return;
    }
    setEditingRoom(null);
    setRoomForm({ ...emptyRoomForm, roomTypeId: types[0]?.id || '' });
    setRoomOpen(true);
  };

  const openEditRoom = (r: any) => {
    setEditingRoom(r);
    setRoomForm({
      number: r.number,
      name: r.name || '',
      roomTypeId: r.roomTypeId,
      floor: r.floor != null ? String(r.floor) : '',
      notes: r.notes || '',
    });
    setRoomOpen(true);
  };

  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const floor = roomForm.floor === '' ? undefined : Number(roomForm.floor);
    if (!roomForm.number.trim() || !roomForm.roomTypeId) {
      showToast('error', 'Room number and room type are required');
      return;
    }
    if (floor !== undefined && (!Number.isInteger(floor) || floor < 0)) {
      showToast('error', 'Floor must be a whole number of zero or more');
      return;
    }
    if (roomSaving) return;
    try {
      setRoomSaving(true);
      const payload = {
        number: roomForm.number.trim(),
        name: roomForm.name.trim() || undefined,
        roomTypeId: roomForm.roomTypeId,
        floor,
        notes: roomForm.notes.trim() || undefined,
      };
      if (editingRoom) await roomsApi.updateRoom(editingRoom.id, payload);
      else await roomsApi.createRoom(payload);
      showToast('success', editingRoom ? 'Room updated' : 'Room created');
      setRoomOpen(false);
      await loadAll();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to save room');
    } finally {
      setRoomSaving(false);
    }
  };

  const removeRoom = async (r: any) => {
    if (!window.confirm(`Delete Room ${r.number}?`)) return;
    try {
      await roomsApi.deleteRoom(r.id);
      showToast('success', 'Room deleted');
      void loadAll();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to delete room');
    }
  };

  if (loading) return <LoadingState message="Loading room configuration..." />;

  return (
    <div className="space-y-6 select-none pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8a9ba8]">
            <Building size={13} className="text-[#b18a55]" /> Administration · Room Configuration
          </div>
          <h1 className="mt-1 font-[Manrope] text-[26px] font-extrabold tracking-[-0.04em] text-[#101a2b]">
            Room Configuration
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#7a858a]">
            Manage room types, rate defaults, occupancy, and the property room inventory.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadAll()} loading={refreshing}>
            <RefreshCw size={14} /> Refresh
          </Button>
          {activeTab === 'types' && (
            <Button size="sm" onClick={openAddType}>
              <Plus size={14} /> New Room Type
            </Button>
          )}
          {activeTab === 'rooms' && (
            <Button size="sm" onClick={openAddRoom}>
              <Plus size={14} /> Add Room
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#e2e7ea]">
        <button
          onClick={() => setActiveTab('types')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold transition border-b-2 ${
            activeTab === 'types'
              ? 'border-[#174b59] text-[#174b59]'
              : 'border-transparent text-[#7c8a95] hover:text-[#1a2b3c]'
          }`}
        >
          <Layers size={15} /> Room Types ({types.length})
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold transition border-b-2 ${
            activeTab === 'rooms'
              ? 'border-[#174b59] text-[#174b59]'
              : 'border-transparent text-[#7c8a95] hover:text-[#1a2b3c]'
          }`}
        >
          <BedDouble size={15} /> Rooms ({rooms.length})
        </button>
      </div>

      {/* TAB 1: ROOM TYPES */}
      {activeTab === 'types' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => (
            <div key={t.id} className="rounded-2xl border border-[#e2e7ea] bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-[#1a2b3c]">{t.name}</h3>
                  <div className="text-[11px] text-[#7c8a95]">{t._count?.rooms || 0} room(s) assigned</div>
                </div>
                <span className="font-mono text-base font-extrabold text-[#174b59]">
                  {formatCurrency(Number(t.basePrice))}
                  <span className="text-[10px] font-normal text-[#7c8a95]">/night</span>
                </span>
              </div>
              <p className="text-xs text-[#5b6b7a] line-clamp-2">{t.description || 'No description provided.'}</p>
              <div className="text-[11px] text-[#7c8a95]">
                Max Occupancy: <span className="font-semibold text-[#1a2b3c]">{t.maxAdults} Adults, {t.maxChildren} Children</span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f4f7]">
                <Button variant="outline" size="sm" onClick={() => openEditType(t)}>
                  <Pencil size={13} /> Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => removeType(t)}>
                  <Trash2 size={13} /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: ROOM INVENTORY */}
      {activeTab === 'rooms' && (
        <DataTable
          columns={[
            { key: 'number', header: 'Room Number', render: (r: any) => <span className="font-bold text-[#1a2b3c]">{r.number}</span> },
            { key: 'name', header: 'Name', render: (r: any) => <span>{r.name || '—'}</span> },
            { key: 'type', header: 'Room Type', render: (r: any) => <Badge label={r.roomType?.name || 'Unassigned'} variant="info" /> },
            { key: 'floor', header: 'Floor', render: (r: any) => <span>{r.floor != null ? `Floor ${r.floor}` : 'Ground'}</span> },
            { key: 'status', header: 'Status', render: (r: any) => <Badge label={r.status} variant="neutral" /> },
            {
              key: 'actions',
              header: '',
              align: 'right' as const,
              render: (r: any) => (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEditRoom(r)} className="p-1.5 text-[#5b6b7a] hover:text-[#174b59]">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => removeRoom(r)} className="p-1.5 text-[#5b6b7a] hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ),
            },
          ]}
          data={rooms}
          loading={refreshing}
          keyFn={(r) => r.id}
        />
      )}

      {/* ROOM TYPE MODAL */}
      <Modal open={typeOpen} onClose={() => setTypeOpen(false)} title={editingType ? 'Edit Room Type' : 'Add Room Type'}>
        <form onSubmit={saveType} className="space-y-4">
          <FormField label="Room Type Name" required>
            <TextInput value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="e.g. Executive Suite" required />
          </FormField>
          <FormField label="Base Rate (GHS / Night)" required>
            <TextInput type="number" min="0.01" step="0.01" value={typeForm.basePrice} onChange={(e) => setTypeForm({ ...typeForm, basePrice: e.target.value })} placeholder="0.00" required />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Max Adults">
              <TextInput type="number" min="0" step="1" value={typeForm.maxAdults} onChange={(e) => setTypeForm({ ...typeForm, maxAdults: e.target.value })} />
            </FormField>
            <FormField label="Max Children">
              <TextInput type="number" min="0" step="1" value={typeForm.maxChildren} onChange={(e) => setTypeForm({ ...typeForm, maxChildren: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Description">
            <TextInput value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} placeholder="Brief details about this room type" />
          </FormField>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="ghost" onClick={() => setTypeOpen(false)}>Cancel</Button>
            <Button type="submit" loading={typeSaving}>{editingType ? 'Save Changes' : 'Create Room Type'}</Button>
          </div>
        </form>
      </Modal>

      {/* ROOM INVENTORY MODAL */}
      <Modal open={roomOpen} onClose={() => setRoomOpen(false)} title={editingRoom ? 'Edit Room' : 'Add Room'}>
        <form onSubmit={saveRoom} className="space-y-4">
          <FormField label="Room Number" required>
            <TextInput value={roomForm.number} onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })} placeholder="e.g. 101, A5" required />
          </FormField>
          <FormField label="Room Name (Optional)">
            <TextInput value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="e.g. Garden Villa 1" />
          </FormField>
          <FormField label="Room Type" required>
            <SelectInput value={roomForm.roomTypeId} onChange={(e) => setRoomForm({ ...roomForm, roomTypeId: e.target.value })} required>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({formatCurrency(Number(t.basePrice))})</option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Floor">
            <TextInput type="number" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} placeholder="0 for Ground Floor" />
          </FormField>
          <FormField label="Notes">
            <TextInput value={roomForm.notes} onChange={(e) => setRoomForm({ ...roomForm, notes: e.target.value })} placeholder="Maintenance notes or location hints" />
          </FormField>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="ghost" onClick={() => setRoomOpen(false)}>Cancel</Button>
            <Button type="submit" loading={roomSaving}>{editingRoom ? 'Save Changes' : 'Add Room'}</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default RoomConfigPage;
