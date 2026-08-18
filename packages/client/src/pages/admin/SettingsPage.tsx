// ============================================
// NS LUXURY VILLA — System Settings Page
// Section #28: Grouped Property & System Settings
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, DollarSign, Bell, Shield, Globe, Save,
  RefreshCw, AlertTriangle, Trash2, Lock,
} from 'lucide-react';
import {
  PageHeader, Button, FormField, TextInput,
  showToast, Spinner, Modal,
} from '../../components/ui';
import { settingsApi, systemApi, staysApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';

interface SettingEntry {
  key: string;
  value: unknown;
  category: string;
  description: string | null;
}

const TABS = [
  { id: 'villa', label: 'Property & Villa Profile', icon: Building2 },
  { id: 'financial', label: 'Financial & Rates', icon: DollarSign },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security & Access', icon: Shield },
  { id: 'regional', label: 'Regional & Localization', icon: Globe },
] as const;
type TabId = (typeof TABS)[number]['id'];

const TAB_KEYS: Record<TabId, string[]> = {
  villa: [
    'villa.name', 'villa.address', 'villa.phone', 'villa.email',
    'villa.website', 'villa.country',
  ],
  financial: [
    'villa.currency', 'villa.tax_rate', 'financial.service_charge_rate',
    'villa.checkin_time', 'villa.checkout_time', 'financial.late_checkout_fee',
    'financial.cancellation_policy_hours',
  ],
  notifications: [
    'notifications.email_enabled', 'notifications.sms_enabled',
    'notifications.reservation_confirmation_email', 'notifications.payment_receipt_email',
    'notifications.daily_report_email', 'notifications.low_inventory_alert_threshold',
  ],
  security: [
    'security.session_timeout_minutes', 'security.max_login_attempts',
    'security.lockout_duration_minutes', 'security.require_2fa_for_admins',
    'security.password_expiry_days', 'security.audit_retention_days',
  ],
  regional: [
    'regional.timezone', 'regional.date_format', 'regional.currency_symbol',
    'regional.phone_country_code', 'regional.country', 'regional.language',
  ],
};

interface SettingFieldProps {
  setting: SettingEntry;
  draft: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}

const SettingField: React.FC<SettingFieldProps> = ({ setting, draft, onChange }) => {
  const val = draft[setting.key] !== undefined ? draft[setting.key] : setting.value;
  let label = setting.key
    .replace(/_/g, ' ')
    .replace(/^villa\.|^financial\.|^notifications\.|^security\.|^regional\./, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  let description = setting.description;

  if (setting.key === 'financial.late_checkout_fee') {
    label = 'Late Check-out Fee Per Hour (GHS)';
    description = 'Hourly fee in Cedis (GHS) applied for each started hour after the check-out deadline (e.g. 50 GHS/hr; 2 hrs = 100 GHS, 3 hrs = 150 GHS).';
  } else if (setting.key === 'villa.checkout_time') {
    label = 'Standard Check-out Time (HH:MM)';
    description = 'Daily departure deadline (e.g. 12:00). Departures past this time automatically incur the hourly late fee.';
  } else if (setting.key === 'villa.checkin_time') {
    label = 'Standard Check-in Time (HH:MM)';
    description = 'Arrival start time (e.g. 14:00).';
  }

  if (typeof setting.value === 'boolean') {
    return (
      <div className="flex items-center justify-between p-3 bg-[#14161D] border border-[#2B303E] rounded">
        <div>
          <div className="text-xs font-medium text-[#F4F4F2]">{label}</div>
          {description && <div className="text-[10px] text-[#6E737B] mt-0.5">{description}</div>}
        </div>
        <button
          type="button"
          onClick={() => onChange(setting.key, !val)}
          className={`relative w-10 h-5 rounded-full transition-colors ${val ? 'bg-[#f1a83f]' : 'bg-[#2B303E]'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    );
  }

  return (
    <FormField label={label}>
      {description && (
        <p className="text-[10px] text-[#6E737B] mb-1">{description}</p>
      )}
      <TextInput
        value={String(val ?? '')}
        onChange={(e) => onChange(setting.key, e.target.value)}
        placeholder={label}
      />
    </FormField>
  );
};

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingEntry[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingLateFees, setSyncingLateFees] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('villa');
  const [dirty, setDirty] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const canReset = useAuthStore((s) => s.hasPermission(PERMISSIONS.SYSTEM_CONFIGURE));

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsApi.list();
      if (res.success && res.data) {
        setSettings(
          res.data.map((s) => ({
            ...s,
            category: s.key.split('.')[0] || 'general',
          })),
        );
        setDirty(false);
        setDraft({});
      }
    } catch {
      showToast('error', 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key: string, val: unknown) => {
    setDraft((d) => ({ ...d, [key]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!dirty || Object.keys(draft).length === 0) return;
    setSaving(true);
    try {
      await settingsApi.bulkUpdate(draft);
      showToast('success', 'Settings updated & policies synchronized successfully.');
      await fetchSettings();
    } catch {
      showToast('error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncLateFees = async () => {
    setSyncingLateFees(true);
    try {
      const res = await staysApi.recalculateLateFees();
      if (res.success && res.data) {
        showToast(
          'success',
          `Late check-out sync complete: ${res.data.adjustedCount} historical records updated (${res.data.hourlyRate} GHS/hr past ${res.data.checkoutTime}).`,
        );
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to sync historical late fees.');
    } finally {
      setSyncingLateFees(false);
    }
  };

  const handleReset = async () => {
    if (resetConfirm !== 'RESET' || !resetPassword || resetting) return;
    setResetting(true);
    setResetError(null);
    try {
      const result = await systemApi.reset(resetConfirm, resetPassword);
      setResetOpen(false);
      setResetConfirm('');
      setResetPassword('');
      showToast('success', `System reset complete. ${Object.values(result.counts).reduce((a, b) => a + b, 0)} records cleared.`);
      await logout();
      navigate('/login');
    } catch (err: any) {
      setResetError(err?.message || 'Reset failed. Check your password and try again.');
    } finally {
      setResetting(false);
    }
  };

  const currentTabKeys = TAB_KEYS[activeTab];
  const displaySettings = settings.filter((s) => currentTabKeys.includes(s.key));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Property & System Settings"
        subtitle="Configure villa business rules, tax rates, checkout policies & operational settings"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'financial' && (
              <Button variant="outline" size="sm" loading={syncingLateFees} onClick={handleSyncLateFees}>
                <RefreshCw size={14} /> Recalculate Past Late Fees
              </Button>
            )}
            {dirty && (
              <>
                <Button variant="ghost" size="sm" onClick={() => { setDraft({}); setDirty(false); }}>
                  Discard
                </Button>
                <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                  <Save size={14} /> Save Changes
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Tab Sidebar */}
        <div className="w-full md:w-56 shrink-0 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-medium transition-all text-left ${
                activeTab === id
                  ? 'bg-[#232733] text-[#F4F4F2] font-semibold border-l-2 border-[#f1a83f] pl-2.5'
                  : 'text-[#A0A5AD] hover:bg-[#1C1F28] hover:text-[#F4F4F2]'
              }`}
            >
              <Icon size={15} className={activeTab === id ? 'text-[#f1a83f]' : 'text-[#6E737B]'} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Setting Fields Panel */}
        <div className="flex-1 bg-[#1C1F28] border border-[#2B303E] rounded-md p-5">
          {loading ? (
            <div className="py-16 text-center text-xs text-[#A0A5AD]"><Spinner /></div>
          ) : (
            <div className="space-y-4">
              {activeTab === 'financial' && (
                <div className="rounded-md border border-[#f1a83f]/40 bg-[#fdf7ea] p-3.5 text-xs text-[#7a5a1e]">
                  <div className="font-bold flex items-center gap-1.5 text-[#7a5a1e]">
                    <span>⏰ Late Check-out Dynamic Policy</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#6b6255] leading-relaxed">
                    Set the hourly rate (GHS) below. Any guest departing past standard check-out time is billed at <strong>rate × hours late</strong> (1 hr late = 1×, 2 hrs late = 2×, etc.). Saving settings automatically synchronizes all historical stays.
                  </p>
                </div>
              )}
              {displaySettings.map((setting) => (
                <SettingField
                  key={setting.key}
                  setting={setting}
                  draft={draft}
                  onChange={handleChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {canReset && (
        <div className="bg-[#1C1F28] border border-red-900/40 rounded-md p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-900/20 rounded text-red-400">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F4F4F2]">Danger Zone — Reset Entire System</h3>
                <p className="text-xs text-[#A0A5AD] mt-1 max-w-xl">
                  Irreversibly wipes all operational and catalog data: guests, reservations, stays, folios,
                  payments, POS orders, pool activity, expenses, inventory, events, rooms and menus.
                  Users, roles, permissions and settings are kept. Type{' '}
                  <span className="font-mono text-red-600">RESET</span> and enter your password to confirm.
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => { setResetOpen(true); setResetError(null); setResetConfirm(''); setResetPassword(''); }}
            >
              <Trash2 size={14} /> Reset System
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={resetOpen}
        onClose={() => { if (!resetting) setResetOpen(false); }}
        title="Confirm System Reset"
        size="md"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <Lock size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="text-xs text-red-700 leading-relaxed">
              This permanently deletes every guest, reservation, stay, payment, order, event and catalog
              record. This action <strong>cannot be undone</strong>.
            </div>
          </div>

          <FormField label="Type RESET to confirm" required>
            <TextInput
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="RESET"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </FormField>

          <FormField label="Your password" required>
            <TextInput
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </FormField>

          {resetError && <div className="text-xs text-red-500">{resetError}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={resetting}
              disabled={resetConfirm !== 'RESET' || !resetPassword}
              onClick={handleReset}
            >
              <Trash2 size={14} /> Wipe Everything
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;
