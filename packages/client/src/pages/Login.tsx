// ============================================
// NS LUXURY VILLA — Login Page
// Authentication with 2FA TOTP support & error feedback
// ============================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiFetch, ApiClientError } from '../services/api';
import type { LoginResponse } from '@nslv/shared';
import { ShieldCheck, KeyRound, User, Lock, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          login: loginInput,
          password,
          ...(requires2FA ? { totpCode } : {}),
        }),
      });

      if (data.requiresTwoFactor) {
        setRequires2FA(true);
        setIsLoading(false);
        return;
      }

      if (data.user && data.tokens) {
        setAuth(data.user, data.tokens);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Unable to connect to server. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#0F141C] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-[#151C28] border border-[#2D3748] rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Header Card */}
        <div className="bg-[#8C2D19] p-6 text-center border-b border-[#C49A45]/30">
          <div className="w-14 h-14 bg-[#151C28] rounded-2xl mx-auto flex items-center justify-center text-[#E2B768] mb-3 shadow-lg border border-[#C49A45]/40">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide font-['Outfit']">
            NS LUXURY VILLA
          </h1>
          <p className="text-xs text-[#E2B768] font-medium mt-1">Management System · Ho, Ghana</p>
        </div>

        {/* Form Area */}
        <div className="p-8">
          <div className="mb-6 text-center">
            <h2 className="text-base font-semibold text-[#F3F4F6]">
              {requires2FA ? 'Two-Factor Authentication' : 'Staff Access Sign In'}
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-1">
              {requires2FA
                ? 'Enter the 6-digit code from your authenticator app'
                : 'Enter your credentials to access the management platform'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-xs text-[#EF4444] text-center font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!requires2FA ? (
              <>
                {/* Username/Email Input */}
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                    Username or Email
                  </label>
                  <div className="relative">
                    <User
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]"
                    />
                    <input
                      type="text"
                      required
                      value={loginInput}
                      onChange={(e) => setLoginInput(e.target.value)}
                      placeholder="admin or email@nsvilla.com"
                      className="w-full bg-[#121824] border border-[#2D3748] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#C49A45] transition-colors"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]"
                    />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#121824] border border-[#2D3748] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#C49A45] transition-colors"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* 2FA Code Input */
              <div>
                <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5 text-center">
                  6-Digit Authenticator Code
                </label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]"
                  />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full bg-[#121824] border border-[#2D3748] rounded-lg pl-10 pr-4 py-2.5 text-center font-mono text-lg tracking-widest text-[#F3F4F6] focus:outline-none focus:border-[#C49A45] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-[#8C2D19] hover:bg-[#732212] text-white font-semibold text-xs py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                'Authenticating...'
              ) : (
                <>
                  {requires2FA ? 'Verify Code' : 'Sign In to Workspace'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Footer Note */}
          <div className="mt-8 pt-4 border-t border-[#2D3748]/50 text-center">
            <p className="text-[11px] text-[#6B7280]">
              Authorized personnel only. All access attempts are audited.
            </p>
            <p className="text-[10px] text-[#E2B768] mt-0.5">
              NS Luxury Villa · Ho, Volta Region, Ghana
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
