import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  guestAuthApi,
  guestSession,
  publicApi,
  PublicApiError,
  type CreateBookingResult,
  type PublicBooking,
  type PublicBookingConfig,
  type RoomTypeAvailability,
} from '../../services/publicApi';
import { villaAssets } from '../../assets';

type Step = 'search' | 'rooms' | 'details' | 'payment' | 'done';

const inputClass =
  'w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] px-3 py-2.5 text-sm text-[var(--ns-ink)] outline-none transition focus:border-[var(--ns-gold)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ns-gold)_18%,transparent)]';

const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ns-muted)]';

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function money(amount: number, currency: string): string {
  const prefix = /^(GHS|GHC)$/i.test(currency || '') ? 'GH₵' : currency;
  return `${prefix} ${Number(amount || 0).toFixed(2)}`;
}

/** "2026-11-19" → "Thu 19 Nov 2026" (kept short in tight layouts). */
function prettyDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function dateRange(checkIn?: string | null, checkOut?: string | null): string {
  return `${prettyDate(checkIn)} → ${prettyDate(checkOut)}`;
}

function durationLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmed';
    case 'PENDING':
      return 'Awaiting deposit verification';
    case 'CANCELLED':
      return 'Cancelled';
    case 'CHECKED_IN':
      return 'Checked in';
    case 'CHECKED_OUT':
      return 'Completed';
    default:
      return status;
  }
}

/** Pick a real room photo for the type when staff have not uploaded one yet. */
function roomPhoto(room: RoomTypeAvailability): string {
  const descriptor = `${room.name} ${room.shortDescription || ''} ${room.description || ''}`.toLowerCase();
  if (/apartment|suite|\bliving\b/.test(descriptor)) return villaAssets.suiteLivingArea;
  if (/large/.test(descriptor) && /studio/.test(descriptor)) return villaAssets.roomDeluxeKing;
  if (/studio/.test(descriptor)) return villaAssets.roomStudioSuite;
  if (/twin/.test(descriptor)) return villaAssets.roomTwinBeds;
  if (/single|standard/.test(descriptor)) return villaAssets.roomSingleBed;
  if (/deluxe|king|double/.test(descriptor)) return villaAssets.roomDeluxeKing;
  return villaAssets.villaExterior;
}

const RoomImage: React.FC<{ room: RoomTypeAvailability; showLabel?: boolean }> = ({ room, showLabel = true }) => {
  const [index, setIndex] = useState(0);
  const images = room.imageUrls && room.imageUrls.length > 0 ? room.imageUrls : [];

  if (images.length === 0) {
    const photo = roomPhoto(room);
    return (
      <div className="relative h-52 w-full overflow-hidden">
        <img
          src={photo}
          alt={room.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {showLabel && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            <img src={villaAssets.logo} alt="NS Logo" className="h-7 w-7 rounded-lg object-cover shadow" />
            <span className="text-xs font-bold text-white drop-shadow">{room.name}</span>
          </div>
        )}
      </div>
    );
  }

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((curr) => (curr === 0 ? images.length - 1 : curr - 1));
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((curr) => (curr === images.length - 1 ? 0 : curr + 1));
  };

  return (
    <div className="relative h-56 w-full overflow-hidden bg-black/10 group">
      <img
        src={images[index]}
        alt={`${room.name} photo ${index + 1}`}
        className="h-full w-full object-cover transition-opacity duration-300"
        loading="lazy"
      />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-md opacity-80 hover:opacity-100 transition"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-md opacity-80 hover:opacity-100 transition"
          >
            <ChevronRight size={16} />
          </button>
          <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-none">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-4 bg-white shadow-xs' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
          <span className="absolute top-2.5 right-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
};

export const BookingPage: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const [config, setConfig] = useState<PublicBookingConfig | null>(null);
  const [step, setStep] = useState<Step>('search');
  const [search, setSearch] = useState({
    checkInDate: iso(addDays(today, 1)),
    checkOutDate: iso(addDays(today, 2)),
    adults: 2,
    children: 0,
  });
  const [rooms, setRooms] = useState<RoomTypeAvailability[]>([]);
  const [selected, setSelected] = useState<RoomTypeAvailability | null>(null);
  const [guest, setGuest] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    specialRequests: '',
    acceptPolicy: false,
  });
  const [booking, setBooking] = useState<CreateBookingResult | null>(null);
  const [reference, setReference] = useState('');
  const [lookup, setLookup] = useState({ confirmationNo: '', email: '' });
  const [lookupResult, setLookupResult] = useState<PublicBooking | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    publicApi.getConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!guestSession.hasSession()) return;
    guestAuthApi
      .me()
      .then((account) =>
        setGuest((current) => ({
          ...current,
          firstName: current.firstName || account.firstName,
          lastName: current.lastName || account.lastName,
          email: current.email || account.email,
          phone: current.phone || account.phone || '',
        })),
      )
      .catch(() => undefined);
  }, []);

  const configError = config && !config.publicEnabled;
  const paymentsUnavailable = !!config && config.publicEnabled && !config.momoConfigured;
  const onlineBookingOpen = !!config && config.publicEnabled && config.momoConfigured;

  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (step !== 'payment') return;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step !== 'search') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const location = useLocation();
  useEffect(() => {
    if (location.hash !== '#lookup') return;
    if (step !== 'search') {
      setStep('search');
      return;
    }
    const timer = window.setTimeout(() => {
      document.getElementById('lookup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [location.hash, step]);

  const holdRemainingMs = booking?.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() - nowTs : 0;
  const holdExpired = step === 'payment' && !!booking?.holdExpiresAt && holdRemainingMs <= 0;

  const stepIndex = step === 'rooms' ? 1 : step === 'details' ? 2 : step === 'payment' ? 3 : step === 'done' ? 4 : 0;

  const runSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError('');
    setNotice('');
    if (search.checkOutDate <= search.checkInDate) {
      setError('Departure must be after arrival.');
      return;
    }
    setLoading(true);
    try {
      const data = await publicApi.getAvailability(search);
      setRooms(data);
      setStep('rooms');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof PublicApiError ? err.message : 'We could not load availability. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const chooseRoom = (room: RoomTypeAvailability) => {
    setSelected(room);
    setError('');
    setStep('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setError('');
    if (!onlineBookingOpen) {
      setError('Online booking is not open yet. Please call the villa to reserve your stay.');
      return;
    }
    if (!guest.acceptPolicy) {
      setError('Please accept the booking and cancellation policy.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await publicApi.createBooking({
        roomTypeId: selected.id,
        checkInDate: search.checkInDate,
        checkOutDate: search.checkOutDate,
        adults: search.adults,
        children: search.children,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        password: guest.password || undefined,
        specialRequests: guest.specialRequests || undefined,
        acceptPolicy: guest.acceptPolicy,
      });
      setBooking(created);
      setStep('payment');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof PublicApiError ? err.message : 'We could not create your booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReference = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!booking) return;
    setError('');
    const trimmed = reference.trim();
    if (trimmed.length < 4) {
      setError('Enter the Mobile Money transaction reference from your payment SMS.');
      return;
    }
    if (holdExpired) {
      setError('The room hold has expired. Please choose your dates again to start a new booking.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await publicApi.submitPaymentReference(booking.confirmationNo, booking.guest.email, trimmed);
      setBooking({
        ...booking,
        status: updated.status,
        amountPaid: updated.amountPaid,
        balance: updated.balance,
        guestPaymentReference: updated.guestPaymentReference,
        paymentSubmittedAt: updated.paymentSubmittedAt,
      });
      setNotice('Payment reference received. Reception will verify your deposit and confirm the booking.');
      setStep('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof PublicApiError ? err.message : 'We could not submit your payment reference. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const runLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLookupLoading(true);
    try {
      const result = await publicApi.lookupBooking(lookup.confirmationNo.trim(), lookup.email.trim());
      setLookupResult(result);
    } catch (err) {
      setLookupResult(null);
      setError(err instanceof PublicApiError ? err.message : 'We could not find that booking.');
    } finally {
      setLookupLoading(false);
    }
  };

  const copyReference = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Copied to clipboard.');
    } catch {
      setNotice('Copy failed — please select and copy manually.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      {step === 'search' && (
        <>
          <section className="relative overflow-hidden rounded-3xl border border-[var(--ns-glass-line)] shadow-2xl">
            <img
              src={villaAssets.villaExterior}
              alt="NS Luxury Villa exterior"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(8,26,40,0.93)_0%,rgba(8,26,40,0.78)_46%,rgba(150,106,33,0.74)_100%)]" />
            <div className="relative px-6 py-12 text-white sm:px-10 lg:py-16">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur">
                  <MapPin size={13} /> Ho · Volta Region · Ghana
                </div>
                <h1 className="mt-5 font-['Outfit'] text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                  Your villa escape starts here.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
                  {onlineBookingOpen
                    ? 'Choose your dates, pick a room type and reserve it with a secure Mobile Money deposit. Reception verifies your payment and your booking appears instantly in our management system.'
                    : 'Browse live availability for every room type. Online deposits are opening soon — call or email reception and we will hold your room.'}
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-white/90">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5"><ShieldCheck size={14} /> Server-checked availability</span>
                  {onlineBookingOpen ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5"><Wallet size={14} /> Mobile Money deposit</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5"><CalendarDays size={14} /> Instant room hold</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5"><Phone size={14} /> Call reception to reserve</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="-mt-8 relative z-10 rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-clay-raised)] p-5 shadow-xl sm:p-6">
            {configError && (
              <div className="mb-4 rounded-xl border border-[var(--ns-warning)]/40 bg-[var(--ns-warning)]/10 px-4 py-3 text-sm text-[var(--ns-ink)]">
                <div className="font-bold">Online reservations are paused</div>
                <p className="mt-1 text-[13px] text-[var(--ns-muted)]">
                  Please call{' '}
                  <a href={`tel:${config?.villa.phone || FALLBACK_PHONE}`} className="font-semibold text-[var(--ns-gold)]">
                    {config?.villa.phone || FALLBACK_PHONE}
                  </a>{' '}
                  and reception will reserve your room.
                </p>
              </div>
            )}
            {paymentsUnavailable && (
              <div className="mb-4 rounded-xl border border-[var(--ns-warning)]/40 bg-[var(--ns-warning)]/10 px-4 py-3 text-sm text-[var(--ns-ink)]">
                <div className="font-bold">Online reservations are opening soon</div>
                <p className="mt-1 text-[13px] text-[var(--ns-muted)]">
                  You can still browse rooms and dates. To reserve now, call{' '}
                  <a href={`tel:${config?.villa.phone || FALLBACK_PHONE}`} className="font-semibold text-[var(--ns-gold)]">
                    {config?.villa.phone || FALLBACK_PHONE}
                  </a>{' '}
                  or email{' '}
                  <a href={`mailto:${config?.villa.email || ''}`} className="font-semibold text-[var(--ns-gold)]">
                    {config?.villa.email || 'our reception'}
                  </a>.
                </p>
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-xl border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 px-4 py-3 text-sm text-[var(--ns-ink)]">
                {error}
              </div>
            )}
            <form onSubmit={runSearch} className="grid gap-4 md:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto] md:items-end">
              <div>
                <label htmlFor="search-arrival" className={labelClass}>Arrival</label>
                <input
                  id="search-arrival"
                  type="date"
                  required
                  min={iso(today)}
                  value={search.checkInDate}
                  onChange={(e) => setSearch({ ...search, checkInDate: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="search-departure" className={labelClass}>Departure</label>
                <input
                  id="search-departure"
                  type="date"
                  required
                  min={search.checkInDate || iso(today)}
                  value={search.checkOutDate}
                  onChange={(e) => setSearch({ ...search, checkOutDate: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="search-adults" className={labelClass}>Adults</label>
                <select id="search-adults" value={search.adults} onChange={(e) => setSearch({ ...search, adults: Number(e.target.value) })} className={inputClass}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="search-children" className={labelClass}>Children</label>
                <select id="search-children" value={search.children} onChange={(e) => setSearch({ ...search, children: Number(e.target.value) })} className={inputClass}>
                  {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading || !!configError}
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-[var(--ns-gold)] px-5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Check availability
              </button>
            </form>
            {onlineBookingOpen && (
              <p className="mt-3 text-[12px] text-[var(--ns-muted)]">
                Deposits are {config?.depositPercent ?? 30}% of the stay total. Rooms are held for {config?.holdMinutes ?? 60} minutes while payment is verified.
              </p>
            )}
          </section>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ns-muted)]">The villa</div>
                <h2 className="mt-1 font-['Outfit'] text-2xl font-extrabold tracking-tight">Space to slow down.</h2>
              </div>
              <a
                href={`tel:${config?.villa.phone || FALLBACK_PHONE}`}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ns-gold)] hover:underline"
              >
                <Phone size={14} /> Questions? Call reception
              </a>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { src: villaAssets.restaurantBar, label: 'Restaurant & bar' },
                { src: villaAssets.roomDeluxeKing, label: 'Deluxe rooms' },
                { src: villaAssets.suiteLivingArea, label: 'Suite living area' },
              ].map((photo) => (
                <figure key={photo.label} className="relative overflow-hidden rounded-2xl border border-[var(--ns-glass-line)]">
                  <img src={photo.src} alt={photo.label} className="h-44 w-full object-cover transition duration-500 hover:scale-[1.03]" loading="lazy" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-2.5 pt-8 text-[12px] font-bold text-white">
                    {photo.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: CalendarDays, title: 'Pick your dates', text: 'Live availability across every room type, checked by the server.' },
              onlineBookingOpen
                ? { icon: CreditCard, title: 'Reserve with MoMo', text: 'Pay the deposit to our Mobile Money number and submit the transaction reference.' }
                : { icon: Phone, title: 'Call to reserve', text: 'Reception holds your room and explains the deposit while online booking opens.' },
              { icon: CheckCircle2, title: 'Reception confirms', text: 'Your booking appears in our management system and is confirmed after verification.' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-5">
                <item.icon size={20} className="text-[var(--ns-gold)]" />
                <div className="mt-3 text-sm font-bold">{item.title}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--ns-muted)]">{item.text}</p>
              </div>
            ))}
          </section>

          <section id="lookup" className="mt-10 scroll-mt-24 rounded-2xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Already have a booking?</div>
                <p className="text-[13px] text-[var(--ns-muted)]">Look it up with your confirmation number and email.</p>
              </div>
            </div>
            <form onSubmit={runLookup} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                aria-label="Confirmation number"
                placeholder="Confirmation number (NSVL-…)"
                value={lookup.confirmationNo}
                onChange={(e) => setLookup({ ...lookup, confirmationNo: e.target.value })}
                className={inputClass}
                required
              />
              <input
                aria-label="Email used for the booking"
                type="email"
                autoComplete="email"
                placeholder="Email used for the booking"
                value={lookup.email}
                onChange={(e) => setLookup({ ...lookup, email: e.target.value })}
                className={inputClass}
                required
              />
              <button type="submit" disabled={lookupLoading} className="rounded-xl border border-[var(--ns-gold)] px-4 py-2 text-sm font-bold text-[var(--ns-gold)] transition hover:bg-[var(--ns-gold)] hover:text-white disabled:opacity-50">
                {lookupLoading ? 'Looking…' : 'Find booking'}
              </button>
            </form>
            {lookupResult && (
              <div className="mt-4 rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-clay-raised)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-sm font-bold text-[var(--ns-gold)]">{lookupResult.confirmationNo}</div>
                  <span className="rounded-full bg-[var(--ns-gold-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--ns-ink)]">{statusLabel(lookupResult.status)}</span>
                </div>
                <div className="mt-2 grid gap-1 text-[13px] text-[var(--ns-muted)] sm:grid-cols-2">
                  <div>{lookupResult.roomType?.name} · {dateRange(lookupResult.checkInDate, lookupResult.checkOutDate)}</div>
                  <div>Deposit {money(lookupResult.depositAmount, lookupResult.currency)} · Paid {money(lookupResult.amountPaid, lookupResult.currency)}</div>
                </div>
                {lookupResult.status === 'PENDING' && (
                  <div className="mt-3 rounded-lg bg-[var(--ns-gold-soft)]/60 p-3 text-[12px]">
                    {lookupResult.momo?.number ? (
                      <>Pay {money(lookupResult.depositAmount, lookupResult.currency)} to MoMo <strong>{lookupResult.momo.number}</strong> ({lookupResult.momo.name}) using reference <strong>{lookupResult.confirmationNo}</strong>.</>
                    ) : (
                      <>Please contact reception at <a href={`tel:${config?.villa.phone || FALLBACK_PHONE}`} className="font-bold underline">{config?.villa.phone || FALLBACK_PHONE}</a> to complete your deposit.</>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {step !== 'search' && (
        <ol className="mb-6 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
          {['Dates', 'Room', 'Details', 'Deposit'].map((label, index) => {
            const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo';
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                    state === 'current'
                      ? 'bg-[var(--ns-gold)] text-white shadow-md'
                      : state === 'done'
                        ? 'bg-[var(--ns-gold)]/12 text-[var(--ns-gold)]'
                        : 'bg-[var(--ns-glass-1)] text-[var(--ns-muted)]'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      state === 'current' ? 'bg-white/25' : state === 'done' ? 'bg-[var(--ns-gold)] text-white' : 'bg-black/5'
                    }`}
                  >
                    {state === 'done' ? <Check size={11} strokeWidth={3} /> : index + 1}
                  </span>
                  {label}
                </span>
                {index < 3 && <span className={`h-px w-4 ${index < stepIndex ? 'bg-[var(--ns-gold)]/50' : 'bg-[var(--ns-glass-line)]'}`} />}
              </li>
            );
          })}
        </ol>
      )}

      {step === 'rooms' && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-['Outfit'] text-2xl font-extrabold tracking-tight sm:text-3xl">Available rooms</h2>
              <p className="mt-1 text-sm text-[var(--ns-muted)]">
                {dateRange(search.checkInDate, search.checkOutDate)} · {search.adults} adult{search.adults === 1 ? '' : 's'}{search.children ? ` · ${search.children} child${search.children === 1 ? '' : 'ren'}` : ''}
              </p>
            </div>
            <button onClick={() => { setStep('search'); setError(''); }} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ns-glass-line)] px-3 py-2 text-sm font-semibold hover:bg-[var(--ns-glass-1)]">
              <ArrowLeft size={15} /> Change dates
            </button>
          </div>

          {error && <div className="mt-4 rounded-xl border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 px-4 py-3 text-sm">{error}</div>}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {rooms.map((room) => (
              <article key={room.id} className="overflow-hidden rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-clay-raised)] shadow-lg">
                <RoomImage room={room} showLabel={false} />
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-['Outfit'] text-xl font-extrabold tracking-tight">{room.name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--ns-muted)]">
                        <Users size={13} /> Up to {room.maxAdults} adult{room.maxAdults === 1 ? '' : 's'}{room.maxChildren ? ` · ${room.maxChildren} child${room.maxChildren === 1 ? '' : 'ren'}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-[var(--ns-gold)]">{money(room.basePrice, room.currency)}</div>
                      <div className="text-[11px] text-[var(--ns-muted)]">per night</div>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-[var(--ns-muted)]">
                    {room.shortDescription || room.description || 'A comfortable room with everything you need for a restful stay.'}
                  </p>

                  {room.amenities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {room.amenities.slice(0, 5).map((amenity) => (
                        <span key={amenity.name} className="rounded-full bg-[var(--ns-glass-1)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ns-muted)]">{amenity.name}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 rounded-xl bg-[var(--ns-glass-1)] p-3 text-[12px]">
                    <div className="flex justify-between"><span className="text-[var(--ns-muted)]">{room.nights} night{room.nights === 1 ? '' : 's'}</span><span>{money(room.subtotal, room.currency)}</span></div>
                    {room.taxAmount > 0 && <div className="mt-1 flex justify-between"><span className="text-[var(--ns-muted)]">Tax</span><span>{money(room.taxAmount, room.currency)}</span></div>}
                    <div className="mt-1 flex justify-between font-bold"><span>Total</span><span>{money(room.totalAmount, room.currency)}</span></div>
                    <div className="mt-2 flex justify-between border-t border-[var(--ns-glass-line)] pt-2 font-bold text-[var(--ns-gold)]"><span>Deposit to reserve</span><span>{money(room.depositAmount, room.currency)}</span></div>
                  </div>

                  {paymentsUnavailable ? (
                    <a
                      href={`tel:${config?.villa.phone || FALLBACK_PHONE}`}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--ns-gold)] px-4 py-2.5 text-sm font-bold text-[var(--ns-gold)] transition hover:bg-[var(--ns-gold)] hover:text-white"
                    >
                      <Phone size={15} /> Call to reserve
                    </a>
                  ) : (
                    <button
                      onClick={() => chooseRoom(room)}
                      disabled={!room.available}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ns-gold)] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {room.available ? <>Select this room <ArrowRight size={15} /></> : room.capacityOk ? 'Sold out for these dates' : 'Not enough capacity'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {rooms.length === 0 && (
            <div className="mt-8 rounded-2xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-8 text-center text-sm text-[var(--ns-muted)]">
              No rooms are available for these dates.{' '}
              <button type="button" onClick={() => setStep('search')} className="font-bold text-[var(--ns-gold)] hover:underline">Try different dates</button>{' '}
              or call{' '}
              <a href={`tel:${config?.villa.phone || FALLBACK_PHONE}`} className="font-bold text-[var(--ns-gold)] hover:underline">
                {config?.villa.phone || FALLBACK_PHONE}
              </a>{' '}
              and reception will find you a room.
            </div>
          )}
        </>
      )}

      {step === 'details' && selected && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={submitBooking} className="rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-clay-raised)] p-5 shadow-lg sm:p-6">
            <button type="button" onClick={() => { setStep('rooms'); setError(''); }} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ns-muted)] hover:text-[var(--ns-gold)]">
              <ArrowLeft size={15} /> Back to rooms
            </button>
            <h2 className="font-['Outfit'] text-2xl font-extrabold tracking-tight">Guest details</h2>
            <p className="mt-1 text-[13px] text-[var(--ns-muted)]">We use these details for your confirmation and to prepare your room.</p>

            {error && <div className="mt-4 rounded-xl border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 px-4 py-3 text-sm">{error}</div>}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="guest-first-name" className={labelClass}>First name</label>
                <input id="guest-first-name" autoComplete="given-name" required value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="guest-last-name" className={labelClass}>Last name</label>
                <input id="guest-last-name" autoComplete="family-name" required value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="guest-email" className={labelClass}>Email</label>
                <input id="guest-email" type="email" autoComplete="email" required value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="guest-phone" className={labelClass}>Phone / WhatsApp</label>
                <input id="guest-phone" type="tel" autoComplete="tel" required value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="+233 …" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="guest-password" className={labelClass}>Create a guest account password (optional)</label>
                <input
                  id="guest-password"
                  type="password"
                  autoComplete="new-password"
                  value={guest.password}
                  onChange={(e) => setGuest({ ...guest, password: e.target.value })}
                  placeholder="At least 8 characters — lets you manage this booking online"
                  className={inputClass}
                  minLength={8}
                />
                <p className="mt-1 text-[11px] text-[var(--ns-muted)]">Leave blank to book without an account. You can always find the booking with your confirmation number and email.</p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="guest-requests" className={labelClass}>Special requests (optional)</label>
                <textarea
                  id="guest-requests"
                  rows={3}
                  value={guest.specialRequests}
                  onChange={(e) => setGuest({ ...guest, specialRequests: e.target.value })}
                  className={inputClass}
                  placeholder="Airport pickup, late arrival, dietary needs…"
                />
              </div>
            </div>

            <details className="mt-5 rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-3.5 text-[12px] leading-relaxed text-[var(--ns-muted)]">
              <summary className="cursor-pointer text-[12px] font-bold text-[var(--ns-ink)]">
                Deposit & cancellation policy
              </summary>
              <ul className="mt-2.5 list-disc space-y-1.5 pl-4">
                <li>A {config?.depositPercent ?? 30}% deposit confirms your room and is applied to your stay total.</li>
                <li>The remaining balance is settled at the villa on arrival.</li>
                <li>You can cancel online until {config?.cancellationHours ?? 24} hours before arrival. After that, please call reception.</li>
                <li>If the deposit is not received within {config?.holdMinutes ?? 60} minutes, the room is released automatically.</li>
              </ul>
            </details>

            <label className="mt-3 flex items-start gap-2.5 rounded-xl bg-[var(--ns-glass-1)] p-3 text-[12px] leading-relaxed text-[var(--ns-muted)]">
              <input
                type="checkbox"
                checked={guest.acceptPolicy}
                onChange={(e) => setGuest({ ...guest, acceptPolicy: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--ns-gold)]"
              />
              <span>
                I accept the deposit and cancellation policy above.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ns-gold)] px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} Continue to deposit
            </button>
          </form>

          <aside className="h-fit rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-5 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl">
              <RoomImage room={selected} showLabel={false} />
            </div>
            <h3 className="mt-4 font-['Outfit'] text-xl font-extrabold">{selected.name}</h3>
            <div className="mt-1 text-[12px] text-[var(--ns-muted)]">
              {dateRange(search.checkInDate, search.checkOutDate)} · {selected.nights} night{selected.nights === 1 ? '' : 's'}
            </div>
            <div className="mt-4 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-[var(--ns-muted)]">Room subtotal</span><span>{money(selected.subtotal, selected.currency)}</span></div>
              {selected.taxAmount > 0 && <div className="flex justify-between"><span className="text-[var(--ns-muted)]">Tax</span><span>{money(selected.taxAmount, selected.currency)}</span></div>}
              <div className="flex justify-between font-bold"><span>Stay total</span><span>{money(selected.totalAmount, selected.currency)}</span></div>
              <div className="flex justify-between border-t border-[var(--ns-glass-line)] pt-2 font-extrabold text-[var(--ns-gold)]"><span>Deposit</span><span>{money(selected.depositAmount, selected.currency)}</span></div>
            </div>
          </aside>
        </div>
      )}

      {step === 'payment' && booking && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-clay-raised)] p-5 shadow-lg sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--ns-gold-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ns-ink)]">
              <Wallet size={13} /> Deposit step
            </div>
            <h2 className="mt-4 font-['Outfit'] text-2xl font-extrabold tracking-tight">Pay your deposit by Mobile Money</h2>
            <div
              className={`mt-3 flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] ${
                holdExpired
                  ? 'border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 text-[var(--ns-danger)]'
                  : 'border-[var(--ns-gold)]/35 bg-[var(--ns-gold-soft)]/40 text-[var(--ns-ink)]'
              }`}
              role="status"
            >
              <Clock3 size={16} className="mt-0.5 shrink-0" />
              <span>
                {holdExpired ? (
                  <>
                    Your room hold has expired. <Link to="/book" className="font-bold underline">Start a new booking</Link> to check availability again.
                  </>
                ) : (
                  <>
                    Room held for <strong className="font-mono">{durationLabel(holdRemainingMs)}</strong> ({config?.holdMinutes ?? 60} minutes total). Send the deposit and submit the reference before the timer runs out.
                  </>
                )}
              </span>
            </div>

            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { title: 'Send the deposit', text: 'Use the MoMo number and reference exactly as shown.' },
                { title: 'Copy your SMS reference', text: 'The transaction ID in your Mobile Money confirmation SMS.' },
                { title: 'Submit it below', text: 'Reception verifies the payment and confirms your room.' },
              ].map((item, index) => (
                <li key={item.title} className="rounded-2xl bg-[var(--ns-glass-1)] p-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ns-gold)] text-[11px] font-black text-white">{index + 1}</span>
                  <div className="mt-2 text-[13px] font-bold">{item.title}</div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ns-muted)]">{item.text}</p>
                </li>
              ))}
            </ol>

            {error && <div className="mt-4 rounded-xl border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 px-4 py-3 text-sm">{error}</div>}

            <div className="mt-5 rounded-2xl border border-[var(--ns-gold)]/35 bg-[var(--ns-gold-soft)]/45 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ns-muted)]">Send exactly</div>
              <div className="mt-1 font-['Outfit'] text-3xl font-extrabold text-[var(--ns-gold)]">{money(booking.depositAmount, booking.currency)}</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ns-muted)]">MoMo number</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-lg font-bold">
                    {booking.momo.number || 'Contact reception'}
                    {booking.momo.number && (
                      <button type="button" onClick={() => copyReference(booking.momo.number)} className="rounded-lg bg-white/50 p-1.5 text-[var(--ns-muted)] hover:text-[var(--ns-gold)]" title="Copy number">
                        <Copy size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ns-muted)]">Account name</div>
                  <div className="mt-1 text-sm font-bold">{booking.momo.name}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ns-muted)]">Reference</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-lg font-bold">
                    {booking.confirmationNo}
                    <button type="button" onClick={() => copyReference(booking.confirmationNo)} className="rounded-lg bg-white/50 p-1.5 text-[var(--ns-muted)] hover:text-[var(--ns-gold)]" title="Copy reference">
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={submitReference} className="mt-5">
              <label htmlFor="momo-reference" className={labelClass}>MoMo transaction reference</label>
              <input
                id="momo-reference"
                required
                minLength={4}
                maxLength={64}
                autoComplete="off"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. 1234567890"
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-[var(--ns-muted)]">Find this in the confirmation SMS from your Mobile Money provider. It is not your phone number.</p>
              <button
                type="submit"
                disabled={submitting || holdExpired}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ns-gold)] px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} I have paid — submit reference
              </button>
            </form>

            <p className="mt-3 text-[11px] leading-relaxed text-[var(--ns-muted)]">
              Reception verifies every Mobile Money payment before confirming. If the deposit is not received before the hold expires, the room is released automatically.
            </p>
          </div>

          <aside className="h-fit rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-5 lg:sticky lg:top-24">
            <div className="font-mono text-sm font-bold text-[var(--ns-gold)]">{booking.confirmationNo}</div>
            <h3 className="mt-2 font-['Outfit'] text-xl font-extrabold">{booking.roomType.name}</h3>
            <div className="mt-1 text-[12px] text-[var(--ns-muted)]">{dateRange(booking.checkInDate, booking.checkOutDate)} · {booking.nights} night{booking.nights === 1 ? '' : 's'}</div>
            <div className="mt-4 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-[var(--ns-muted)]">Stay total</span><span>{money(booking.totalAmount, booking.currency)}</span></div>
              <div className="flex justify-between font-bold"><span>Deposit</span><span>{money(booking.depositAmount, booking.currency)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--ns-muted)]">Status</span><span>{statusLabel(booking.status)}</span></div>
            </div>
            {booking.accountCreated && (
              <div className="mt-4 rounded-xl bg-[var(--ns-gold-soft)]/60 p-3 text-[12px] leading-relaxed">
                Your guest account was created. Check your email to verify it, then sign in to manage this booking.
              </div>
            )}
            <Link to="/guest/login" className="mt-4 inline-flex text-[12px] font-bold text-[var(--ns-gold)] hover:underline">Sign in to your guest account →</Link>
          </aside>
        </div>
      )}

      {step === 'done' && booking && (
        <div className="mx-auto max-w-2xl rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-clay-raised)] p-6 text-center shadow-xl sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ns-success)]/15 text-[var(--ns-success)]">
            <CheckCircle2 size={34} />
          </div>
          <h2 className="mt-5 font-['Outfit'] text-3xl font-extrabold tracking-tight">Payment reference received</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ns-muted)]">
            {notice || 'Reception will verify your Mobile Money payment and confirm your booking.'}
          </p>
          <div className="mt-6 rounded-2xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] p-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono text-sm font-bold text-[var(--ns-gold)]">
                {booking.confirmationNo}
                <button type="button" onClick={() => copyReference(booking.confirmationNo)} className="rounded-lg bg-white/50 p-1.5 text-[var(--ns-muted)] hover:text-[var(--ns-gold)]" title="Copy confirmation number">
                  <Copy size={12} />
                </button>
              </div>
              <span className="rounded-full bg-[var(--ns-gold-soft)] px-2.5 py-1 text-[11px] font-bold">{statusLabel(booking.status)}</span>
            </div>
            <div className="mt-3 grid gap-1 text-[13px] text-[var(--ns-muted)]">
              <div>{booking.roomType.name} · {dateRange(booking.checkInDate, booking.checkOutDate)}</div>
              <div>Deposit {money(booking.depositAmount, booking.currency)} · Reference {reference || booking.guestPaymentReference || '—'}</div>
            </div>
          </div>

          <ol className="mt-5 space-y-2 rounded-2xl bg-[var(--ns-glass-1)] p-4 text-left text-[13px] text-[var(--ns-muted)]">
            {[
              'Reception matches your transaction reference against the Mobile Money statement.',
              'Your booking changes to Confirmed as soon as the deposit is credited.',
              'Keep this confirmation number — quote it at check-in and in any message to the villa.',
            ].map((text, index) => (
              <li key={text} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ns-gold)]/15 text-[11px] font-black text-[var(--ns-gold)]">{index + 1}</span>
                <span className="leading-relaxed">{text}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to={`/guest/login`} className="rounded-xl bg-[var(--ns-gold)] px-5 py-2.5 text-sm font-bold text-white">Sign in to manage booking</Link>
            <Link to="/book" className="rounded-xl border border-[var(--ns-glass-line)] px-5 py-2.5 text-sm font-bold">Book another room</Link>
          </div>
          <div className="mt-5 text-[11px] text-[var(--ns-muted)]">
            Need help? Call <a href={`tel:${config?.villa.phone || ''}`} className="font-semibold text-[var(--ns-gold)]"><Phone size={12} className="inline" /> {config?.villa.phone || FALLBACK_PHONE}</a>
          </div>
        </div>
      )}
    </div>
  );
};

const FALLBACK_PHONE = '+233 535 572 774';
