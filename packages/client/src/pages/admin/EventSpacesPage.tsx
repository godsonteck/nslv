// ============================================
// NS LUXURY VILLA — Event Spaces Configuration Page
// /admin/event-spaces — Admin management of event venues & spaces
// ============================================

import React, { useEffect, useState } from 'react';
import { eventsApi, EventSpaceRecord } from '../../services/apiService';
import { Building2, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { Button, Modal, FormField, TextInput, showToast, LoadingState, DataTable } from '../../components/ui';
import { formatCurrency } from '@nslv/shared';

const emptySpaceForm = { name: '', description: '', location: '', capacity: '', pricePerHour: '' };

export const EventSpacesPage: React.FC = () => {
  const [spaces, setSpaces] = useState<EventSpaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EventSpaceRecord | null>(null);
  const [form, setForm] = useState(emptySpaceForm);

  const loadSpaces = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      const data = await eventsApi.spaces();
      setSpaces(data);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to load event spaces');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadSpaces(true);
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptySpaceForm);
    setModalOpen(true);
  };

  const openEdit = (space: EventSpaceRecord) => {
    setEditing(space);
    setForm({
      name: space.name,
      description: space.description || '',
      location: space.location || '',
      capacity: space.capacity != null ? String(space.capacity) : '',
      pricePerHour: space.pricePerHour != null ? String(space.pricePerHour) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('error', 'Venue name is required');
      return;
    }
    try {
      setSaving(true);
      const body = {
        name: form.name,
        description: form.description || undefined,
        location: form.location || undefined,
        capacity: form.capacity ? Number(form.capacity) : 0,
        pricePerHour: form.pricePerHour ? Number(form.pricePerHour) : 0,
      };
      if (editing) {
        await eventsApi.updateSpace(editing.id, body);
        showToast('success', 'Event space updated');
      } else {
        await eventsApi.createSpace(body);
        showToast('success', 'Event space created');
      }
      setModalOpen(false);
      void loadSpaces();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to save event space');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (space: EventSpaceRecord) => {
    if (!window.confirm(`Delete venue space "${space.name}"?`)) return;
    try {
      await eventsApi.deleteSpace(space.id);
      showToast('success', 'Event space deleted');
      void loadSpaces();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete event space');
    }
  };

  if (loading) return <LoadingState message="Loading event spaces..." />;

  const columns = [
    {
      key: 'name',
      header: 'Venue Name',
      render: (s: EventSpaceRecord) => (
        <div>
          <div className="font-bold text-[var(--ns-ink)]">{s.name}</div>
          <div className="text-[11px] text-[var(--ns-muted)]">{s.description || 'No description'}</div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (s: EventSpaceRecord) => <span className="text-xs text-[var(--ns-muted)]">{s.location || '—'}</span>,
    },
    {
      key: 'capacity',
      header: 'Max Capacity',
      render: (s: EventSpaceRecord) => <span className="text-xs font-semibold text-[var(--ns-ink)]">{s.capacity || 0} guests</span>,
    },
    {
      key: 'rate',
      header: 'Rate / Hour',
      render: (s: EventSpaceRecord) => (
        <span className="font-mono text-xs font-bold text-[var(--ns-teal)]">
          {s.pricePerHour ? formatCurrency(Number(s.pricePerHour)) : 'Free / Included'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (s: EventSpaceRecord) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(s)} className="p-1.5 glass-subtle ns-glass-hover text-[var(--ns-muted)] hover:text-[var(--ns-teal)]">
            <Pencil size={14} />
          </button>
          <button onClick={() => handleDelete(s)} className="p-1.5 glass-subtle ns-glass-hover text-[var(--ns-muted)] hover:text-[var(--ns-danger)]">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 select-none pb-8">
      {/* ── Compact Header ── */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Building2 size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>Event Spaces Management</h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Configure property event locations, max capacities, and hourly rental rates for bookings.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadSpaces()} loading={refreshing}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} /> New Event Space
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={spaces} loading={refreshing} keyFn={(s) => s.id} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Event Space' : 'New Event Space'}>
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Venue / Space Name" required>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Poolside Lawn, Grand Ballroom" required />
          </FormField>
          <FormField label="Location">
            <TextInput value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Ground Floor, East Wing" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Max Capacity (Guests)">
              <TextInput type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 150" />
            </FormField>
            <FormField label="Hourly Rate (GHS)">
              <TextInput type="number" step="0.01" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} placeholder="0.00" />
            </FormField>
          </div>
          <FormField label="Description">
            <TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief details about facilities or sound systems" />
          </FormField>
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-glass-line)]">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Space'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EventSpacesPage;
