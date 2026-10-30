// ============================================
// NS LUXURY VILLA — Staff Account & Profile
// User profile settings, avatar, and security
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/apiService';
import { Button, FormField, TextInput, showToast } from '../components/ui';
import { Camera, KeyRound, Lock, Save, ShieldCheck, UserCheck, User } from 'lucide-react';

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const AccountPage: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({
    username: '',
    firstName: '',
    lastName: '',
    phone: '',
    avatarUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const [password, setPassword] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        username: user.username || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        avatarUrl: user.avatarUrl || '',
      });
    }
  }, [user]);

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please choose an image file (PNG, JPG, or WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Image must be smaller than 2MB.');
      return;
    }
    try {
      const url = await readFileAsDataURL(file);
      setPreview(url);
    } catch {
      showToast('error', 'Unable to read image file.');
    } finally {
      e.target.value = '';
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await authApi.updateProfile({
        ...profile,
        phone: profile.phone || null,
        avatarUrl: preview ?? (profile.avatarUrl || null),
      });
      updateUser(data as any);
      showToast('success', 'Profile updated successfully.');
      setPreview(null);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.currentPassword || !password.newPassword || !password.confirmPassword) {
      showToast('error', 'Please fill in all password fields.');
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      showToast('error', 'New passwords do not match.');
      return;
    }
    setChanging(true);
    try {
      await authApi.changePassword(
        password.currentPassword,
        password.newPassword,
        password.confirmPassword,
      );
      showToast('success', 'Password changed successfully. Please sign in again.');
      setTimeout(() => void useAuthStore.getState().logout(), 800);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Unable to change password.');
    } finally {
      setChanging(false);
    }
  };

  const initials =
    `${(user?.firstName || '')[0] ?? ''}${(user?.lastName || '')[0] ?? ''}`.toUpperCase() || 'NS';

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-300">
      {/* Compact Header */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <User size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>My Profile</h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Manage your personal details, avatar, and account security for the villa team.</p>
          </div>
        </div>
        <div className="flex items-center gap-2"></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Avatar Profile Card */}
        <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
            <div className="flex items-center gap-2">
              <Camera size={14} className="text-[var(--ns-teal)]" />
              <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Profile Picture</h2>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 p-6">
            <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[var(--ns-gold)]/30 shadow-md ns-glass-band">
              {preview ? (
                <img src={preview} alt="Avatar Preview" className="h-full w-full object-cover" />
              ) : user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-[var(--ns-gold)] tracking-wider font-serif">
                  {initials}
                </span>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="gap-1.5 border-[var(--ns-glass-line)] text-[var(--ns-ink)] ns-glass-hover text-xs font-semibold"
              >
                <Camera size={13} className="text-[var(--ns-gold)]" />
                {preview ? 'Change Photo' : 'Upload Photo'}
              </Button>
              {(preview || user?.avatarUrl) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPreview(null);
                    setProfile((p) => ({ ...p, avatarUrl: '' }));
                  }}
                  className="text-xs text-[var(--ns-danger)] ns-glass-hover"
                >
                  Remove
                </Button>
              )}
            </div>

            <div className="rounded-xl border border-[var(--ns-glass-line)] ns-glass-band p-3 text-center text-xs text-[var(--ns-muted)] space-y-1 w-full">
              <div className="font-bold text-[var(--ns-ink)]">{user?.firstName} {user?.lastName}</div>
              <div className="text-[11px] text-[var(--ns-gold)] font-semibold uppercase tracking-wider">
                {user?.roles?.map((r: any) => (typeof r === 'string' ? r : r?.name)).join(' • ') || 'Villa team'}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details & Password */}
        <div className="space-y-6 lg:col-span-2">
          {/* Personal Information */}
          <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-[var(--ns-teal)]" />
                <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Personal Information</h2>
              </div>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Your name, username and contact details.</p>
            </div>
            <form onSubmit={saveProfile} className="grid gap-4 p-5 sm:grid-cols-2">
              <FormField label="Username" required>
                <TextInput
                  required
                  value={profile.username}
                  onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                  placeholder="username"
                />
              </FormField>

              <FormField label="Email Address">
                <TextInput
                  disabled
                  value={user?.email || ''}
                  className="glass-input text-[var(--ns-muted)] font-medium"
                />
              </FormField>

              <FormField label="First Name" required>
                <TextInput
                  required
                  value={profile.firstName}
                  onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="First name"
                />
              </FormField>

              <FormField label="Last Name" required>
                <TextInput
                  required
                  value={profile.lastName}
                  onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Last name"
                />
              </FormField>

              <FormField label="Phone Number">
                <TextInput
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+233 24 000 0000"
                />
              </FormField>

              <div className="flex items-end">
                <Button
                  type="submit"
                  loading={saving}
                  className="gap-1.5 glass ns-glass-hover text-[var(--ns-ink)] w-full sm:w-auto font-semibold"
                >
                  <Save size={14} className="text-[var(--ns-gold)]" /> Save Profile
                </Button>
              </div>
            </form>
          </div>

          {/* Account Password */}
          <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-[var(--ns-teal)]" />
                <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Account Password</h2>
              </div>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Update your sign-in credentials. You will be automatically signed out upon successful change.</p>
            </div>
            <form onSubmit={changePassword} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Current Password" required>
                  <TextInput
                    required
                    type="password"
                    value={password.currentPassword}
                    onChange={(e) => setPassword((p) => ({ ...p, currentPassword: e.target.value }))}
                    placeholder="••••••••"
                  />
                </FormField>

                <FormField label="New Password" required>
                  <TextInput
                    required
                    type="password"
                    value={password.newPassword}
                    onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Min. 8 characters"
                  />
                </FormField>

                <FormField label="Confirm New Password" required>
                  <TextInput
                    required
                    type="password"
                    value={password.confirmPassword}
                    onChange={(e) => setPassword((p) => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="Repeat new password"
                  />
                </FormField>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ns-glass-line)] pt-4">
                <div className="flex items-center gap-2 text-xs text-[var(--ns-muted)]">
                  <ShieldCheck size={14} className="text-[var(--ns-success)]" />
                  <span>Secured with high-entropy cryptographic password encryption.</span>
                </div>
                <Button
                  type="submit"
                  variant="danger"
                  loading={changing}
                  className="gap-1.5 font-semibold text-xs"
                >
                  <KeyRound size={13} /> Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;