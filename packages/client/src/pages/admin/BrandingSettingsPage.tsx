import React, { useEffect, useState } from 'react';
import { Palette, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { PageHeader, Button, FormField, TextInput, showToast, Modal } from '../../components/ui';
import { useThemeStore } from '../../stores/themeStore';
import type { ThemeConfig } from '../../services/apiService';

const ColorPicker: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  description?: string;
}> = ({ label, value, onChange, description }) => (
  <FormField label={label}>
    {description && <p className="text-[10px] text-[#6E737B] mb-2">{description}</p>}
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-16 rounded cursor-pointer border border-[#2B303E]"
      />
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="flex-1 font-mono text-xs"
      />
    </div>
  </FormField>
);

export const BrandingSettingsPage: React.FC = () => {
  const { theme, loadTheme, updateTheme, resetTheme } = useThemeStore();
  const [draft, setDraft] = useState<Partial<ThemeConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    void loadTheme().finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [loadTheme]);

  const handleChange = (key: keyof ThemeConfig, val: any) => {
    setDraft((d) => ({ ...d, [key]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!dirty || Object.keys(draft).length === 0) return;
    setSaving(true);
    try {
      await updateTheme(draft);
      showToast('success', 'Branding updated successfully.');
      setDraft({});
      setDirty(false);
    } catch {
      showToast('error', 'Failed to save branding.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetTheme();
      setResetOpen(false);
      setDraft({});
      setDirty(false);
      showToast('success', 'Theme reset to defaults.');
    } catch {
      showToast('error', 'Failed to reset theme.');
    }
  };

  if (loading && !theme) {
    return <div className="py-8 text-center text-xs text-[#A0A5AD]">Loading theme settings...</div>;
  }

  const activeTheme = theme ?? {
    ...{
      villaName: 'NS Luxury Villa',
      villaTagline: 'Property Operations',
      primaryColor: '#174b59',
      secondaryColor: '#b18a55',
      accentColor: '#d9bd91',
      bgColor: '#f5f6f4',
      textColor: '#14232b',
      textMuted: '#7a858a',
      borderColor: '#e5e8e5',
      successColor: '#2d8a68',
      warningColor: '#d97706',
      errorColor: '#dc2626',
      infoColor: '#0284c7',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      headingFont: 'Manrope, sans-serif',
      useCustomLogin: false,
      enableDarkMode: false,
    }
  } as ThemeConfig;

  const getValue = (key: keyof ThemeConfig): any => draft[key] !== undefined ? draft[key] : activeTheme[key];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branding & Theme"
        subtitle="Customize the appearance of your platform for all users"
        actions={
          dirty ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setDraft({}); setDirty(false); }}>
                Discard
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                <Save size={14} /> Save Changes
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* Brand Identity Section */}
        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={18} className="text-[#C5A880]" />
            <h2 className="text-base font-bold text-[#F4F4F2]">Brand Identity</h2>
          </div>

          <FormField label="Villa Name">
            <TextInput
              value={getValue('villaName')}
              onChange={(e) => handleChange('villaName', e.target.value)}
              placeholder="e.g., NS Luxury Villa"
            />
          </FormField>

          <FormField label="Tagline">
            <div>
              <TextInput
                value={getValue('villaTagline')}
                onChange={(e) => handleChange('villaTagline', e.target.value)}
                placeholder="e.g., Property Operations"
              />
              <p className="text-[10px] text-[#A0A5AD] mt-1">Displayed under the villa name in headers</p>
            </div>
          </FormField>

          <FormField label="Logo URL">
            <div>
              <TextInput
                type="url"
                value={getValue('logoUrl') || ''}
                onChange={(e) => handleChange('logoUrl', e.target.value || null)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-[10px] text-[#A0A5AD] mt-1">Image URL for your villa logo (preferably square, 200x200px)</p>
            </div>
          </FormField>

          <FormField label="Login Background URL">
            <div>
              <TextInput
                type="url"
                value={getValue('loginBgUrl') || ''}
                onChange={(e) => handleChange('loginBgUrl', e.target.value || null)}
                placeholder="https://example.com/bg.jpg"
              />
              <p className="text-[10px] text-[#A0A5AD] mt-1">Full-screen background image for login page</p>
            </div>
          </FormField>
        </div>

        {/* Color Scheme Section */}
        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-lg p-6 space-y-4">
          <h2 className="text-base font-bold text-[#F4F4F2] mb-4">Color Palette</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorPicker
              label="Primary Color"
              value={getValue('primaryColor')}
              onChange={(val) => handleChange('primaryColor', val)}
              description="Main brand color (buttons, headers, accents)"
            />

            <ColorPicker
              label="Secondary Color"
              value={getValue('secondaryColor')}
              onChange={(val) => handleChange('secondaryColor', val)}
              description="Complementary brand color"
            />

            <ColorPicker
              label="Accent Color"
              value={getValue('accentColor')}
              onChange={(val) => handleChange('accentColor', val)}
              description="Highlights and emphasis elements"
            />

            <ColorPicker
              label="Background Color"
              value={getValue('bgColor')}
              onChange={(val) => handleChange('bgColor', val)}
              description="Main page background"
            />

            <ColorPicker
              label="Text Color"
              value={getValue('textColor')}
              onChange={(val) => handleChange('textColor', val)}
              description="Primary text color"
            />

            <ColorPicker
              label="Muted Text Color"
              value={getValue('textMuted')}
              onChange={(val) => handleChange('textMuted', val)}
              description="Secondary text and hints"
            />

            <ColorPicker
              label="Border Color"
              value={getValue('borderColor')}
              onChange={(val) => handleChange('borderColor', val)}
              description="Dividers and borders"
            />

            <ColorPicker
              label="Success Color"
              value={getValue('successColor')}
              onChange={(val) => handleChange('successColor', val)}
              description="Positive actions and confirmations"
            />

            <ColorPicker
              label="Warning Color"
              value={getValue('warningColor')}
              onChange={(val) => handleChange('warningColor', val)}
              description="Warnings and cautions"
            />

            <ColorPicker
              label="Error Color"
              value={getValue('errorColor')}
              onChange={(val) => handleChange('errorColor', val)}
              description="Errors and destructive actions"
            />

            <ColorPicker
              label="Info Color"
              value={getValue('infoColor')}
              onChange={(val) => handleChange('infoColor', val)}
              description="Information and notifications"
            />
          </div>
        </div>

        {/* Typography Section */}
        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-lg p-6 space-y-4">
          <h2 className="text-base font-bold text-[#F4F4F2] mb-4">Typography</h2>

          <FormField label="Body Font Family">
            <div>
              <TextInput
                value={getValue('fontFamily')}
                onChange={(e) => handleChange('fontFamily', e.target.value)}
                placeholder="system-ui, -apple-system, sans-serif"
              />
              <p className="text-[10px] text-[#A0A5AD] mt-1">Font stack for body text (CSS font-family)</p>
            </div>
          </FormField>

          <FormField label="Heading Font Family">
            <div>
              <TextInput
                value={getValue('headingFont')}
                onChange={(e) => handleChange('headingFont', e.target.value)}
                placeholder="Manrope, sans-serif"
              />
              <p className="text-[10px] text-[#A0A5AD] mt-1">Font stack for headings and titles</p>
            </div>
          </FormField>
        </div>

        {/* Advanced Section */}
        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-lg p-6 space-y-4">
          <h2 className="text-base font-bold text-[#F4F4F2] mb-4">Advanced</h2>

          <FormField label="Custom CSS">
            <div>
              <textarea
                value={getValue('customCss') || ''}
                onChange={(e) => handleChange('customCss', e.target.value || null)}
                placeholder=".my-custom-class { color: red; }"
                className="w-full h-32 p-2 bg-[#14161D] border border-[#2B303E] rounded text-[12px] font-mono text-[#F4F4F2]"
              />
              <p className="text-[10px] text-[#A0A5AD] mt-1">Additional CSS rules to apply globally. Use with caution!</p>
            </div>
          </FormField>

          <div className="space-y-2 border-t border-[#2B303E] pt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={getValue('enableDarkMode') || false}
                onChange={(e) => handleChange('enableDarkMode', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-xs font-medium text-[#F4F4F2]">Enable dark mode option for users</span>
            </label>
          </div>
        </div>

        {/* Reset Section */}
        <div className="bg-[#1C1F28] border border-red-900/40 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-900/20 rounded text-red-400">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F4F4F2]">Reset to Default Theme</h3>
                <p className="text-xs text-[#A0A5AD] mt-1 max-w-xl">
                  Restore all branding and theme settings to their original defaults.
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setResetOpen(true)}
            >
              <RefreshCw size={14} /> Reset
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Theme to Defaults"
        size="md"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="text-xs text-red-700 leading-relaxed">
              This will restore all branding and theme settings to their factory defaults.
              Your customizations will be lost. This action cannot be undone.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleReset}>
              <RefreshCw size={14} /> Reset Theme
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BrandingSettingsPage;
