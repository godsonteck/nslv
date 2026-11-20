import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailCheck, ShieldAlert } from 'lucide-react';
import { guestAuthApi, PublicApiError } from '../../services/publicApi';

const inputClass =
  'w-full rounded-xl border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] px-3 py-2.5 text-sm text-[var(--ns-ink)] outline-none transition focus:border-[var(--ns-gold)]';
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ns-muted)]';

export const GuestActionPage: React.FC<{ mode: 'forgot' | 'reset' | 'verify' }> = ({ mode }) => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(mode === 'verify');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'verify') return;
    if (!token) {
      setLoading(false);
      setError('This verification link is missing its token.');
      return;
    }
    guestAuthApi
      .verifyEmail(token)
      .then(() => setSuccess('Your email is verified. You can now sign in to your guest account.'))
      .catch((err) => setError(err instanceof PublicApiError ? err.message : 'We could not verify this link.'))
      .finally(() => setLoading(false));
  }, [mode, token]);

  const submitForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await guestAuthApi.forgotPassword(email);
      setSuccess('If an account exists for that email, we have sent a reset link. Check your inbox and spam folder.');
    } catch (err) {
      setError(err instanceof PublicApiError ? err.message : 'We could not process the request.');
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    if (!token) {
      setError('This reset link is missing its token.');
      return;
    }
    setLoading(true);
    try {
      await guestAuthApi.resetPassword(token, password);
      setSuccess('Your password has been updated. Sign in with your new password.');
    } catch (err) {
      setError(err instanceof PublicApiError ? err.message : 'We could not reset the password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="rounded-3xl border border-[var(--ns-glass-line)] bg-[var(--ns-clay-raised)] p-6 shadow-xl sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ns-gold-soft)] text-[var(--ns-gold)]">
          <MailCheck size={22} />
        </div>
        <h1 className="mt-4 font-['Outfit'] text-2xl font-extrabold tracking-tight">
          {mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Verify your email'}
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--ns-muted)]">
          {mode === 'forgot'
            ? 'Enter the email on your guest account and we will send you a reset link.'
            : mode === 'reset'
              ? 'Choose a strong password with at least 8 characters.'
              : 'Confirming your email keeps your bookings secure.'}
        </p>

        {success && (
          <div className="mt-4 rounded-xl border border-[var(--ns-success)]/40 bg-[var(--ns-success)]/10 px-4 py-3 text-sm">
            <div className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--ns-success)]" /> {success}</div>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-[var(--ns-danger)]/40 bg-[var(--ns-danger)]/10 px-4 py-3 text-sm">
            <div className="flex items-start gap-2"><ShieldAlert size={16} className="mt-0.5 shrink-0 text-[var(--ns-danger)]" /> {error}</div>
          </div>
        )}

        {mode === 'forgot' && !success && (
          <form onSubmit={submitForgot} className="mt-5 space-y-4">
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ns-gold)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <MailCheck size={16} />} Send reset link
            </button>
          </form>
        )}

        {mode === 'reset' && !success && (
          <form onSubmit={submitReset} className="mt-5 space-y-4">
            <div>
              <label className={labelClass}>New password</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Confirm password</label>
              <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ns-gold)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Update password
            </button>
          </form>
        )}

        {mode === 'verify' && loading && (
          <div className="mt-6 flex items-center gap-2 text-sm text-[var(--ns-muted)]"><Loader2 size={16} className="animate-spin" /> Verifying your email…</div>
        )}

        <div className="mt-6 border-t border-[var(--ns-glass-line)] pt-4 text-[12px]">
          <Link to="/guest/login" className="font-bold text-[var(--ns-gold)] hover:underline">Go to sign in →</Link>
        </div>
      </div>
    </div>
  );
};
