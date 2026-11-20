import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  LogOut,
  MailCheck,
  MapPin,
  ShieldAlert,
  Wallet,
  Sparkles,
} from 'lucide-react';
import {
  guestAuthApi,
  guestBookingsApi,
  guestSession,
  publicApi,
  PublicApiError,
  type GuestAccount,
  type PublicBooking,
  type PublicBookingConfig,
} from '../../services/publicApi';

const inputClass =
  'w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] px-3 py-2.5 text-sm text-[var(--ns-ink)] outline-none transition focus:border-[var(--ns-gold)]';

function money(amount: number, currency: string): string {
  const prefix = /^(GHS|GHC)$/i.test(currency || '') ? 'GH₵' : currency;
  return `${prefix} ${Number(amount || 0).toFixed(2)}`;
}

function prettyDate(value: string): string {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function prettyDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusMeta(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return { label: 'Confirmed', className: 'bg-[var(--ns-success)]/15 text-[var(--ns-success)]' };
    case 'PENDING':
      return { label: 'Deposit pending', className: 'bg-[var(--ns-warning)]/15 text-[var(--ns-warning)]' };
    case 'CHECKED_IN':
      return { label: 'Checked in', className: 'bg-[var(--ns-info)]/15 text-[var(--ns-info)]' };
    case 'CHECKED_OUT':
      return { label: 'Completed', className: 'bg-[var(--ns-muted)]/15 text-[var(--ns-muted)]' };
    case 'CANCELLED':
      return { label: 'Cancelled', className: 'bg-[var(--ns-danger)]/15 text-[var(--ns-danger)]' };
    case 'NO_SHOW':
      return { label: 'No show', className: 'bg-[var(--ns-danger)]/15 text-[var(--ns-danger)]' };
    default:
      return { label: status, className: 'bg-[var(--ns-glass-1)] text-[var(--ns-muted)]' };
  }
}

export const GuestBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [account, setAccount] = useState<GuestAccount | null>(null);
  const [config, setConfig] = useState<PublicBookingConfig | null>(null);
  const [bookings, setBookings] = useState<PublicBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [referenceInputs, setReferenceInputs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleAuthError = (err: unknown) => {
    if (err instanceof PublicApiError && (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED' || err.code === 'INVALID_TOKEN')) {
      guestSession.clear();
      navigate('/guest/login');
      return true;
    }
    return false;
  };

  const load = async () => {
    if (!guestSession.hasSession()) {
      navigate('/guest/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const me = await guestAuthApi.me();
      setAccount(me);
      if (!me.emailVerified) {
        setNeedsVerification(true);
        return;
      }
      setNeedsVerification(false);
      const [list, cfg] = await Promise.all([guestBookingsApi.list(), publicApi.getConfig()]);
      setBookings(list);
      setConfig(cfg);
    } catch (err) {
      if (!handleAuthError(err)) {
        setError(err instanceof PublicApiError ? err.message : 'We could not load your bookings.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!account?.email) return;
    setResending(true);
    setResent(false);
    try {
      await guestAuthApi.resendVerification(account.email);
    } catch {
      // Deliberately silent: never reveal whether an address exists.
    } finally {
      setResending(false);
      setResent(true);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitReference = async (booking: PublicBooking) => {
    const reference = (referenceInputs[booking.id] || '').trim();
    if (!reference || !booking.guest?.email) return;
    setBusyId(booking.id);
    setError('');
    try {
      const updated = await publicApi.submitPaymentReference(booking.confirmationNo, booking.guest.email, reference);
      setBookings((current) => current.map((item) => (item.id === booking.id ? { ...item, ...updated } : item)));
      setReferenceInputs((current) => ({ ...current, [booking.id]: '' }));
    } catch (err) {
      if (!handleAuthError(err)) {
        setError(err instanceof PublicApiError ? err.message : 'We could not submit the reference.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const cancelBooking = async (booking: PublicBooking) => {
    if (!window.confirm(`Cancel booking ${booking.confirmationNo}? This cannot be undone online.`)) return;
    setBusyId(booking.id);
    setError('');
    try {
      const updated = await guestBookingsApi.cancel(booking.id);
      setBookings((current) => current.map((item) => (item.id === booking.id ? { ...item, ...updated } : item)));
    } catch (err) {
      if (!handleAuthError(err)) {
        setError(err instanceof PublicApiError ? err.message : 'We could not cancel the booking.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const signOut = async () => {
    await guestAuthApi.logout();
    navigate('/book');
  };

  const now = Date.now();
  const upcoming = bookings.filter((booking) => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status));
  const past = bookings.filter((booking) => !['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status));

  const canCancel = (booking: PublicBooking) => {
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) return false;
    const hoursUntilArrival = (new Date(`${booking.checkInDate}T00:00:00`).getTime() - now) / (60 * 60 * 1000);
    return hoursUntilArrival >= (config?.cancellationHours ?? 24);
  };

  const renderBooking = (booking: PublicBooking) => {
    const status = statusMeta(booking.status);
    const expanded = expandedId === booking.id;
    const busy = busyId === booking.id;

    return (
      <article key={booking.id} className="overflow-hidden rounded-2xl border border-[var(--ns-glass-line)] bg-[var(--ns-clay-raised)] shadow-sm">
        <button
          type="button"
          onClick={() => setExpandedId(expanded ? null : booking.id)}
          className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-[var(--ns-glass-1)] sm:p-5"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-bold text-[var(--ns-gold)]">{booking.confirmationNo}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-sm font-bold"><BedDouble size={15} /> {booking.roomType?.name || 'Room'}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ns-muted)]">
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {prettyDate(booking.checkInDate)} → {prettyDate(booking.checkOutDate)}</span>
              <span>{booking.adults} adult{booking.adults === 1 ? '' : 's'}{booking.children ? ` · ${booking.children} child${booking.children === 1 ? '' : 'ren'}` : ''}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="text-right">
              <div className="text-sm font-extrabold">{money(booking.totalAmount, booking.currency)}</div>
              <div className="text-[11px] text-[var(--ns-muted)]">Deposit {money(booking.depositAmount, booking.currency)}</div>
            </div>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-[var(--ns-glass-line)] p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--ns-glass-1)] p-3 text-[12px]">
                <div className="flex justify-between"><span className="text-[var(--ns-muted)]">Stay total</span><span className="font-semibold">{money(booking.totalAmount, booking.currency)}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-[var(--ns-muted)]">Paid</span><span className="font-semibold text-[var(--ns-success)]">{money(booking.amountPaid, booking.currency)}</span></div>
                <div className="mt-1 flex justify-between border-t border-[var(--ns-glass-line)] pt-1 font-bold"><span>Balance</span><span>{money(booking.balance, booking.currency)}</span></div>
              </div>
              <div className="rounded-xl bg-[var(--ns-glass-1)] p-3 text-[12px]">
                <div className="flex items-center gap-1.5 text-[var(--ns-muted)]"><MapPin size={12} /> {booking.room?.number ? `Room ${booking.room.number}` : 'Room assigned on arrival'}</div>
                {booking.guestPaymentReference && (
                  <div className="mt-2 flex items-center gap-1.5 text-[var(--ns-muted)]"><Wallet size={12} /> Reference: <span className="font-mono font-bold text-[var(--ns-ink)]">{booking.guestPaymentReference}</span></div>
                )}
                {booking.holdExpiresAt && booking.status === 'PENDING' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[var(--ns-warning)]"><Clock3 size={12} /> Held until {prettyDateTime(booking.holdExpiresAt)}</div>
                )}
                {booking.paymentSubmittedAt && (
                  <div className="mt-2 flex items-center gap-1.5 text-[var(--ns-success)]"><CheckCircle2 size={12} /> Reference submitted {new Date(booking.paymentSubmittedAt).toLocaleDateString()}</div>
                )}
              </div>
            </div>

            {booking.status === 'PENDING' && (
              <div className="mt-4 rounded-xl border border-[var(--ns-gold)]/35 bg-[var(--ns-gold-soft)]/45 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ns-muted)]">Complete your deposit</div>
                {booking.momo?.number ? (
                  <>
                    <p className="mt-1 text-[13px] leading-relaxed">
                      Send <strong>{money(booking.depositAmount, booking.currency)}</strong> to MoMo <strong>{booking.momo.number}</strong> ({booking.momo.name}) using <strong>{booking.confirmationNo}</strong> as the reference. Then submit the transaction reference below.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={referenceInputs[booking.id] || ''}
                        onChange={(e) => setReferenceInputs((current) => ({ ...current, [booking.id]: e.target.value }))}
                        placeholder="MoMo transaction reference"
                        autoComplete="off"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => submitReference(booking)}
                        disabled={busy || !(referenceInputs[booking.id] || '').trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ns-gold)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} Submit
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] leading-relaxed">
                    Online deposit payment is not available right now. Call{' '}
                    <a href={`tel:${config?.villa.phone || '+233 535 572 774'}`} className="font-bold text-[var(--ns-gold)] hover:underline">
                      {config?.villa.phone || '+233 535 572 774'}
                    </a>{' '}
                    to pay your deposit and confirm this room.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/book" className="rounded-xl border border-[var(--ns-glass-line)] px-3 py-2 text-[12px] font-bold hover:bg-[var(--ns-glass-1)]">Book another stay</Link>
              {canCancel(booking) && (
                <button
                  type="button"
                  onClick={() => cancelBooking(booking)}
                  disabled={busy}
                  className="rounded-xl border border-[var(--ns-danger)]/40 px-3 py-2 text-[12px] font-bold text-[var(--ns-danger)] hover:bg-[var(--ns-danger)]/10 disabled:opacity-50"
                >
                  {busy ? 'Working…' : 'Cancel booking'}
                </button>
              )}
              {['PENDING', 'CONFIRMED'].includes(booking.status) && !canCancel(booking) && (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ns-glass-1)] px-3 py-2 text-[12px] text-[var(--ns-muted)]">
                  <ShieldAlert size={13} /> Online cancellation has closed — please call the villa.
                </span>
              )}
            </div>
          </div>
        )}
      </article>
    );
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24 text-sm text-[var(--ns-muted)]">
        <Loader2 size={20} className="mr-2 animate-spin" /> Loading your bookings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ns-muted)]">Guest account</div>
          <h1 className="mt-1 font-['Outfit'] text-3xl font-extrabold tracking-tight sm:text-4xl">
            {account ? `Hello, ${account.firstName}.` : 'My bookings'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ns-muted)]">
            <span>{account?.email}</span>
            {account && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${account.emailVerified ? 'bg-[var(--ns-success)]/15 text-[var(--ns-success)]' : 'bg-[var(--ns-warning)]/15 text-[var(--ns-warning)]'}`}>
                <MailCheck size={11} /> {account.emailVerified ? 'Email verified' : 'Email not verified'}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/book" className="rounded-xl bg-[var(--ns-gold)] px-4 py-2 text-sm font-bold text-white">Book a room</Link>
          <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--ns-glass-line)] px-3 py-2 text-sm font-semibold text-[var(--ns-muted)] hover:bg-[var(--ns-glass-1)]">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>

      {error && <div className="mt-5 rounded-xl border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 px-4 py-3 text-sm">{error}</div>}

      {needsVerification ? (
        <div className="mt-8 rounded-3xl border border-[var(--ns-warning)]/40 bg-[var(--ns-warning)]/10 p-6 sm:p-8">
          <div className="flex items-center gap-2 font-['Outfit'] text-xl font-extrabold">
            <MailCheck size={20} className="text-[var(--ns-warning)]" /> Confirm your email to see your stays
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--ns-muted)]">
            We sent a verification link to <strong className="text-[var(--ns-ink)]">{account?.email}</strong>. Opening it protects
            your booking history and lets you cancel or complete a deposit online.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={resendVerification}
              disabled={resending}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--ns-gold)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {resending ? <Loader2 size={15} className="animate-spin" /> : <MailCheck size={15} />} Resend verification email
            </button>
            {resent && <span className="text-[12px] font-semibold text-[var(--ns-success)]">Sent — check your inbox and spam folder.</span>}
          </div>
          <p className="mt-4 text-[12px] text-[var(--ns-muted)]">
            Already confirmed? <button type="button" onClick={() => void load()} className="font-bold text-[var(--ns-gold)] hover:underline">Refresh</button>
          </p>
        </div>
      ) : (
        <>
      <section className="mt-8">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--ns-muted)]">Upcoming stays</h2>
        <div className="mt-3 space-y-3">
          {upcoming.length > 0 ? upcoming.map(renderBooking) : (
            <div className="rounded-2xl border border-dashed border-[var(--ns-glass-line)] p-8 text-center text-sm text-[var(--ns-muted)]">
              No upcoming stays yet. <Link to="/book" className="font-bold text-[var(--ns-gold)] hover:underline">Find your room →</Link>
            </div>
          )}
        </div>
      </section>

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--ns-muted)]">Past & cancelled</h2>
          <div className="mt-3 space-y-3">{past.map(renderBooking)}</div>
        </section>
      )}
        </>
      )}

    </div>
  );
};
