// ============================================
// NS LUXURY VILLA — Staff Account & Profile
// User profile settings, avatar, and security
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/apiService';
import { ShellPage, Section } from '../components/common/WorkspaceUI';
import { Button, FormField, TextInput, showToast } from '../components/ui';
import { Camera, KeyRound, Lock, Save, ShieldCheck, UserCheck } from 'lucide-react';

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
    <ShellPage
      eyebrow="Account"
      title="My Account"
      subtitle="Manage your personal staff credentials, avatar, contact details, and account security."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Avatar Profile Card ── */}
        <Section title="Profile Picture" subtitle="Appears across system activity logs & receipts.">
          <div className="flex flex-col items-center gap-4 p-6">
            <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[#c59a58]/30 shadow-md bg-[var(--ns-surface-2)]">
              {preview ? (
                <img src={preview} alt="Avatar Preview" className="h-full w-full object-cover" />
              ) : user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-[#c59a58] tracking-wider font-serif">
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
                className="gap-1.5 border-[var(--ns-line)] text-[var(--ns-ink)] hover:bg-[var(--ns-surface-2)] text-xs font-semibold"
              >
                <Camera size={13} className="text-[#c59a58]" />
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
                  className="text-xs text-rose-600 hover:bg-rose-50"
                >
                  Remove
                </Button>
              )}
            </div>

            <div className="rounded-xl border border-[var(--ns-line)] bg-[var(--ns-surface-2)] p-3 text-center text-xs text-[var(--ns-muted)] space-y-1 w-full">
              <div className="font-bold text-[var(--ns-ink)]">{user?.firstName} {user?.lastName}</div>
              <div className="text-[11px] text-[#b88738] font-semibold uppercase tracking-wider">
                {user?.roles?.map((r: any) => (typeof r === 'string' ? r : r?.name)).join(' • ') || 'Staff Member'}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Profile Details & Password ── */}
        <div className="space-y-6 lg:col-span-2">
          <Section title="Personal Information" subtitle="Your name, username and contact details.">
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
                  className="bg-[var(--ns-surface-2)] text-[var(--ns-muted)] font-medium"
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
                  className="gap-1.5 bg-[#173c4d] hover:bg-[#133240] text-white w-full sm:w-auto font-semibold"
                >
                  <Save size={14} className="text-[#c59a58]" /> Save Profile
                </Button>
              </div>
            </form>
          </Section>

          <Section
            title="Account Password"
            subtitle="Update your sign-in credentials. You will be automatically signed out upon successful change."
          >
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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ns-line)] pt-4">
                <div className="flex items-center gap-2 text-xs text-[var(--ns-muted)]">
                  <ShieldCheck size={14} className="text-emerald-600" />
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
          </Section>
        </div>
      </div>
    </ShellPage>
  );
};

export default AccountPage;