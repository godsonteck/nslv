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

  // Use theme's background image if available, otherwise fallback to default asset
  const backgroundImage = theme?.loginBgUrl || villaAssets.villaExterior;
  const logo = theme?.logoUrl || villaAssets.logo;
  const villaName = theme?.villaName || 'NSVilla';
  const villaTagline = theme?.villaTagline || 'Property operations';

  return (
    <div className="h-screen overflow-y-auto bg-[#f3f5f3] lg:grid lg:grid-cols-[1.05fr_.95fr]">
      {/* Left Side - Background Image */}
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={backgroundImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#0E0B12]/85" />

        {/* Left Side Content */}
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt={villaName}
              className="h-12 w-12 rounded-2xl object-cover"
            />
            <div>
              <div className="text-lg font-extrabold">{villaName}</div>
              <div className="text-[9px] font-bold uppercase tracking-[.2em] text-[#f1a83f]">
                {villaTagline}
              </div>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#f1a83f]">
              Arrive as a Guest, Stay as Family
            </div>
            <h1 className="mt-4 text-5xl font-extrabold tracking-[-.055em]">
              A calmer way to run the villa.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/70">
              Reservations, rooms, guest stays, folios and department service
              stay connected from arrival to departure.
            </p>
          </div>

          <div className="text-[10px] text-white/45">
            Ho, Volta Region · Ghana · Authorized personnel only
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex min-h-screen items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[430px]">
          {/* Mobile Header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              src={logo}
              alt={villaName}
              className="h-11 w-11 rounded-xl object-cover"
            />
            <div>
              <div className="text-base font-extrabold text-[#20343e]">
                {villaName}
              </div>
              <div className="text-[9px] font-extrabold uppercase tracking-[.18em] text-[#a8761e]">
                {villaTagline}
              </div>
            </div>
          </div>

          {/* Form Container */}
          <div className="mb-7">
            <div className="ns-eyebrow">
              {two ? 'SECURITY CHECK' : 'STAFF ACCESS'}
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em] text-[#14232b]">
              {two ? 'Verify your identity' : 'Welcome back'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#7a858a]">
              {two
                ? 'Enter the verification code from your authenticator.'
                : 'Sign in to your authorized NSVilla workspace.'}
            </p>
          </div>

          {/* Error Message */}
          {err && (
            <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {err}
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {!two ? (
              <>
                {/* Email/Username Field */}
                <div>
                  <label className="block text-sm font-medium text-[#20343e] mb-1">
                    Username or email
                  </label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="you@villa.com"
                    className="w-full rounded border border-[#d9dfea] bg-white px-4 py-2 text-sm text-[#14232b] placeholder-[#a0a5ad] focus:border-[#f1a83f] focus:outline-none focus:ring-2 focus:ring-[#f1a83f]/20"
                    disabled={busy}
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-[#20343e] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      placeholder="Enter password"
                      className="w-full rounded border border-[#d9dfea] bg-white px-4 py-2 text-sm text-[#14232b] placeholder-[#a0a5ad] focus:border-[#f1a83f] focus:outline-none focus:ring-2 focus:ring-[#f1a83f]/20"
                      disabled={busy}
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a858a] hover:text-[#14232b]"
                      disabled={busy}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* TOTP Field */}
                <div>
                  <label className="block text-sm font-medium text-[#20343e] mb-1">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full rounded border border-[#d9dfea] bg-white px-4 py-2 text-center text-2xl tracking-widest text-[#14232b] placeholder-[#a0a5ad] focus:border-[#f1a83f] focus:outline-none focus:ring-2 focus:ring-[#f1a83f]/20"
                    disabled={busy}
                  />
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded bg-[#f1a83f] px-4 py-2.5 text-sm font-semibold text-[#17232b] hover:bg-[#dd9323] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {two ? 'Verify' : 'Sign in'}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Security Info */}
          <div className="mt-6 rounded bg-[#f3f5f3] p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7a858a] mb-2">
              Security Notice
            </div>
            <p className="text-[11px] leading-5 text-[#5a6268]">
              Access is protected by role-based permissions. Important actions
              are recorded in the audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
