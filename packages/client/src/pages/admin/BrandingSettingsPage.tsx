import React, { useEffect, useState } from 'react';
import { Palette, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { PageHeader, Button, FormField, TextInput, SelectInput, showToast, Modal } from '../../components/ui';
import { useThemeStore } from '../../stores/themeStore';
import type { ThemeConfig } from '../../services/apiService';

const fontOptions = [
  'system-ui, -apple-system, sans-serif',
  'Inter, sans-serif',
  'Manrope, sans-serif',
  'DM Sans, sans-serif',
  'Poppins, sans-serif',
  'Montserrat, sans-serif',
  'Lato, sans-serif',
  'Open Sans, sans-serif',
  'Roboto, sans-serif',
  'Helvetica Neue, Helvetica, Arial, sans-serif',
  'Arial, sans-serif',
  'Verdana, sans-serif',
  'Tahoma, sans-serif',
  'Trebuchet MS, sans-serif',
  'Segoe UI, sans-serif',
  'Calibri, sans-serif',
  'Candara, sans-serif',
  'Gill Sans, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  '"Times New Roman", serif',
  'Garamond, serif',
  'Palatino Linotype, serif',
  'Book Antiqua, serif',
  'Baskerville, serif',
  'Cambria, serif',
  'Georgia, serif',
  'Courier New, monospace',
  'Lucida Console, monospace',
  'Consolas, monospace',
  'Monaco, monospace',
  'Trebuchet MS, sans-serif',
  'Impact, sans-serif',
];

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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, key: 'logoUrl' | 'loginBgUrl') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      handleChange(key, result || null);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!dirty || Object.keys(draft).length === 0) return;
    setSaving(true);
    try {
      await updateTheme(draft);
      showToast('success', 'Branding updated successfully.');
      setDraft({});
      setDirty(false);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to save branding.';
      console.error('[BrandingSettingsPage] Save error:', errMsg, error);
      showToast('error', errMsg);
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

  const activeTheme = theme ?? ({
    villaName: 'NS Luxury Villa',
    villaTagline: 'Property Operations',
    primaryColor: '#16a4d4',
    secondaryColor: '#f1a83f',
    accentColor: '#1cecd4',
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
  } as ThemeConfig);

  const getValue = (key: keyof ThemeConfig): any => draft[key] !== undefined ? draft[key] : activeTheme[key];

  const logoValue = getValue('logoUrl') || '';
  const loginBgValue = getValue('loginBgUrl') || '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branding & Theme"
        subtitle="Customize your villa identity and brand colors"
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
        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Palette size={18} className="text-[#f1a83f]" />
            <h2 className="text-base font-bold text-[#F4F4F2]">Brand identity</h2>
          </div>

          <FormField label="Villa Name">
            <TextInput
              value={getValue('villaName')}
              onChange={(e) => handleChange('villaName', e.target.value)}
              placeholder="NS Luxury Villa"
            />
          </FormField>

          <FormField label="Tagline">
            <TextInput
              value={getValue('villaTagline')}
              onChange={(e) => handleChange('villaTagline', e.target.value)}
              placeholder="Property Operations"
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded border border-[#2B303E] bg-[#14161D] p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A0A5AD]">
                Logo image
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'logoUrl')}
                className="block w-full text-[11px] text-[#5b6672] file:mr-3 file:rounded file:border-0 file:bg-[#f1a83f] file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-[#17232B]"
              />
              <div className="mt-3 flex h-20 items-center justify-center overflow-hidden rounded border border-dashed border-[#2B303E] bg-[#0E1117]">
                {logoValue ? (
                  <img src={logoValue} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-[#7E8692]">No logo uploaded</span>
                )}
              </div>
            </div>

            <div className="rounded border border-[#2B303E] bg-[#14161D] p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A0A5AD]">
                Login background
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'loginBgUrl')}
                className="block w-full text-[11px] text-[#5b6672] file:mr-3 file:rounded file:border-0 file:bg-[#f1a83f] file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-[#17232B]"
              />
              <div className="mt-3 flex h-20 items-center justify-center overflow-hidden rounded border border-dashed border-[#2B303E] bg-[#0E1117]">
                {loginBgValue ? (
                  <img src={loginBgValue} alt="Login background preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-[#7E8692]">No background uploaded</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-lg p-6 space-y-4">
          <h2 className="text-base font-bold text-[#F4F4F2]">Typography</h2>

          <FormField label="Body font">
            <SelectInput
              value={getValue('fontFamily')}
              onChange={(e) => handleChange('fontFamily', e.target.value)}
            >
              {fontOptions.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="Heading font">
            <SelectInput
              value={getValue('headingFont')}
              onChange={(e) => handleChange('headingFont', e.target.value)}
            >
              {fontOptions.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        <div className="bg-[#1C1F28] border border-[#2B303E] rounded-lg p-6 space-y-4">
          <h2 className="text-base font-bold text-[#F4F4F2]">Display</h2>

          <label className="flex items-center justify-between gap-3 rounded border border-[#2B303E] bg-[#14161D] p-3">
            <span className="text-sm text-[#F4F4F2]">Enable dark mode</span>
            <input
              type="checkbox"
              checked={Boolean(getValue('enableDarkMode'))}
              onChange={(e) => handleChange('enableDarkMode', e.target.checked)}
              className="h-4 w-4 rounded accent-[#f1a83f]"
            />
          </label>
        </div>

        <div className="bg-[#1C1F28] border border-red-900/40 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-900/20 rounded text-red-400">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F4F4F2]">Reset to default branding</h3>
                <p className="text-xs text-[#A0A5AD] mt-1">
                  Restore the original default theme and branding values.
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
              <RefreshCw size={14} /> Reset
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset branding"
        size="md"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="text-xs text-red-700 leading-relaxed">
              This will restore the default branding theme. Your custom logo, background, and colors will be removed.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleReset}>
              <RefreshCw size={14} /> Reset theme
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BrandingSettingsPage;
