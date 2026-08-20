import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { guestsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { Plus, RefreshCw, UserRound, Search, Mail, Phone, MapPin, Calendar, CreditCard, BedDouble, Shield, Sparkles, Pencil, Eye } from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
import { formatCurrency, formatGuestName } from '@nslv/shared';

export const GuestsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const [data, setData] = useState<any[]>([]);
  const [q, setQ] = useState(initialSearch);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
    dateOfBirth: '',
    nationality: '',
    preferences: '',
    notes: '',
    isVip: false,
  });

  // Selected Guest Details Modal
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
      // Keep basic guest object if full lookup fails
      showToast('error', err instanceof Error ? err.message : 'Unable to load full guest details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const startEditGuest = (guest: any) => {
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
      dateOfBirth: guest.dateOfBirth ? String(guest.dateOfBirth).slice(0, 10) : '',
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
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : undefined,
        nationality: form.nationality.trim() || undefined,
        preferences: form.preferences.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isVip: form.isVip,
      });
      showToast('success', 'Guest profile created');
      setOpen(false);
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
        dateOfBirth: '',
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
        dateOfBirth: editForm.dateOfBirth ? new Date(editForm.dateOfBirth) : null,
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

  return (
    <ShellPage
      eyebrow="FRONT OFFICE · GUESTS"
      title="Guest directory"
      subtitle="A single guest profile connects reservations, active stays and financial folio history."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> New guest
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Guest profiles" value={data.length} icon={UserRound} />
        <StatTile label="VIP guests" value={data.filter((x) => x.isVip).length} note="Preferred guest profiles" icon={Sparkles} accent />
        <StatTile label="Search result" value={q ? `Filtered by "${q}"` : 'All guests'} note="Live database records" />
      </div>

      <Section title="Guest records" subtitle="Click on any guest row to view their complete profile and history">
        <Toolbar search={q} onSearch={setQ} placeholder="Search name, phone, email, document…" />

        {loading ? (
          <LoadingState />
        ) : data.length === 0 ? (
          <div className="p-5">
            <div className="rounded-2xl border border-dashed border-[#dfe4e0] p-12 text-center">
              <UserRound className="mx-auto text-[#a0aaad]" size={36} />
              <h3 className="mt-3 text-sm font-extrabold text-[#26363e]">No guest records found</h3>
              <p className="mt-1 text-xs text-[#899397]">
                {q ? 'No guests match your search criteria.' : 'Create the first guest profile when a new guest arrives.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                <tr>
                  <th className="px-5 py-3">Guest</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Stays</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {data.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => openGuestDetails(g)}
                    className="cursor-pointer hover:bg-[#f5f8f6] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9f3f5] text-xs font-extrabold text-[#16a4d4]">
                          {(g.firstName?.[0] || 'G') + (g.lastName?.[0] || '')}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-[#26363e]">
                              {formatGuestName(g)}
                            </span>
                            {g.isVip && (
                              <span className="inline-flex items-center rounded-full bg-[#fbf3db] px-2 py-0.5 text-[9px] font-extrabold text-[#a8761e]">
                                VIP
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[10px] font-mono text-[#9aa3a6]">{g.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[11px] text-[#667278]">
                      <div>{g.email || '—'}</div>
                      <div className="mt-0.5 text-[10px] text-[#8a9598]">{g.phone || '—'}</div>
                    </td>
                    <td className="px-5 py-4 text-[11px] text-[#667278]">
                      <div>{[g.city, g.country].filter(Boolean).join(', ') || '—'}</div>
                      {g.nationality && <div className="mt-0.5 text-[10px] text-[#8a9598]">{g.nationality}</div>}
                    </td>
                    <td className="px-5 py-4">
                      {g.isVip ? (
                        <span className="inline-flex items-center rounded-md bg-[#e8f2f4] px-2 py-1 text-[10px] font-extrabold text-[#16a4d4]">
                          VIP GUEST
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-[#f0f2f0] px-2 py-1 text-[10px] font-bold text-[#667278]">
                          STANDARD
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[11px] font-extrabold text-[#26363e]">
                      {g._count?.reservations ?? 0} bookings
                    </td>
                    <td className="px-5 py-4 text-[11px] text-[#8a9598]">
                      {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openGuestDetails(g)}
                      >
                        <Eye size={13} /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Guest Details Modal */}
      <Modal
        open={!!selectedGuestId}
        onClose={() => {
          setSelectedGuestId(null);
          setSelectedGuest(null);
        }}
        title={selectedGuest ? `Guest profile · ${formatGuestName(selectedGuest)}` : 'Guest profile'}
        size="lg"
      >
        {selectedGuest && (
          <div className="p-6 space-y-6">
            {/* Top Overview Banner */}
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-[#f7f9f8] border border-[#e8ebe8] p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#16a4d4] text-base font-extrabold text-white">
                  {(selectedGuest.firstName?.[0] || 'G') + (selectedGuest.lastName?.[0] || '')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-[#20343e]">
                      {formatGuestName(selectedGuest)}
                    </h3>
                    {selectedGuest.isVip && (
                      <span className="rounded-full bg-[#fbf3db] px-2.5 py-0.5 text-[10px] font-extrabold text-[#a8761e]">
                        VIP GUEST
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[#7d898d] space-x-2">
                    <span>ID: <span className="font-mono">{selectedGuest.id.slice(0, 8)}</span></span>
                    <span>·</span>
                    <span>Joined {selectedGuest.createdAt ? new Date(selectedGuest.createdAt).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
              </div>

              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => startEditGuest(selectedGuest)}>
                  <Pencil size={13} /> Edit profile
                </Button>
              )}
            </div>

            {loadingDetails ? (
              <LoadingState />
            ) : (
              <>
                {/* Information Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Contact Details */}
                  <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center gap-1.5">
                      <Mail size={13} /> Contact Information
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                        <span className="text-[#899397]">Email</span>
                        <span className="font-bold text-[#26363e]">{selectedGuest.email || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                        <span className="text-[#899397]">Phone</span>
                        <span className="font-bold text-[#26363e]">{selectedGuest.phone || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                        <span className="text-[#899397]">City / Country</span>
                        <span className="font-bold text-[#26363e]">
                          {[selectedGuest.city, selectedGuest.country].filter(Boolean).join(', ') || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#899397]">Street Address</span>
                        <span className="font-bold text-[#26363e] text-right">{selectedGuest.address || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Identity & Legal Info */}
                  <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center gap-1.5">
                      <Shield size={13} /> Identification & Profile
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                        <span className="text-[#899397]">Nationality</span>
                        <span className="font-bold text-[#26363e]">{selectedGuest.nationality || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                        <span className="text-[#899397]">ID Document</span>
                        <span className="font-bold text-[#26363e]">{selectedGuest.idDocumentType || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                        <span className="text-[#899397]">Document Number</span>
                        <span className="font-bold font-mono text-[#26363e]">
                          {canViewSensitive ? selectedGuest.idDocumentNumber || '—' : selectedGuest.idDocumentNumber ? '••••••••' : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#899397]">Date of Birth</span>
                        <span className="font-bold text-[#26363e]">
                          {selectedGuest.dateOfBirth ? new Date(selectedGuest.dateOfBirth).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preferences and Notes */}
                {(selectedGuest.preferences || selectedGuest.notes) && (
                  <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-2 text-xs">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d]">
                      Notes & Preferences
                    </div>
                    {selectedGuest.preferences && (
                      <div className="text-[#26363e]">
                        <span className="font-bold text-[#899397]">Preferences: </span>
                        {selectedGuest.preferences}
                      </div>
                    )}
                    {selectedGuest.notes && (
                      <div className="text-[#26363e]">
                        <span className="font-bold text-[#899397]">Staff notes: </span>
                        {selectedGuest.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Reservation & Stay History */}
                <div className="rounded-2xl border border-[#e8ebe8] bg-white p-5 space-y-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BedDouble size={14} /> Reservation & Stay History
                    </span>
                    <span className="text-[#899397]">
                      {selectedGuest.reservations?.length ?? 0} booking{(selectedGuest.reservations?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>

                  {(!selectedGuest.reservations || selectedGuest.reservations.length === 0) ? (
                    <div className="p-6 text-center text-xs text-[#899397]">
                      No previous bookings recorded for this guest.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                          <tr>
                            <th className="px-3 py-2">Confirmation</th>
                            <th className="px-3 py-2">Room</th>
                            <th className="px-3 py-2">Dates</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf0ed] text-xs">
                          {selectedGuest.reservations.map((item: any) => {
                            const res = item.reservation || item;
                            return (
                              <tr key={res.id} className="hover:bg-[#fbfcfa]">
                                <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-[#a8761e]">
                                  {res.confirmationNo || res.id.slice(0, 8)}
                                </td>
                                <td className="px-3 py-2.5 text-[#26363e]">
                                  {res.room ? `Room ${res.room.number}` : '—'}
                                  <div className="text-[10px] text-[#8a9598]">{res.room?.roomType?.name}</div>
                                </td>
                                <td className="px-3 py-2.5 text-[11px] text-[#667278]">
                                  {new Date(res.checkInDate).toLocaleDateString()} → {new Date(res.checkOutDate).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2.5 font-bold text-[#20343e]">
                                  {formatCurrency(res.totalAmount)}
                                </td>
                                <td className="px-3 py-2.5">
                                  {statusBadge(res.status)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setSelectedGuestId(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Guest Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Create guest profile" size="lg">
        <form onSubmit={saveNewGuest} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" required>
              <TextInput
                required
                placeholder="e.g. Kwame"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </FormField>
            <FormField label="Last name (optional)">
              <TextInput
                placeholder="e.g. Mensah"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email">
              <TextInput
                type="email"
                placeholder="guest@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>
            <FormField label="Phone">
              <TextInput
                placeholder="+233..."
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Address">
              <TextInput
                placeholder="Street address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </FormField>
            <FormField label="City">
              <TextInput
                placeholder="City / Region"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </FormField>
            <FormField label="Country">
              <TextInput
                placeholder="Country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Document Type">
              <SelectInput
                value={form.idDocumentType}
                onChange={(e) => setForm({ ...form, idDocumentType: e.target.value })}
              >
                <option value="">Select document type…</option>
                <option value="PASSPORT">Passport</option>
                <option value="NATIONAL_ID">National ID / Ghana Card</option>
                <option value="DRIVERS_LICENSE">Driver's License</option>
                <option value="OTHER">Other</option>
              </SelectInput>
            </FormField>
            <FormField label="Document Number">
              <TextInput
                placeholder="Document #"
                value={form.idDocumentNumber}
                onChange={(e) => setForm({ ...form, idDocumentNumber: e.target.value })}
              />
            </FormField>
            <FormField label="Nationality">
              <TextInput
                placeholder="Nationality"
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Preferences">
              <TextInput
                placeholder="e.g. High floor, quiet room"
                value={form.preferences}
                onChange={(e) => setForm({ ...form, preferences: e.target.value })}
              />
            </FormField>
            <FormField label="Staff notes">
              <TextInput
                placeholder="Internal notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </FormField>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="vip-check"
              checked={form.isVip}
              onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
              className="h-4 w-4 rounded border-[#ced5ce] text-[#16a4d4] focus:ring-[#16a4d4]"
            />
            <label htmlFor="vip-check" className="text-xs font-bold text-[#26363e]">
              Mark as VIP Guest
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#edf0ed]">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create guest
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Guest Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit guest profile" size="lg">
        <form onSubmit={saveEditGuest} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" required>
              <TextInput
                required
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
              />
            </FormField>
            <FormField label="Last name (optional)">
              <TextInput
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email">
              <TextInput
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </FormField>
            <FormField label="Phone">
              <TextInput
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Address">
              <TextInput
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </FormField>
            <FormField label="City">
              <TextInput
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              />
            </FormField>
            <FormField label="Country">
              <TextInput
                value={editForm.country}
                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Document Type">
              <SelectInput
                value={editForm.idDocumentType}
                onChange={(e) => setEditForm({ ...editForm, idDocumentType: e.target.value })}
              >
                <option value="">Select document type…</option>
                <option value="PASSPORT">Passport</option>
                <option value="NATIONAL_ID">National ID / Ghana Card</option>
                <option value="DRIVERS_LICENSE">Driver's License</option>
                <option value="OTHER">Other</option>
              </SelectInput>
            </FormField>
            <FormField label="Document Number">
              <TextInput
                value={editForm.idDocumentNumber}
                onChange={(e) => setEditForm({ ...editForm, idDocumentNumber: e.target.value })}
              />
            </FormField>
            <FormField label="Nationality">
              <TextInput
                value={editForm.nationality}
                onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Preferences">
              <TextInput
                value={editForm.preferences}
                onChange={(e) => setEditForm({ ...editForm, preferences: e.target.value })}
              />
            </FormField>
            <FormField label="Staff notes">
              <TextInput
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </FormField>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="vip-edit-check"
              checked={editForm.isVip}
              onChange={(e) => setEditForm({ ...editForm, isVip: e.target.checked })}
              className="h-4 w-4 rounded border-[#ced5ce] text-[#16a4d4] focus:ring-[#16a4d4]"
            />
            <label htmlFor="vip-edit-check" className="text-xs font-bold text-[#26363e]">
              Mark as VIP Guest
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#edf0ed]">
            <Button variant="ghost" type="button" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>
    </ShellPage>
  );
};

export default GuestsPage;