// ============================================
// NS LUXURY VILLA — Events & Functions Management
// Event spaces & bookings (weddings, corporate, birthdays, private parties)
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
  Pencil,
  Building2,
  Users,
  MapPin,
  Calendar,
  Clock,
  Phone,
  UserCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Modal,
  FormField,
  TextInput,
  SelectInput,
  showToast,
  statusBadge,
  LoadingState,
} from '../../components/ui';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
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
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'SPACES'>('EVENTS');

  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission(PERMISSIONS.EVENTS_CREATE);
  const canEdit = hasPermission(PERMISSIONS.EVENTS_EDIT);
  const canCancel = hasPermission(PERMISSIONS.EVENTS_CANCEL);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventBookingRecord | null>(null);
  const [spaceModalOpen, setSpaceModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields for Event
  const [title, setTitle] = useState('');
  const [eventSpaceId, setEventSpaceId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [status, setStatus] = useState('CONFIRMED');
  const [guestCount, setGuestCount] = useState('1');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Form fields for Space
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
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        eventSpaceId: eventSpaceId || null,
        startAt,
        endAt,
        status: status as EventBookingRecord['status'],
        guestCount: Number(guestCount) || 0,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (editing) {
        await eventsApi.update(editing.id, body);
        showToast('success', 'Event updated.');
      } else {
        await eventsApi.create(body);
        showToast('success', 'Event booking created.');
      }
      setModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to save the event.');
    } finally {
      setSaving(false);
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
    if (!window.confirm(`Delete "${ev.title}" permanently? This cannot be undone.`)) return;
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
    setSaving(true);
    try {
      await eventsApi.createSpace({
        name: spaceName.trim(),
        location: spaceLocation.trim() || undefined,
        capacity: Number(spaceCapacity) || 0,
      });
      showToast('success', 'Event space added.');
      setSpaceModalOpen(false);
      setSpaceName('');
      setSpaceLocation('');
      setSpaceCapacity('');
      await fetchAll();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to add event space.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSpace = async (space: EventSpaceRecord) => {
    if (!window.confirm(`Delete venue "${space.name}"? This cannot be undone.`)) return;
    try {
      await eventsApi.deleteSpace(space.id);
      showToast('success', 'Event space deleted.');
      await fetchAll();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete event space.');
    }
  };

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (statusFilter && ev.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const hay = `${ev.title} ${ev.contactName ?? ''} ${ev.eventSpace?.name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, statusFilter, searchQuery]);

  const upcomingCount = useMemo(() => {
    return events.filter((ev) => ev.status !== 'CANCELLED' && new Date(ev.startAt).getTime() >= Date.now()).length;
  }, [events]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return events.filter((ev) => new Date(ev.startAt).toDateString() === today).length;
  }, [events]);

  const expectedGuests = useMemo(() => {
    return events
      .filter((ev) => ev.status !== 'CANCELLED' && new Date(ev.startAt).getTime() >= Date.now())
      .reduce((s, ev) => s + Number(ev.guestCount || 0), 0);
  }, [events]);

  return (
    <ShellPage
      eyebrow="OPERATIONS • PRIVATE FUNCTIONS & CELEBRATIONS"
      title="Events & Venues"
      subtitle="Manage function spaces, banquets, private villa parties, weddings, and corporate gatherings."
      actions={
        <div className="flex items-center gap-2">
          {canCreate && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSpaceModalOpen(true)}
                className="gap-1.5 border-[#e5ebeb] text-[#0c1921]"
              >
                <Building2 size={13} /> Add Venue Space
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={openCreate}
                className="gap-1.5 bg-[#c59a58] hover:bg-[#b88738] text-white shadow-sm font-semibold"
              >
                <Plus size={14} /> Book Event
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* ── Metric Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Upcoming Functions"
          value={upcomingCount}
          note="Confirmed future bookings"
          icon={CalendarClock}
          accent={upcomingCount > 0}
        />
        <StatTile
          label="Events Today"
          value={todayCount}
          note={todayCount > 0 ? 'Active event on property today' : 'No events scheduled today'}
          icon={Sparkles}
        />
        <StatTile
          label="Expected Event Guests"
          value={expectedGuests}
          note="Attendees across upcoming events"
          icon={Users}
        />
      </div>

      {/* ── Segmented Navigation ── */}
      <div className="flex border-b border-[#e5ebeb] bg-white rounded-t-2xl px-5 pt-3">
        <button
          onClick={() => setActiveTab('EVENTS')}
          className={`flex items-center gap-2 pb-3 pt-1 px-4 text-xs font-bold transition-colors ${
            activeTab === 'EVENTS'
              ? 'text-[#0c1921] border-b-2 border-[#c59a58]'
              : 'text-[#71828a] hover:text-[#0c1921]'
          }`}
        >
          <Calendar size={14} />
          <span>Event Bookings</span>
          <span className="rounded-full bg-[#173c4d]/10 px-2 py-0.5 text-[10px]">
            {events.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('SPACES')}
          className={`flex items-center gap-2 pb-3 pt-1 px-4 text-xs font-bold transition-colors ${
            activeTab === 'SPACES'
              ? 'text-[#0c1921] border-b-2 border-[#c59a58]'
              : 'text-[#71828a] hover:text-[#0c1921]'
          }`}
        >
          <Building2 size={14} />
          <span>Villa Function Spaces</span>
          <span className="rounded-full bg-[#173c4d]/10 px-2 py-0.5 text-[10px]">
            {spaces.length}
          </span>
        </button>
      </div>

      {/* ── Tab: Events ── */}
      {activeTab === 'EVENTS' && (
        <Section
          title="Scheduled Functions"
          subtitle="All confirmed, planned, and past private functions and property events."
          action={
            <Button variant="ghost" size="sm" onClick={fetchAll} className="h-8 gap-1.5 text-xs text-[#5a6b75]">
              <RefreshCw size={13} /> Refresh
            </Button>
          }
        >
          <Toolbar search={searchQuery} onSearch={setSearchQuery} placeholder="Search by title, organizer, or venue…">
            <SelectInput
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40 text-xs"
            >
              <option value="">All Statuses</option>
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Toolbar>

          {loading ? (
            <div className="p-12"><LoadingState /></div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center text-xs text-[#71828a]">
              {events.length === 0 ? 'No events booked yet.' : 'No events match your search.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#edf2f2] bg-[#fbfdfd] text-[10px] font-extrabold uppercase tracking-wider text-[#71828a]">
                    <th className="py-3 px-5">Event Title & Notes</th>
                    <th className="py-3 px-5">Venue Space</th>
                    <th className="py-3 px-5">Date & Time</th>
                    <th className="py-3 px-5 text-center">Guests</th>
                    <th className="py-3 px-5">Contact Person</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filtered.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[#fbfcfb] transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[#0c1921] text-xs">{ev.title}</div>
                        <div className="text-[10px] text-[#71828a] max-w-xs truncate">
                          {ev.description || ev.notes || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#173c4d]/5 px-2 py-0.5 text-[11px] font-semibold text-[#0c1921]">
                          <Building2 size={11} className="text-[#c59a58]" />
                          {ev.eventSpace?.name ?? 'Villa Grounds'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[11px] text-[#5a6b75]">
                        <div>{new Date(ev.startAt).toLocaleDateString('en-GH', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                        <div className="text-[10px] text-[#71828a]">
                          {new Date(ev.startAt).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })} &minus; {new Date(ev.endAt).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono font-bold text-xs text-[#0c1921]">
                        {ev.guestCount}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-[#0c1921] text-xs">{ev.contactName || '—'}</div>
                        {ev.contactPhone && (
                          <div className="text-[10px] text-[#71828a]">{ev.contactPhone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {statusBadge(ev.status)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(ev)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5a6b75] hover:bg-slate-100 transition-colors"
                              title="Edit Event"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canEdit && ev.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancel(ev)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Cancel Event"
                            >
                              <XCircle size={13} />
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => handleDelete(ev)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Delete Event"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* ── Tab: Spaces ── */}
      {activeTab === 'SPACES' && (
        <Section
          title="Villa Event Spaces & Venues"
          subtitle="Dedicated properties, poolside terraces, dining halls, and garden lawns."
        >
          <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((sp) => (
              <div
                key={sp.id}
                className="rounded-2xl border border-[#e5ebeb] bg-white p-5 shadow-sm hover:border-[#c59a58]/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0c1921] text-[#c59a58]">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0c1921] font-serif">{sp.name}</h4>
                      <p className="text-[11px] text-[#5a6b75] flex items-center gap-1">
                        <MapPin size={11} className="text-[#c59a58]" /> {sp.location || 'NS Villa Grounds'}
                      </p>
                    </div>
                  </div>
                  {canCreate && (
                    <button
                      onClick={() => handleDeleteSpace(sp)}
                      className="text-[#71828a] hover:text-rose-600 p-1"
                      title="Delete Space"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[#edf2f2] pt-3 text-xs">
                  <span className="text-[#71828a]">Guest Capacity:</span>
                  <span className="font-mono font-bold text-[#0c1921]">
                    {sp.capacity > 0 ? `${sp.capacity} Guests` : 'Flexible'}
                  </span>
                </div>
              </div>
            ))}
            {spaces.length === 0 && (
              <div className="col-span-3 py-12 text-center text-xs text-[#71828a]">
                No event spaces configured yet. Click "Add Venue Space" above to configure areas.
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Modal: Book / Edit Event ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Event — ${editing.title}` : 'Book New Event or Function'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Event Title" required>
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mensah Wedding Reception, Rotary Club Dinner"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Venue Space">
              <SelectInput value={eventSpaceId} onChange={(e) => setEventSpaceId(e.target.value)}>
                <option value="">Villa Grounds / Custom</option>
                {spaces.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} {sp.capacity ? `(${sp.capacity} max)` : ''}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Expected Guest Count" required>
              <TextInput
                type="number"
                min="1"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                placeholder="1"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date & Time" required>
              <TextInput
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
              />
            </FormField>
            <FormField label="End Date & Time" required>
              <TextInput
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contact Person Name">
              <TextInput
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Kwesi Boateng"
              />
            </FormField>
            <FormField label="Contact Phone Number">
              <TextInput
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+233 …"
              />
            </FormField>
          </div>

          <FormField label="Status" required>
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="Function Notes / Setup Requirements">
            <TextInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Buffet setup, DJ sound system, 5 round tables"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#edf2f2]">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} className="bg-[#0c1921] hover:bg-[#173c4d] text-white">
              {editing ? 'Save Changes' : 'Confirm Booking'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Add Event Space ── */}
      <Modal
        open={spaceModalOpen}
        onClose={() => setSpaceModalOpen(false)}
        title="Add Function Venue Space"
      >
        <form onSubmit={handleCreateSpace} className="space-y-4">
          <FormField label="Venue Space Name" required>
            <TextInput
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder="e.g. Poolside Terrace, Grand Villa Hall, VIP Garden"
              required
            />
          </FormField>

          <FormField label="Location / Description">
            <TextInput
              value={spaceLocation}
              onChange={(e) => setSpaceLocation(e.target.value)}
              placeholder="e.g. West Wing, Ground Floor, Outdoor Garden"
            />
          </FormField>

          <FormField label="Maximum Guest Capacity">
            <TextInput
              type="number"
              min="1"
              value={spaceCapacity}
              onChange={(e) => setSpaceCapacity(e.target.value)}
              placeholder="e.g. 150"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#edf2f2]">
            <Button type="button" variant="ghost" onClick={() => setSpaceModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} className="bg-[#0c1921] hover:bg-[#173c4d] text-white">
              Add Venue
            </Button>
          </div>
        </form>
      </Modal>
    </ShellPage>
  );
};

export default EventsPage;
