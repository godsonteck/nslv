import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, LockKeyhole, LogIn, Mail, UserPlus } from 'lucide-react';
import { guestAuthApi, PublicApiError } from '../../services/publicApi';

const inputClass =
  'w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] px-3 py-2.5 text-sm text-[var(--ns-ink)] outline-none transition focus:border-[var(--ns-gold)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ns-gold)_18%,transparent)]';
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ns-muted)]';

export const GuestAuthPage: React.FC<{ mode: 'login' | 'register' }> = ({ mode }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [unverified, setUnverified] = useState(false);

  const isLogin = mode === 'login';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (isLogin) {
        await guestAuthApi.login({ email: form.email, password: form.password });
        navigate('/guest/bookings');
        return;
      }
      const result = await guestAuthApi.register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      if (result.requiresVerification) {
        setNotice('Account created. Open the verification link we emailed you, then sign in.');
        return;
      }
      if (result.tokens) navigate('/guest/bookings');
    } catch (err) {
      const apiError = err instanceof PublicApiError ? err : null;
      setUnverified(apiError?.code === 'EMAIL_NOT_VERIFIED');
      setError(apiError ? apiError.message : 'We could not sign you in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!form.email) {
      setError('Enter the email address you registered with.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await guestAuthApi.resendVerification(form.email);
      setNotice('Verification email sent. Check your inbox and spam folder.');
    } catch {
      setNotice('Verification email sent. Check your inbox and spam folder.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:py-16">
      <div className="flex-1">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--ns-gold-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ns-ink)]">
          <LockKeyhole size={13} /> Guest account
        </div>
        <h1 className="mt-4 font-['Outfit'] text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          {isLogin ? 'Welcome back.' : 'Make your stay easier.'}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--ns-muted)]">
          {isLogin
            ? 'Sign in to see upcoming stays, submit a Mobile Money reference and manage your booking.'
            : 'Create an account to keep your bookings, payment references and confirmations in one place.'}
        </p>
        <ul className="mt-6 space-y-3 text-sm text-[var(--ns-muted)]">
          {['View upcoming and past stays', 'Submit your MoMo payment reference', 'Cancel online within the policy window', 'Email confirmation for every booking'].map((item) => (
            <li key={item} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--ns-gold)]" /> {item}</li>
          ))}
        </ul>
      </div>

      <div className="w-full max-w-md rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-clay-raised)] p-6 shadow-xl sm:p-8">
        <h2 className="font-['Outfit'] text-2xl font-extrabold tracking-tight">{isLogin ? 'Sign in' : 'Create your account'}</h2>
        <p className="mt-1 text-[13px] text-[var(--ns-muted)]">
          {isLogin ? 'Use the email you booked with.' : 'Already have an account? '}
          {!isLogin && <Link to="/guest/login" className="font-bold text-[var(--ns-gold)] hover:underline">Sign in</Link>}
        </p>

        {error && <div className="mt-4 rounded-xl border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 px-4 py-3 text-sm">{error}</div>}
        {notice && (
          <div className="mt-4 rounded-xl border border-[var(--ns-success)]/40 bg-[var(--ns-success)]/10 px-4 py-3 text-sm text-[var(--ns-ink)]">
            {notice}
          </div>
        )}
        {unverified && (
          <button
            type="button"
            onClick={resendVerification}
            disabled={loading}
            className="mt-3 text-[12px] font-bold text-[var(--ns-gold)] hover:underline disabled:opacity-50"
          >
            Resend verification email
          </button>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          {!isLogin && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="register-first-name" className={labelClass}>First name</label>
                <input id="register-first-name" autoComplete="given-name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="register-last-name" className={labelClass}>Last name</label>
                <input id="register-last-name" autoComplete="family-name" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="guest-auth-email" className={labelClass}>Email</label>
            <input id="guest-auth-email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
          </div>

          {!isLogin && (
            <div>
              <label htmlFor="register-phone" className={labelClass}>Phone / WhatsApp</label>
              <input id="register-phone" type="tel" autoComplete="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+233 …" className={inputClass} />
            </div>
          )}

          <div>
            <label htmlFor="guest-auth-password" className={labelClass}>Password</label>
            <input
              id="guest-auth-password"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputClass}
              placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
            />
          </div>

          {isLogin && (
            <div className="text-right">
              <Link to="/guest/forgot" className="text-[12px] font-bold text-[var(--ns-gold)] hover:underline">Forgot password?</Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ns-gold)] px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : isLogin ? <LogIn size={16} /> : <UserPlus size={16} />}
            {isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {!isLogin && (
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--ns-muted)]">
            We send a verification link to your email. Open it before signing in — it protects your booking history if someone else knows your address.
          </p>
        )}

        <div className="mt-6 border-t border-[var(--ns-glass-line)] pt-4 text-[12px] text-[var(--ns-muted)]">
          Booking without an account?{' '}
          <Link to="/book#lookup" className="inline-flex items-center gap-1 font-bold text-[var(--ns-gold)] hover:underline">
            <Mail size={12} /> Find your booking <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
};
