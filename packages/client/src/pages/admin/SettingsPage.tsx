// ============================================
// NS LUXURY VILLA — System Settings Page
// /settings — Tabbed villa configuration UI
// ============================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2, DollarSign, Bell, Shield, Globe, Save,
  RefreshCw,
} from 'lucide-react';
import {
  PageHeader, Button, FormField, TextInput,
  showToast, ToastContainer, Spinner,
} from '../components/ui';
import { settingsApi } from '../services/apiService';

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
interface SettingEntry {
  key: string;
  value: unknown;
  dataType: string;
  description: string | null;
  isPublic: boolean;
}

// ──────────────────────────────────────────
// Tab definitions
// ──────────────────────────────────────────
const TABS = [
  { id: 'villa', label: 'Villa Profile', icon: Building2 },
  { id: 'financial', label: 'Financial', icon: DollarSign },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'regional', label: 'Regional', icon: Globe },
] as const;
type TabId = (typeof TABS)[number]['id'];

// ──────────────────────────────────────────
// Setting key groupings per tab
// ──────────────────────────────────────────
const TAB_KEYS: Record<TabId, string[]> = {
  villa: [
    'villa_name', 'villa_address', 'villa_phone', 'villa_email',
    'villa_website', 'villa_tax_id', 'villa_description',
  ],
  financial: [
    'default_currency', 'tax_rate', 'service_charge_rate',
    'check_in_time', 'check_out_time', 'late_check_out_fee',
    'early_check_in_fee', 'cancellation_policy_hours',
  ],
  notifications: [
    'email_notifications_enabled', 'sms_notifications_enabled',
    'reservation_confirmation_email', 'payment_receipt_email',
    'daily_report_email', 'low_inventory_alert_threshold',
  ],
  security: [
    'session_timeout_minutes', 'max_login_attempts',
    'lockout_duration_minutes', 'require_2fa_for_admins',
    'password_expiry_days', 'audit_retention_days',
  ],
  regional: [
    'timezone', 'date_format', 'currency_symbol',
    'phone_country_code', 'country', 'language',
  ],
};

// ──────────────────────────────────────────
// Individual Setting Field
// ──────────────────────────────────────────
interface SettingFieldProps {
  setting: SettingEntry;
  draft: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}

const SettingField: React.FC<SettingFieldProps> = ({ setting, draft, onChange }) => {
  const val = draft[setting.key] !== undefined ? draft[setting.key] : setting.value;
  const label = setting.key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (setting.dataType === 'boolean') {
    return (
      <div className="flex items-center justify-between p-3 bg-[#151C28] border border-[#2D3748] rounded-lg">
        <div>
          <div className="text-xs font-medium text-[#F3F4F6]">{label}</div>
          {setting.description && <div className="text-[10px] text-[#6B7280] mt-0.5">{setting.description}</div>}
        </div>
        <button
          onClick={() => onChange(setting.key, !val)}
          className={`relative w-11 h-6 rounded-full transition-colors ${val ? 'bg-[#C49A45]' : 'bg-[#2D3748]'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    );
  }

  return (
    <FormField label={label}>
      {setting.description && (
        <p className="text-[10px] text-[#6B7280] mb-1.5">{setting.description}</p>
      )}
      <TextInput
        value={String(val ?? '')}
        onChange={(e) => onChange(setting.key, e.target.value)}
        placeholder={label}
      />
    </FormField>
  );
};

// ──────────────────────────────────────────
// Settings Page
// ──────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingEntry[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('villa');
  const [dirty, setDirty] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsApi.list();
      if (res.success && res.data) {
        setSettings(res.data as SettingEntry[]);
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
      showToast('success', 'Settings saved successfully.');
      await fetchSettings();
    } catch {
      showToast('error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({});
    setDirty(false);
    showToast('info', 'Changes discarded.');
  };

  const tabKeys = TAB_KEYS[activeTab];
  const tabSettings = settings.filter((s) => tabKeys.includes(s.key));

  // For settings not yet in DB, synthesize placeholders
  const displaySettings: SettingEntry[] = tabKeys.map((key) => {
    const found = tabSettings.find((s) => s.key === key);
    if (found) return found;
    return {
      key,
      value: '',
      dataType: key.includes('enabled') || key.includes('require') ? 'boolean' : 'string',
      description: null,
      isPublic: false,
    };
  });

  return (
    <div className="p-6">
      <PageHeader
        title="System Settings"
        subtitle="Configure NS Luxury Villa's operational parameters"
        actions={
          dirty ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RefreshCw size={13} /> Discard
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                <Save size={13} /> Save Changes
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Dirty indicator */}
      {dirty && (
        <div className="mb-4 px-4 py-2.5 bg-[#C49A45]/10 border border-[#C49A45]/30 rounded-xl text-xs text-[#C49A45]">
          ⚠️ You have unsaved changes. Click <strong>Save Changes</strong> to apply them.
        </div>
      )}

      <div className="flex gap-6">
        {/* Tab Sidebar */}
        <div className="w-48 shrink-0 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left ${activeTab === id
                ? 'bg-[#8C2D19]/20 border border-[#8C2D19]/40 text-[#F3F4F6]'
                : 'text-[#9CA3AF] hover:bg-[#1C2536] hover:text-[#F3F4F6]'
                }`}
            >
              <Icon size={14} className={activeTab === id ? 'text-[#C49A45]' : ''} />
              {label}
            </button>
          ))}
        </div>

        {/* Setting Fields */}
        <div className="flex-1 bg-[#1C2536] border border-[#2D3748] rounded-xl p-5">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner size={32} /></div>
          ) : (
            <>
              <h2 className="text-sm font-bold text-[#F3F4F6] mb-4 flex items-center gap-2">
                {(() => {
                  const tab = TABS.find((t) => t.id === activeTab);
                  if (!tab) return null;
                  const Icon = tab.icon;
                  return <><Icon size={15} className="text-[#C49A45]" /> {tab.label}</>;
                })()}
              </h2>

              <div className="space-y-2">
                {displaySettings.map((setting) => (
                  <SettingField
                    key={setting.key}
                    setting={setting}
                    draft={draft}
                    onChange={handleChange}
                  />
                ))}
              </div>

              {displaySettings.length === 0 && (
                <div className="text-center py-12 text-[#6B7280] text-xs">
                  No settings configured for this category yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};

export default SettingsPage;
