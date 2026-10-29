import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { guestsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import {
  Plus,
  RefreshCw,
  Users,
  UserCheck,
  Search,
  Mail,
  Phone,
  MapPin,
  BedDouble,
  Shield,
  Sparkles,
  Pencil,
  Eye,
  Building,
  Tag,
  X,
} from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, TextareaInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
import { formatCurrency, formatGuestName } from '@nslv/shared';

export const GuestsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const [data, setData] = useState<any[]>([]);
  const [q, setQ] = useState(initialSearch);
  const [vipFilter, setVipFilter] = useState<'ALL' | 'VIP' | 'STANDARD'>('ALL');
  const [sortBy, setSortBy] = useState<'name_asc' | 'stays_desc' | 'newest'>('name_asc');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New Guest Form State
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    idDocumentType: '',
    idDocumentNumber: '',
    nationality: '',
    preferences: '',
    notes: '',
    isVip: false,
  });

  // Selected Guest View Modal
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edit Guest Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ ...form });

  const canCreate = useAuthStore((s) => s.hasPermission('guests.create') || s.hasRole('admin'));
  const canEdit = useAuthStore((s) => s.hasPermission('guests.edit') || s.hasRole('admin'));
  const canViewSensitive = useAuthStore((s) => s.hasPermission('guests.view_sensitive') || s.hasRole('admin'));

  const load = async () => {
    try {
      setLoading(true);
      const r = await guestsApi.list(q ? { search: q } : undefined);
      setData(r.data || []);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load guests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== q) setQ(urlSearch);
  }, [searchParams, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [q]);

  const openGuestDetails = async (guest: any) => {
    setSelectedGuestId(guest.id);
    setSelectedGuest(guest);
    try {
      setLoadingDetails(true);
      const res = await guestsApi.getById(guest.id);
      setSelectedGuest(res.data || res);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to load full guest details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const startEditGuest = (guest: any) => {
    setSelectedGuestId(guest.id);
    setSelectedGuest(guest);
    setEditForm({
      firstName: guest.firstName || '',
      lastName: guest.lastName || '',
      email: guest.email || '',
      phone: guest.phone || '',
      address: guest.address || '',
      city: guest.city || '',
      country: guest.country || '',
      idDocumentType: guest.idDocumentType || '',
      idDocumentNumber: guest.idDocumentNumber || '',
      nationality: guest.nationality || '',
      preferences: guest.preferences || '',
      notes: guest.notes || '',
      isVip: Boolean(guest.isVip),
    });
    setEditModalOpen(true);
  };

  const saveNewGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim()) {
      showToast('error', 'First name is required.');
      return;
    }
    try {
      setSaving(true);
      await guestsApi.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        idDocumentType: form.idDocumentType || undefined,
        idDocumentNumber: form.idDocumentNumber.trim() || undefined,
        nationality: form.nationality.trim() || undefined,
        preferences: form.preferences.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isVip: form.isVip,
      });
      showToast('success', 'Guest profile created successfully');
      setCreateOpen(false);
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        idDocumentType: '',
        idDocumentNumber: '',
        nationality: '',
        preferences: '',
        notes: '',
        isVip: false,
      });
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to create guest');
    } finally {
      setSaving(false);
    }
  };

  const saveEditGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuestId) return;
    if (!editForm.firstName.trim()) {
      showToast('error', 'First name is required.');
      return;
    }
    try {
      setSaving(true);
      const updated = await guestsApi.update(selectedGuestId, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        city: editForm.city.trim() || null,
        country: editForm.country.trim() || null,
        idDocumentType: editForm.idDocumentType || null,
        idDocumentNumber: editForm.idDocumentNumber.trim() || null,
        nationality: editForm.nationality.trim() || null,
        preferences: editForm.preferences.trim() || null,
        notes: editForm.notes.trim() || null,
        isVip: editForm.isVip,
      });
      showToast('success', 'Guest profile updated');
      setEditModalOpen(false);
      setSelectedGuest(updated.data || updated);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to update guest');
    } finally {
      setSaving(false);
    }
  };

  const vipCount = data.filter((x) => x.isVip).length;
  const repeatGuestsCount = data.filter((x) => (x._count?.reservations ?? 0) > 1).length;
  const totalStaysCount = data.reduce((acc, x) => acc + (x._count?.reservations ?? 0), 0);

  const filteredGuests = data
    .filter((g) => {
      if (vipFilter === 'VIP') return Boolean(g.isVip);
      if (vipFilter === 'STANDARD') return !g.isVip;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'stays_desc') {
        return (b._count?.reservations ?? 0) - (a._count?.reservations ?? 0);
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return (a.firstName || '').localeCompare(b.firstName || '');
    });

  return (
    <ShellPage
      eyebrow="Front Office"
      title="Guest Directory"
      subtitle="Manage guest profiles, contact records, VIP status, and stay history."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="gap-1.5 glass-subtle ns-glass-hover"
            title="Refresh guest records"
          >
            <RefreshCw size={14} /> Refresh
          </Button>
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="gap-1.5 font-bold glass-subtle ns-glass-hover"
            >
              <Plus size={14} /> Register Guest
            </Button>
          )}
        </>
      }
    >
      {/* ── Stat Tiles ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatTile
          label="Total Guests"
          value={data.length}
          note="Registered in directory"
          icon={Users}
          onClick={() => { setVipFilter('ALL'); setQ(''); }}
        />
        <StatTile
          label="VIP Profiles"
          value={vipCount}
          note="Preferred luxury guests"
          icon={Sparkles}
          accent={vipFilter === 'VIP'}
          onClick={() => setVipFilter(vipFilter === 'VIP' ? 'ALL' : 'VIP')}
        />
        <StatTile
          label="Repeat Guests"
          value={repeatGuestsCount}
          note="Stayed 2 or more times"
          icon={UserCheck}
        />
        <StatTile
          label="Total Stays"
          value={totalStaysCount}
          note="Cumulative guest bookings"
          icon={BedDouble}
        />
      </div>

      {/* ── Main Section ── */}
      <Section
        title="Guest Records"
        subtitle={`Showing ${filteredGuests.length} guest${filteredGuests.length === 1 ? '' : 's'}`}
      >
        <Toolbar
          search={q}
          onSearch={setQ}
          placeholder="Search by name, phone, email, document #..."
        >
          {/* VIP Filter */}
          <select
            value={vipFilter}
            onChange={(e) => setVipFilter(e.target.value as any)}
            className="ns-input glass-input h-10 px-3 text-xs font-semibold"
            title="Filter by guest tier"
          >
            <option value="ALL">All Guests</option>
            <option value="VIP">VIP Guests Only</option>
            <option value="STANDARD">Standard Guests</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="ns-input glass-input h-10 px-3 text-xs font-semibold"
            title="Sort guest directory"
          >
            <option value="name_asc">Sort: Name (A to Z)</option>
            <option value="stays_desc">Sort: Most Stays</option>
            <option value="newest">Sort: Recently Registered</option>
          </select>

          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-[var(--ns-muted)] hover:text-[var(--ns-ink)] glass-subtle ns-glass-hover"
              title="Clear search"
            >
              <X size={14} /> Clear
            </button>
          )}
        </Toolbar>

        {loading ? (
          <LoadingState />
        ) : filteredGuests.length === 0 ? (
          <div className="py-14 text-center">
            <Users className="mx-auto text-[var(--ns-muted)]" size={36} />
            <div className="mt-3 text-sm font-bold text-[var(--ns-ink)]">No guests match your criteria</div>
            <div className="mt-1 text-xs text-[var(--ns-muted)]">
              {q ? 'Try clearing your search query or adjusting the filters.' : 'Register the first guest profile when a new guest arrives.'}
            </div>
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="mt-4 gap-1.5 glass-subtle ns-glass-hover"
              >
                <Plus size={14} /> Register Guest
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="ns-glass-band text-[10px] uppercase tracking-[.14em] text-[var(--ns-muted)] border-b border-[var(--ns-glass-line)]">
                <tr>
                  <th className="px-5 py-3">Guest Name</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Location &amp; Origin</th>
                  <th className="px-5 py-3 text-center">Stays</th>
                  <th className="px-5 py-3">Registered</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-glass-line)]">
                {filteredGuests.map((g) => {
                  const initials = ((g.firstName?.[0] || 'G') + (g.lastName?.[0] || '')).toUpperCase();
                  const stays = g._count?.reservations ?? 0;
                  return (
                    <tr
                      key={g.id}
                      onClick={() => openGuestDetails(g)}
                      className="cursor-pointer ns-glass-hover transition-colors"
                    >
                      {/* Name & Initials */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                              g.isVip
                                ? 'glass text-[var(--ns-gold)] shadow-xs'
                                : 'glass-subtle text-[var(--ns-ink)]'
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-[var(--ns-ink)]">
                                {formatGuestName(g)}
                              </span>
                              {g.isVip && (
                                <span className="inline-flex items-center gap-0.5 rounded-md glass-subtle border border-[var(--ns-warning)] px-1.5 py-0.5 text-[9px] font-extrabold text-[var(--ns-warning)]">
                                  <Sparkles size={8} /> VIP
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[10px] text-[var(--ns-muted)] mt-0.5">
                              ID: {g.id.slice(0, 8).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-3.5 text-xs">
                        <div className="font-medium text-[var(--ns-ink)]">
                          {g.phone ? (
                            <a
                              href={`tel:${g.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline hover:text-[var(--ns-gold)]"
                            >
                              {g.phone}
                            </a>
                          ) : (
                            <span className="text-[var(--ns-muted)]">-</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--ns-muted)] mt-0.5">
                          {g.email ? (
                            <a
                              href={`mailto:${g.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline hover:text-[var(--ns-gold)]"
                            >
                              {g.email}
                            </a>
                          ) : (
                            <span className="text-[var(--ns-muted)]">-</span>
                          )}
                        </div>
                      </td>

                      {/* Location & Nationality */}
                      <td className="px-5 py-3.5 text-xs text-[var(--ns-muted)]">
                        <div>{[g.city, g.country].filter(Boolean).join(', ') || '-'}</div>
                        {g.nationality && (
                          <div className="text-[11px] text-[var(--ns-muted)] mt-0.5">
                            {g.nationality}
                          </div>
                        )}
                      </td>

                      {/* Total Stays */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                          stays > 0
                            ? 'glass-subtle text-[var(--ns-success)] border border-[var(--ns-success)]'
                            : 'glass-subtle text-[var(--ns-muted)]'
                        }`}>
                          {stays} stay{stays === 1 ? '' : 's'}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td className="px-5 py-3.5 text-xs text-[var(--ns-muted)]">
                        {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '-'}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openGuestDetails(g)}
                            className="rounded-lg p-2 text-[var(--ns-muted)] ns-glass-hover hover:text-[var(--ns-gold)] transition bg-[var(--ns-glass-1)]"
                            title="View guest profile"
                          >
                            <Eye size={16} />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => startEditGuest(g)}
                              className="rounded-lg p-2 text-[var(--ns-muted)] ns-glass-hover hover:text-[var(--ns-gold)] transition bg-[var(--ns-glass-1)]"
                              title="Edit guest profile"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Brief & Simple Guest View Modal ── */}
      <Modal
        open={!!selectedGuestId}
        onClose={() => {
          setSelectedGuestId(null);
          setSelectedGuest(null);
        }}
        title="Guest Profile"
        size="md"
      >
        {selectedGuest && (
          <div className="p-5 space-y-4">
            {/* Header: Name, VIP & Quick Edit */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                    selectedGuest.isVip
                      ? 'glass text-[var(--ns-gold)] shadow-sm'
                      : 'glass-subtle text-[var(--ns-ink)]'
                  }`}
                >
                  {((selectedGuest.firstName?.[0] || 'G') + (selectedGuest.lastName?.[0] || '')).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--ns-ink)]">
                      {formatGuestName(selectedGuest)}
                    </h3>
                    {selectedGuest.isVip && (
                      <span className="rounded-full glass-subtle border border-[var(--ns-warning)] px-2 py-0.5 text-[10px] font-bold text-[var(--ns-warning)]">
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--ns-muted)] mt-0.5">
                    Guest ID: <span className="font-mono">{selectedGuest.id.slice(0, 8).toUpperCase()}</span>
                    {selectedGuest.createdAt && ` · Joined ${new Date(selectedGuest.createdAt).toLocaleDateString()}`}
                  </div>
                </div>
              </div>

              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEditGuest(selectedGuest)}
                  className="gap-1 text-xs glass-subtle ns-glass-hover"
                >
                  <Pencil size={12} /> Edit
                </Button>
              )}
            </div>

            {loadingDetails ? (
              <LoadingState />
            ) : (
              <div className="space-y-4">
                {/* Contact & Location List */}
                <div className="rounded-xl border border-[var(--ns-glass-line)] glass-subtle p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[var(--ns-glass-line)]">
                    <span className="text-[var(--ns-muted)] flex items-center gap-1.5"><Phone size={13} /> Phone</span>
                    <span className="font-semibold text-[var(--ns-ink)]">
                      {selectedGuest.phone ? (
                        <a href={`tel:${selectedGuest.phone}`} className="hover:underline hover:text-[var(--ns-gold)]">
                          {selectedGuest.phone}
                        </a>
                      ) : (
                        '-'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[var(--ns-glass-line)]">
                    <span className="text-[var(--ns-muted)] flex items-center gap-1.5"><Mail size={13} /> Email</span>
                    <span className="font-semibold text-[var(--ns-ink)]">
                      {selectedGuest.email ? (
                        <a href={`mailto:${selectedGuest.email}`} className="hover:underline hover:text-[var(--ns-gold)]">
                          {selectedGuest.email}
                        </a>
                      ) : (
                        '-'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[var(--ns-glass-line)]">
                    <span className="text-[var(--ns-muted)] flex items-center gap-1.5"><MapPin size={13} /> Location</span>
                    <span className="font-semibold text-[var(--ns-ink)]">
                      {[selectedGuest.city, selectedGuest.country].filter(Boolean).join(', ') || '-'}
                    </span>
                  </div>
                  {selectedGuest.nationality && (
                    <div className="flex justify-between items-center py-1 border-b border-[var(--ns-glass-line)]">
                      <span className="text-[var(--ns-muted)] flex items-center gap-1.5"><Building size={13} /> Nationality</span>
                      <span className="font-semibold text-[var(--ns-ink)]">{selectedGuest.nationality}</span>
                    </div>
                  )}
                  {selectedGuest.idDocumentNumber && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-[var(--ns-muted)] flex items-center gap-1.5"><Shield size={13} /> ID Document</span>
                      <span className="font-mono font-semibold text-[var(--ns-ink)]">
                        {canViewSensitive
                          ? `${selectedGuest.idDocumentType ? selectedGuest.idDocumentType + ' ' : ''}${selectedGuest.idDocumentNumber}`
                          : '••••••••'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes or Preferences if any */}
                {(selectedGuest.preferences || selectedGuest.notes) && (
                  <div className="rounded-xl border border-[var(--ns-warning)] glass-subtle p-3 text-xs space-y-1">
                    {selectedGuest.preferences && (
                      <div>
                        <span className="font-bold text-[var(--ns-warning)]">Preferences: </span>
                        <span className="text-[var(--ns-ink)]">{selectedGuest.preferences}</span>
                      </div>
                    )}
                    {selectedGuest.notes && (
                      <div>
                        <span className="font-bold text-[var(--ns-warning)]">Staff Notes: </span>
                        <span className="text-[var(--ns-ink)]">{selectedGuest.notes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Stay History Summary */}
                <div className="rounded-xl border border-[var(--ns-glass-line)] glass-subtle p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-[var(--ns-muted)]">
                    <span className="flex items-center gap-1.5"><BedDouble size={13} /> Stay History</span>
                    <span>{selectedGuest.reservations?.length ?? 0} booking{(selectedGuest.reservations?.length ?? 0) === 1 ? '' : 's'}</span>
                  </div>

                  {!selectedGuest.reservations || selectedGuest.reservations.length === 0 ? (
                    <p className="text-[var(--ns-muted)] text-center py-2">No previous bookings recorded.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-[var(--ns-glass-line)]">
                      {selectedGuest.reservations.map((item: any) => {
                        const res = item.reservation || item;
                        return (
                          <div key={res.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-[var(--ns-ink)]">
                                {res.room ? `Room ${res.room.number}` : 'Unassigned'}
                              </div>
                              <div className="text-[11px] text-[var(--ns-muted)]">
                                {new Date(res.checkInDate).toLocaleDateString()} → {new Date(res.checkOutDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-2">
                              <span className="font-semibold text-[var(--ns-ink)]">{formatCurrency(res.totalAmount)}</span>
                              {statusBadge(res.status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedGuestId(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Guest Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register New Guest"
        subtitle="Register contact information, stay preferences and VIP status for a new guest"
        size="lg"
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="create-guest-form"
              loading={saving}
              className="font-bold glass text-[var(--ns-teal)] px-5 shadow-xs ns-glass-hover"
            >
              Save Guest Profile
            </Button>
          </>
        }
      >
        <form id="create-guest-form" onSubmit={saveNewGuest} className="space-y-4">
          {/* Identity & Contact */}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="First Name" required>
              <TextInput
                required
                placeholder="e.g. Ama"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </FormField>
            <FormField label="Last Name">
              <TextInput
                placeholder="e.g. Mensah"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Phone Number">
              <TextInput
                placeholder="e.g. +233 24 000 0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FormField>
            <FormField label="Email Address">
              <TextInput
                type="email"
                placeholder="guest@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>
          </div>

          {/* VIP Recognition Toggle Card */}
          <div
            onClick={() => setForm({ ...form, isVip: !form.isVip })}
            className={`cursor-pointer rounded-xl border p-3.5 transition-all flex items-center justify-between gap-3 ${
              form.isVip
                ? 'border-[var(--ns-gold)] glass-subtle ring-1 ring-[var(--ns-gold)] shadow-xs ns-glass-selected'
                : 'border-[var(--ns-glass-line)] hover:border-[var(--ns-glass-line)]'
            }`}
            style={{ backgroundColor: form.isVip ? undefined : 'var(--ns-glass-1)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  form.isVip
                    ? 'glass text-[var(--ns-gold)] shadow-xs'
                    : 'glass-subtle text-[var(--ns-muted)]'
                }`}
              >
                <Sparkles size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--ns-ink)' }}>
                    VIP Guest Recognition
                  </span>
                  {form.isVip && (
                    <span className="rounded glass-subtle px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--ns-gold)]">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-tight" style={{ color: 'var(--ns-muted)' }}>
                  Priority reservations, champagne welcome amenities, and dedicated concierge
                </p>
              </div>
            </div>
            <button
              type="button"
              className={`glass-subtle ns-glass-hover relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                form.isVip ? 'glass ns-glass-selected' : 'glass'
              }`}
              aria-label="Toggle VIP Status"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full glass-subtle shadow-md ring-0 transition duration-200 ease-in-out ${
                  form.isVip ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Location & Identification */}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Nationality">
              <TextInput
                placeholder="e.g. Ghanaian"
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              />
            </FormField>
            <FormField label="City / Country">
              <TextInput
                placeholder="e.g. Accra, Ghana"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="ID Document Type">
              <SelectInput
                value={form.idDocumentType}
                onChange={(e) => setForm({ ...form, idDocumentType: e.target.value })}
              >
                <option value="">Select document type</option>
                <option value="PASSPORT">Passport</option>
                <option value="NATIONAL_ID">National ID / Ghana Card</option>
                <option value="DRIVERS_LICENSE">Driver's License</option>
                <option value="OTHER">Other</option>
              </SelectInput>
            </FormField>
            <FormField label="Document Number">
              <TextInput
                placeholder="e.g. GHA-000000000-0"
                value={form.idDocumentNumber}
                onChange={(e) => setForm({ ...form, idDocumentNumber: e.target.value })}
              />
            </FormField>
          </div>

          {/* Preferences & Staff Notes */}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Guest Preferences">
              <TextareaInput
                rows={2}
                placeholder="Pillow, dietary, or room preferences"
                value={form.preferences}
                onChange={(e) => setForm({ ...form, preferences: e.target.value })}
              />
            </FormField>
            <FormField label="Internal Staff Notes">
              <TextareaInput
                rows={2}
                placeholder="Internal service notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ── Edit Guest Modal ── */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Guest Profile"
        subtitle={`Update contact details, identification and stay preferences for ${[editForm.firstName, editForm.lastName].filter(Boolean).join(' ') || 'this guest'}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="edit-guest-form"
              loading={saving}
              className="font-bold glass text-[var(--ns-teal)] px-5 shadow-xs ns-glass-hover"
            >
              Save Changes
            </Button>
          </>
        }
      >
        <form id="edit-guest-form" onSubmit={saveEditGuest} className="space-y-4">
          {/* Identity & Contact */}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="First Name" required>
              <TextInput
                required
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
              />
            </FormField>
            <FormField label="Last Name">
              <TextInput
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Phone Number">
              <TextInput
                placeholder="e.g. +233 24 000 0000"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </FormField>
            <FormField label="Email Address">
              <TextInput
                type="email"
                placeholder="guest@example.com"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </FormField>
          </div>

          {/* VIP Recognition Toggle Card */}
          <div
            onClick={() => setEditForm({ ...editForm, isVip: !editForm.isVip })}
            className={`cursor-pointer rounded-xl border p-3.5 transition-all flex items-center justify-between gap-3 ${
              editForm.isVip
                ? 'border-[var(--ns-gold)] glass-subtle ring-1 ring-[var(--ns-gold)] shadow-xs ns-glass-selected'
                : 'border-[var(--ns-glass-line)] hover:border-[var(--ns-glass-line)]'
            }`}
            style={{ backgroundColor: editForm.isVip ? undefined : 'var(--ns-glass-1)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  editForm.isVip
                    ? 'glass text-[var(--ns-gold)] shadow-xs'
                    : 'glass-subtle text-[var(--ns-muted)]'
                }`}
              >
                <Sparkles size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--ns-ink)' }}>
                    VIP Guest Recognition
                  </span>
                  {editForm.isVip && (
                    <span className="rounded glass-subtle px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--ns-gold)]">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-tight" style={{ color: 'var(--ns-muted)' }}>
                  Priority reservations, complimentary amenities, and dedicated villa concierge
                </p>
              </div>
            </div>
            <button
              type="button"
              className={`glass-subtle ns-glass-hover relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                editForm.isVip ? 'glass ns-glass-selected' : 'glass'
              }`}
              aria-label="Toggle VIP Status"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full glass-subtle shadow-md ring-0 transition duration-200 ease-in-out ${
                  editForm.isVip ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Location & Identification */}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Nationality">
              <TextInput
                placeholder="e.g. Ghanaian"
                value={editForm.nationality}
                onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
              />
            </FormField>
            <FormField label="City / Country">
              <TextInput
                placeholder="e.g. Accra, Ghana"
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="ID Document Type">
              <SelectInput
                value={editForm.idDocumentType}
                onChange={(e) => setEditForm({ ...editForm, idDocumentType: e.target.value })}
              >
                <option value="">Select document type</option>
                <option value="PASSPORT">Passport</option>
                <option value="NATIONAL_ID">National ID / Ghana Card</option>
                <option value="DRIVERS_LICENSE">Driver's License</option>
                <option value="OTHER">Other</option>
              </SelectInput>
            </FormField>
            <FormField label="Document Number">
              <TextInput
                placeholder="e.g. GHA-000000000-0"
                value={editForm.idDocumentNumber}
                onChange={(e) => setEditForm({ ...editForm, idDocumentNumber: e.target.value })}
              />
            </FormField>
          </div>

          {/* Preferences & Staff Notes */}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Guest Preferences">
              <TextareaInput
                rows={2}
                placeholder="Pillow, dietary, or room preferences"
                value={editForm.preferences}
                onChange={(e) => setEditForm({ ...editForm, preferences: e.target.value })}
              />
            </FormField>
            <FormField label="Internal Staff Notes">
              <TextareaInput
                rows={2}
                placeholder="Internal service notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </FormField>
          </div>
        </form>
      </Modal>
    </ShellPage>
  );
};

export default GuestsPage;
