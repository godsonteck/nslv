import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { guestsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import {
  Plus,
  RefreshCw,
  UserRound,
  Search,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  BedDouble,
  Shield,
  Sparkles,
  Pencil,
  Eye,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Building,
  Tag,
} from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { formatCurrency, formatGuestName } from '@nslv/shared';

export const GuestsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const [data, setData] = useState<any[]>([]);
  const [q, setQ] = useState(initialSearch);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMoreCreate, setShowMoreCreate] = useState(false);
  const [showMoreEdit, setShowMoreEdit] = useState(false);
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
      showToast('success', 'Guest profile created successfully!');
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

  const vipCount = data.filter((x) => x.isVip).length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c59a58]/30 bg-[#fbf8f2] px-3 py-1 text-[11px] font-bold tracking-wider text-[#9b6e2e] uppercase shadow-xs">
            <Sparkles size={13} className="text-[#c59a58]" />
            Guest Relations
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0f172a]">
            Guest Directory
          </h1>
          <p className="mt-1 text-xs text-[#64748b]">
            Comprehensive guest profiles connecting reservation history, stays, preferences, and folios.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="border-[#cbd5e1] hover:bg-[#0c1921] bg-[#0c1921]/70 shadow-xs text-xs font-semibold gap-1.5"
          >
            <RefreshCw size={14} /> Refresh
          </Button>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setOpen(true)}
              className="bg-gradient-to-r from-[#174b59] to-[#0f3440] hover:from-[#133e4a] hover:to-[#0a232b] text-white shadow-md text-xs font-semibold gap-1.5"
            >
              <Plus size={14} /> Register New Guest
            </Button>
          )}
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Total Profiles */}
        <div className="rounded-2xl border border-[#cbd5e1]/70 bg-[#0c1921] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Total Registered Guests</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e2535] text-[#174b59]">
              <UserRound size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-[#0f172a]">{data.length}</div>
          <div className="mt-1 text-xs text-[#64748b]">Active directory profiles</div>
        </div>

        {/* VIP Guests */}
        <div className="rounded-2xl border border-[#c59a58]/40 bg-gradient-to-br from-white to-[#fbf8f2] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9b6e2e]">VIP Guests</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-[#9b6e2e]">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-[#9b6e2e]">{vipCount}</div>
          <div className="mt-1 text-xs text-[#9b6e2e] font-medium">Preferred VIP guest profiles</div>
        </div>

        {/* Filter / Search Status */}
        <div className="rounded-2xl border border-[#cbd5e1]/70 bg-[#0c1921] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Search Status</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Search size={18} />
            </div>
          </div>
          <div className="mt-3 text-lg font-bold text-[#0f172a] truncate">
            {q ? `Filter: "${q}"` : 'All Guests'}
          </div>
          <div className="mt-1 text-xs text-[#64748b]">Real-time profile lookup</div>
        </div>
      </div>

      {/* ── Main Guest Table Section ── */}
      <div className="rounded-2xl border border-[#cbd5e1]/70 bg-[#0c1921] shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e2e8f0] px-6 py-4 bg-[#0f141d]/50 gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
              <UserCheck size={16} className="text-[#174b59]" />
              Guest Records
            </h2>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Click any guest row to view complete profile, stay history, and identity records.
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568]" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, phone, email, doc #..."
              className="w-full rounded-xl border border-[#cbd5e1] pl-9 pr-3 py-1.5 text-xs text-[#0f172a] focus:border-[#174b59] focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : data.length === 0 ? (
          <div className="p-12 text-center">
            <UserRound className="mx-auto text-[#4a5568]" size={40} />
            <h3 className="mt-3 text-sm font-extrabold text-[#0f172a]">No guest records found</h3>
            <p className="mt-1 text-xs text-[#64748b]">
              {q ? 'No guests match your search criteria.' : 'Register the first guest profile when a new guest arrives.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[#e2e8f0] bg-[#0f141d] text-[10px] uppercase font-bold tracking-wider text-[#64748b]">
                <tr>
                  <th className="px-6 py-3.5">Guest Name &amp; Code</th>
                  <th className="px-6 py-3.5">Contact Details</th>
                  <th className="px-6 py-3.5">Origin / Nationality</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-center">Total Stays</th>
                  <th className="px-6 py-3.5">Registration</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {data.map((g) => {
                  const initials = (g.firstName?.[0] || 'G') + (g.lastName?.[0] || '');
                  return (
                    <tr
                      key={g.id}
                      onClick={() => openGuestDetails(g)}
                      className="cursor-pointer hover:bg-[#0f141d]/80 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-xs ${
                              g.isVip
                                ? 'bg-gradient-to-br from-[#c59a58] to-[#9b6e2e] text-white'
                                : 'bg-[#e9f3f5] text-[#174b59]'
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#0f172a] group-hover:text-[#174b59] transition-colors">
                                {formatGuestName(g)}
                              </span>
                              {g.isVip && (
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-800">
                                  <Sparkles size={9} /> VIP
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-[10px] font-mono text-[#94a3b8]">
                              ID: {g.id.slice(0, 8).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs text-[#64748b]">
                        <div className="font-medium text-[#0f172a]">{g.email || '—'}</div>
                        <div className="text-[11px] text-[#64748b] mt-0.5">{g.phone || '—'}</div>
                      </td>

                      <td className="px-6 py-4 text-xs text-[#64748b]">
                        <div className="font-medium text-[#0f172a]">{[g.city, g.country].filter(Boolean).join(', ') || '—'}</div>
                        {g.nationality && (
                          <div className="text-[10px] text-[#64748b] mt-0.5">{g.nationality}</div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {g.isVip ? (
                          <span className="inline-flex items-center rounded-md border border-[#c59a58]/40 bg-[#fbf8f2] px-2 py-1 text-[10px] font-black text-[#9b6e2e]">
                            VIP GUEST
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-[#1e2535] bg-[#1e2535] px-2 py-1 text-[10px] font-semibold text-[#6e7a8a]">
                            STANDARD
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center rounded-full bg-[#1e2535] px-2.5 py-1 text-xs font-extrabold text-[#0f172a]">
                          {g._count?.reservations ?? 0}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-[#64748b]">
                        {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '—'}
                      </td>

                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openGuestDetails(g)}
                          className="border-[#cbd5e1] hover:bg-[#1e2535] text-xs font-semibold gap-1"
                        >
                          <Eye size={13} /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Guest Details Modal ── */}
      <Modal
        open={!!selectedGuestId}
        onClose={() => {
          setSelectedGuestId(null);
          setSelectedGuest(null);
        }}
        title={selectedGuest ? `Guest Profile: ${formatGuestName(selectedGuest)}` : 'Guest Profile'}
        size="lg"
      >
        {selectedGuest && (
          <div className="p-6 space-y-6">
            {/* Top Overview Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 to-[#102433] text-white p-5 shadow-xs">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-black shadow-md ${
                    selectedGuest.isVip
                      ? 'bg-gradient-to-br from-[#c59a58] to-[#9b6e2e] text-white'
                      : 'bg-[#0c1921]/10 text-white'
                  }`}
                >
                  {(selectedGuest.firstName?.[0] || 'G') + (selectedGuest.lastName?.[0] || '')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">{formatGuestName(selectedGuest)}</h3>
                    {selectedGuest.isVip && (
                      <span className="rounded-full bg-amber-400/20 border border-amber-300/40 px-2.5 py-0.5 text-[10px] font-black text-amber-300">
                        VIP GUEST
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-300 flex items-center gap-2">
                    <span>Code: <span className="font-mono text-white">{selectedGuest.id.slice(0, 8).toUpperCase()}</span></span>
                    <span className="text-slate-400">|</span>
                    <span>Joined {selectedGuest.createdAt ? new Date(selectedGuest.createdAt).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
              </div>

              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEditGuest(selectedGuest)}
                  className="bg-[#0c1921]/10 hover:bg-[#0c1921]/20 border-white/20 text-white text-xs font-semibold gap-1.5 self-start sm:self-auto"
                >
                  <Pencil size={13} /> Edit Profile
                </Button>
              )}
            </div>

            {loadingDetails ? (
              <LoadingState />
            ) : (
              <>
                {/* Contact & Identity Cards */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Contact Details */}
                  <div className="rounded-2xl border border-[#1e2535] bg-[#0c1921] p-5 space-y-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#6e7a8a] flex items-center gap-1.5">
                      <Mail size={13} className="text-[#174b59]" /> Contact Information
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#1e2535]">
                        <span className="text-[#6e7a8a]">Email Address</span>
                        <span className="font-bold text-[#0f172a]">{selectedGuest.email || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1e2535]">
                        <span className="text-[#6e7a8a]">Phone Number</span>
                        <span className="font-bold text-[#0f172a]">{selectedGuest.phone || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1e2535]">
                        <span className="text-[#6e7a8a]">City / Country</span>
                        <span className="font-bold text-[#0f172a]">
                          {[selectedGuest.city, selectedGuest.country].filter(Boolean).join(', ') || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#6e7a8a]">Physical Address</span>
                        <span className="font-bold text-[#0f172a] text-right">{selectedGuest.address || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Identity Verification */}
                  <div className="rounded-2xl border border-[#1e2535] bg-[#0c1921] p-5 space-y-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#6e7a8a] flex items-center gap-1.5">
                      <Shield size={13} className="text-[#c59a58]" /> Identification &amp; Compliance
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#1e2535]">
                        <span className="text-[#6e7a8a]">Nationality</span>
                        <span className="font-bold text-[#0f172a]">{selectedGuest.nationality || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1e2535]">
                        <span className="text-[#6e7a8a]">ID Document Type</span>
                        <span className="font-bold text-[#0f172a]">{selectedGuest.idDocumentType || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1e2535]">
                        <span className="text-[#6e7a8a]">Document Number</span>
                        <span className="font-bold font-mono text-[#0f172a]">
                          {canViewSensitive
                            ? selectedGuest.idDocumentNumber || '—'
                            : selectedGuest.idDocumentNumber
                            ? '••••••••'
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#6e7a8a]">Date of Birth</span>
                        <span className="font-bold text-[#0f172a]">
                          {selectedGuest.dateOfBirth ? new Date(selectedGuest.dateOfBirth).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preferences and Notes */}
                {(selectedGuest.preferences || selectedGuest.notes) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-2 text-xs">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <Tag size={13} /> Preferences &amp; Guest Notes
                    </div>
                    {selectedGuest.preferences && (
                      <div className="text-amber-950">
                        <span className="font-bold text-amber-800">Preferences: </span>
                        {selectedGuest.preferences}
                      </div>
                    )}
                    {selectedGuest.notes && (
                      <div className="text-amber-950">
                        <span className="font-bold text-amber-800">Staff Notes: </span>
                        {selectedGuest.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Stays History */}
                <div className="rounded-2xl border border-[#1e2535] bg-[#0c1921] p-5 space-y-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#6e7a8a] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BedDouble size={14} className="text-[#174b59]" /> Reservation &amp; Stay History
                    </span>
                    <span className="text-[#4a5568]">
                      {selectedGuest.reservations?.length ?? 0} booking{(selectedGuest.reservations?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>

                  {!selectedGuest.reservations || selectedGuest.reservations.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#4a5568]">
                      No previous bookings recorded for this guest.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-[#0f141d] border-b border-[#1e2535] text-[10px] uppercase font-bold text-[#6e7a8a]">
                          <tr>
                            <th className="px-3 py-2.5">Confirmation</th>
                            <th className="px-3 py-2.5">Room</th>
                            <th className="px-3 py-2.5">Dates</th>
                            <th className="px-3 py-2.5">Amount</th>
                            <th className="px-3 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e2535] text-xs">
                          {selectedGuest.reservations.map((item: any) => {
                            const res = item.reservation || item;
                            return (
                              <tr key={res.id} className="hover:bg-[#0f141d]/80">
                                <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-[#c59a58]">
                                  {res.confirmationNo || res.id.slice(0, 8).toUpperCase()}
                                </td>
                                <td className="px-3 py-2.5 text-[#0f172a]">
                                  {res.room ? `Room ${res.room.number}` : '—'}
                                  <div className="text-[10px] text-[#4a5568]">{res.room?.roomType?.name}</div>
                                </td>
                                <td className="px-3 py-2.5 text-[11px] text-[#6e7a8a]">
                                  {new Date(res.checkInDate).toLocaleDateString()} &rarr; {new Date(res.checkOutDate).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2.5 font-bold text-[#0f172a]">
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

            <div className="flex justify-end pt-2 border-t border-[#1e2535]">
              <Button variant="outline" onClick={() => setSelectedGuestId(null)}>
                Close Profile
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Guest Modal ── */}
      <Modal open={open} onClose={() => setOpen(false)} title="Register New Guest Profile" size="md">
        <form onSubmit={saveNewGuest} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First Name" required>
              <TextInput
                required
                placeholder="e.g. Kwame"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </FormField>
            <FormField label="Last Name (Optional)">
              <TextInput
                placeholder="e.g. Mensah"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Phone Number">
              <TextInput
                placeholder="e.g. 0244123456"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </FormField>
            <FormField label="Email Address (Optional)">
              <TextInput
                type="email"
                placeholder="guest@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="vip-check"
              checked={form.isVip}
              onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
              className="h-4 w-4 rounded accent-[#c59a58]"
            />
            <label htmlFor="vip-check" className="text-xs font-bold text-[#0f172a] cursor-pointer">
              Mark as VIP Guest
            </label>
          </div>

          {/* Additional details toggle */}
          <div className="border-t border-[#1e2535] pt-3">
            <button
              type="button"
              onClick={() => setShowMoreCreate(!showMoreCreate)}
              className="flex w-full items-center justify-between rounded-xl bg-[#1e2535] px-3.5 py-2.5 text-xs font-bold text-[#a0a9b8] hover:bg-slate-200 transition-colors"
            >
              <span>{showMoreCreate ? '− Hide additional details' : '+ Additional details (ID Document, Address, Notes — Optional)'}</span>
              {showMoreCreate ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showMoreCreate && (
              <div className="mt-3 space-y-3.5 rounded-xl border border-[#1e2535] bg-[#0f141d]/50 p-3.5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Document Type">
                    <SelectInput
                      value={form.idDocumentType}
                      onChange={(e) => setForm({ ...form, idDocumentType: e.target.value })}
                    >
                      <option value="">Select type…</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="NATIONAL_ID">National ID / Ghana Card</option>
                      <option value="DRIVERS_LICENSE">Driver's License</option>
                      <option value="OTHER">Other</option>
                    </SelectInput>
                  </FormField>
                  <FormField label="Document Number">
                    <TextInput
                      placeholder="Doc #"
                      value={form.idDocumentNumber}
                      onChange={(e) => setForm({ ...form, idDocumentNumber: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Nationality">
                    <TextInput
                      placeholder="e.g. Ghanaian"
                      value={form.nationality}
                      onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                    />
                  </FormField>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Preferences">
                    <TextInput
                      placeholder="e.g. High floor, quiet room"
                      value={form.preferences}
                      onChange={(e) => setForm({ ...form, preferences: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Staff Notes">
                    <TextInput
                      placeholder="Internal staff notes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </FormField>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#1e2535]">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="bg-gradient-to-r from-[#174b59] to-[#0f3440] text-white">
              Create Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Guest Modal ── */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Guest Profile" size="md">
        <form onSubmit={saveEditGuest} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First Name" required>
              <TextInput
                required
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
              />
            </FormField>
            <FormField label="Last Name (Optional)">
              <TextInput
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Phone Number">
              <TextInput
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </FormField>
            <FormField label="Email Address (Optional)">
              <TextInput
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </FormField>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="vip-edit-check"
              checked={editForm.isVip}
              onChange={(e) => setEditForm({ ...editForm, isVip: e.target.checked })}
              className="h-4 w-4 rounded accent-[#c59a58]"
            />
            <label htmlFor="vip-edit-check" className="text-xs font-bold text-[#0f172a] cursor-pointer">
              Mark as VIP Guest
            </label>
          </div>

          <div className="border-t border-[#1e2535] pt-3">
            <button
              type="button"
              onClick={() => setShowMoreEdit(!showMoreEdit)}
              className="flex w-full items-center justify-between rounded-xl bg-[#1e2535] px-3.5 py-2.5 text-xs font-bold text-[#a0a9b8] hover:bg-slate-200 transition-colors"
            >
              <span>{showMoreEdit ? '− Hide additional details' : '+ Additional details (ID Document, Address, Notes — Optional)'}</span>
              {showMoreEdit ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showMoreEdit && (
              <div className="mt-3 space-y-3.5 rounded-xl border border-[#1e2535] bg-[#0f141d]/50 p-3.5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Document Type">
                    <SelectInput
                      value={editForm.idDocumentType}
                      onChange={(e) => setEditForm({ ...editForm, idDocumentType: e.target.value })}
                    >
                      <option value="">Select type…</option>
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

                <div className="grid gap-3 sm:grid-cols-3">
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Preferences">
                    <TextInput
                      value={editForm.preferences}
                      onChange={(e) => setEditForm({ ...editForm, preferences: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Staff Notes">
                    <TextInput
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    />
                  </FormField>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#1e2535]">
            <Button variant="ghost" type="button" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="bg-gradient-to-r from-[#174b59] to-[#0f3440] text-white">
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default GuestsPage;
