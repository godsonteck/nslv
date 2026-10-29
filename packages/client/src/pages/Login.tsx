import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiFetch, ApiClientError } from '../services/api';
import type { LoginResponse } from '@nslv/shared';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { portalPathFor } from '../components/auth/PortalGuard';
import { villaAssets } from '../assets';
import type { ThemeConfig } from '../services/apiService';

export default function Login() {
  const nav = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [login, setLogin] = useState('');
  const [pw, setPw] = useState('');
  const [totp, setTotp] = useState('');
  const [two, setTwo] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [theme, setTheme] = useState<ThemeConfig | null>(null);

  // Load theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await fetch('/api/v1/theme');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setTheme(data.data);
          }
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };

    void loadTheme();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const d = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          login,
          password: pw,
          ...(two ? { totpCode: totp } : {}),
        }),
      });

      if (d.requiresTwoFactor) {
        setTwo(true);
        return;
      }

      if (d.user && d.tokens) {
        setAuth(d.user, d.tokens);
        nav(portalPathFor(d.user.roles), { replace: true });
      }
    } catch (e) {
      setErr(
        e instanceof ApiClientError
          ? e.message
          : 'Unable to connect to the NSVilla service.'
      );
    } finally {
      setBusy(false);
    }
  };

  const logo = theme?.logoUrl || villaAssets.logo;
  const villaName = theme?.villaName || 'NSVilla';
  const villaTagline = theme?.villaTagline || 'Property operations';

  const fieldClass =
    'ns-input glass-input w-full rounded-xl px-4 py-2.5 text-sm font-bold transition-all';

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-[1.05fr_.95fr]">
      {/* ── Left: editorial branding over the shared canvas ── */}
      <div className="relative hidden overflow-hidden lg:block">
        <div className="relative flex h-full flex-col justify-between p-10 text-[var(--ns-ink)] xl:p-14">
          <div className="flex items-center gap-3">
            <img src={logo} alt={villaName} className="h-12 w-12 rounded-2xl object-cover ring-1 ring-[var(--ns-glass-line)]" />
            <div>
              <div className="text-lg font-extrabold">{villaName}</div>
              <div className="text-[9px] font-bold uppercase tracking-[.2em] text-[var(--ns-gold)]">{villaTagline}</div>
            </div>
          </div>

          <div className="glass-subtle skeuo-card max-w-xl rounded-3xl p-8 border border-[var(--ns-glass-line)]">
            <div className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[var(--ns-gold)]">
              Arrive as a Guest, Stay as Family
            </div>
            <h1 className="mt-4 text-5xl font-extrabold leading-[1.05] tracking-[-.055em]">
              A calmer way to run the villa.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--ns-muted)]">
              Reservations, rooms, guest stays, folios and department service stay connected from
              arrival to departure.
            </p>
          </div>

          <div className="text-[10px] text-[var(--ns-muted)]">
            Ho, Volta Region · Ghana · Authorized personnel only
          </div>
        </div>
      </div>

      {/* ── Right: glass sign-in card ── */}
      <div className="flex min-h-screen items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[440px]">
          {/* Mobile header */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <img src={logo} alt={villaName} className="h-11 w-11 rounded-xl object-cover ring-1 ring-[var(--ns-gold)]/30" />
            <div>
              <div className="text-base font-extrabold" style={{ color: 'var(--ns-ink)' }}>{villaName}</div>
              <div className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[var(--ns-gold)]">{villaTagline}</div>
            </div>
          </div>

          <div className="glass-strong skeuo-card rounded-3xl p-6 sm:p-8 border border-[var(--ns-glass-line)] shadow-2xl">
            <div className="mb-6">
              <div className="ns-eyebrow">{two ? 'SECURITY CHECK' : 'STAFF ACCESS'}</div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]" style={{ color: 'var(--ns-ink)' }}>
                {two ? 'Verify your identity' : 'Welcome back'}
              </h2>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--ns-muted)' }}>
                {two
                  ? 'Enter the verification code from your authenticator.'
                  : 'Sign in to your authorized NSVilla workspace.'}
              </p>
            </div>

            {err && (
              <div className="mb-4 rounded-xl border border-[var(--ns-danger)] glass-subtle p-3 text-sm text-[var(--ns-danger)]">
                {err}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {!two ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ns-ink)' }}>
                      Username or email
                    </label>
                    <input
                      type="text"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="you@villa.com"
                      className={fieldClass}
                      style={{ color: 'var(--ns-ink)' }}
                      disabled={busy}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ns-ink)' }}>
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={show ? 'text' : 'password'}
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        placeholder="Enter password"
                        className={`${fieldClass} pr-11`}
                        style={{ color: 'var(--ns-ink)' }}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        onClick={() => setShow(!show)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: 'var(--ns-muted)' }}
                        disabled={busy}
                        aria-label={show ? 'Hide password' : 'Show password'}
                      >
                        {show ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ns-ink)' }}>
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className={`${fieldClass} text-center text-2xl tracking-[.4em]`}
                    style={{ color: 'var(--ns-ink)' }}
                    disabled={busy}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl skeuo-btn skeuo-btn-primary px-4 py-3 text-sm font-black text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {two ? 'Verify' : 'Sign in'}
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

          <div className="glass-subtle skeuo-card mt-4 rounded-2xl p-4 text-center border border-[var(--ns-glass-line)]">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.10em]" style={{ color: 'var(--ns-muted)' }}>
              Security Notice
            </div>
            <p className="text-[11px] leading-5" style={{ color: 'var(--ns-muted)' }}>
              Access is protected by role-based permissions. Important actions are recorded in the audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
