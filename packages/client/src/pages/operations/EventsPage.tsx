// ============================================
// NS LUXURY VILLA — Events Management
// Event spaces & bookings (birthdays, weddings, corporate, private parties)
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  SelectInput,
  Button,
  Modal,
  FormField,
  TextInput,
  showToast,
  statusBadge,
} from '../../components/ui';
import { CalendarClock, Plus, RefreshCw, Trash2, XCircle, Pencil, Building2 } from 'lucide-react';
import { eventsApi, EventBookingRecord, EventSpaceRecord } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';

const EVENT_STATUSES = ['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

const toLocalInput = (iso: string) => new Date(iso).toISOString().slice(0, 16);

export const EventsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventBookingRecord[]>([]);
  const [spaces, setSpaces] = useState<EventSpaceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission(PERMISSIONS.EVENTS_CREATE);
  const canEdit = hasPermission(PERMISSIONS.EVENTS_EDIT);
  const canCancel = hasPermission(PERMISSIONS.EVENTS_CANCEL);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventBookingRecord | null>(null);
  const [spaceModalOpen, setSpaceModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => Promise<void>; isDeleting: boolean }>({
    open: false,
    title: '',
    message: '',
    onConfirm: async () => {},
    isDeleting: false,
  });

  const [title, setTitle] = useState('');
  const [eventSpaceId, setEventSpaceId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [status, setStatus] = useState('CONFIRMED');
  const [guestCount, setGuestCount] = useState('1');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [spaceName, setSpaceName] = useState('');
  const [spaceLocation, setSpaceLocation] = useState('');
  const [spaceCapacity, setSpaceCapacity] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, spacesRes] = await Promise.all([eventsApi.list(), eventsApi.spaces()]);
      setEvents(eventsRes);
      setSpaces(spacesRes);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setEventSpaceId(spaces[0]?.id ?? '');
    setStartAt(new Date().toISOString().slice(0, 16));
    setEndAt(new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16));
    setStatus('CONFIRMED');
    setGuestCount('1');
    setContactName('');
    setContactPhone('');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (ev: EventBookingRecord) => {
    setEditing(ev);
    setTitle(ev.title);
    setEventSpaceId(ev.eventSpaceId ?? '');
    setStartAt(toLocalInput(ev.startAt));
    setEndAt(toLocalInput(ev.endAt));
    setStatus(ev.status);
    setGuestCount(String(ev.guestCount));
    setContactName(ev.contactName ?? '');
    setContactPhone(ev.contactPhone ?? '');
    setNotes(ev.notes ?? '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('error', 'Event title is required.');
      return;
    }
    if (!startAt || !endAt) {
      showToast('error', 'Event start and end times are required.');
      return;
    }
    try {
      const body = {
        title,
        eventSpaceId: eventSpaceId || null,
        startAt,
        endAt,
        status: status as EventBookingRecord['status'],
        guestCount: Number(guestCount) || 0,
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
        notes: notes || undefined,
      };
      if (editing) {
        await eventsApi.update(editing.id, body);
        showToast('success', 'Event updated.');
      } else {
        await eventsApi.create(body);
        showToast('success', 'Event booked.');
      }
      setModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to save the event.');
    }
  };

  const handleCancel = async (ev: EventBookingRecord) => {
    if (!window.confirm(`Cancel "${ev.title}" scheduled for ${new Date(ev.startAt).toLocaleString()}?`)) return;
    try {
      await eventsApi.cancel(ev.id);
      showToast('success', 'Event cancelled.');
      await fetchAll();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to cancel the event.');
    }
  };

  const handleDelete = async (ev: EventBookingRecord) => {
    if (!window.confirm(`Delete "${ev.title}" permanently?`)) return;
    try {
      await eventsApi.remove(ev.id);
      showToast('success', 'Event deleted.');
      await fetchAll();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete the event.');
    }
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceName.trim()) {
      showToast('error', 'Event space name is required.');
      return;
    }
    try {
      await eventsApi.createSpace({
        name: spaceName,
        location: spaceLocation || undefined,
        capacity: Number(spaceCapacity) || 0,
      });
      showToast('success', 'Event space added.');
      setSpaceModalOpen(false);
      setSpaceName('');
      setSpaceLocation('');
      setSpaceCapacity('');
      await fetchAll();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to add the event space.');
    }
  };

  const handleDeleteSpace = async (space: EventSpaceRecord) => {
    setConfirmModal({
      open: true,
      title: 'Delete Event Space',
      message: `Are you sure you want to permanently delete "${space.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await eventsApi.deleteSpace(space.id);
          showToast('success', 'Event space deleted.');
          setConfirmModal({ ...confirmModal, open: false, isDeleting: false });
          await fetchAll();
        } catch (err: any) {
          showToast('error', err?.message ?? 'Failed to delete the event space.');
          setConfirmModal({ ...confirmModal, open: false, isDeleting: false });
        }
      },
      isDeleting: false,
    });
  };

  const filtered = events.filter((ev) => {
    if (statusFilter && ev.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = `${ev.title} ${ev.contactName ?? ''} ${ev.eventSpace?.name ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const upcoming = events.filter((ev) => ev.status !== 'CANCELLED' && new Date(ev.startAt).getTime() >= Date.now()).length;
  const todayCount = events.filter((ev) => new Date(ev.startAt).toDateString() === new Date().toDateString()).length;
  const expectedGuests = events
    .filter((ev) => ev.status !== 'CANCELLED' && new Date(ev.startAt).getTime() >= Date.now())
    .reduce((s, ev) => s + Number(ev.guestCount || 0), 0);

  const columns = [
    {
      key: 'title',
      header: 'Event',
      render: (row: EventBookingRecord) => (
        <div>
          <div className="font-semibold text-[#F4F4F2]">{row.title}</div>
          <div className="text-[11px] text-[#A0A5AD]">{row.description ?? row.notes ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'space',
      header: 'Venue',
      render: (row: EventBookingRecord) => (
        <span className="text-xs text-[#A0A5AD]">{row.eventSpace?.name ?? 'To be arranged'}</span>
      ),
    },
    {
      key: 'when',
      header: 'Schedule',
      render: (row: EventBookingRecord) => (
        <div className="text-xs text-[#A0A5AD]">
          <div>{new Date(row.startAt).toLocaleString()}</div>
          <div>→ {new Date(row.endAt).toLocaleTimeString()}</div>
        </div>
      ),
    },
    {
      key: 'guests',
      header: 'Guests',
      align: 'center' as const,
      render: (row: EventBookingRecord) => <span className="font-mono text-xs text-[#F4F4F2]">{row.guestCount}</span>,
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (row: EventBookingRecord) => (
        <div className="text-xs text-[#A0A5AD]">
          <div>{row.contactName ?? '—'}</div>
          <div>{row.contactPhone ?? ''}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center' as const,
      render: (row: EventBookingRecord) => statusBadge(row.status),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (row: EventBookingRecord) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-[#232733] rounded text-[#A0A5AD] hover:text-[#F4F4F2]" title="Edit event">
              <Pencil size={14} />
            </button>
          )}
          {canEdit && row.status !== 'CANCELLED' && (
            <button onClick={() => handleCancel(row)} className="p-1.5 hover:bg-amber-500/10 rounded text-[#A0A5AD] hover:text-amber-400" title="Cancel event">
              <XCircle size={14} />
            </button>
          )}
          {canCancel && (
            <button onClick={() => handleDelete(row)} className="p-1.5 hover:bg-red-500/10 rounded text-[#A0A5AD] hover:text-red-400" title="Delete event">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events & Functions Management"
        subtitle="Event spaces, bookings and guest functions across the property"
        actions={
          canCreate && (
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus size={14} /> Book Event
            </Button>
          )
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-md p-4">
          <div className="text-[11px] font-bold text-[#A0A5AD] uppercase tracking-wider">Upcoming Events</div>
          <div className="text-3xl font-extrabold text-[#F4F4F2] mt-1">{upcoming}</div>
        </div>
        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-md p-4">
          <div className="text-[11px] font-bold text-[#A0A5AD] uppercase tracking-wider">Today</div>
          <div className="text-3xl font-extrabold text-[#F4F4F2] mt-1">{todayCount}</div>
        </div>
        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-md p-4">
          <div className="text-[11px] font-bold text-[#A0A5AD] uppercase tracking-wider">Expected Guests</div>
          <div className="text-3xl font-extrabold text-[#F4F4F2] mt-1">{expectedGuests}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#1C1F28] border border-[#2B303E] rounded-md">
        <div className="flex items-center gap-2">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search event, contact, venue..." className="w-72" />
          <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            <option value="">All Statuses</option>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </SelectInput>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAll}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyTitle="No events scheduled"
        emptySubtitle="Book an event (birthday, wedding, corporate day, private party) to fill this calendar."
        keyFn={(e) => e.id}
      />

      {(canEdit || canCreate) && (
        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-[#A0A5AD]" />
              <h3 className="text-sm font-bold text-[#F4F4F2]">Event Spaces</h3>
            </div>
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setSpaceModalOpen(true)}>
                <Plus size={13} /> Add Space
              </Button>
            )}
          </div>
          {spaces.length === 0 ? (
            <p className="text-xs text-[#A0A5AD] py-3 text-center">No event spaces yet. Add your first venue (garden, pool deck, restaurant terrace).</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {spaces.map((sp) => (
                <div key={sp.id} className="border border-[#2B303E] rounded-md p-4 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F4F4F2]">{sp.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase ${sp.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>{sp.isActive ? 'Active' : 'Inactive'}</span>
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteSpace(sp)}
                          className="p-1 hover:bg-red-500/10 rounded text-[#A0A5AD] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete event space"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {sp.location && <div className="text-[11px] text-[#A0A5AD] mt-0.5">{sp.location}</div>}
                  <div className="text-[11px] text-[#A0A5AD] mt-2">Capacity {sp.capacity} · {sp._count?.bookings ?? 0} bookings</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Event' : 'Book Event'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Event Title" required>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kwame & Ama Wedding Reception" required />
          </FormField>

          <FormField label="Event Space / Venue">
            <SelectInput value={eventSpaceId} onChange={(e) => setEventSpaceId(e.target.value)}>
              <option value="">To be arranged</option>
              {spaces.map((sp) => (
                <option key={sp.id} value={sp.id}>{sp.name}{sp.location ? ` — ${sp.location}` : ''}</option>
              ))}
            </SelectInput>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Starts" required>
              <TextInput type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </FormField>
            <FormField label="Ends" required>
              <TextInput type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Guest Count">
              <TextInput type="number" min="0" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} placeholder="0" />
            </FormField>
            <FormField label="Status">
              <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
                {EVENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectInput>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contact Name">
              <TextInput value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Ama Boateng" />
            </FormField>
            <FormField label="Contact Phone">
              <TextInput value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="e.g. +233 24 000 0000" />
            </FormField>
          </div>

          <FormField label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catering, décor or setup requirements" />
          </FormField>

          <div className="pt-4 border-t border-[#2B303E] flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <CalendarClock size={14} /> {editing ? 'Save Changes' : 'Book Event'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={spaceModalOpen} onClose={() => setSpaceModalOpen(false)} title="Add Event Space" size="md">
        <form onSubmit={handleCreateSpace} className="space-y-4">
          <FormField label="Space Name" required>
            <TextInput value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="e.g. Poolside Deck" required />
          </FormField>
          <FormField label="Location">
            <TextInput value={spaceLocation} onChange={(e) => setSpaceLocation(e.target.value)} placeholder="e.g. Ground floor, by the pool" />
          </FormField>
          <FormField label="Capacity">
            <TextInput type="number" min="0" value={spaceCapacity} onChange={(e) => setSpaceCapacity(e.target.value)} placeholder="0" />
          </FormField>
          <div className="pt-4 border-t border-[#2B303E] flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSpaceModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <Building2 size={14} /> Add Space
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmModal.open} onClose={() => setConfirmModal({ ...confirmModal, open: false })} title={confirmModal.title} size="sm">
        <div className="space-y-4">
          <p className="text-[#A0A5AD]">{confirmModal.message}</p>
          <div className="flex justify-end gap-2 pt-4 border-t border-[#2B303E]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmModal({ ...confirmModal, open: false })}
              disabled={confirmModal.isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                setConfirmModal({ ...confirmModal, isDeleting: true });
                await confirmModal.onConfirm();
              }}
              disabled={confirmModal.isDeleting}
            >
              {confirmModal.isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EventsPage;