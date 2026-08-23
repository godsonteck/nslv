// ============================================
// NS LUXURY VILLA — System Settings Page
// Section #28: Grouped Property & System Settings + Selective Reset & Data Recovery
// ============================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  DollarSign,
  Bell,
  Shield,
  Globe,
  Save,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Lock,
  CheckSquare,
  Square,
  BedDouble,
  UtensilsCrossed,
  Waves,
  CalendarClock,
  Receipt,
  Boxes,
  Layers,
  ScrollText,
  Sliders,
  CheckCircle2,
  History,
  Download,
  RotateCcw,
  Plus,
  HardDrive,
  Database,
  FileJson,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  FormField,
  TextInput,
  showToast,
  Spinner,
  Modal,
} from '../../components/ui';
import {
  settingsApi,
  systemApi,
  staysApi,
  type SystemModuleCounts,
  type BackupMetadata,
} from '../../services/apiService';
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
  { id: 'backups', label: 'Data Recovery & Snapshots', icon: History },
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
  backups: [],
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

interface ResetModuleItem {
  id: string;
  key: keyof ResetSelection;
  label: string;
  icon: any;
  description: string;
  getCountsText: (counts: SystemModuleCounts | null) => string;
  getTotalCount: (counts: SystemModuleCounts | null) => number;
}

interface ResetSelection {
  reservations: boolean;
  posOrders: boolean;
  pool: boolean;
  events: boolean;
  finance: boolean;
  expenses: boolean;
  inventory: boolean;
  catalogs: boolean;
  rooms: boolean;
  notifications: boolean;
  auditLogs: boolean;
}

const DEFAULT_SELECTION: ResetSelection = {
  reservations: true,
  posOrders: true,
  pool: true,
  events: true,
  finance: true,
  expenses: true,
  inventory: true,
  catalogs: true,
  rooms: true,
  notifications: true,
  auditLogs: true,
};

const RESET_MODULES_LIST: ResetModuleItem[] = [
  {
    id: 'reservations',
    key: 'reservations',
    label: 'Reservations, Guests & Stays',
    icon: BedDouble,
    description: 'Clears guest profiles, bookings, stays, folios & room charges. Resets room status to Available.',
    getCountsText: (c) =>
      c
        ? `${c.reservations.reservations} bookings · ${c.reservations.stays} stays · ${c.reservations.folios} folios · ${c.reservations.guests} guests`
        : 'Loading...',
    getTotalCount: (c) => c?.reservations.total ?? 0,
  },
  {
    id: 'posOrders',
    key: 'posOrders',
    label: 'Restaurant & Bar POS Orders',
    icon: UtensilsCrossed,
    description: 'Clears all restaurant dining orders, bar tabs, kitchen tickets and individual order line items.',
    getCountsText: (c) =>
      c ? `${c.posOrders.restaurantOrders} restaurant orders · ${c.posOrders.barOrders} bar orders` : 'Loading...',
    getTotalCount: (c) => c?.posOrders.total ?? 0,
  },
  {
    id: 'pool',
    key: 'pool',
    label: 'Pool Services & Attendance',
    icon: Waves,
    description: 'Clears pool day-pass records, guest attendance logs and pool POS transaction receipts.',
    getCountsText: (c) =>
      c ? `${c.pool.poolTransactions} transactions · ${c.pool.poolAttendance} attendance logs` : 'Loading...',
    getTotalCount: (c) => c?.pool.total ?? 0,
  },
  {
    id: 'events',
    key: 'events',
    label: 'Event Bookings',
    icon: CalendarClock,
    description: 'Clears venue hall bookings and private event reservations.',
    getCountsText: (c) => (c ? `${c.events.eventBookings} event bookings` : 'Loading...'),
    getTotalCount: (c) => c?.events.total ?? 0,
  },
  {
    id: 'finance',
    key: 'finance',
    label: 'Cash Drawer, Payments & Closes',
    icon: DollarSign,
    description: 'Clears cash register shift entries, money-in/out records, payment transactions & daily closes.',
    getCountsText: (c) =>
      c
        ? `${c.finance.payments} payments · ${c.finance.cashRegisterEntries} register entries · ${c.finance.dailyCloses} daily closes`
        : 'Loading...',
    getTotalCount: (c) => c?.finance.total ?? 0,
  },
  {
    id: 'expenses',
    key: 'expenses',
    label: 'Expenses & Disbursements',
    icon: Receipt,
    description: 'Clears operational expense vouchers, petty cash receipts and vendor payout records.',
    getCountsText: (c) => (c ? `${c.expenses.expenses} expense records` : 'Loading...'),
    getTotalCount: (c) => c?.expenses.total ?? 0,
  },
  {
    id: 'inventory',
    key: 'inventory',
    label: 'Inventory & Stock Items',
    icon: Boxes,
    description: 'Clears inventory stock items, min/max quantities, units and cost prices.',
    getCountsText: (c) => (c ? `${c.inventory.inventoryItems} stock items` : 'Loading...'),
    getTotalCount: (c) => c?.inventory.total ?? 0,
  },
  {
    id: 'catalogs',
    key: 'catalogs',
    label: 'POS Menus & Service Catalogs',
    icon: Layers,
    description: 'Clears food menu dishes, beverage items, pool service packages and user-defined categories.',
    getCountsText: (c) =>
      c
        ? `${c.catalogs.restaurantItems} food items · ${c.catalogs.barItems} drinks · ${c.catalogs.poolServices} pool services · ${c.catalogs.itemCategories} categories`
        : 'Loading...',
    getTotalCount: (c) => c?.catalogs.total ?? 0,
  },
  {
    id: 'rooms',
    key: 'rooms',
    label: 'Room Types, Rooms & Amenities',
    icon: Building2,
    description: 'Clears configured physical rooms, room types, rates and room amenity configurations.',
    getCountsText: (c) =>
      c ? `${c.rooms.rooms} rooms · ${c.rooms.roomTypes} room types · ${c.rooms.roomAmenities} amenities` : 'Loading...',
    getTotalCount: (c) => c?.rooms.total ?? 0,
  },
  {
    id: 'notifications',
    key: 'notifications',
    label: 'Staff Notifications',
    icon: Bell,
    description: 'Clears staff alert notifications and message inbox.',
    getCountsText: (c) => (c ? `${c.notifications.notifications} notifications` : 'Loading...'),
    getTotalCount: (c) => c?.notifications.total ?? 0,
  },
  {
    id: 'auditLogs',
    key: 'auditLogs',
    label: 'Historical Audit Trail',
    icon: ScrollText,
    description: 'Clears historical event audit logs (a new audit record will be created documenting this reset).',
    getCountsText: (c) => (c ? `${c.auditLogs.auditLogs} audit logs` : 'Loading...'),
    getTotalCount: (c) => c?.auditLogs.total ?? 0,
  },
];

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingEntry[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingLateFees, setSyncingLateFees] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('villa');
  const [dirty, setDirty] = useState(false);

  // Selective Reset State
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [moduleCounts, setModuleCounts] = useState<SystemModuleCounts | null>(null);
  const [selectedModules, setSelectedModules] = useState<ResetSelection>(DEFAULT_SELECTION);

  // Data Recovery & Backups State
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupMetadata | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Delete Backup Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedBackupForDelete, setSelectedBackupForDelete] = useState<BackupMetadata | null>(null);
  const [deletingBackup, setDeletingBackup] = useState(false);

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

  const loadCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const data = await systemApi.getCounts();
      setModuleCounts(data);
    } catch {
      // Non-blocking preview error
    } finally {
      setCountsLoading(false);
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    setBackupsLoading(true);
    try {
      const data = await systemApi.listBackups();
      setBackups(data || []);
    } catch {
      // Non-blocking
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    if (activeTab === 'backups') {
      fetchBackups();
    }
  }, [fetchSettings, activeTab, fetchBackups]);

  const handleOpenReset = () => {
    setResetOpen(true);
    setResetError(null);
    setResetConfirm('');
    setResetPassword('');
    setSelectedModules(DEFAULT_SELECTION);
    void loadCounts();
  };

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

  const handleCreateManualBackup = async () => {
    setCreatingBackup(true);
    try {
      const meta = await systemApi.createBackup('Manual database backup before operational changes');
      showToast('success', `Snapshot "${meta.id}" created (${meta.totalRecords} records).`);
      await fetchBackups();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to create backup snapshot.');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (backup: BackupMetadata) => {
    try {
      const data = await systemApi.getBackup(backup.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${backup.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('info', `Downloaded backup file: ${backup.filename}`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to download backup.');
    }
  };

  const handleOpenRestoreModal = (backup: BackupMetadata) => {
    setSelectedBackupForRestore(backup);
    setRestoreModalOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackupForRestore || restoring) return;
    setRestoring(true);
    try {
      const res = await systemApi.restoreBackup(selectedBackupForRestore.id);
      setRestoreModalOpen(false);
      showToast(
        'success',
        `Reversal complete! Restored ${res.restoredRecords} records from snapshot "${selectedBackupForRestore.id}".`,
      );
      await fetchSettings();
      await fetchBackups();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to restore snapshot.');
    } finally {
      setRestoring(false);
    }
  };

  const handleOpenDeleteModal = (backup: BackupMetadata) => {
    setSelectedBackupForDelete(backup);
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteBackup = async () => {
    if (!selectedBackupForDelete || deletingBackup) return;
    setDeletingBackup(true);
    try {
      await systemApi.deleteBackup(selectedBackupForDelete.id);
      setDeleteModalOpen(false);
      showToast('success', `Snapshot "${selectedBackupForDelete.id}" deleted.`);
      await fetchBackups();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete backup.');
    } finally {
      setDeletingBackup(false);
    }
  };

  // Quick Preset Handlers
  const applyPreset = (preset: 'all' | 'ops' | 'finance' | 'none') => {
    if (preset === 'all') {
      setSelectedModules({
        reservations: true,
        posOrders: true,
        pool: true,
        events: true,
        finance: true,
        expenses: true,
        inventory: true,
        catalogs: true,
        rooms: true,
        notifications: true,
        auditLogs: true,
      });
    } else if (preset === 'ops') {
      setSelectedModules({
        reservations: true,
        posOrders: true,
        pool: true,
        events: true,
        finance: true,
        expenses: true,
        inventory: false,
        catalogs: false,
        rooms: false,
        notifications: true,
        auditLogs: true,
      });
    } else if (preset === 'finance') {
      setSelectedModules({
        reservations: true,
        posOrders: true,
        pool: true,
        events: false,
        finance: true,
        expenses: true,
        inventory: false,
        catalogs: false,
        rooms: false,
        notifications: false,
        auditLogs: false,
      });
    } else {
      setSelectedModules({
        reservations: false,
        posOrders: false,
        pool: false,
        events: false,
        finance: false,
        expenses: false,
        inventory: false,
        catalogs: false,
        rooms: false,
        notifications: false,
        auditLogs: false,
      });
    }
  };

  const toggleModule = (key: keyof ResetSelection) => {
    setSelectedModules((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectedCount = useMemo(() => {
    return Object.values(selectedModules).filter(Boolean).length;
  }, [selectedModules]);

  const totalAffectedRecords = useMemo(() => {
    if (!moduleCounts) return 0;
    let sum = 0;
    for (const item of RESET_MODULES_LIST) {
      if (selectedModules[item.key]) {
        sum += item.getTotalCount(moduleCounts);
      }
    }
    return sum;
  }, [selectedModules, moduleCounts]);

  const handleReset = async () => {
    if (resetConfirm !== 'RESET' || !resetPassword || resetting || selectedCount === 0) return;
    setResetting(true);
    setResetError(null);
    try {
      const isAll = selectedCount === RESET_MODULES_LIST.length;
      const result = await systemApi.reset(
        resetConfirm,
        resetPassword,
        isAll ? undefined : selectedModules,
      );
      setResetOpen(false);
      setResetConfirm('');
      setResetPassword('');

      const totalDeleted = Object.values(result.counts || {}).reduce((a, b) => a + b, 0);
      showToast(
        'success',
        result.isFullWipe
          ? `Full system wipe complete. ${totalDeleted} records cleared. (Safety snapshot saved)`
          : `Selective reset complete. ${totalDeleted} records cleared for: ${result.modulesWiped.join(', ')}. (Safety snapshot saved)`,
      );

      if (result.isFullWipe) {
        await logout();
        navigate('/login');
      } else {
        await fetchSettings();
        await loadCounts();
        await fetchBackups();
      }
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
        subtitle="Configure villa business rules, tax rates, checkout policies, snapshots & data recovery"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'financial' && (
              <Button variant="outline" size="sm" loading={syncingLateFees} onClick={handleSyncLateFees}>
                <RefreshCw size={14} /> Recalculate Past Late Fees
              </Button>
            )}
            {activeTab === 'backups' && (
              <Button variant="primary" size="sm" loading={creatingBackup} onClick={handleCreateManualBackup}>
                <Plus size={14} /> Create System Snapshot
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Tabs */}
        <div className="lg:w-64 shrink-0 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition text-left ${
                  active
                    ? 'bg-[#1C1F28] text-[#f1a83f] border border-[#f1a83f]/30'
                    : 'text-[#8A9598] hover:bg-[#14161D] hover:text-[#F4F4F2]'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-[#1C1F28] border border-[#2B303E] rounded-xl p-6">
          {activeTab === 'backups' ? (
            /* ─── DATA RECOVERY & SNAPSHOTS TAB ───────────────────────── */
            <div className="space-y-6">
              <div className="border-b border-[#2B303E] pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#F4F4F2] flex items-center gap-2">
                    <History size={16} className="text-[#16a4d4]" />
                    Data Recovery, Snapshots & Rollbacks
                  </h2>
                  <p className="text-xs text-[#8A9598] mt-0.5">
                    Reverse deleted data from point-in-time snapshots or create manual system backups
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  loading={backupsLoading}
                  onClick={fetchBackups}
                  className="gap-1.5"
                >
                  <RefreshCw size={13} /> Refresh List
                </Button>
              </div>

              {/* Informational Banner */}
              <div className="flex items-start gap-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-blue-200">
                <Shield size={20} className="text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <strong className="text-blue-300 font-bold">Automatic Pre-Reset Safety Net:</strong> Before any system or modular reset is performed, an automatic safety snapshot is saved here. If you or another administrator ever clear data and need to reverse it, click <strong className="text-emerald-300">Reverse / Restore</strong> on the snapshot below to instantly restore all deleted records.
                </div>
              </div>

              {/* Snapshots List */}
              {backupsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size={24} />
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#2B303E] rounded-xl">
                  <Database size={32} className="mx-auto text-slate-600 mb-2" />
                  <h4 className="text-xs font-bold text-slate-300">No snapshots recorded yet</h4>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Click "Create System Snapshot" above to create an instant manual backup point, or perform a reset to generate an automatic pre-reset snapshot.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {backups.map((b) => {
                    const isPreReset = b.trigger === 'PRE_RESET_SNAPSHOT';
                    const dateStr = new Date(b.createdAt).toLocaleString();
                    const sizeKb = (b.fileSizeBytes / 1024).toFixed(1);

                    return (
                      <div
                        key={b.id}
                        className="bg-[#14161D] border border-[#2B303E] rounded-xl p-4 hover:border-slate-600 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                isPreReset
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {isPreReset ? '🛡️ Pre-Reset Safety Snapshot' : '💾 Manual Snapshot'}
                            </span>
                            <span className="text-xs font-bold text-[#F4F4F2]">{dateStr}</span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              ({b.totalRecords} records · {sizeKb} KB)
                            </span>
                          </div>

                          {b.description && (
                            <p className="text-xs text-slate-400">{b.description}</p>
                          )}

                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {Object.entries(b.modelsCount || {})
                              .filter(([_, count]) => count > 0)
                              .slice(0, 7)
                              .map(([model, count]) => (
                                <span
                                  key={model}
                                  className="text-[9px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700"
                                >
                                  {model}: {count}
                                </span>
                              ))}
                            {Object.keys(b.modelsCount || {}).filter((k) => (b.modelsCount as any)[k] > 0).length > 7 && (
                              <span className="text-[9px] font-mono text-slate-500">+more</span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#2B303E]">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenRestoreModal(b)}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            <RotateCcw size={13} /> Reverse / Restore
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadBackup(b)}
                            title="Download JSON file to your computer"
                            className="gap-1 text-slate-300"
                          >
                            <Download size={13} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeleteModal(b)}
                            title="Delete snapshot"
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ─── STANDARD SETTINGS TABS ──────────────────────────────── */
            loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size={24} />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="border-b border-[#2B303E] pb-3 mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#F4F4F2]">
                      {TABS.find((t) => t.id === activeTab)?.label}
                    </h2>
                    <p className="text-xs text-[#8A9598] mt-0.5">
                      Configure live operational parameters and system policies
                    </p>
                  </div>
                </div>

                {displaySettings.length === 0 && (
                  <div className="text-xs text-[#8A9598] py-6 text-center">
                    No configurable keys found for this category.
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
            )
          )}
        </div>
      </div>

      {/* ─── DANGER ZONE: SELECTIVE & FULL SYSTEM RESET ─────────────────────── */}
      {canReset && (
        <div className="bg-[#1C1F28] border border-red-900/40 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-red-900/20 rounded-lg text-red-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-[#F4F4F2]">Danger Zone — Selective or Full System Reset</h3>
                  <span className="bg-red-900/30 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-800/40">Admin Only</span>
                </div>
                <p className="text-xs text-[#A0A5AD] mt-1 max-w-2xl leading-relaxed">
                  Choose exactly which data modules you want to clear (Reservations, POS Orders, Expenses, Cash Ledger, Menus, Rooms, etc.) or wipe the entire database clean. A safety snapshot is automatically created before any wipe so you can reverse/restore at any time.
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleOpenReset}
              className="gap-2 shrink-0 shadow-sm"
            >
              <Sliders size={14} /> Configure & Reset System...
            </Button>
          </div>
        </div>
      )}

      {/* ─── MODAL: RESTORE / REVERSE SNAPSHOT ─────────────────────────────── */}
      <Modal
        open={restoreModalOpen}
        onClose={() => {
          if (!restoring) setRestoreModalOpen(false);
        }}
        title="Reverse Deleted Data — Restore Snapshot"
        size="md"
      >
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-200">
            <RotateCcw size={18} className="text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <strong className="text-emerald-300 font-bold">Data Restoration:</strong> This will restore all{' '}
              <strong className="text-white">{selectedBackupForRestore?.totalRecords} records</strong> from snapshot{' '}
              <code className="bg-emerald-950 px-1 py-0.5 rounded font-mono text-[11px]">{selectedBackupForRestore?.id}</code> back into the live database.
            </div>
          </div>

          <div className="bg-[#14161D] border border-[#2B303E] rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Snapshot Created:</span>
              <span className="font-semibold text-white">
                {selectedBackupForRestore ? new Date(selectedBackupForRestore.createdAt).toLocaleString() : ''}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Type:</span>
              <span className="font-semibold text-[#16a4d4]">
                {selectedBackupForRestore?.trigger === 'PRE_RESET_SNAPSHOT' ? 'Pre-Reset Safety Snapshot' : 'Manual Snapshot'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Records:</span>
              <span className="font-semibold text-emerald-400">{selectedBackupForRestore?.totalRecords} records</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRestoreModalOpen(false)}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={restoring}
              onClick={handleConfirmRestore}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
            >
              <RotateCcw size={14} /> Confirm & Reverse Data
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: DELETE SNAPSHOT CONFIRMATION ───────────────────────────── */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          if (!deletingBackup) setDeleteModalOpen(false);
        }}
        title="Delete Snapshot File"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-200">
            <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed">
              Are you sure you want to permanently delete snapshot <code className="bg-red-950 px-1 py-0.5 rounded font-mono text-[11px] text-white">{selectedBackupForDelete?.id}</code>?
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            This snapshot contains <strong>{selectedBackupForDelete?.totalRecords} records</strong> from {selectedBackupForDelete ? new Date(selectedBackupForDelete.createdAt).toLocaleString() : ''}. Once deleted from disk, it cannot be restored.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deletingBackup}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deletingBackup}
              onClick={handleConfirmDeleteBackup}
              className="gap-1.5 shadow-sm"
            >
              <Trash2 size={14} /> Delete Snapshot
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: SELECTIVE SYSTEM RESET ─────────────────────────────────── */}
      <Modal
        open={resetOpen}
        onClose={() => {
          if (!resetting) setResetOpen(false);
        }}
        title="Selective / Full System Reset"
        size="lg"
      >
        <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-200">
            <Lock size={18} className="text-red-400 mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <strong className="text-red-300 font-bold">Safety Snapshot Created Automatically:</strong> An automatic pre-reset snapshot of all selected records will be saved to your <strong className="text-white">Data Recovery & Snapshots</strong> center before deletion. You can reverse/restore at any time.
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders size={13} /> Quick Selection Presets
              </label>
              <span className="text-[11px] font-bold text-[#16a4d4]">
                {selectedCount} of {RESET_MODULES_LIST.length} modules selected ({totalAffectedRecords} total records)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-3 py-2 text-xs font-bold rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition text-center"
              >
                🔴 Wipe Everything
              </button>
              <button
                type="button"
                onClick={() => applyPreset('ops')}
                className="px-3 py-2 text-xs font-bold rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition text-center"
              >
                🟡 Operational Data Only
              </button>
              <button
                type="button"
                onClick={() => applyPreset('finance')}
                className="px-3 py-2 text-xs font-bold rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition text-center"
              >
                🟢 Financials & Orders
              </button>
              <button
                type="button"
                onClick={() => applyPreset('none')}
                className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition text-center"
              >
                ⚪ Deselect All
              </button>
            </div>
          </div>

          {/* Modules Selection Checklist */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Select Data Modules to Clear
            </label>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {RESET_MODULES_LIST.map((item) => {
                const isSelected = selectedModules[item.key];
                const Icon = item.icon;
                const totalCount = item.getTotalCount(moduleCounts);

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleModule(item.key)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition flex items-start gap-3 select-none ${
                      isSelected
                        ? 'border-red-500/50 bg-red-950/20 text-white shadow-sm'
                        : 'border-[#2B303E] bg-[#14161D] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-red-400">
                      {isSelected ? <CheckSquare size={17} className="text-red-400" /> : <Square size={17} className="text-slate-600" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-extrabold flex items-center gap-1.5 ${isSelected ? 'text-[#F4F4F2]' : 'text-slate-300'}`}>
                          <Icon size={14} className={isSelected ? 'text-red-400' : 'text-slate-500'} />
                          {item.label}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                            totalCount > 0
                              ? isSelected
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-slate-800 text-slate-400'
                              : 'bg-slate-800/50 text-slate-600'
                          }`}
                        >
                          {totalCount} {totalCount === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>

                      <div className="text-[9px] font-mono text-slate-500 mt-1.5 truncate">
                        {countsLoading ? 'Loading records...' : item.getCountsText(moduleCounts)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Inputs */}
          <div className="space-y-4 pt-2 border-t border-[#2B303E]">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Type RESET to confirm" required>
                <TextInput
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="RESET"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono uppercase font-bold"
                />
              </FormField>

              <FormField label="Your Admin Password" required>
                <TextInput
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  autoComplete="current-password"
                />
              </FormField>
            </div>

            {resetError && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{resetError}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-slate-400">
              {selectedCount === 0 ? (
                <span className="text-amber-400 font-semibold">Please select at least 1 module to clear.</span>
              ) : selectedCount === RESET_MODULES_LIST.length ? (
                <span className="text-red-400 font-bold">Wiping entire database ({totalAffectedRecords} total records).</span>
              ) : (
                <span>Wiping {selectedCount} selected modules ({totalAffectedRecords} records).</span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResetOpen(false)}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={resetting}
                disabled={resetConfirm !== 'RESET' || !resetPassword || selectedCount === 0}
                onClick={handleReset}
                className="gap-1.5 shadow-sm"
              >
                <Trash2 size={14} />
                {selectedCount === RESET_MODULES_LIST.length ? 'Wipe Entire System' : `Clear ${selectedCount} Selected Modules`}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;
