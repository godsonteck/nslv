// ============================================
// NS LUXURY VILLA — Staff Login Portal
// Serene Luxury Glassmorphism + Calm Minimal Editorial
// ============================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { apiFetch, ApiClientError } from '../services/api';
import type { LoginResponse } from '@nslv/shared';
import {
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  ShieldCheck,
  MapPin,
  KeyRound,
  Sun,
  Moon,
  Monitor,
  AlertCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { portalPathFor } from '../components/auth/PortalGuard';
import { villaAssets } from '../assets';
import type { ThemeConfig } from '../services/apiService';

export default function Login() {
  const nav = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { themePreference, setThemePreference } = useThemeStore();

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
          : 'Unable to connect to the NSVilla service. Please check network connectivity.'
      );
    } finally {
      setBusy(false);
    }
  };

  const logo = theme?.logoUrl || villaAssets.logo;
  const villaName = theme?.villaName || 'NS Luxury Villa';
  const villaTagline = theme?.villaTagline || 'Lokoe, Ho · Volta Region, Ghana';
  const heroImage = theme?.loginBgUrl || villaAssets.villaExterior;

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden selection:bg-[var(--ns-teal)] selection:text-white">
      {/* ── Top Floating Navigation Strip ── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10 max-w-7xl mx-auto w-full">
        {/* Brand Link */}
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl overflow-hidden ring-1 ring-[var(--ns-glass-line)] shadow-sm flex items-center justify-center p-0.5 glass">
            <img src={logo} alt={villaName} className="h-full w-full object-cover rounded-xl" />
          </div>
          <div>
            <div className="font-['Manrope'] text-base sm:text-lg font-extrabold tracking-tight" style={{ color: 'var(--ns-ink)' }}>
              {villaName}
            </div>
            <div className="text-[10px] font-bold tracking-wider text-[var(--ns-muted)]">
              {villaTagline}
            </div>
          </div>
        </div>

        {/* Tactile Theme Selector */}
        <div className="flex items-center gap-1 p-1 rounded-2xl glass border border-[var(--ns-glass-line)] shadow-xs">
          <button
            type="button"
            onClick={() => setThemePreference('light')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              themePreference === 'light'
                ? 'skeuo-btn-secondary text-[var(--ns-gold)] font-bold shadow-xs'
                : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'
            }`}
            title="Light mode"
            aria-label="Light mode"
          >
            <Sun size={15} />
          </button>
          <button
            type="button"
            onClick={() => setThemePreference('dark')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              themePreference === 'dark'
                ? 'skeuo-btn-secondary text-[var(--ns-gold)] font-bold shadow-xs'
                : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'
            }`}
            title="Dark mode"
            aria-label="Dark mode"
          >
            <Moon size={15} />
          </button>
          <button
            type="button"
            onClick={() => setThemePreference('system')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              themePreference === 'system'
                ? 'skeuo-btn-secondary text-[var(--ns-gold)] font-bold shadow-xs'
                : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'
            }`}
            title="System theme"
            aria-label="System theme"
          >
            <Monitor size={15} />
          </button>
        </div>
      </header>

      {/* ── Main Content Showcase Area ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl mx-auto grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between relative rounded-3xl overflow-hidden glass skeuo-card border border-[var(--ns-glass-line)] p-10 xl:p-12 min-h-[560px]">
            {/* Background Photography Vignette */}
            <div className="absolute inset-0 z-0">
              <img
                src={heroImage}
                alt="NS Luxury Villa"
                className="w-full h-full object-cover transform scale-105 filter brightness-[0.65] contrast-[1.05]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,30,40,.35),rgba(4,30,40,.82))]" />
            </div>

            {/* Top Calm Eyebrow */}
            <div className="relative z-10 flex items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/90 text-[10.5px] font-semibold tracking-wider uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--ns-gold)]" />
                Operations workspace
              </span>
            </div>

            {/* Editorial Centerpiece — Uncluttered & Poetic */}
            <div className="relative z-10 space-y-4 my-auto py-8">
              <h1 className="text-4xl xl:text-5xl font-black text-white font-serif tracking-tight leading-[1.15] drop-shadow-sm">
                Your property, <br />
                <span className="text-[#9de0ea] italic font-light">in clear view.</span>
              </h1>
              <p className="text-sm xl:text-base text-slate-300 font-medium max-w-md leading-relaxed">
                A focused workspace for reservations, guests, rooms, and daily service—designed for the people running the villa.
              </p>

              {/* Calm, quiet villa attributes — no busy boxes */}
              <div className="pt-6 flex items-center gap-3 text-xs text-slate-300 font-medium">
                <span>12 Luxury Suites</span>
                <span className="text-slate-500">·</span>
                <span>Poolside Lounge</span>
                <span className="text-slate-500">·</span>
                <span>Front Desk & Dining</span>
              </div>
            </div>

            {/* Bottom Property Signature */}
            <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4 font-medium">
              <div className="flex items-center gap-1.5 text-slate-300">
                <MapPin size={13} className="text-[#9de0ea]" />
                <span>Lokoe, Ho · Volta Region, Ghana</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>System Operational</span>
              </div>
            </div>
          </div>

          <div className="w-full lg:col-span-5 max-w-md mx-auto flex flex-col justify-center">
            <div className="glass-strong skeuo-card rounded-3xl p-8 sm:p-9 border border-[var(--ns-glass-line)] relative overflow-hidden">
              
              <div className="absolute top-0 left-0 right-0 h-px bg-[linear-gradient(90deg,transparent,rgba(76,169,188,.85),transparent)]" />

              {/* Card Header */}
              <div className="text-center pb-6">
                <div className="mx-auto mb-3 h-13 w-13 rounded-2xl glass p-1 border border-[var(--ns-glass-line)] shadow-xs flex items-center justify-center">
                  <img src={logo} alt={villaName} className="h-full w-full object-cover rounded-xl" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--ns-gold)]">
                  {two ? 'Two-Factor Verification' : 'Staff Access'}
                </div>
                <h2 className="mt-1 text-2xl font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>
                  {two ? 'Confirm Identity' : 'Welcome Back'}
                </h2>
                <p className="mt-1 text-xs font-medium" style={{ color: 'var(--ns-muted)' }}>
                  {two
                    ? 'Enter the 6-digit authentication token from your device'
                    : 'Sign in to access your hotel workstation'}
                </p>
              </div>

              {/* Error Notice */}
              {err && (
                <div className="mb-4 rounded-xl border border-[var(--ns-danger)]/40 bg-rose-500/10 p-3 text-xs font-semibold text-[var(--ns-danger)] flex items-start gap-2.5">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{err}</span>
                </div>
              )}

              {/* Sign In Form */}
              <form onSubmit={submit} className="space-y-4">
                {!two ? (
                  <>
                    {/* Username / Email */}
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ns-ink)' }}>
                        Username or Email
                      </label>
                      <div className="relative">
                        <UserIcon
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--ns-muted)]"
                        />
                        <input
                          type="text"
                          required
                          autoComplete="username"
                          value={login}
                          onChange={(e) => setLogin(e.target.value)}
                          placeholder="Enter your username or email"
                          className="ns-input glass-input w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all"
                          disabled={busy}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ns-ink)' }}>
                        Password
                      </label>
                      <div className="relative">
                        <Lock
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--ns-muted)]"
                        />
                        <input
                          type={show ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          value={pw}
                          onChange={(e) => setPw(e.target.value)}
                          placeholder="Enter your password"
                          className="ns-input glass-input w-full pl-10 pr-10 py-2.5 text-xs font-semibold rounded-xl transition-all"
                          disabled={busy}
                        />
                        <button
                          type="button"
                          onClick={() => setShow(!show)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg text-[var(--ns-muted)] hover:text-[var(--ns-ink)] transition-colors"
                          disabled={busy}
                          aria-label={show ? 'Hide password' : 'Show password'}
                          title={show ? 'Hide password' : 'Show password'}
                        >
                          {show ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ns-ink)' }}>
                      6-Digit Security Token
                    </label>
                    <div className="relative">
                      <KeyRound
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--ns-gold)]"
                      />
                      <input
                        type="text"
                        required
                        autoFocus
                        value={totp}
                        onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••••"
                        maxLength={6}
                        className="ns-input glass-input w-full pl-10 pr-3 py-2.5 text-center text-xl font-bold tracking-[.35em] rounded-xl transition-all"
                        disabled={busy}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwo(false)}
                      className="mt-2 text-[11px] font-semibold text-[var(--ns-muted)] hover:text-[var(--ns-gold)] flex items-center gap-1 transition-colors"
                    >
                      <ArrowLeft size={12} />
                      Back to password login
                    </button>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 rounded-xl skeuo-btn skeuo-btn-primary px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {busy ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating…</span>
                    </div>
                  ) : (
                    <>
                      <span>{two ? 'Verify & Continue' : 'Sign In to Workstation'}</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              {/* Security Strip */}
              <div className="mt-6 pt-4 border-t border-[var(--ns-glass-line)] flex items-center justify-between text-[10px] font-medium" style={{ color: 'var(--ns-muted)' }}>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 size={12} />
                  <span>Encrypted TLS 1.3</span>
                </div>
                <div className="flex items-center gap-1">
                  <Building2 size={11} />
                  <span>NS Villa Server</span>
                </div>
              </div>
            </div>

            {/* Calm Footer Footnote */}
            <p className="text-center mt-3 text-[10.5px] font-medium text-[var(--ns-muted)]">
              Authorized personnel only. All access is audited.
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer Strip ── */}
      <footer className="relative z-10 px-6 py-4 text-center text-[10.5px] font-medium border-t border-[var(--ns-glass-line)] text-[var(--ns-muted)]">
        © {new Date().getFullYear()} {villaName}. All rights reserved.
      </footer>
    </div>
  );
}
