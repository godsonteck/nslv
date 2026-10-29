// ============================================
// NS LUXURY VILLA — Redesigned Staff Login Portal
// Frosted Glassmorphism + Tactile Skeuomorphism + Ultra-Visible Typography
// ============================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, type ThemePreference } from '../stores/themeStore';
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
  Sparkles,
  MapPin,
  KeyRound,
  Sun,
  Moon,
  Monitor,
  AlertCircle,
  Building2,
  CheckCircle2,
  Radio,
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
  const villaTagline = theme?.villaTagline || 'Lokoe, Ho, Volta Region, Ghana';
  const heroImage = theme?.loginBgUrl || villaAssets.villaExterior;

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden selection:bg-[var(--ns-teal)] selection:text-white">
      {/* ── Top Floating Navigation Strip ── */}
      <header className="relative z-20 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5 max-w-7xl mx-auto w-full">
        {/* Brand Link */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-11 sm:sm:w-11 rounded-2xl overflow-hidden ring-2 ring-[var(--ns-gold)]/40 shadow-md skeuo-badge bg-black/20 flex items-center justify-center">
            <img src={logo} alt={villaName} className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="font-['Manrope'] text-base sm:text-lg font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>
              {villaName}
            </div>
            <div className="text-[9.5px] font-black uppercase tracking-wider text-[var(--ns-gold)]">
              {villaTagline}
            </div>
          </div>
        </div>

        {/* Tactile Skeuomorphic Theme Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-subtle skeuo-card border border-[var(--ns-glass-line)] shadow-xs">
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
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-12 gap-8 items-center">
          
          {/* ── Left Editorial Showcase (Desktop) ── */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between space-y-6 relative rounded-3xl overflow-hidden glass skeuo-card border border-[var(--ns-glass-line)] p-8 xl:p-10 min-h-[580px] shadow-2xl">
            {/* Background Photography Vignette */}
            <div className="absolute inset-0 z-0">
              <img
                src={heroImage}
                alt="NS Luxury Villa View"
                className="w-full h-full object-cover transform scale-105 filter brightness-[0.72] contrast-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060b12] via-[#09131ebd] to-[#070e1766]" />
            </div>

            {/* Top Tagline Pill */}
            <div className="relative z-10 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full skeuo-badge bg-black/40 border border-white/20 text-white text-[10px] font-black tracking-widest uppercase">
                <Sparkles size={12} className="text-[var(--ns-gold)]" />
                NS Luxury Villa
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full skeuo-badge bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-extrabold uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                PMS Enterprise v1.0
              </span>
            </div>

            {/* Editorial Centerpiece */}
            <div className="relative z-10 space-y-4 my-auto">
              <h1 className="text-4xl xl:text-5xl font-black text-white font-serif tracking-tight leading-[1.12] drop-shadow-md">
                Arrive as a Guest, <br />
                <span className="text-[var(--ns-gold)] italic font-light">Stay as Family.</span>
              </h1>
              <p className="text-sm xl:text-base text-slate-200 font-medium max-w-lg leading-relaxed drop-shadow-sm">
                Real-time workstation unifying front desk check-ins, guest billing folios, restaurant & bar POS, pool services, and managerial analytics.
              </p>

              {/* 3 Tactile Pillars */}
              <div className="grid grid-cols-3 gap-3 pt-4">
                <div className="glass-subtle skeuo-card rounded-2xl p-3.5 border border-white/15 bg-black/35 text-white">
                  <div className="text-[10px] font-black uppercase text-[var(--ns-gold)] tracking-wider">Rooms & Suites</div>
                  <div className="text-xs font-bold mt-1 text-slate-100">Live Availability</div>
                </div>
                <div className="glass-subtle skeuo-card rounded-2xl p-3.5 border border-white/15 bg-black/35 text-white">
                  <div className="text-[10px] font-black uppercase text-[var(--ns-teal)] tracking-wider">Dining & Lounge</div>
                  <div className="text-xs font-bold mt-1 text-slate-100">Instant POS Folios</div>
                </div>
                <div className="glass-subtle skeuo-card rounded-2xl p-3.5 border border-white/15 bg-black/35 text-white">
                  <div className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Audit Security</div>
                  <div className="text-xs font-bold mt-1 text-slate-100">Role-Guarded</div>
                </div>
              </div>
            </div>

            {/* Bottom Property Signature */}
            <div className="relative z-10 flex items-center justify-between text-xs text-slate-300 border-t border-white/10 pt-4 font-semibold">
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-[var(--ns-gold)]" />
                <span>Lokoe, Ho · Volta Region, Ghana</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck size={13} />
                <span>Protected Access</span>
              </div>
            </div>
          </div>

          {/* ── Right Floating Sign-In Terminal Card ── */}
          <div className="w-full lg:col-span-5 max-w-md mx-auto">
            <div className="glass-strong skeuo-card rounded-3xl p-7 sm:p-9 border border-[var(--ns-glass-line)] shadow-2xl relative overflow-hidden">
              
              {/* Card Ambient Top Sheen */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--ns-gold)] to-transparent opacity-80" />

              {/* Terminal Title & Avatar */}
              <div className="text-center pb-6">
                <div className="mx-auto mb-3.5 h-14 w-14 rounded-2xl skeuo-card bg-gradient-to-b from-white/90 to-white/60 dark:from-slate-800 dark:to-slate-900 border border-[var(--ns-glass-line)] shadow-md flex items-center justify-center p-1.5">
                  <img src={logo} alt={villaName} className="h-full w-full object-cover rounded-xl" />
                </div>
                <div className="ns-eyebrow text-center">
                  {two ? 'Two-Factor Verification' : 'Hospitality Workstation'}
                </div>
                <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>
                  {two ? 'Confirm Identity' : 'Staff Sign In'}
                </h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed" style={{ color: 'var(--ns-muted)' }}>
                  {two
                    ? 'Enter the 6-digit authentication token from your device'
                    : 'Enter your assigned credentials to access your terminal'}
                </p>
              </div>

              {/* Error Notice */}
              {err && (
                <div className="mb-4 rounded-xl border border-[var(--ns-danger)]/50 bg-rose-500/10 p-3.5 text-xs font-bold text-[var(--ns-danger)] flex items-start gap-2.5 shadow-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{err}</span>
                </div>
              )}

              {/* Sign In Form */}
              <form onSubmit={submit} className="space-y-4">
                {!two ? (
                  <>
                    {/* Username / Email */}
                    <div>
                      <label className="block text-xs font-black mb-1.5" style={{ color: 'var(--ns-ink)' }}>
                        Username or Work Email
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
                          placeholder="staff@villa.com or username"
                          className="ns-input glass-input w-full pl-10 pr-3.5 py-2.5 text-xs font-bold rounded-xl transition-all"
                          disabled={busy}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-black" style={{ color: 'var(--ns-ink)' }}>
                          Password
                        </label>
                      </div>
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
                          placeholder="Enter your security password"
                          className="ns-input glass-input w-full pl-10 pr-11 py-2.5 text-xs font-bold rounded-xl transition-all"
                          disabled={busy}
                        />
                        <button
                          type="button"
                          onClick={() => setShow(!show)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg skeuo-btn-secondary text-[var(--ns-muted)] hover:text-[var(--ns-ink)] transition-colors"
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
                    <label className="block text-xs font-black mb-1.5" style={{ color: 'var(--ns-ink)' }}>
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
                        className="ns-input glass-input w-full pl-10 pr-3 py-3 text-center text-xl font-black tracking-[.4em] rounded-xl transition-all"
                        disabled={busy}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwo(false)}
                      className="mt-2 text-[11px] font-bold text-[var(--ns-muted)] hover:text-[var(--ns-gold)] flex items-center gap-1 transition-colors"
                    >
                      <ArrowLeft size={12} />
                      Back to password login
                    </button>
                  </div>
                )}

                {/* Tactile Submit Button */}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 rounded-xl skeuo-btn skeuo-btn-primary px-4 py-3 text-sm font-black text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {busy ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating…</span>
                    </div>
                  ) : (
                    <>
                      <span>{two ? 'Verify & Continue' : 'Sign In to Workstation'}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {/* Security Audit Badge Strip */}
              <div className="mt-6 pt-5 border-t border-[var(--ns-glass-line)] flex items-center justify-between text-[10.5px] font-bold" style={{ color: 'var(--ns-muted)' }}>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  <span>Encrypted TLS 1.3</span>
                </div>
                <div className="flex items-center gap-1">
                  <Building2 size={12} />
                  <span>NS Villa Server</span>
                </div>
              </div>
            </div>

            {/* Bottom System Legal Footnote */}
            <div className="text-center mt-4">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>
                Authorized Personnel Only · All terminal activity is audited.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer Strip ── */}
      <footer className="relative z-10 px-5 py-3 text-center text-[10.5px] font-bold border-t border-[var(--ns-glass-line)]" style={{ color: 'var(--ns-muted)' }}>
        © {new Date().getFullYear()} {villaName} Management System. All rights reserved. Lokoe, Ho, Ghana.
      </footer>
    </div>
  );
}
