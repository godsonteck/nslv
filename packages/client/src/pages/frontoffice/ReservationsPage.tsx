import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reservationsApi, roomsApi, guestsApi, paymentsApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { CalendarDays, Plus, RefreshCw, Users, Link2, X, Minus, MoreHorizontal, Trash2, Pencil, Eye, UserX, BedDouble, Shield, Printer, Mail, Phone, Clock, FileText, CreditCard, ChevronUp, ChevronDown, ChevronRight, ChevronsUpDown, ArrowUpDown } from 'lucide-react';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState, statusBadge } from '../../components/ui';
import { TenderSplit, makeTenderRow, parseTenders, tendersCoverTotal, type TenderRow } from '../../components/ui/TenderSplit';
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
import { formatCurrency, formatGuestName } from '@nslv/shared';
import { printPaymentReceipt } from '../../lib/company';

const uid = () => Math.random().toString(36).slice(2, 10);

type Person = { key: string; mode: 'existing' | 'new'; guestId: string; firstName: string; lastName: string; phone: string; email: string; address: string; city: string; country: string; nationality: string; idDocumentType: string; idDocumentNumber: string; dateOfBirth: string; preferences: string; notes: string; isVip: boolean };
type RoomLine = { key: string; roomId: string; adults: string; children: string; primaryKey: string; additionalKeys: string[] };

const emptyPerson: Person = { key: uid(), mode: 'existing', guestId: '', firstName: '', lastName: '', phone: '', email: '', address: '', city: '', country: '', nationality: '', idDocumentType: '', idDocumentNumber: '', dateOfBirth: '', preferences: '', notes: '', isVip: false };
const emptyRoomLine = (primaryKey: string): RoomLine => ({ key: uid(), roomId: '', adults: '1', children: '0', primaryKey, additionalKeys: [] });

const guestName = (g: any) => (g ? `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim() || '—' : '—');

const recordedDeposits = (r: any) => (r?.payments || []).filter((p: any) => p.status === 'COMPLETED' && !p.voidedAt);
const recordedDepositTotal = (r: any) => recordedDeposits(r).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
const reservationBalance = (r: any) => Math.max(0, Number(r?.totalAmount || 0) - recordedDepositTotal(r));
// A reservation is fully paid once the recorded payments cover the whole amount due.
const isFullyPaid = (r: any) => Number(r?.totalAmount || 0) > 0 && reservationBalance(r) === 0;

export const ReservationsPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sortField, setSortField] = useState<'checkInDate' | 'checkOutDate' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Single-room booking
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('existing');
  const [guestFilter, setGuestFilter] = useState('');
  const [newGuest, setNewGuest] = useState({ firstName: '', lastName: '', phone: '', email: '', address: '', city: '', country: '', nationality: '', idDocumentType: '', idDocumentNumber: '', dateOfBirth: '', preferences: '', notes: '', isVip: false });
  const [form, setForm] = useState({ guestId: '', roomId: '', checkInDate: '', checkOutDate: '', adults: '1', children: '0', discountAmount: '', discountReason: '', additionalGuestIds: [] as string[], depositAmount: '', depositMethod: 'CASH', depositReference: '' });

  // Multi-room (group) booking
  const [multi, setMulti] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [roomLines, setRoomLines] = useState<RoomLine[]>([]);
  const [bookingDates, setBookingDates] = useState({ checkInDate: '', checkOutDate: '' });
  const [groupDeposit, setGroupDeposit] = useState({ amount: '', method: 'CASH', reference: '', tendered: '' });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [depositTargetGroup, setDepositTargetGroup] = useState<any | null>(null);
  const [availableRoomIds, setAvailableRoomIds] = useState<Set<string> | null>(null);
  const [editAvailableRoomIds, setEditAvailableRoomIds] = useState<Set<string> | null>(null);
  const [editAvailabilityLoading, setEditAvailabilityLoading] = useState(false);

  // Add room to an existing group party
  const [addRoomGroup, setAddRoomGroup] = useState<any | null>(null);
  const [addRoomForm, setAddRoomForm] = useState({ roomId: '', guestId: '', adults: '1', children: '0' });
  const [addRoomAvailableRoomIds, setAddRoomAvailableRoomIds] = useState<Set<string> | null>(null);

  // Manage guests on an existing reservation
  const [manageOpen, setManageOpen] = useState(false);
  const [manageRes, setManageRes] = useState<any>(null);
  const [manageIds, setManageIds] = useState<string[]>([]);
  const [editRes, setEditRes] = useState<any>(null);
  const [editForm, setEditForm] = useState({ roomId: '', checkInDate: '', checkOutDate: '', adults: '1', children: '0', source: '', specialRequests: '', notes: '' });
  
  // Reservation Details Popup
  const [detailsRes, setDetailsRes] = useState<any | null>(null);

  // Record a partial payment against an existing reservation or group
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositForm, setDepositForm] = useState({ amount: '', method: 'CASH', reference: '', tendered: '' });
  const [depositSplitOpen, setDepositSplitOpen] = useState(false);
  const [depositTenders, setDepositTenders] = useState<TenderRow[]>([makeTenderRow()]);

  const canDeleteCancelled = useAuthStore((s) => s.hasRole('admin'));
  const canEdit = useAuthStore((s) => s.hasPermission('reservations.edit'));
  const canCancel = useAuthStore((s) => s.hasPermission('reservations.cancel') || s.hasRole('admin'));
  const isAdmin = useAuthStore((s) => s.hasRole('admin'));
  const canDiscount = useAuthStore((s) => s.hasPermission('folios.adjust'));
  const canProcessPayment = useAuthStore((s) => s.hasPermission('payments.create'));
  const navigate = useNavigate();

  const tableRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      setLoading(true);
      // 'CONFIRMED_PENDING' is a pseudo-status: fetch all and let client filter
      const apiStatus = (status === 'ALL' || status === 'CONFIRMED_PENDING') ? undefined : status;
      const [r, rm, g] = await Promise.all([
        reservationsApi.list({ search: q || undefined, status: apiStatus }),
        roomsApi.getRooms(),
        guestsApi.list(),
      ]);
      const raw: any[] = r.data || [];
      // Client-side filter for the CONFIRMED_PENDING pseudo-status
      const list = status === 'CONFIRMED_PENDING'
        ? raw.filter((x) => ['CONFIRMED', 'PENDING'].includes(String(x.status).toUpperCase()))
        : raw;
      setData(list);
      setRooms(rm.data || []);
      setGuests(g.data || []);
      // Keep an open detail panel in sync with the freshly loaded data so
      // recorded payments, amounts and balance stay current after a refresh.
      setDetailsRes((prev: any) => {
        if (!prev) return prev;
        return list.find((x: any) => x.id === prev.id) || prev;
      });
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load reservations');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [q, status]);

  const scrollToTable = (newStatus: string) => {
    setStatus(newStatus);
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  useEffect(() => {
    const dates = multi ? bookingDates : form;
    if (!dates.checkInDate || !dates.checkOutDate || dates.checkOutDate <= dates.checkInDate) {
      setAvailableRoomIds(null);
      return;
    }
    let cancelled = false;
    reservationsApi.checkAvailability(dates.checkInDate, dates.checkOutDate)
      .then((result) => {
        if (!cancelled) setAvailableRoomIds(new Set((result.data || []).map((room: any) => room.id)));
      })
      .catch((error) => {
        if (!cancelled) {
          setAvailableRoomIds(null);
          showToast('error', error instanceof Error ? error.message : 'Unable to check room availability');
        }
      });
    return () => { cancelled = true; };
  }, [multi, bookingDates.checkInDate, bookingDates.checkOutDate, form.checkInDate, form.checkOutDate]);

  const bookableRooms = availableRoomIds === null ? [] : rooms.filter((room) => availableRoomIds.has(room.id));

  // Availability check for the edit form — re-run whenever dates change
  useEffect(() => {
    if (!editRes) return;
    const { checkInDate, checkOutDate } = editForm;
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      setEditAvailableRoomIds(null);
      return;
    }
    let cancelled = false;
    setEditAvailabilityLoading(true);
    reservationsApi.checkAvailability(checkInDate, checkOutDate)
      .then((result) => {
        if (!cancelled) setEditAvailableRoomIds(new Set((result.data || []).map((room: any) => room.id)));
      })
      .catch(() => {
        if (!cancelled) setEditAvailableRoomIds(null);
      })
      .finally(() => { if (!cancelled) setEditAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [editRes, editForm.checkInDate, editForm.checkOutDate]);

  const resetSingle = () => {
    setGuestMode('existing');
    setGuestFilter('');
    setNewGuest({ firstName: '', lastName: '', phone: '', email: '', address: '', city: '', country: '', nationality: '', idDocumentType: '', idDocumentNumber: '', dateOfBirth: '', preferences: '', notes: '', isVip: false });
    setForm({ guestId: '', roomId: '', checkInDate: '', checkOutDate: '', adults: '1', children: '0', discountAmount: '', discountReason: '', additionalGuestIds: [], depositAmount: '', depositMethod: 'CASH', depositReference: '' });
  };

  const startMulti = () => {
    setMulti(true);
    if (people.length === 0 && roomLines.length === 0) {
      const p = { ...emptyPerson };
      setPeople([p]);
      // Default to 2 rooms so group booking is unmistakably for multiple rooms
      setRoomLines([emptyRoomLine(p.key), emptyRoomLine(p.key)]);
    } else if (roomLines.length <= 1) {
      const pKey = people[0]?.key || uid();
      if (people.length === 0) setPeople([{ ...emptyPerson, key: pKey }]);
      setRoomLines([emptyRoomLine(pKey), emptyRoomLine(pKey)]);
    }
  };

  const setMultiRoomCount = (count: number) => {
    const pKey = people[0]?.key || uid();
    if (people.length === 0) setPeople([{ ...emptyPerson, key: pKey }]);
    setRoomLines((curr) => {
      if (curr.length === count) return curr;
      if (curr.length < count) {
        const added = Array.from({ length: count - curr.length }, () => emptyRoomLine(pKey));
        return [...curr, ...added];
      }
      return curr.slice(0, count);
    });
  };

  const closeModal = () => {
    setOpen(false);
    setMulti(false);
    setPeople([]);
    setRoomLines([]);
    setBookingDates({ checkInDate: '', checkOutDate: '' });
    setGroupDeposit({ amount: '', method: 'CASH', reference: '', tendered: '' });
    resetSingle();
  };

  const toggleFormGuest = (id: string) =>
    setForm((f) => ({
      ...f,
      additionalGuestIds: f.additionalGuestIds.includes(id) ? f.additionalGuestIds.filter((x) => x !== id) : [...f.additionalGuestIds, id],
    }));

  const createNewGuests = async (targets: Person[]) => {
    const map = new Map<string, string>();
    for (const p of targets) {
      if (p.mode === 'existing') {
        if (!p.guestId) throw new Error('Choose an existing guest for every person.');
        map.set(p.key, p.guestId);
      } else {
        if (!p.firstName.trim()) throw new Error('Enter a first name for each new guest.');
        const created = await guestsApi.create({
          firstName: p.firstName.trim(),
          lastName: p.lastName.trim() || undefined,
          phone: p.phone.trim() || undefined,
          email: p.email.trim() || undefined,
          address: p.address.trim() || undefined,
          city: p.city.trim() || undefined,
          country: p.country.trim() || undefined,
          nationality: p.nationality.trim() || undefined,
          idDocumentType: p.idDocumentType || undefined,
          idDocumentNumber: p.idDocumentNumber.trim() || undefined,
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : undefined,
          preferences: p.preferences.trim() || undefined,
          notes: p.notes.trim() || undefined,
          isVip: p.isVip,
        });
        map.set(p.key, created.data?.id ?? created.id);
      }
    }
    return map;
  };

  const openAddRoomToGroup = (group: any) => {
    setAddRoomGroup(group);
    setAddRoomForm({ roomId: '', guestId: group.leadGuest?.id || '', adults: '1', children: '0' });
    reservationsApi.checkAvailability(String(group.checkInDate).slice(0, 10), String(group.checkOutDate).slice(0, 10))
      .then((res) => {
        setAddRoomAvailableRoomIds(new Set((res.data || []).map((rm: any) => rm.id)));
      })
      .catch(() => setAddRoomAvailableRoomIds(null));
  };

  const submitAddRoomToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addRoomGroup) return;
    try {
      setSaving(true);
      await reservationsApi.create({
        roomId: addRoomForm.roomId,
        guestId: addRoomForm.guestId,
        checkInDate: String(addRoomGroup.checkInDate).slice(0, 10),
        checkOutDate: String(addRoomGroup.checkOutDate).slice(0, 10),
        adults: Number(addRoomForm.adults) || 1,
        children: Number(addRoomForm.children) || 0,
        bookingId: addRoomGroup.bookingId,
      });
      showToast('success', `Room added to group booking ${addRoomGroup.bookingId}`);
      setAddRoomGroup(null);
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to add room to group');
    } finally {
      setSaving(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (multi) {
        if (roomLines.length === 0) throw new Error('Add at least one room to the booking.');
        const keyToGuest = await createNewGuests(people);
        const leadGuestId = keyToGuest.get(people[0]?.key);
        const roomsPayload = roomLines.map((line) => {
          if (!line.roomId) throw new Error('Every room needs a room selected.');
          const primaryGuestId = keyToGuest.get(line.primaryKey) || leadGuestId;
          if (!primaryGuestId) throw new Error('Every room needs a primary guest (or select the lead guest).');
          return {
            roomId: line.roomId,
            guestId: primaryGuestId,
            adults: Number(line.adults) || 1,
            children: Number(line.children) || 0,
            additionalGuestIds: line.additionalKeys.map((k) => keyToGuest.get(k)!).filter(Boolean),
          };
        });
        const gDepositAmount = Number(groupDeposit.amount);
        if (gDepositAmount > 0 && gDepositAmount > Math.max(0, groupEstimatedTotal)) {
          throw new Error(`Group partial payment cannot exceed the estimated group total of ${formatCurrency(groupEstimatedTotal)}.`);
        }
        const res = await reservationsApi.createMulti({
          checkInDate: bookingDates.checkInDate,
          checkOutDate: bookingDates.checkOutDate,
          depositAmount: gDepositAmount > 0 ? gDepositAmount : undefined,
          depositMethod: gDepositAmount > 0 ? groupDeposit.method : undefined,
          depositReference: gDepositAmount > 0 && groupDeposit.reference.trim() ? groupDeposit.reference.trim() : undefined,
          rooms: roomsPayload,
        });
        const count = res.data?.reservations?.length ?? roomsPayload.length;
        showToast('success', `Group booking created — ${count} room${count === 1 ? '' : 's'} under group ${res.data?.bookingId ?? ''}`);
      } else {
        let guestId = form.guestId;
        if (guestMode === 'new') {
          if (!newGuest.firstName.trim()) throw new Error('Enter the new guest first name.');
          const created = await guestsApi.create({
            firstName: newGuest.firstName.trim(),
            lastName: newGuest.lastName.trim() || undefined,
            phone: newGuest.phone.trim() || undefined,
            email: newGuest.email.trim() || undefined,
            address: newGuest.address.trim() || undefined,
            city: newGuest.city.trim() || undefined,
            country: newGuest.country.trim() || undefined,
            nationality: newGuest.nationality.trim() || undefined,
            idDocumentType: newGuest.idDocumentType || undefined,
            idDocumentNumber: newGuest.idDocumentNumber.trim() || undefined,
            dateOfBirth: newGuest.dateOfBirth ? new Date(newGuest.dateOfBirth) : undefined,
            preferences: newGuest.preferences.trim() || undefined,
            notes: newGuest.notes.trim() || undefined,
            isVip: newGuest.isVip,
          });
          guestId = created.data?.id ?? created.id;
        }
        await reservationsApi.create({
          guestId,
          roomId: form.roomId,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          adults: Number(form.adults),
          children: Number(form.children),
          discountAmount: Number(form.discountAmount) || 0,
          discountReason: form.discountAmount ? form.discountReason.trim() : undefined,
          additionalGuestIds: form.additionalGuestIds,
          depositAmount: Number(form.depositAmount) > 0 ? Number(form.depositAmount) : undefined,
          depositMethod: Number(form.depositAmount) > 0 ? form.depositMethod : undefined,
          depositReference: Number(form.depositAmount) > 0 && form.depositReference.trim() ? form.depositReference.trim() : undefined,
        });
        showToast('success', guestMode === 'new' ? 'Guest created and reservation booked' : 'Reservation created');
      }
      closeModal();
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to create reservation');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this reservation?')) return;
    try {
      await reservationsApi.cancel(id, 'Cancelled from NSVilla front office');
      showToast('success', 'Reservation cancelled');
      if (detailsRes?.id === id) setDetailsRes(null);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to cancel reservation');
    }
  };

  const markNoShow = async (id: string) => {
    const reason = window.prompt('Enter reason for marking as NO-SHOW (optional):', 'Guest did not arrive');
    if (reason === null) return;
    try {
      await reservationsApi.markNoShow(id, reason.trim() || undefined);
      showToast('success', 'Reservation marked as NO-SHOW and room released');
      if (detailsRes?.id === id) setDetailsRes(null);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to mark reservation as no-show');
    }
  };

  const openDetails = (r: any) => {
    setDetailsRes(r);
  };

  const openGroupDeposit = (group: any) => {
    setDepositTargetGroup(group);
    setDetailsRes(null);
    const expected = group.balance;
    setDepositForm({ amount: expected > 0 ? String(expected) : '', method: 'CASH', reference: '', tendered: '' });
    setDepositSplitOpen(false);
    setDepositTenders([makeTenderRow()]);
    setDepositOpen(true);
  };

  const openDeposit = () => {
    const r = detailsRes;
    if (!r) return;
    setDepositTargetGroup(null);
    const balanceDue = reservationBalance(r);
    const exp = Number(r.depositAmount || 0) - recordedDepositTotal(r);
    const defaultAmount = exp > 0 ? exp : balanceDue;
    setDepositForm({ amount: defaultAmount > 0 ? String(defaultAmount) : '', method: 'CASH', reference: '', tendered: '' });
    setDepositSplitOpen(false);
    setDepositTenders([makeTenderRow()]);
    setDepositOpen(true);
  };

  const recordDeposit = async () => {
    if (depositTargetGroup) {
      const g = depositTargetGroup;
      const amount = Number(depositForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast('error', 'Enter a valid payment amount.');
        return;
      }
      if (g.balance <= 0) {
        showToast('error', 'This group booking is already paid in full.');
        return;
      }
      if (amount > g.balance) {
        showToast('error', `Payment cannot exceed the outstanding group balance of ${formatCurrency(g.balance)}.`);
        return;
      }
      const cashTendered = depositForm.method === 'CASH' && depositForm.tendered ? Number(depositForm.tendered) : amount;
      if (depositForm.method === 'CASH' && cashTendered < amount) {
        showToast('error', 'Cash tendered cannot be less than the payment amount.');
        return;
      }
      const changeDue = depositForm.method === 'CASH' && cashTendered > amount ? cashTendered - amount : 0;
      const settlesInFull = amount >= g.balance;
      const remainingAfter = Math.max(0, g.balance - amount);
      const splitTenders = depositSplitOpen ? parseTenders(depositTenders) : undefined;
      if (depositSplitOpen && !tendersCoverTotal(depositTenders, amount)) {
        showToast('error', 'Tender amounts must equal the partial payment amount.');
        return;
      }
      const leadRes = g.reservations[0];
      const leadGuestId = g.leadGuest?.id || leadRes?.guests?.[0]?.guestId;
      try {
        setSaving(true);
        const refText = depositSplitOpen
          ? undefined
          : depositForm.reference.trim()
            ? `${depositForm.reference.trim()} (Group: ${g.bookingId})`
            : `Group: ${g.bookingId}`;
        const desc = settlesInFull
          ? `Group payment received (paid in full) for group booking ${g.bookingId} (${g.reservations.length} rooms).${changeDue > 0 ? ` Cash tendered: GHS ${cashTendered.toFixed(2)}, Change given: GHS ${changeDue.toFixed(2)}.` : ''} Balance remaining: GHS 0.00`
          : `Group partial payment recorded for group booking ${g.bookingId} (${g.reservations.length} rooms). Remaining balance: GHS ${remainingAfter.toFixed(2)}.${changeDue > 0 ? ` Cash tendered: GHS ${cashTendered.toFixed(2)}, Change given: GHS ${changeDue.toFixed(2)}.` : ''}`;
        const res = await paymentsApi.processPayment({
          reservationId: leadRes.id,
          guestId: leadGuestId,
          amount,
          method: (splitTenders?.[0]?.method ?? depositForm.method) as any,
          ...(splitTenders ? { tenders: splitTenders } : {}),
          reference: refText,
          source: 'GROUP_BOOKING',
          sourceId: g.bookingId,
          paymentType: 'DEPOSIT',
          idempotencyKey: crypto.randomUUID(),
          description: desc,
        });

        const createdPayment = res?.data || res;
        printPaymentReceipt(createdPayment || { amount, method: depositForm.method, reference: refText, createdAt: new Date().toISOString() }, {
          type: settlesInFull ? 'PAYMENT' : 'DEPOSIT',
          fullySettled: settlesInFull,
          guestName: formatGuestName(g.leadGuest),
          bookingRef: g.bookingId,
          isGroup: true,
          roomCount: g.reservations.length,
          amountDue: g.totalAmount || g.balance,
          tenderedAmount: depositForm.method === 'CASH' && cashTendered > amount ? cashTendered : undefined,
          changeGiven: changeDue > 0 ? changeDue : undefined,
          remainingBalance: remainingAfter,
        });

        showToast('success', settlesInFull ? 'Group payment recorded — group booking paid in full.' : 'Group partial payment recorded.');
        setDepositOpen(false);
        setDepositTargetGroup(null);
        load();
      } catch (e) {
        showToast('error', e instanceof Error ? e.message : 'Unable to record group partial payment');
      } finally {
        setSaving(false);
      }
      return;
    }

    const r = detailsRes;
    if (!r) return;
    const amount = Number(depositForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('error', 'Enter a valid payment amount.');
      return;
    }
    const balanceDue = reservationBalance(r);
    if (balanceDue <= 0) {
      showToast('error', 'This reservation is already paid in full.');
      return;
    }
    if (amount > balanceDue) {
      showToast('error', `Payment cannot exceed the outstanding amount of ${formatCurrency(Math.max(0, balanceDue))}.`);
      return;
    }
    const cashTendered = depositForm.method === 'CASH' && depositForm.tendered ? Number(depositForm.tendered) : amount;
    if (depositForm.method === 'CASH' && cashTendered < amount) {
      showToast('error', 'Cash tendered cannot be less than the payment amount.');
      return;
    }
    const changeDue = depositForm.method === 'CASH' && cashTendered > amount ? cashTendered - amount : 0;
    const settlesInFull = amount >= balanceDue;
    const remainingAfter = Math.max(0, balanceDue - amount);
    const splitTenders = depositSplitOpen ? parseTenders(depositTenders) : undefined;
    if (depositSplitOpen && !tendersCoverTotal(depositTenders, amount)) {
      showToast('error', 'Tender amounts must equal the partial payment amount.');
      return;
    }
    const primaryGuest = [...(r.guests || [])].sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary))[0];
    try {
      setSaving(true);
      const desc = settlesInFull
        ? `Payment received (paid in full) for ${r.confirmationNo || 'reservation'}.${changeDue > 0 ? ` Cash tendered: GHS ${cashTendered.toFixed(2)}, Change given: GHS ${changeDue.toFixed(2)}.` : ''} Balance remaining: GHS 0.00`
        : `Partial payment recorded for ${r.confirmationNo || 'reservation'}. Remaining balance: GHS ${remainingAfter.toFixed(2)}.${changeDue > 0 ? ` Cash tendered: GHS ${cashTendered.toFixed(2)}, Change given: GHS ${changeDue.toFixed(2)}.` : ''}`;
      const res = await paymentsApi.processPayment({
        reservationId: r.id,
        guestId: primaryGuest?.guestId,
        amount,
        method: (splitTenders?.[0]?.method ?? depositForm.method) as any,
        ...(splitTenders ? { tenders: splitTenders } : {}),
        reference: depositSplitOpen ? undefined : depositForm.reference.trim() || undefined,
        paymentType: 'DEPOSIT',
        idempotencyKey: crypto.randomUUID(),
        description: desc,
      });

      const createdPayment = res?.data || res;
      printPaymentReceipt(createdPayment || { amount, method: depositForm.method, reference: depositForm.reference, createdAt: new Date().toISOString() }, {
        type: settlesInFull ? 'PAYMENT' : 'DEPOSIT',
        fullySettled: settlesInFull,
        guestName: guestName(r.guests?.[0]?.guest),
        bookingRef: r.bookingId || r.confirmationNo,
        roomNumber: r.room?.number,
        amountDue: Number(r.totalAmount) || balanceDue,
        tenderedAmount: depositForm.method === 'CASH' && cashTendered > amount ? cashTendered : undefined,
        changeGiven: changeDue > 0 ? changeDue : undefined,
        remainingBalance: remainingAfter,
      });

      showToast('success', settlesInFull ? 'Payment recorded — reservation paid in full.' : 'Partial payment recorded.');
      setDepositOpen(false);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to record partial payment');
    } finally {
      setSaving(false);
    }
  };

  const cancelGroup = async (bookingId: string) => {
    const groupRes = data.filter((r) => r.bookingId === bookingId);
    if (!window.confirm(`Cancel entire group booking ${bookingId} (${groupRes.length} room${groupRes.length !== 1 ? 's' : ''})?`)) return;
    try {
      for (const r of groupRes) {
        if (!['CANCELLED', 'CHECKED_OUT', 'NO_SHOW'].includes(String(r.status).toUpperCase())) {
          await reservationsApi.cancel(r.id, `Group booking ${bookingId} cancelled`);
        }
      }
      showToast('success', `Group booking ${bookingId} cancelled`);
      if (selectedGroupId === bookingId) setSelectedGroupId(null);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to cancel group booking');
    }
  };

  const deleteCancelled = async (r: any) => {
    if (!window.confirm(`Permanently delete cancelled reservation ${r.confirmationNo || r.id}? This cannot be undone.`)) return;
    try {
      await reservationsApi.deleteCancelled(r.id);
      showToast('success', 'Cancelled reservation permanently deleted.');
      if (detailsRes?.id === r.id) setDetailsRes(null);
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to delete cancelled reservation');
    }
  };

  const openManageGuests = (r: any) => {
    setManageRes(r);
    setManageIds([]);
    setManageOpen(true);
  };

  const saveManageGuests = async () => {
    if (!manageRes) return;
    try {
      setSaving(true);
      await reservationsApi.addGuests(manageRes.id, manageIds);
      showToast('success', 'Guests added to the reservation');
      setManageOpen(false);
      setManageRes(null);
      setManageIds([]);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to add guests');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r: any) => {
    setEditRes(r);
    setEditForm({
      roomId: r.roomId, checkInDate: String(r.checkInDate).slice(0, 10), checkOutDate: String(r.checkOutDate).slice(0, 10),
      adults: String(r.adults ?? 1), children: String(r.children ?? 0), source: r.source || '',
      specialRequests: r.specialRequests || '', notes: r.notes || '',
    });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editRes) return;
    try {
      setSaving(true);
      await reservationsApi.update(editRes.id, { ...editForm, adults: Number(editForm.adults), children: Number(editForm.children), specialRequests: editForm.specialRequests || undefined, notes: editForm.notes || undefined });
      showToast('success', 'Reservation updated and repriced');
      setEditRes(null);
      load();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Unable to update reservation');
    } finally {
      setSaving(false);
    }
  };

  const filteredGuests = guests.filter((g) =>
    !guestFilter || `${g.firstName} ${g.lastName} ${g.phone || ''} ${g.email || ''}`.toLowerCase().includes(guestFilter.toLowerCase()),
  );

  const guestAttached = (g: any) => (manageRes?.guests || []).some((x: any) => x.guestId === g.id);

  const toggleSort = (field: 'checkInDate' | 'checkOutDate') => {
    if (sortField !== field) { setSortField(field); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortField(null); }
  };

  const SortIcon = ({ field }: { field: 'checkInDate' | 'checkOutDate' }) => {
    if (sortField !== field) return <ChevronsUpDown size={11} className="ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp size={11} className="ml-1 text-[#16a4d4]" /> : <ChevronDown size={11} className="ml-1 text-[#16a4d4]" />;
  };

  interface GroupItem {
    isGroup: true;
    id: string;
    bookingId: string;
    reservations: any[];
    leadGuest: any;
    allGuests: any[];
    rooms: any[];
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    discountAmount: number;
    depositAmount: number;
    payments: any[];
    recordedTotal: number;
    balance: number;
    isFullyPaid: boolean;
    status: string;
    bookedBy: any;
    createdAt: string;
  }

  interface SingleItem {
    isGroup: false;
    id: string;
    reservation: any;
    leadGuest: any;
    allGuests: any[];
    room: any;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    discountAmount: number;
    depositAmount: number;
    payments: any[];
    recordedTotal: number;
    balance: number;
    isFullyPaid: boolean;
    status: string;
    bookedBy: any;
    createdAt: string;
  }

  type TableItem = GroupItem | SingleItem;

  const tableItems: TableItem[] = (() => {
    const partyMap = new Map<string, any[]>();
    const singles: any[] = [];

    for (const r of data) {
      if (r.bookingId) {
        if (!partyMap.has(r.bookingId)) partyMap.set(r.bookingId, []);
        partyMap.get(r.bookingId)!.push(r);
      } else {
        singles.push(r);
      }
    }

    const items: TableItem[] = [];

    for (const [bookingId, resList] of partyMap.entries()) {
      resList.sort((a, b) => (a.room?.number || '').localeCompare(b.room?.number || ''));
      const first = resList[0];
      const leadGuest = first?.guests?.find((g: any) => g.isPrimary)?.guest || first?.guests?.[0]?.guest;
      const allGuests = [...new Map(resList.flatMap((r) => (r.guests || []).map((g: any) => [g.guest?.id, g.guest])).filter(([id]) => Boolean(id))).values()];
      const rooms = resList.map((r) => r.room).filter(Boolean);
      const totalAmount = resList.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
      const discountAmount = resList.reduce((sum, r) => sum + Number(r.discountAmount || 0), 0);
      
      const allPayments: any[] = [];
      const seenPaymentIds = new Set<string>();
      for (const r of resList) {
        for (const p of recordedDeposits(r)) {
          if (!seenPaymentIds.has(p.id)) {
            seenPaymentIds.add(p.id);
            allPayments.push(p);
          }
        }
      }
      const recordedTotal = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const balance = Math.max(0, totalAmount - recordedTotal);
      const fullyPaid = totalAmount > 0 && balance === 0;

      const statuses = new Set(resList.map((r) => String(r.status || 'PENDING').toUpperCase()));
      let groupStatus = 'CONFIRMED';
      if (statuses.size === 1) {
        groupStatus = [...statuses][0];
      } else if (statuses.has('CHECKED_IN')) {
        groupStatus = 'MIXED (CHECKED IN)';
      } else {
        groupStatus = 'MIXED';
      }

      items.push({
        isGroup: true,
        id: bookingId,
        bookingId,
        reservations: resList,
        leadGuest,
        allGuests,
        rooms,
        checkInDate: first.checkInDate,
        checkOutDate: first.checkOutDate,
        totalAmount,
        discountAmount,
        depositAmount: resList.reduce((sum, r) => sum + Number(r.depositAmount || 0), 0),
        payments: allPayments,
        recordedTotal,
        balance,
        isFullyPaid: fullyPaid,
        status: groupStatus,
        bookedBy: first.bookedBy,
        createdAt: first.createdAt,
      });
    }

    for (const r of singles) {
      const leadGuest = r.guests?.find((g: any) => g.isPrimary)?.guest || r.guests?.[0]?.guest;
      const allGuests = (r.guests || []).map((g: any) => g.guest).filter(Boolean);
      const deposits = recordedDeposits(r);
      const recordedTotal = deposits.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const totalAmount = Number(r.totalAmount || 0);
      const balance = Math.max(0, totalAmount - recordedTotal);
      const fullyPaid = totalAmount > 0 && balance === 0;

      items.push({
        isGroup: false,
        id: r.id,
        reservation: r,
        leadGuest,
        allGuests,
        room: r.room,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        totalAmount,
        discountAmount: Number(r.discountAmount || 0),
        depositAmount: Number(r.depositAmount || 0),
        payments: deposits,
        recordedTotal,
        balance,
        isFullyPaid: fullyPaid,
        status: String(r.status || 'PENDING').toUpperCase(),
        bookedBy: r.bookedBy,
        createdAt: r.createdAt,
      });
    }

    if (sortField) {
      items.sort((a, b) => {
        const va = new Date(a[sortField]).getTime();
        const vb = new Date(b[sortField]).getTime();
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    } else {
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    return items;
  })();

  const selectedGroup = selectedGroupId
    ? (tableItems.find((it) => it.isGroup && it.bookingId === selectedGroupId) as GroupItem | undefined) || null
    : null;

  const displayItems = dateFilter
    ? tableItems.filter((item) => {
        const cin = String(item.checkInDate).slice(0, 10);
        const cout = String(item.checkOutDate).slice(0, 10);
        return cin <= dateFilter && dateFilter <= cout;
      })
    : tableItems;

  const confirmed = data.filter((x) => ['CONFIRMED', 'PENDING'].includes(String(x.status).toUpperCase())).length;
  const active = data.filter((x) => String(x.status).toUpperCase() === 'CHECKED_IN').length;

  const groupNights = Math.max(1, Math.ceil((new Date(bookingDates.checkOutDate).getTime() - new Date(bookingDates.checkInDate).getTime()) / (1000 * 3600 * 24)) || 1);
  const groupEstimatedTotal = Math.max(0, roomLines.reduce((sum, line) => {
    const room = rooms.find((r) => r.id === line.roomId);
    const price = Number(room?.roomType?.basePrice || 0);
    return sum + (price * groupNights);
  }, 0) - (Number(form.discountAmount) || 0));

  const singleNights = Math.max(1, Math.ceil((new Date(form.checkOutDate).getTime() - new Date(form.checkInDate).getTime()) / (1000 * 3600 * 24)) || 1);
  const singleSelectedRoom = rooms.find((r) => r.id === form.roomId);
  const singleEstimatedTotal = Math.max(0, (Number(singleSelectedRoom?.roomType?.basePrice || 0) * singleNights) - (Number(form.discountAmount) || 0));

  return (
    <ShellPage
      eyebrow="FRONT OFFICE · RESERVATIONS"
      title="Reservations"
      subtitle="Plan arrivals, protect room availability and keep every booking connected to the guest record."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/payments')}>
            Payments & refunds
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> New reservation
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Bookings in view" value={displayItems.length} icon={CalendarDays} onClick={() => scrollToTable('ALL')} />
        <StatTile label="Confirmed / pending rooms" value={confirmed} note={dateFilter ? 'In selected date' : 'Current filtered result'} onClick={() => scrollToTable('CONFIRMED_PENDING')} />
        <StatTile label="Checked in rooms" value={active} note={dateFilter ? 'In selected date' : 'Active stays'} onClick={() => scrollToTable('CHECKED_IN')} />
      </div>
      <div ref={tableRef}>
      <Section title="Booking ledger" subtitle="Search by guest, reservation or room">
        <Toolbar search={q} onSearch={setQ} placeholder="Search guest, booking code or room…">
          {/* Prominent Date Filter with label & Today shortcut */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center rounded-xl border border-[#dfe4e1] bg-white px-2.5 h-10 shadow-sm focus-within:border-[#16a4d4] focus-within:ring-1 focus-within:ring-[#16a4d4]">
              <CalendarDays size={14} className="text-[#16a4d4] mr-2 flex-shrink-0" />
              <label htmlFor="resDateFilter" className="text-[11px] font-bold text-[#657278] mr-2 whitespace-nowrap cursor-pointer">
                Filter date:
              </label>
              <input
                id="resDateFilter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border-0 bg-transparent text-xs font-semibold text-[#1f2d33] focus:outline-none focus:ring-0 p-0 cursor-pointer"
                title="Filter reservations by stay date"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="ml-2 rounded-full p-1 text-[#8a9598] hover:bg-[#f0f3f2] hover:text-[#e04f4f]"
                  title="Clear date filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                setDateFilter(dateFilter === today ? '' : today);
              }}
              className={`h-10 px-3 rounded-xl border text-xs font-bold transition ${
                dateFilter === new Date().toISOString().slice(0, 10)
                  ? 'border-[#16a4d4] bg-[#16a4d4] text-white shadow-sm'
                  : 'border-[#dfe4e1] bg-white text-[#4a555a] hover:border-[#16a4d4] hover:text-[#16a4d4]'
              }`}
              title="Show reservations active today"
            >
              Today
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center rounded-xl border border-[#dfe4e1] bg-white px-2.5 h-10 shadow-sm focus-within:border-[#16a4d4]">
            <ArrowUpDown size={14} className="text-[#8a9598] mr-2 flex-shrink-0" />
            <select
              value={sortField ? `${sortField}_${sortDir}` : 'default'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'checkIn_asc') { setSortField('checkInDate'); setSortDir('asc'); }
                else if (val === 'checkIn_desc') { setSortField('checkInDate'); setSortDir('desc'); }
                else if (val === 'checkOut_asc') { setSortField('checkOutDate'); setSortDir('asc'); }
                else if (val === 'checkOut_desc') { setSortField('checkOutDate'); setSortDir('desc'); }
                else { setSortField(null); setSortDir('asc'); }
              }}
              className="border-0 bg-transparent text-xs font-semibold text-[#1f2d33] focus:outline-none focus:ring-0 p-0 cursor-pointer"
              title="Sort reservations by date"
            >
              <option value="default">Sort: Default grouping</option>
              <option value="checkIn_asc">Sort: Check-in (Earliest first)</option>
              <option value="checkIn_desc">Sort: Check-in (Latest first)</option>
              <option value="checkOut_asc">Sort: Check-out (Earliest first)</option>
              <option value="checkOut_desc">Sort: Check-out (Latest first)</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ns-input h-10 px-3 text-xs font-semibold"
            title="Filter by status"
          >
            <option value="ALL">Status: ALL</option>
            <option value="CONFIRMED">Status: CONFIRMED</option>
            <option value="PENDING">Status: PENDING</option>
            <option value="CONFIRMED_PENDING">Status: CONFIRMED + PENDING</option>
            <option value="CHECKED_IN">Status: CHECKED IN</option>
            <option value="CHECKED_OUT">Status: CHECKED OUT</option>
            <option value="CANCELLED">Status: CANCELLED</option>
          </select>
        </Toolbar>

        {/* Active Date Filter Banner */}
        {dateFilter && (
          <div className="flex items-center justify-between border-b border-[#e1e9e7] bg-[#edf6f8] px-5 py-2.5 text-xs text-[#176274]">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-[#16a4d4]" />
              <span>
                Showing reservations active on{' '}
                <strong className="font-bold text-[#0c404d]">
                  {new Date(dateFilter + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </strong>
                {' '}— <span className="font-semibold">{displayItems.length} booking{displayItems.length === 1 ? '' : 's'}</span> found
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-[#16a4d4] hover:bg-[#dbeef4] border border-[#b8dde6]"
            >
              <X size={12} /> Clear date filter
            </button>
          </div>
        )}
        {loading ? (
          <LoadingState />
        ) : displayItems.length === 0 ? (
          <div className="p-5">
            <div className="rounded-2xl border border-dashed border-[#dfe4e0] p-12 text-center">
              <CalendarDays className="mx-auto text-[#a0aaad]" />
              <h3 className="mt-3 text-sm font-extrabold">
                {dateFilter ? `No bookings on ${new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'No bookings yet'}
              </h3>
              <p className="mt-1 text-xs text-[#899397]">
                {dateFilter ? 'Try a different date or clear the filter.' : 'Your fresh property database is ready for its first booking.'}
              </p>
              {dateFilter && (
                <button onClick={() => setDateFilter('')} className="mt-4 rounded-xl bg-[#16a4d4] px-4 py-2 text-[11px] font-extrabold text-white hover:bg-[#138db8]">
                  Clear date filter
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                <tr>
                  <th className="px-5 py-3">Reservation / Group</th>
                  <th className="px-5 py-3">Guests</th>
                  <th className="px-5 py-3">Room(s)</th>
                  <th className="px-5 py-3">
                    <span className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSort('checkInDate')}
                        className={`flex items-center transition-colors hover:text-[#16a4d4] ${sortField === 'checkInDate' ? 'text-[#16a4d4]' : ''}`}
                        title="Sort by check-in date"
                      >
                        Check-in <SortIcon field="checkInDate" />
                      </button>
                      <span className="opacity-30">·</span>
                      <button
                        onClick={() => toggleSort('checkOutDate')}
                        className={`flex items-center transition-colors hover:text-[#16a4d4] ${sortField === 'checkOutDate' ? 'text-[#16a4d4]' : ''}`}
                        title="Sort by check-out date"
                      >
                        Check-out <SortIcon field="checkOutDate" />
                      </button>
                    </span>
                  </th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {displayItems.map((item) => {
                  if (item.isGroup) {
                    const isExpanded = expandedGroups.has(item.bookingId);
                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          onClick={() => setSelectedGroupId(item.bookingId)}
                          className="cursor-pointer hover:bg-[#f3f8f9] transition-colors bg-[#fbfdfc]"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedGroups((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.bookingId)) next.delete(item.bookingId);
                                    else next.add(item.bookingId);
                                    return next;
                                  });
                                }}
                                className="mr-0.5 rounded p-1 text-[#16a4d4] hover:bg-[#e0f0f4] transition"
                                title={isExpanded ? 'Collapse rooms' : 'Expand rooms'}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                              <span className="font-mono text-[11px] font-bold text-[#a8761e]">{item.bookingId}</span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#e8f2f4] px-1.5 py-0.5 text-[9px] font-extrabold text-[#16a4d4]">
                                <Users size={10} /> GROUP · {item.reservations.length} ROOMS
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] text-[#9aa3a6]">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</div>
                            {isAdmin && <div className="mt-1 text-[10px] text-[#667278]">Booked by: {item.bookedBy?.name || '—'}</div>}
                          </td>
                          <td className="px-5 py-4 text-xs text-[#26363e]">
                            <div className="font-extrabold">{formatGuestName(item.leadGuest)} <span className="text-[10px] font-bold text-[#16a4d4]">(Lead)</span></div>
                            {item.allGuests.length > 1 && (
                              <div className="text-[10px] text-[#78858a] mt-0.5">
                                +{item.allGuests.length - 1} other guest{item.allGuests.length - 1 !== 1 ? 's' : ''} in party
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs text-[#667278]">
                            <div className="font-bold text-[#26363e]">{item.rooms.length} Rooms: {item.rooms.map((r: any) => `R${r.number}`).join(', ')}</div>
                            <div className="text-[10px] text-[#9aa3a6]">{item.rooms.map((r: any) => r.roomType?.name).filter(Boolean).slice(0, 2).join(', ')}{item.rooms.length > 2 ? '…' : ''}</div>
                          </td>
                          <td className="px-5 py-4 text-[11px] text-[#667278]">
                            <div>{new Date(item.checkInDate).toLocaleDateString()} → {new Date(item.checkOutDate).toLocaleDateString()}</div>
                            <div className="text-[10px] text-[#9aa3a6]">{Math.max(1, Math.ceil((new Date(item.checkOutDate).getTime() - new Date(item.checkInDate).getTime()) / (1000 * 3600 * 24)))} nights</div>
                          </td>
                          <td className="px-5 py-4 text-xs font-extrabold text-[#20343e]">
                            <div>{formatCurrency(item.totalAmount)}</div>
                            <div className="text-[9px] font-bold uppercase text-[#16a4d4]">Group total</div>
                            {item.discountAmount > 0 && <div className="mt-0.5 text-[10px] text-[#a05d20]">Discount −{formatCurrency(item.discountAmount)}</div>}
                          </td>
                          <td className="px-5 py-4 text-xs">
                            {item.recordedTotal > 0 ? (
                              <>
                                <div className={`font-extrabold ${item.isFullyPaid ? 'text-[#2e7d32]' : 'text-[#16a4d4]'}`}>
                                  {formatCurrency(item.recordedTotal)} paid
                                </div>
                                {item.isFullyPaid ? (
                                  <span className="mt-1 inline-block rounded-full bg-[#e3f3e6] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#2e7d32]">
                                    Paid in full (Group)
                                  </span>
                                ) : (
                                  <div className="mt-0.5 text-[10px] font-bold text-[#b0743a]">
                                    Balance due {formatCurrency(item.balance)}
                                  </div>
                                )}
                                <div className="text-[9px] text-[#899397] font-semibold mt-0.5">Group Payment ({item.payments.length})</div>
                              </>
                            ) : (
                              <div>
                                <span className="text-[#c0c6c4] font-semibold">Unpaid</span>
                                <div className="text-[10px] font-bold text-[#b0743a]">Due {formatCurrency(item.totalAmount)}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">{statusBadge(item.status)}</td>
                          <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setSelectedGroupId(item.bookingId)} className="rounded-lg p-2 text-[#899397] hover:bg-[#e8f2f4] hover:text-[#16a4d4]" title="View group booking details">
                                <Eye size={16} />
                              </button>
                              {canProcessPayment && !item.isFullyPaid && (
                                <button onClick={() => openGroupDeposit(item)} className="rounded-lg p-2 text-[#16a4d4] hover:bg-[#e8f2f4]" title="Record group payment">
                                  <CreditCard size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setExpandedGroups((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.bookingId)) next.delete(item.bookingId);
                                    else next.add(item.bookingId);
                                    return next;
                                  });
                                }}
                                className="rounded-lg p-2 text-[#899397] hover:bg-[#e8f2f4] hover:text-[#16a4d4]"
                                title={isExpanded ? 'Hide rooms' : 'Show rooms in this group'}
                              >
                                <BedDouble size={16} />
                              </button>
                              {canCancel && (
                                <button onClick={() => cancelGroup(item.bookingId)} className="rounded-lg p-2 text-[#899397] hover:bg-red-50 hover:text-red-600" title="Cancel entire group booking">
                                  <MoreHorizontal size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Nested rooms under this group */}
                        {isExpanded && item.reservations.map((subRes: any) => (
                          <tr
                            key={subRes.id}
                            onClick={() => openDetails(subRes)}
                            className="bg-[#f5f9f9] border-l-4 border-l-[#16a4d4] text-xs hover:bg-[#edf5f6] transition-colors cursor-pointer"
                          >
                            <td className="px-5 py-2.5 pl-8 font-mono text-[11px] text-[#556970]">
                              <span className="text-[#16a4d4] font-bold mr-1.5">↳</span>
                              {subRes.confirmationNo}
                            </td>
                            <td className="px-5 py-2.5 text-[#304046]">
                              <span className="font-semibold">{guestName(subRes.guests?.[0]?.guest)}</span>
                            </td>
                            <td className="px-5 py-2.5 font-bold text-[#26363e]">
                              Room {subRes.room?.number || '—'} <span className="text-[10px] font-normal text-[#899397]">({subRes.room?.roomType?.name || 'Room'})</span>
                            </td>
                            <td className="px-5 py-2.5 text-[11px] text-[#667278]">
                              {new Date(subRes.checkInDate).toLocaleDateString()} → {new Date(subRes.checkOutDate).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-2.5 font-bold text-[#20343e]">
                              {formatCurrency(subRes.totalAmount)}
                            </td>
                            <td className="px-5 py-2.5 text-[10px] text-[#708086]">
                              Covered by group payment
                            </td>
                            <td className="px-5 py-2.5">{statusBadge(subRes.status || 'PENDING')}</td>
                            <td className="px-5 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openDetails(subRes)} className="p-1 text-[#899397] hover:text-[#16a4d4]" title="View room details"><Eye size={14} /></button>
                                {canEdit && ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(String(subRes.status).toUpperCase()) && (
                                  <button onClick={() => openEdit(subRes)} className="p-1 text-[#899397] hover:text-[#16a4d4]" title="Edit room stay"><Pencil size={14} /></button>
                                )}
                                <button onClick={() => openManageGuests(subRes)} className="p-1 text-[#899397] hover:text-[#16a4d4]" title="Manage guests on room"><Users size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  }

                  const r = item.reservation;
                  const allGuests = item.allGuests;
                  const extra = allGuests.length - 1;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openDetails(r)}
                      className="cursor-pointer hover:bg-[#f5f8f6] transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-[#a8761e]">{r.confirmationNo || r.id.slice(0, 8)}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-[#9aa3a6]">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</div>
                        {isAdmin && <div className="mt-1 text-[10px] text-[#667278]">Booked by: {r.bookedBy?.name || '—'}</div>}
                      </td>
                      <td className="px-5 py-4 text-xs text-[#26363e]">
                        {allGuests.length ? (
                          <>
                            <span className="font-extrabold">{guestName(allGuests[0])}</span>
                            {extra > 0 && <span className="ml-1.5 text-[10px] text-[#8a9598]">+{extra} more</span>}
                            {allGuests.slice(1).map((g: any, gi: number) => (
                              <div key={gi} className="text-[11px] text-[#667278]">{guestName(g)}</div>
                            ))}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-[#667278]">
                        {r.room ? `Room ${r.room.number}` : 'Unassigned'}
                        <div className="text-[10px] text-[#9aa3a6]">{r.room?.roomType?.name || '—'}</div>
                      </td>
                      <td className="px-5 py-4 text-[11px] text-[#667278]">
                        {new Date(r.checkInDate).toLocaleDateString()} → {new Date(r.checkOutDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-xs font-extrabold text-[#20343e]">
                        {Number(r.totalAmount || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}
                        {Number(r.discountAmount || 0) > 0 && <div className="mt-1 text-[10px] font-bold text-[#a05d20]" title={r.discountReason || 'Approved reservation discount'}>Discount −{Number(r.discountAmount).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}</div>}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {Number(r.depositAmount || 0) > 0 || recordedDepositTotal(r) > 0 ? (
                          <>
                            <div className={`font-extrabold ${isFullyPaid(r) ? 'text-[#2e7d32]' : 'text-[#16a4d4]'}`}>
                              {formatCurrency(recordedDepositTotal(r))} paid
                            </div>
                            {isFullyPaid(r) ? (
                              <span className="mt-1 inline-block rounded-full bg-[#e3f3e6] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#2e7d32]">
                                Paid in full
                              </span>
                            ) : (
                              <>
                                {Number(r.depositAmount || 0) > 0 && Number(r.depositAmount) !== recordedDepositTotal(r) && (
                                  <div className="mt-0.5 text-[10px] text-[#899397]">{formatCurrency(r.depositAmount)} expected</div>
                                )}
                                <div className="mt-0.5 text-[10px] font-bold text-[#b0743a]">
                                  Balance due {formatCurrency(reservationBalance(r))}
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="text-[#c0c6c4]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">{statusBadge(r.status || 'PENDING')}{isAdmin && r.checkedInBy?.name && <div className="mt-1 text-[10px] text-[#667278]">In: {r.checkedInBy.name}</div>}{isAdmin && r.checkedOutBy?.name && <div className="mt-1 text-[10px] text-[#667278]">Out: {r.checkedOutBy.name}</div>}</td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDetails(r)} className="rounded-lg p-2 text-[#899397] hover:bg-[#e8f2f4] hover:text-[#16a4d4]" title="View booking details">
                            <Eye size={16} />
                          </button>
                          {canEdit && ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(String(r.status).toUpperCase()) && (
                            <button onClick={() => openEdit(r)} className="rounded-lg p-2 text-[#899397] hover:bg-[#e8f2f4] hover:text-[#16a4d4]" title="Edit reservation details">
                              <Pencil size={16} />
                            </button>
                          )}
                          <button onClick={() => openManageGuests(r)} className="rounded-lg p-2 text-[#899397] hover:bg-[#e8f2f4] hover:text-[#16a4d4]" title="Manage guests on this reservation">
                            <Users size={16} />
                          </button>
                          {canCancel && ['PENDING', 'CONFIRMED'].includes(String(r.status).toUpperCase()) && (
                            <button onClick={() => markNoShow(r.id)} className="rounded-lg p-2 text-[#899397] hover:bg-amber-50 hover:text-amber-700" title="Mark reservation as NO-SHOW">
                              <UserX size={16} />
                            </button>
                          )}
                          {!['CANCELLED', 'CHECKED_OUT', 'NO_SHOW'].includes(String(r.status).toUpperCase()) && (
                            <button onClick={() => cancel(r.id)} className="rounded-lg p-2 text-[#899397] hover:bg-red-50 hover:text-red-600" title="Cancel reservation">
                              <MoreHorizontal size={16} />
                            </button>
                          )}
                          {canDeleteCancelled && String(r.status).toUpperCase() === 'CANCELLED' && (
                            <button onClick={() => deleteCancelled(r)} className="rounded-lg p-2 text-[#899397] hover:bg-red-50 hover:text-red-600" title="Permanently delete cancelled reservation">
                              <Trash2 size={16} />
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
      </div>

      <Modal open={open} onClose={closeModal} title="New reservation" size="lg">
        <form onSubmit={save} className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setMulti(false)} className={`rounded-xl px-3 py-2 text-[10px] font-extrabold ${!multi ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
              Single room
            </button>
            <button type="button" onClick={startMulti} className={`rounded-xl px-3 py-2 text-[10px] font-extrabold flex items-center gap-1.5 ${multi ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
              <Users size={12} /> Group booking (multiple rooms)
            </button>
          </div>

          {multi ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Arrival" required>
                  <TextInput type="date" required value={bookingDates.checkInDate} onChange={(e) => setBookingDates({ ...bookingDates, checkInDate: e.target.value })} />
                </FormField>
                <FormField label="Departure" required>
                  <TextInput type="date" required value={bookingDates.checkOutDate} onChange={(e) => setBookingDates({ ...bookingDates, checkOutDate: e.target.value })} />
                </FormField>
              </div>
              {canDiscount && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Approved discount (GHS)">
                    <TextInput type="number" min="0" step="0.01" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} placeholder="0.00" />
                  </FormField>
                  <FormField label="Discount reason" required={Number(form.discountAmount) > 0}>
                    <TextInput required={Number(form.discountAmount) > 0} value={form.discountReason} onChange={(e) => setForm({ ...form, discountReason: e.target.value })} placeholder="Reason for approved discount" />
                  </FormField>
                </div>
              )}

              <div className="rounded-2xl border border-[#e7ebe8] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">Guests in this booking</div>
                  <Button size="sm" type="button" variant="outline" onClick={() => setPeople((p) => [...p, { ...emptyPerson, key: uid() }])}>
                    <Plus size={13} /> Add guest
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {people.map((p, i) => (
                    <div key={p.key} className="rounded-xl border border-[#eef1ee] bg-[#fbfcfa] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, mode: 'existing' } : x)))} className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${p.mode === 'existing' ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
                            Existing
                          </button>
                          <button type="button" onClick={() => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, mode: 'new' } : x)))} className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${p.mode === 'new' ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
                            New guest
                          </button>
                        </div>
                        {people.length > 1 && (
                          <button type="button" onClick={() => setPeople((arr) => arr.filter((x) => x.key !== p.key))} className="text-[#b23a3a]">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {p.mode === 'existing' ? (
                        <div className="mt-2">
                          <FormField label={`Person ${i + 1}`}>
                            <SelectInput value={p.guestId} onChange={(e) => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, guestId: e.target.value } : x)))}>
                              <option value="">Select guest</option>
                              {guests.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.firstName} {g.lastName}
                                  {g.phone ? ` · ${g.phone}` : ''}
                                </option>
                              ))}
                            </SelectInput>
                          </FormField>
                        </div>
                      ) : (
                        <div className="mt-2 grid gap-3 sm:grid-cols-3">
                          <FormField label={`First name · Person ${i + 1}`}>
                            <TextInput value={p.firstName} onChange={(e) => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, firstName: e.target.value } : x)))} placeholder="First name" />
                          </FormField>
                          <FormField label="Last name">
                            <TextInput value={p.lastName} onChange={(e) => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, lastName: e.target.value } : x)))} placeholder="Last name" />
                          </FormField>
                          <FormField label="Phone">
                            <TextInput value={p.phone} onChange={(e) => setPeople((arr) => arr.map((x) => (x.key === p.key ? { ...x, phone: e.target.value } : x)))} placeholder="+233 …" />
                          </FormField>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#e7ebe8] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">Rooms in this party ({roomLines.length})</div>
                    <div className="text-[10px] text-[#718086]">Select how many rooms this group is reserving</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-[#8a9598]">Quick size:</span>
                    {[2, 3, 4, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setMultiRoomCount(cnt)}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition ${
                          roomLines.length === cnt
                            ? 'bg-[#16a4d4] text-white shadow-xs'
                            : 'border border-[#dfe4e0] bg-white text-[#718086] hover:border-[#16a4d4] hover:text-[#16a4d4]'
                        }`}
                      >
                        {cnt} Rooms
                      </button>
                    ))}
                    <Button size="sm" type="button" variant="outline" onClick={() => setRoomLines((l) => [...l, emptyRoomLine(people[0]?.key || '')])}>
                      <Plus size={13} /> Add room
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  {roomLines.map((line, i) => {
                    const taken = roomLines.filter((x) => x.key !== line.key).map((x) => x.roomId);
                    return (
                      <div key={line.key} className="rounded-xl border border-[#eef1ee] bg-[#fbfcfa] p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-extrabold text-[#20343e]">Room {i + 1} of {roomLines.length}</div>
                          {roomLines.length > 1 && (
                            <button type="button" onClick={() => setRoomLines((arr) => arr.filter((x) => x.key !== line.key))} className="text-[#b23a3a] hover:bg-red-50 p-1 rounded" title="Remove this room">
                              <Minus size={14} />
                            </button>
                          )}
                        </div>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <FormField label="Room" required>
                            <SelectInput required value={line.roomId} onChange={(e) => setRoomLines((arr) => arr.map((x) => (x.key === line.key ? { ...x, roomId: e.target.value } : x)))}>
                              <option value="">Select room</option>
                              {bookableRooms
                                .filter((r) => !taken.includes(r.id))
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    Room {r.number} · {r.roomType?.name || 'Room'} ({Number(r.roomType?.basePrice || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })})
                                  </option>
                                ))}
                            </SelectInput>
                          </FormField>
                          <FormField label="Primary guest (this room)">
                            <SelectInput value={line.primaryKey} onChange={(e) => setRoomLines((arr) => arr.map((x) => (x.key === line.key ? { ...x, primaryKey: e.target.value } : x)))}>
                              <option value="">Default to Lead Guest (Person 1)</option>
                              {people.map((p, pi) => (
                                <option key={p.key} value={p.key}>
                                  Person {pi + 1} — {p.mode === 'existing' ? guests.find((g) => g.id === p.guestId) ? `${guests.find((g) => g.id === p.guestId).firstName} ${guests.find((g) => g.id === p.guestId).lastName}` : 'guest not chosen' : p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : 'new guest'}
                                </option>
                              ))}
                            </SelectInput>
                          </FormField>
                          <FormField label="Adults">
                            <TextInput type="number" min="1" value={line.adults} onChange={(e) => setRoomLines((arr) => arr.map((x) => (x.key === line.key ? { ...x, adults: e.target.value } : x)))} />
                          </FormField>
                          <FormField label="Children">
                            <TextInput type="number" min="0" value={line.children} onChange={(e) => setRoomLines((arr) => arr.map((x) => (x.key === line.key ? { ...x, children: e.target.value } : x)))} />
                          </FormField>
                        </div>
                        <FormField label="Additional guests sharing this room">
                          {people.length === 0 ? (
                            <p className="text-xs text-[#8a9598]">Add guests above first.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {people
                                .filter((p) => p.key !== line.primaryKey)
                                .map((p, pi) => {
                                  const active = line.additionalKeys.includes(p.key);
                                  const label = p.mode === 'existing' ? guestName(guests.find((g) => g.id === p.guestId)) : p.firstName || `Person ${pi + 1}`;
                                  return (
                                    <button
                                      key={p.key}
                                      type="button"
                                      onClick={() =>
                                        setRoomLines((arr) =>
                                          arr.map((x) =>
                                            x.key === line.key
                                              ? { ...x, additionalKeys: active ? x.additionalKeys.filter((k) => k !== p.key) : [...x.additionalKeys, p.key] }
                                              : x,
                                          ),
                                        )
                                      }
                                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${active ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}
                                    >
                                      {label || 'Person'}
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </FormField>
                      </div>
                    );
                  })}
                  {roomLines.length === 0 && (
                    <button type="button" onClick={() => setRoomLines((l) => [...l, emptyRoomLine(people[0]?.key || '')])} className="w-full rounded-xl border border-dashed border-[#dfe4e0] py-6 text-xs font-bold text-[#8a9598] hover:border-[#16a4d4] hover:text-[#16a4d4]">
                      + Add the first room
                    </button>
                  )}
                </div>
              </div>

              {/* Group Partial Payment & Real-time Due Card */}
              <div className="rounded-2xl border border-[#dfe4e1] bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0ed] pb-2.5">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e] flex items-center gap-1.5">
                      <CreditCard size={14} className="text-[#16a4d4]" /> Group Financial Breakdown &amp; Payment (optional)
                    </div>
                    <p className="mt-0.5 text-[10px] text-[#8a9598]">Calculates total group charges, payments made, and remaining balance due.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {groupEstimatedTotal > 0 && Number(groupDeposit.amount) >= groupEstimatedTotal ? (
                      <span className="rounded-md bg-[#ecfdf5] px-2.5 py-1 text-[11px] font-extrabold text-[#047857] border border-[#a7f3d0]">
                        ✓ Full Payment (Group)
                      </span>
                    ) : Number(groupDeposit.amount) > 0 ? (
                      <span className="rounded-md bg-[#fffbeb] px-2.5 py-1 text-[11px] font-extrabold text-[#b45309] border border-[#fde68a]">
                        Part Payment / Deposit (Group)
                      </span>
                    ) : (
                      <span className="rounded-md bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-extrabold text-[#6b7280] border border-[#e5e7eb]">
                        Unpaid · Settle at check-in
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Deposit / Payment amount (GHS)">
                    <TextInput
                      type="number"
                      min="0"
                      max={Math.max(0, groupEstimatedTotal) || undefined}
                      step="0.01"
                      value={groupDeposit.amount}
                      onChange={(e) => setGroupDeposit({ ...groupDeposit, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </FormField>
                  <FormField label="Payment method" required={Number(groupDeposit.amount) > 0}>
                    <SelectInput
                      required={Number(groupDeposit.amount) > 0}
                      value={groupDeposit.method}
                      onChange={(e) => setGroupDeposit({ ...groupDeposit, method: e.target.value })}
                    >
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </SelectInput>
                  </FormField>
                  {groupDeposit.method === 'CASH' && Number(groupDeposit.amount) > 0 ? (
                    <FormField label="Cash tendered / handed over (GHS)">
                      <TextInput
                        type="number"
                        min={Number(groupDeposit.amount) || 0}
                        step="0.01"
                        value={groupDeposit.tendered}
                        onChange={(e) => setGroupDeposit({ ...groupDeposit, tendered: e.target.value })}
                        placeholder={groupDeposit.amount || '0.00'}
                      />
                    </FormField>
                  ) : (
                    <FormField label="Reference (optional)">
                      <TextInput
                        value={groupDeposit.reference}
                        onChange={(e) => setGroupDeposit({ ...groupDeposit, reference: e.target.value })}
                        placeholder="e.g. Group MoMo ref"
                      />
                    </FormField>
                  )}
                </div>

                {/* Live Real-time Due & Settlement Box */}
                <div className="rounded-xl border border-[#dfe4e1] bg-[#f9faf9] p-3 text-xs space-y-2">
                  <div className="flex justify-between items-center text-[#556368]">
                    <span className="font-semibold">Total money supposed to be paid (Group Total):</span>
                    <span className="font-extrabold text-[#20343e] text-sm">{formatCurrency(groupEstimatedTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#556368]">
                    <span>Money paid now (Deposit):</span>
                    <span className="font-bold text-[#2e7d32]">{formatCurrency(Number(groupDeposit.amount) || 0)}</span>
                  </div>
                  {groupDeposit.method === 'CASH' && Number(groupDeposit.tendered) > Number(groupDeposit.amount) && (
                    <div className="flex justify-between items-center text-[#556368]">
                      <span>Cash tendered:</span>
                      <span className="font-bold text-[#20343e]">{formatCurrency(Number(groupDeposit.tendered))}</span>
                    </div>
                  )}
                  {groupDeposit.method === 'CASH' && Number(groupDeposit.tendered) > Number(groupDeposit.amount) && (
                    <div className="flex justify-between items-center rounded-lg bg-[#ecfdf5] px-2.5 py-1.5 text-[#047857] border border-[#a7f3d0]">
                      <span className="font-bold">&#8594; Change due to guest:</span>
                      <span className="font-extrabold text-sm">{formatCurrency(Number(groupDeposit.tendered) - Number(groupDeposit.amount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center rounded-lg bg-[#f0f8fa] px-2.5 py-1.5 text-[#0e5a6a] border border-[#cbe3e9] mt-1">
                    <span className="font-bold">&#8594; Remaining money due (Group Balance left):</span>
                    <span className="font-extrabold text-sm text-[#b0743a]">
                      {formatCurrency(Math.max(0, groupEstimatedTotal - (Number(groupDeposit.amount) || 0)))}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-[#e7ebe8] p-4">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setGuestMode('existing')} className={`rounded-xl px-3 py-2 text-[10px] font-extrabold ${guestMode === 'existing' ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
                    Select existing guest
                  </button>
                  <button type="button" onClick={() => setGuestMode('new')} className={`rounded-xl px-3 py-2 text-[10px] font-extrabold ${guestMode === 'new' ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}>
                    Enter new guest details
                  </button>
                </div>
                {guestMode === 'existing' ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <FormField label="Find existing guest">
                      <TextInput value={guestFilter} onChange={(e) => setGuestFilter(e.target.value)} placeholder="Search by name, phone or email…" />
                    </FormField>
                    <FormField label="Guest" required>
                      <SelectInput required value={form.guestId} onChange={(e) => setForm({ ...form, guestId: e.target.value })}>
                        <option value="">Select guest</option>
                        {filteredGuests.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.firstName} {g.lastName}
                            {g.phone ? ` · ${g.phone}` : ''}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <FormField label="First name" required>
                      <TextInput required value={newGuest.firstName} onChange={(e) => setNewGuest({ ...newGuest, firstName: e.target.value })} placeholder="First name" />
                    </FormField>
                    <FormField label="Last name">
                      <TextInput value={newGuest.lastName} onChange={(e) => setNewGuest({ ...newGuest, lastName: e.target.value })} placeholder="Last name" />
                    </FormField>
                    <FormField label="Phone">
                      <TextInput value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="+233 …" />
                    </FormField>
                  </div>
                )}
                <div className="mt-4">
                  <FormField label="Additional guests sharing this room">
                    {guests.length === 0 ? (
                      <p className="text-xs text-[#8a9598]">No guests in the directory yet.</p>
                    ) : (
                      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                        {guests.filter((g) => g.id !== form.guestId).map((g) => {
                          const active = form.additionalGuestIds.includes(g.id);
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => toggleFormGuest(g.id)}
                              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${active ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}
                            >
                              {g.firstName} {g.lastName}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </FormField>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Arrival" required>
                  <TextInput type="date" required value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value, roomId: '' })} />
                </FormField>
                <FormField label="Departure" required>
                  <TextInput type="date" required value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value, roomId: '' })} />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Room" required>
                  {!form.checkInDate || !form.checkOutDate || form.checkOutDate <= form.checkInDate ? (
                    <div className="flex h-10 items-center rounded-xl border border-dashed border-[#d0d9d4] bg-[#f7f8f6] px-3 text-xs text-[#8a9598]">
                      Select arrival &amp; departure dates first
                    </div>
                  ) : bookableRooms.length === 0 ? (
                    <div className="flex h-10 items-center rounded-xl border border-dashed border-[#f0c0a0] bg-[#fff8f4] px-3 text-xs text-[#b05a20] font-semibold">
                      No rooms available for selected dates
                    </div>
                  ) : (
                    <SelectInput required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                      <option value="">Select room</option>
                      {bookableRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.number} · {r.roomType?.name || 'Room'} ({Number(r.roomType?.basePrice || 0).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })})
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </FormField>
                <FormField label="Adults" required>
                  <TextInput type="number" min="1" required value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} />
                </FormField>
              </div>

              <div className="rounded-2xl border border-[#dfe4e1] bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0ed] pb-2.5">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e] flex items-center gap-1.5">
                      <CreditCard size={14} className="text-[#16a4d4]" /> Financial Breakdown &amp; Payment (optional)
                    </div>
                    <p className="mt-0.5 text-[10px] text-[#8a9598]">Calculates room charges, payments, and remaining money due.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {singleEstimatedTotal > 0 && Number(form.depositAmount) >= singleEstimatedTotal ? (
                      <span className="rounded-md bg-[#ecfdf5] px-2.5 py-1 text-[11px] font-extrabold text-[#047857] border border-[#a7f3d0]">
                        ✓ Full Payment
                      </span>
                    ) : Number(form.depositAmount) > 0 ? (
                      <span className="rounded-md bg-[#fffbeb] px-2.5 py-1 text-[11px] font-extrabold text-[#b45309] border border-[#fde68a]">
                        Part Payment / Deposit
                      </span>
                    ) : (
                      <span className="rounded-md bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-extrabold text-[#6b7280] border border-[#e5e7eb]">
                        Unpaid · Settle at check-in
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label="Amount (GHS)">
                    <TextInput type="number" min="0" max={singleEstimatedTotal || undefined} step="0.01" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} placeholder="0.00" />
                  </FormField>
                  <FormField label="Payment method" required={Number(form.depositAmount) > 0}>
                    <SelectInput required={Number(form.depositAmount) > 0} value={form.depositMethod} onChange={(e) => setForm({ ...form, depositMethod: e.target.value })}>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </SelectInput>
                  </FormField>
                  <FormField label="Reference (optional)">
                    <TextInput value={form.depositReference} onChange={(e) => setForm({ ...form, depositReference: e.target.value })} placeholder="e.g. MoMo ref / card last 4" />
                  </FormField>
                </div>
                {/* Live Real-time Due & Settlement Box */}
                <div className="rounded-xl border border-[#dfe4e1] bg-[#f9faf9] p-3 text-xs space-y-2">
                  <div className="flex justify-between items-center text-[#556368]">
                    <span className="font-semibold">Total money supposed to be paid:</span>
                    <span className="font-extrabold text-[#20343e] text-sm">{formatCurrency(singleEstimatedTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#556368]">
                    <span>Money paid now (Deposit):</span>
                    <span className="font-bold text-[#2e7d32]">{formatCurrency(Number(form.depositAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center rounded-lg bg-[#f0f8fa] px-2.5 py-1.5 text-[#0e5a6a] border border-[#cbe3e9] mt-1">
                    <span className="font-bold">&#8594; Remaining money due (Balance left):</span>
                    <span className="font-extrabold text-sm text-[#b0743a]">
                      {formatCurrency(Math.max(0, singleEstimatedTotal - (Number(form.depositAmount) || 0)))}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="rounded-2xl bg-[#f7f8f6] p-4 text-[11px] leading-5 text-[#778286]">
            Availability and pricing must be validated by the server. The client does not reserve a room until the API confirms the booking.
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>
              {multi ? 'Book party' : guestMode === 'new' ? 'Create guest & reserve' : 'Create reservation'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editRes} onClose={() => { setEditRes(null); setEditAvailableRoomIds(null); }} title={editRes ? `Edit ${editRes.confirmationNo || 'reservation'}` : 'Edit reservation'} size="lg">
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="rounded-xl bg-[#f7f8f6] p-3 text-xs text-[#667278]">{String(editRes?.status).toUpperCase() === 'CHECKED_IN' ? 'This guest is in house. You can extend or shorten departure and update stay details; any accommodation difference is posted to the open folio.' : 'Changes are checked against live availability. The room rate and booking total are recalculated from the revised stay dates.'}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Arrival" required><TextInput type="date" required disabled={String(editRes?.status).toUpperCase() === 'CHECKED_IN'} value={editForm.checkInDate} onChange={(e) => setEditForm({ ...editForm, checkInDate: e.target.value })} /></FormField>
            <FormField label="Departure" required><TextInput type="date" required value={editForm.checkOutDate} onChange={(e) => setEditForm({ ...editForm, checkOutDate: e.target.value })} /></FormField>
            <FormField label="Room" required>
              {String(editRes?.status).toUpperCase() === 'CHECKED_IN' ? (
                <SelectInput required disabled value={editForm.roomId}>
                  {rooms.filter((room) => room.isActive && !['MAINTENANCE', 'OUT_OF_SERVICE'].includes(room.status)).map((room) => <option key={room.id} value={room.id}>Room {room.number} · {room.roomType?.name || 'Room'}</option>)}
                </SelectInput>
              ) : editAvailabilityLoading ? (
                <div className="flex h-10 items-center rounded-xl border border-[#eef1ee] bg-[#f7f8f6] px-3 text-xs text-[#8a9598]">Checking availability…</div>
              ) : editAvailableRoomIds === null ? (
                <div className="flex h-10 items-center rounded-xl border border-dashed border-[#d0d9d4] bg-[#f7f8f6] px-3 text-xs text-[#8a9598]">Select valid arrival &amp; departure dates to see available rooms</div>
              ) : (
                <SelectInput required value={editForm.roomId} onChange={(e) => setEditForm({ ...editForm, roomId: e.target.value })}>
                  <option value="">Select room</option>
                  {rooms
                    .filter((room) => room.isActive && !['MAINTENANCE', 'OUT_OF_SERVICE'].includes(room.status))
                    .filter((room) => editAvailableRoomIds.has(room.id) || room.id === editRes?.roomId)
                    .map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.number} · {room.roomType?.name || 'Room'}{room.id === editRes?.roomId ? ' (current)' : ''}
                      </option>
                    ))}
                </SelectInput>
              )}
            </FormField>
            <FormField label="Source"><TextInput value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} placeholder="WALK_IN" /></FormField>
            <FormField label="Adults" required><TextInput type="number" min="1" required value={editForm.adults} onChange={(e) => setEditForm({ ...editForm, adults: e.target.value })} /></FormField>
            <FormField label="Children"><TextInput type="number" min="0" value={editForm.children} onChange={(e) => setEditForm({ ...editForm, children: e.target.value })} /></FormField>
          </div>
          <FormField label="Special requests"><textarea className="ns-input min-h-20 w-full p-3 text-sm" value={editForm.specialRequests} onChange={(e) => setEditForm({ ...editForm, specialRequests: e.target.value })} /></FormField>
          <FormField label="Internal notes"><textarea className="ns-input min-h-20 w-full p-3 text-sm" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></FormField>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditRes(null)}>Cancel</Button><Button type="submit" loading={saving}>Save changes</Button></div>
        </form>
      </Modal>

      {/* Reservation Details Modal */}
      <Modal
        open={!!detailsRes}
        onClose={() => setDetailsRes(null)}
        title={detailsRes ? `Reservation details · ${detailsRes.confirmationNo || detailsRes.id.slice(0, 8)}` : 'Reservation details'}
        size="lg"
      >
        {detailsRes && (() => {
          const allGuests = detailsRes.guests?.length ? [...detailsRes.guests].sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary)) : [];
          const primaryGuest = allGuests[0]?.guest;
          const additionalGuests = allGuests.slice(1);
          const checkIn = new Date(detailsRes.checkInDate);
          const checkOut = new Date(detailsRes.checkOutDate);
          const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24)));

          return (
            <div className="p-6 space-y-6">
              {/* Group Party Overview Banner (if part of group) */}
              {detailsRes.bookingId && (() => {
                const groupItem = tableItems.find((it) => it.isGroup && it.bookingId === detailsRes.bookingId) as GroupItem | undefined;
                const groupRooms = groupItem ? groupItem.rooms : [];
                const groupTotal = groupItem ? groupItem.totalAmount : detailsRes.totalAmount;
                const groupPaid = groupItem ? groupItem.recordedTotal : recordedDepositTotal(detailsRes);
                const groupBalance = groupItem ? groupItem.balance : reservationBalance(detailsRes);
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#b8dde6] bg-[#edf6f8] p-4 text-xs text-[#0e5a6a]">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-xl bg-[#d5edf2] p-2 text-[#16a4d4]">
                        <Users size={18} />
                      </div>
                      <div>
                        <div className="font-extrabold text-[#09414d] flex items-center gap-2">
                          <span>Group Booking {detailsRes.bookingId}</span>
                          <span className="rounded-full bg-[#16a4d4] px-2 py-0.5 text-[10px] font-bold text-white">
                            {groupRooms.length} Room{groupRooms.length !== 1 ? 's' : ''} in Party
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#4d7882]">
                          Rooms: {groupRooms.map((rm: any) => `Room ${rm.number}`).join(', ')} · Group Total: <strong className="text-[#09414d]">{formatCurrency(groupTotal)}</strong> · Group Paid: <strong className="text-[#2e7d32]">{formatCurrency(groupPaid)}</strong> · Group Remaining Due: <strong className="text-[#b0743a]">{formatCurrency(groupBalance)}</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const bid = detailsRes.bookingId;
                        setDetailsRes(null);
                        setSelectedGroupId(bid);
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#16a4d4] px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#138db8] transition"
                    >
                      View Entire Group <ChevronRight size={13} />
                    </button>
                  </div>
                );
              })()}

              {/* Header Overview Card */}
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#e8ebe8] bg-[#f7f9f8] p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-extrabold text-[#a8761e]">
                      {detailsRes.confirmationNo || detailsRes.id.slice(0, 8)}
                    </span>
                    {detailsRes.bookingId && (
                      <span className="rounded-md bg-[#e8f2f4] px-2 py-0.5 text-[10px] font-extrabold text-[#16a4d4]">
                        PARTY · {detailsRes.bookingId}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[#7d898d] space-x-2">
                    <span>Booked on {detailsRes.createdAt ? new Date(detailsRes.createdAt).toLocaleString() : '—'}</span>
                    {detailsRes.source && <span>· Via {detailsRes.source}</span>}
                  </div>
                  {detailsRes.bookedBy && (
                    <div className="mt-1 text-xs flex items-center gap-1 text-[#26363e] font-semibold">
                      <span>👤 Booked by</span>
                      <span className="text-[#16a4d4]">{detailsRes.bookedBy?.name || 'Staff'}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {statusBadge(detailsRes.status || 'PENDING')}
                </div>
              </div>

              {/* Grid 1: Stay & Room Details & Guest Details */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Stay & Room */}
                <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center gap-1.5">
                    <BedDouble size={14} /> Room & Stay Information
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                      <span className="text-[#899397]">Assigned Room</span>
                      <span className="font-extrabold text-[#26363e]">
                        {detailsRes.room ? `Room ${detailsRes.room.number}` : 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                      <span className="text-[#899397]">Room Type</span>
                      <span className="font-bold text-[#26363e]">
                        {detailsRes.room?.roomType?.name || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                      <span className="text-[#899397]">Stay Period</span>
                      <span className="font-bold text-[#26363e]">
                        {checkIn.toLocaleDateString()} → {checkOut.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                      <span className="text-[#899397]">Duration</span>
                      <span className="font-bold text-[#26363e]">{nights} night{nights === 1 ? '' : 's'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#899397]">Occupancy</span>
                      <span className="font-bold text-[#26363e]">
                        {detailsRes.adults ?? 1} Adult{(detailsRes.adults ?? 1) === 1 ? '' : 's'}
                        {Number(detailsRes.children || 0) > 0 ? `, ${detailsRes.children} Child${detailsRes.children === 1 ? '' : 'ren'}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary & Additional Guests */}
                <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Users size={14} /> Guests on Booking
                    </span>
                    <button
                      onClick={() => {
                        const r = detailsRes;
                        setDetailsRes(null);
                        openManageGuests(r);
                      }}
                      className="text-[10px] font-extrabold text-[#16a4d4] hover:underline"
                    >
                      Manage →
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                      <span className="text-[#899397]">Primary Guest</span>
                      <span className="font-extrabold text-[#26363e]">{formatGuestName(primaryGuest)}</span>
                    </div>
                    {primaryGuest?.phone && (
                      <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                        <span className="text-[#899397]">Phone</span>
                        <span className="font-bold text-[#26363e]">{primaryGuest.phone}</span>
                      </div>
                    )}
                    {primaryGuest?.email && (
                      <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                        <span className="text-[#899397]">Email</span>
                        <span className="font-bold text-[#26363e]">{primaryGuest.email}</span>
                      </div>
                    )}
                    {additionalGuests.length > 0 && (
                      <div className="py-1">
                        <span className="text-[#899397] block mb-1">Additional Guests ({additionalGuests.length}):</span>
                        <div className="space-y-1">
                          {additionalGuests.map((ag: any) => (
                            <div key={ag.id} className="text-[#26363e] font-semibold pl-2 border-l-2 border-[#dce5e0]">
                              {formatGuestName(ag.guest)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Summary Card */}
              <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center gap-1.5">
                    <CreditCard size={14} /> Financial Breakdown &amp; Money Due
                  </div>
                  {isFullyPaid(detailsRes) ? (
                    <span className="rounded-full bg-[#e3f3e6] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#2e7d32]">
                      ✓ Paid in full
                    </span>
                  ) : recordedDepositTotal(detailsRes) > 0 ? (
                    <span className="rounded-full bg-[#fdf3e7] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#b0743a]">
                      Part Payment / Deposit
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#6b7280]">
                      Unpaid · Balance Due
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                    <span className="text-[#899397]">Nightly Base Rate</span>
                    <span className="font-bold text-[#26363e]">
                      {formatCurrency(detailsRes.baseRate || detailsRes.room?.roomType?.basePrice || 0)} / night
                    </span>
                  </div>
                  {Number(detailsRes.discountAmount || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-[#f0f2f0] text-[#a05d20]">
                      <span>Discount ({detailsRes.discountReason || 'Approved discount'})</span>
                      <span className="font-bold">−{formatCurrency(detailsRes.discountAmount)}</span>
                    </div>
                  )}
                  {Number(detailsRes.taxAmount || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                      <span className="text-[#899397]">Taxes & Levies</span>
                      <span className="font-bold text-[#26363e]">{formatCurrency(detailsRes.taxAmount)}</span>
                    </div>
                  )}

                  {/* Always-visible 3 KPI Tiles */}
                  <div className="grid grid-cols-3 gap-2.5 pt-2">
                    <div className="rounded-xl bg-[#f7f9f8] p-3 border border-[#edf0ed] text-center">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7d898d]">Total Money Due</div>
                      <div className="text-base font-extrabold text-[#20343e] mt-0.5">{formatCurrency(detailsRes.totalAmount)}</div>
                    </div>
                    <div className="rounded-xl bg-[#eef7ee] p-3 border border-[#d6ebd7] text-center">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#2e7d32]">Money Paid</div>
                      <div className="text-base font-extrabold text-[#2e7d32] mt-0.5">{formatCurrency(recordedDepositTotal(detailsRes))}</div>
                    </div>
                    <div className={`rounded-xl p-3 border text-center ${reservationBalance(detailsRes) > 0 ? 'bg-[#fdf6ee] border-[#fae2c8]' : 'bg-[#eef7ee] border-[#d6ebd7]'}`}>
                      <div className={`text-[10px] font-extrabold uppercase tracking-wider ${reservationBalance(detailsRes) > 0 ? 'text-[#b0743a]' : 'text-[#2e7d32]'}`}>
                        Remaining Money Due
                      </div>
                      <div className={`text-base font-extrabold mt-0.5 ${reservationBalance(detailsRes) > 0 ? 'text-[#b0743a]' : 'text-[#2e7d32]'}`}>
                        {formatCurrency(reservationBalance(detailsRes))}
                      </div>
                    </div>
                  </div>

                  {/* Payment Ledger / History */}
                  <div className="space-y-1.5 bg-[#f7f9f8] p-3 rounded-xl border border-[#edf0ed] mt-2">
                    <div className="flex justify-between items-center">
                      <span className={`font-bold ${isFullyPaid(detailsRes) ? 'text-[#2e7d32]' : recordedDepositTotal(detailsRes) > 0 ? 'text-[#16a4d4]' : 'text-[#7d898d]'}`}>
                        {isFullyPaid(detailsRes) ? 'Payment Status: Paid in full' : recordedDepositTotal(detailsRes) > 0 ? 'Payment Status: Part Payment / Deposit' : 'Payment Status: Unpaid · Due at check-in'}
                      </span>
                      <span className={`font-extrabold ${isFullyPaid(detailsRes) ? 'text-[#2e7d32]' : 'text-[#16a4d4]'}`}>
                        {formatCurrency(recordedDepositTotal(detailsRes))} paid
                        {!isFullyPaid(detailsRes) && Number(detailsRes.depositAmount || 0) > 0 && Number(detailsRes.depositAmount) !== recordedDepositTotal(detailsRes) && ` / ${formatCurrency(detailsRes.depositAmount)} expected`}
                      </span>
                    </div>
                    {recordedDeposits(detailsRes).length > 0 ? (
                      recordedDeposits(detailsRes).map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-[#edf0ed]">
                          <span className="text-[#5f6b6f]">
                            Recorded · {p.method}
                            {p.reference ? ` · ${p.reference}` : ''}
                            {p.processedAt ? ` · ${new Date(p.processedAt).toLocaleDateString()}` : ''}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-[#2e7d32] font-bold">{formatCurrency(p.amount)}</span>
                            <button
                              type="button"
                              title="Print payment receipt"
                              onClick={() =>
                                printPaymentReceipt(p, {
                                  type: isFullyPaid(detailsRes) ? 'PAYMENT' : 'DEPOSIT',
                                  fullySettled: isFullyPaid(detailsRes),
                                  guestName: guestName(detailsRes.guests?.[0]?.guest),
                                  bookingRef: detailsRes.bookingId || detailsRes.confirmationNo,
                                  roomNumber: detailsRes.room?.number,
                                  amountDue: Number(detailsRes.totalAmount) || 0,
                                  remainingBalance: reservationBalance(detailsRes),
                                })
                              }
                              className="rounded-md p-1 text-[#718086] hover:bg-white hover:text-[#16a4d4] transition-colors"
                            >
                              <Printer size={12} />
                            </button>
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-[#b0743a] pt-1 border-t border-[#edf0ed]">
                        No payment recorded yet — collect partial payment or full amount at check-in.
                      </div>
                    )}
                    {!isFullyPaid(detailsRes) && (
                      <div className="flex justify-between border-t border-[#e4e9e5] pt-2 mt-1">
                        <span className="text-[#5f6b6f] font-semibold">Remaining balance left to pay:</span>
                        <span className="font-extrabold text-[#b0743a]">{formatCurrency(reservationBalance(detailsRes))}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Special Requests & Notes */}
              {(detailsRes.specialRequests || detailsRes.notes) && (
                <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-2 text-xs">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center gap-1.5">
                    <FileText size={13} /> Notes & Special Requests
                  </div>
                  {detailsRes.specialRequests && (
                    <div>
                      <span className="font-bold text-[#899397]">Special requests: </span>
                      <span className="text-[#26363e]">{detailsRes.specialRequests}</span>
                    </div>
                  )}
                  {detailsRes.notes && (
                    <div>
                      <span className="font-bold text-[#899397]">Internal notes: </span>
                      <span className="text-[#26363e]">{detailsRes.notes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#edf0ed]">
                <div className="flex items-center gap-2">
                  {canProcessPayment && ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(String(detailsRes.status).toUpperCase()) && !isFullyPaid(detailsRes) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[#16a4d4]"
                      onClick={openDeposit}
                    >
                      <CreditCard size={13} /> Record payment
                    </Button>
                  )}
                  {canCancel && ['PENDING', 'CONFIRMED'].includes(String(detailsRes.status).toUpperCase()) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markNoShow(detailsRes.id)}
                    >
                      <UserX size={13} /> Mark No-Show
                    </Button>
                  )}
                  {!['CANCELLED', 'CHECKED_OUT', 'NO_SHOW'].includes(String(detailsRes.status).toUpperCase()) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => cancel(detailsRes.id)}
                    >
                      Cancel booking
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {canEdit && ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(String(detailsRes.status).toUpperCase()) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const r = detailsRes;
                        setDetailsRes(null);
                        openEdit(r);
                      }}
                    >
                      <Pencil size={13} /> Edit details
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setDetailsRes(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Group Booking Details Modal */}
      <Modal
        open={!!selectedGroup}
        onClose={() => setSelectedGroupId(null)}
        title={selectedGroup ? `Group booking details · ${selectedGroup.bookingId}` : 'Group booking details'}
        size="lg"
      >
        {selectedGroup && (
          <div className="p-6 space-y-6">
            {/* Header Overview Card */}
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#e8ebe8] bg-[#f7f9f8] p-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-extrabold text-[#a8761e]">
                    {selectedGroup.bookingId}
                  </span>
                  <span className="rounded-md bg-[#e8f2f4] px-2 py-0.5 text-[10px] font-extrabold text-[#16a4d4]">
                    GROUP BOOKING · {selectedGroup.reservations.length} ROOMS
                  </span>
                </div>
                <div className="mt-1 text-xs text-[#7d898d] space-x-2">
                  <span>Booked on {selectedGroup.createdAt ? new Date(selectedGroup.createdAt).toLocaleString() : '—'}</span>
                  <span>· {Math.max(1, Math.ceil((new Date(selectedGroup.checkOutDate).getTime() - new Date(selectedGroup.checkInDate).getTime()) / (1000 * 3600 * 24)))} nights</span>
                </div>
                {selectedGroup.bookedBy && (
                  <div className="mt-1 text-xs flex items-center gap-1 text-[#26363e] font-semibold">
                    <span>👤 Booked by</span>
                    <span className="text-[#16a4d4]">{selectedGroup.bookedBy?.name || 'Staff'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {statusBadge(selectedGroup.status)}
              </div>
            </div>

            {/* Grid 1: Stay & Lead Guest Details */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Stay Dates */}
              <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center gap-1.5">
                  <CalendarDays size={14} /> Group Stay Dates
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                    <span className="text-[#899397]">Check-in</span>
                    <span className="font-extrabold text-[#26363e]">{new Date(selectedGroup.checkInDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                    <span className="text-[#899397]">Check-out</span>
                    <span className="font-extrabold text-[#26363e]">{new Date(selectedGroup.checkOutDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                    <span className="text-[#899397]">Total Rooms</span>
                    <span className="font-extrabold text-[#16a4d4]">{selectedGroup.rooms.length} Rooms</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#899397]">Total Guests</span>
                    <span className="font-extrabold text-[#26363e]">{selectedGroup.allGuests.length} Guests in party</span>
                  </div>
                </div>
              </div>

              {/* Lead Guest */}
              <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center gap-1.5">
                  <Users size={14} /> Lead Guest Contact
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                    <span className="text-[#899397]">Name</span>
                    <span className="font-extrabold text-[#26363e] flex items-center gap-1">
                      {formatGuestName(selectedGroup.leadGuest)}
                      {selectedGroup.leadGuest?.isVip && <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-extrabold text-amber-800">VIP</span>}
                    </span>
                  </div>
                  {selectedGroup.leadGuest?.phone && (
                    <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                      <span className="text-[#899397]">Phone</span>
                      <span className="font-bold text-[#26363e]">{selectedGroup.leadGuest.phone}</span>
                    </div>
                  )}
                  {selectedGroup.leadGuest?.email && (
                    <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                      <span className="text-[#899397]">Email</span>
                      <span className="font-bold text-[#26363e]">{selectedGroup.leadGuest.email}</span>
                    </div>
                  )}
                  {selectedGroup.allGuests.length > 1 && (
                    <div className="py-1">
                      <span className="text-[#899397] block mb-1">Other Guests ({selectedGroup.allGuests.length - 1}):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedGroup.allGuests.filter((g: any) => g.id !== selectedGroup.leadGuest?.id).map((ag: any) => (
                          <span key={ag.id} className="rounded-md bg-[#f0f4f2] px-2 py-0.5 text-[11px] font-medium text-[#26363e]">
                            {formatGuestName(ag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rooms in Group */}
            <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center gap-1.5">
                <BedDouble size={14} /> Booked Rooms ({selectedGroup.reservations.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-wider text-[#7d898d]">
                    <tr>
                      <th className="px-3 py-2">Room</th>
                      <th className="px-3 py-2">Confirmation</th>
                      <th className="px-3 py-2">Assigned Guest</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0ed]">
                    {selectedGroup.reservations.map((sub: any) => (
                      <tr key={sub.id} className="hover:bg-[#f8fbf9]">
                        <td className="px-3 py-2 font-bold text-[#26363e]">
                          Room {sub.room?.number || '—'} <span className="text-[10px] font-normal text-[#899397]">({sub.room?.roomType?.name || 'Room'})</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[#556970]">{sub.confirmationNo}</td>
                        <td className="px-3 py-2 text-[#304046]">{guestName(sub.guests?.[0]?.guest)}</td>
                        <td className="px-3 py-2 font-bold text-[#20343e]">{formatCurrency(sub.totalAmount)}</td>
                        <td className="px-3 py-2">{statusBadge(sub.status || 'PENDING')}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGroupId(null);
                              openDetails(sub);
                            }}
                            className="rounded p-1 text-[#899397] hover:bg-[#e8f2f4] hover:text-[#16a4d4]"
                            title="View room details"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary & Group Payment Card */}
            <div className="rounded-2xl border border-[#e8ebe8] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d898d] flex items-center gap-1.5">
                  <CreditCard size={14} /> Group Payment &amp; Financial Summary
                </div>
                {selectedGroup.isFullyPaid ? (
                  <span className="rounded-full bg-[#e3f3e6] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#2e7d32]">
                    Paid in full (Group)
                  </span>
                ) : (
                  <span className="rounded-full bg-[#fdf3e7] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#b0743a]">
                    Balance due {formatCurrency(selectedGroup.balance)}
                  </span>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#f0f2f0]">
                  <span className="text-[#899397]">Combined Group Total</span>
                  <span className="font-extrabold text-[#20343e] text-sm">{formatCurrency(selectedGroup.totalAmount)}</span>
                </div>
                {selectedGroup.discountAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-[#f0f2f0] text-[#a05d20]">
                    <span>Group Discounts</span>
                    <span className="font-bold">−{formatCurrency(selectedGroup.discountAmount)}</span>
                  </div>
                )}
                <div className="space-y-1.5 bg-[#f7f9f8] p-3 rounded-xl border border-[#eef1ee]">
                  <div className="flex justify-between items-center">
                    <span className={`font-bold ${selectedGroup.isFullyPaid ? 'text-[#2e7d32]' : 'text-[#16a4d4]'}`}>
                      Single Group Payment
                    </span>
                    <span className={`font-extrabold ${selectedGroup.isFullyPaid ? 'text-[#2e7d32]' : 'text-[#16a4d4]'}`}>
                      {formatCurrency(selectedGroup.recordedTotal)} paid
                    </span>
                  </div>
                  {selectedGroup.payments.length > 0 ? (
                    selectedGroup.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-[#edf0ed]">
                        <span className="text-[#5f6b6f]">
                          Group Deposit · {p.method}
                          {p.reference ? ` · ${p.reference}` : ''}
                          {p.processedAt ? ` · ${new Date(p.processedAt).toLocaleDateString()}` : ''}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-[#2e7d32] font-bold">{formatCurrency(p.amount)}</span>
                          <button
                            type="button"
                            title="Print payment receipt"
                            onClick={() =>
                              printPaymentReceipt(p, {
                                type: selectedGroup.isFullyPaid ? 'PAYMENT' : 'DEPOSIT',
                                fullySettled: selectedGroup.isFullyPaid,
                                guestName: formatGuestName(selectedGroup.leadGuest),
                                bookingRef: selectedGroup.bookingId,
                                isGroup: true,
                                roomCount: selectedGroup.rooms?.length,
                                amountDue: selectedGroup.totalAmount,
                                remainingBalance: selectedGroup.balance,
                              })
                            }
                            className="rounded-md p-1 text-[#718086] hover:bg-white hover:text-[#16a4d4] transition-colors"
                          >
                            <Printer size={12} />
                          </button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-[#b0743a]">No group payment recorded yet — collect partial payment below.</div>
                  )}
                  {!selectedGroup.isFullyPaid && (
                    <div className="flex justify-between border-t border-[#e4e9e5] pt-2 mt-1">
                      <span className="text-[#5f6b6f] font-semibold">Remaining Group Balance</span>
                      <span className="font-extrabold text-[#b0743a] text-sm">{formatCurrency(selectedGroup.balance)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#edf0ed]">
              <div className="flex items-center gap-2">
                {canProcessPayment && !selectedGroup.isFullyPaid && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-[#16a4d4] text-white"
                    onClick={() => {
                      const g = selectedGroup;
                      setSelectedGroupId(null);
                      openGroupDeposit(g);
                    }}
                  >
                    <CreditCard size={13} /> Record group payment
                  </Button>
                )}
                {canCancel && !['CANCELLED', 'CHECKED_OUT'].includes(String(selectedGroup.status).toUpperCase()) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => cancelGroup(selectedGroup.bookingId)}
                  >
                    Cancel group booking
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedGroupId(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={depositOpen}
        onClose={() => { setDepositOpen(false); setDepositTargetGroup(null); }}
        title={depositTargetGroup ? `Record group payment · ${depositTargetGroup.bookingId}` : detailsRes ? `Record payment · ${detailsRes.confirmationNo || 'reservation'}` : 'Record payment'}
        size="md"
      >
        <div className="space-y-5">
          {depositTargetGroup ? (
            <>
              <div className="rounded-xl bg-[#f0f8fa] p-3 text-xs text-[#20343e] border border-[#d3eaee]">
                <div className="flex items-center gap-2 mb-1.5 font-bold text-[#16a4d4]">
                  <Users size={14} /> Group Payment · {depositTargetGroup.reservations.length} Rooms ({depositTargetGroup.rooms.map((r: any) => `R${r.number}`).join(', ')})
                </div>
                {depositTargetGroup.recordedTotal > 0 ? (
                  <>
                    <span className="text-[#2e7d32] font-bold">{formatCurrency(depositTargetGroup.recordedTotal)} recorded</span>
                    <span className="mx-1 text-[#899397]">·</span>
                    <span className="text-[#b0743a] font-bold">Group balance due {formatCurrency(depositTargetGroup.balance)}</span>
                  </>
                ) : (
                  <span>No payment logged yet for this group — record the group deposit.</span>
                )}
                <div className="mt-1 text-[10px] text-[#899397]">
                  Outstanding group balance: <strong className="text-[#20343e]">{formatCurrency(depositTargetGroup.balance)}</strong> (Group total: {formatCurrency(depositTargetGroup.totalAmount)})
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Amount to pay (GHS)" required>
                  <TextInput
                    type="number"
                    min={1}
                    step="0.01"
                    placeholder="e.g. 500"
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </FormField>
                <FormField label="Payment method" required>
                  <SelectInput value={depositForm.method} onChange={(e) => setDepositForm((f) => ({ ...f, method: e.target.value }))} disabled={depositSplitOpen}>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </SelectInput>
                </FormField>
              </div>

              {depositForm.method === 'CASH' && !depositSplitOpen && (
                <FormField label="Cash tendered / handed over by guest (GHS) (optional)">
                  <TextInput
                    type="number"
                    min={Number(depositForm.amount) || 0}
                    step="0.01"
                    placeholder={depositForm.amount || 'e.g. 500'}
                    value={depositForm.tendered}
                    onChange={(e) => setDepositForm((f) => ({ ...f, tendered: e.target.value }))}
                  />
                </FormField>
              )}

              {/* Settlement Check Box */}
              {Number(depositForm.amount) > 0 && (
                <div className="rounded-xl border border-[#dfe4e1] bg-[#f9faf9] p-3 text-xs space-y-2">
                  <div className="flex justify-between items-center text-[#556368]">
                    <span>Money supposed to be paid:</span>
                    <span className="font-extrabold text-[#20343e]">{formatCurrency(depositTargetGroup.balance)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#556368]">
                    <span>Money paid:</span>
                    <span className="font-bold text-[#20343e]">{formatCurrency(Number(depositForm.amount))}</span>
                  </div>
                  {depositForm.method === 'CASH' && Number(depositForm.tendered) > Number(depositForm.amount) && (
                    <div className="flex justify-between items-center text-[#556368]">
                      <span>Cash tendered:</span>
                      <span className="font-bold text-[#20343e]">{formatCurrency(Number(depositForm.tendered))}</span>
                    </div>
                  )}
                  <div className="border-t border-[#e2e7e4] pt-2 flex justify-between items-center">
                    <span className="font-semibold text-[#445055]">Payment Classification:</span>
                    {Number(depositForm.amount) >= depositTargetGroup.balance ? (
                      <span className="rounded-md bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-extrabold text-[#047857] border border-[#a7f3d0]">
                        &#10003; Full Payment (Paid in full)
                      </span>
                    ) : (
                      <span className="rounded-md bg-[#fffbeb] px-2 py-0.5 text-[11px] font-extrabold text-[#b45309] border border-[#fde68a]">
                        Part Payment / Deposit
                      </span>
                    )}
                  </div>
                  {depositForm.method === 'CASH' && Number(depositForm.tendered) > Number(depositForm.amount) && (
                    <div className="flex justify-between items-center rounded-lg bg-[#ecfdf5] px-2.5 py-1.5 text-[#047857] border border-[#a7f3d0]">
                      <span className="font-bold">&#8594; Change due to guest:</span>
                      <span className="font-extrabold text-sm">{formatCurrency(Number(depositForm.tendered) - Number(depositForm.amount))}</span>
                    </div>
                  )}
                  {Number(depositForm.amount) < depositTargetGroup.balance && (
                    <div className="flex justify-between items-center rounded-lg bg-[#fffbeb] px-2.5 py-1.5 text-[#b45309] border border-[#fde68a]">
                      <span className="font-bold">&#8594; Remaining balance to be paid:</span>
                      <span className="font-extrabold text-sm">{formatCurrency(depositTargetGroup.balance - Number(depositForm.amount))}</span>
                    </div>
                  )}
                  {Number(depositForm.amount) >= depositTargetGroup.balance && (
                    <div className="text-[11px] text-[#047857] font-semibold text-center pt-0.5">
                      &#10003; This payment completely clears the outstanding group balance.
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-bold text-[#4A5568]">
                <input
                  type="checkbox"
                  checked={depositSplitOpen}
                  onChange={(e) => {
                    setDepositSplitOpen(e.target.checked);
                    setDepositTenders([makeTenderRow()]);
                  }}
                  className="h-3.5 w-3.5 accent-[#174B59]"
                />
                Split payment across methods (e.g. cash + mobile money)
              </label>

              {depositSplitOpen && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <TenderSplit total={Number(depositForm.amount) || 0} rows={depositTenders} onChange={setDepositTenders} />
                </div>
              )}

              <FormField label="Reference (optional)">
                <TextInput
                  placeholder="Receipt / transaction number"
                  value={depositForm.reference}
                  disabled={depositSplitOpen}
                  onChange={(e) => setDepositForm((f) => ({ ...f, reference: e.target.value }))}
                />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => { setDepositOpen(false); setDepositTargetGroup(null); }}>Cancel</Button>
                <Button variant="primary" size="sm" loading={saving} disabled={depositSplitOpen && !tendersCoverTotal(depositTenders, Number(depositForm.amount) || 0)} onClick={recordDeposit}>Record group payment</Button>
              </div>
            </>
          ) : detailsRes ? (
            <>
              <div className="rounded-xl bg-[#f7f9f8] p-3 text-xs text-[#26363e]">
                {Number(detailsRes.depositAmount || 0) > 0 || recordedDepositTotal(detailsRes) > 0 ? (
                  <>
                    {Number(detailsRes.depositAmount || 0) > 0 && Number(detailsRes.depositAmount) !== recordedDepositTotal(detailsRes) && (
                      <>
                        Payment expected: <span className="font-extrabold text-[#16a4d4]">{formatCurrency(detailsRes.depositAmount)}</span>
                        <span className="mx-1 text-[#899397]">·</span>
                      </>
                    )}
                    {recordedDepositTotal(detailsRes) > 0 && (
                      <>
                        <span className="text-[#2e7d32] font-bold">{formatCurrency(recordedDepositTotal(detailsRes))} recorded</span>
                        <span className="mx-1 text-[#899397]">·</span>
                      </>
                    )}
                    <span className="text-[#b0743a] font-bold">Balance due {formatCurrency(Math.max(0, Number(detailsRes.totalAmount || 0) - recordedDepositTotal(detailsRes)))}</span>
                  </>
                ) : (
                  <span>No payment was logged on this reservation — record the amount the guest paid.</span>
                )}
                <div className="mt-1 text-[10px] text-[#899397]">
                  Amount cannot exceed {formatCurrency(Math.max(0, Number(detailsRes.totalAmount || 0) - recordedDepositTotal(detailsRes)))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Amount to pay (GHS)" required>
                  <TextInput
                    type="number"
                    min={1}
                    step="0.01"
                    placeholder="e.g. 500"
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </FormField>
                <FormField label="Payment method" required>
                  <SelectInput value={depositForm.method} onChange={(e) => setDepositForm((f) => ({ ...f, method: e.target.value }))} disabled={depositSplitOpen}>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </SelectInput>
                </FormField>
              </div>

              {depositForm.method === 'CASH' && !depositSplitOpen && (
                <FormField label="Cash tendered / handed over by guest (GHS) (optional)">
                  <TextInput
                    type="number"
                    min={Number(depositForm.amount) || 0}
                    step="0.01"
                    placeholder={depositForm.amount || 'e.g. 500'}
                    value={depositForm.tendered}
                    onChange={(e) => setDepositForm((f) => ({ ...f, tendered: e.target.value }))}
                  />
                </FormField>
              )}

              {/* Settlement Check Box */}
              {Number(depositForm.amount) > 0 && (
                <div className="rounded-xl border border-[#dfe4e1] bg-[#f9faf9] p-3 text-xs space-y-2">
                  <div className="flex justify-between items-center text-[#556368]">
                    <span>Money supposed to be paid:</span>
                    <span className="font-extrabold text-[#20343e]">{formatCurrency(reservationBalance(detailsRes))}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#556368]">
                    <span>Money paid:</span>
                    <span className="font-bold text-[#20343e]">{formatCurrency(Number(depositForm.amount))}</span>
                  </div>
                  {depositForm.method === 'CASH' && Number(depositForm.tendered) > Number(depositForm.amount) && (
                    <div className="flex justify-between items-center text-[#556368]">
                      <span>Cash tendered:</span>
                      <span className="font-bold text-[#20343e]">{formatCurrency(Number(depositForm.tendered))}</span>
                    </div>
                  )}
                  <div className="border-t border-[#e2e7e4] pt-2 flex justify-between items-center">
                    <span className="font-semibold text-[#445055]">Payment Classification:</span>
                    {Number(depositForm.amount) >= reservationBalance(detailsRes) ? (
                      <span className="rounded-md bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-extrabold text-[#047857] border border-[#a7f3d0]">
                        &#10003; Full Payment (Paid in full)
                      </span>
                    ) : (
                      <span className="rounded-md bg-[#fffbeb] px-2 py-0.5 text-[11px] font-extrabold text-[#b45309] border border-[#fde68a]">
                        Part Payment / Deposit
                      </span>
                    )}
                  </div>
                  {depositForm.method === 'CASH' && Number(depositForm.tendered) > Number(depositForm.amount) && (
                    <div className="flex justify-between items-center rounded-lg bg-[#ecfdf5] px-2.5 py-1.5 text-[#047857] border border-[#a7f3d0]">
                      <span className="font-bold">&#8594; Change due to guest:</span>
                      <span className="font-extrabold text-sm">{formatCurrency(Number(depositForm.tendered) - Number(depositForm.amount))}</span>
                    </div>
                  )}
                  {Number(depositForm.amount) < reservationBalance(detailsRes) && (
                    <div className="flex justify-between items-center rounded-lg bg-[#fffbeb] px-2.5 py-1.5 text-[#b45309] border border-[#fde68a]">
                      <span className="font-bold">&#8594; Remaining balance to be paid:</span>
                      <span className="font-extrabold text-sm">{formatCurrency(reservationBalance(detailsRes) - Number(depositForm.amount))}</span>
                    </div>
                  )}
                  {Number(depositForm.amount) >= reservationBalance(detailsRes) && (
                    <div className="text-[11px] text-[#047857] font-semibold text-center pt-0.5">
                      &#10003; This payment completely clears the outstanding reservation balance.
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-bold text-[#4A5568]">
                <input
                  type="checkbox"
                  checked={depositSplitOpen}
                  onChange={(e) => {
                    setDepositSplitOpen(e.target.checked);
                    setDepositTenders([makeTenderRow()]);
                  }}
                  className="h-3.5 w-3.5 accent-[#174B59]"
                />
                Split payment across methods (e.g. cash + mobile money)
              </label>

              {depositSplitOpen && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <TenderSplit total={Number(depositForm.amount) || 0} rows={depositTenders} onChange={setDepositTenders} />
                </div>
              )}

              <FormField label="Reference (optional)">
                <TextInput
                  placeholder="Receipt / transaction number"
                  value={depositForm.reference}
                  disabled={depositSplitOpen}
                  onChange={(e) => setDepositForm((f) => ({ ...f, reference: e.target.value }))}
                />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => { setDepositOpen(false); setDepositTargetGroup(null); }}>Cancel</Button>
                <Button variant="primary" size="sm" loading={saving} disabled={depositSplitOpen && !tendersCoverTotal(depositTenders, Number(depositForm.amount) || 0)} onClick={recordDeposit}>Record payment</Button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title={manageRes ? `Guests on ${manageRes.confirmationNo || 'reservation'}` : 'Manage guests'} size="lg">
        <div className="space-y-5">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">Currently on the reservation</div>
            <div className="mt-2 space-y-1.5">
              {(manageRes?.guests?.length ? [...manageRes.guests].sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary)) : []).map((g: any) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border border-[#eef1ee] bg-[#fbfcfa] px-3 py-2 text-xs">
                  <span className={g.isPrimary ? 'font-extrabold text-[#20343e]' : 'text-[#667278]'}>
                    {guestName(g.guest)} {g.isPrimary && <span className="ml-1 rounded-md bg-[#e8f2f4] px-1.5 py-0.5 text-[9px] font-extrabold text-[#16a4d4]">PRIMARY</span>}
                  </span>
                  <span className="text-[10px] text-[#8a9598]">{g.guest?.phone || g.guest?.email || ''}</span>
                </div>
              ))}
              {(!manageRes?.guests || manageRes.guests.length === 0) && <p className="text-xs text-[#8a9598]">No guests attached yet.</p>}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">Add more guests</div>
            <div className="mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {guests.filter((g) => !guestAttached(g)).length === 0 ? (
                <p className="text-xs text-[#8a9598]">All guests are already on this reservation.</p>
              ) : (
                guests
                  .filter((g) => !guestAttached(g))
                  .map((g) => {
                    const active = manageIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setManageIds((ids) => (active ? ids.filter((x) => x !== g.id) : [...ids, g.id]))}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${active ? 'bg-[#16a4d4] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'}`}
                      >
                        {g.firstName} {g.lastName}
                      </button>
                    );
                  })
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setManageOpen(false)}>Close</Button>
            <Button type="button" loading={saving} onClick={() => void saveManageGuests()} disabled={manageIds.length === 0}>
              Add {manageIds.length > 0 ? `${manageIds.length} guest${manageIds.length === 1 ? '' : 's'}` : 'guests'}
            </Button>
          </div>
        </div>
      </Modal>
    </ShellPage>
  );
};

export default ReservationsPage;
