import React from 'react';
import { LucideIcon, ArrowUpRight, X } from 'lucide-react';
import { SearchInput, EmptyState } from '../ui';

export const ShellPage: React.FC<{
  eyebrow?: string; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode;
}> = ({eyebrow,title,subtitle,actions,children}) => (
  <div className="ns-page workspace-page relative space-y-5 pb-12">
    <header className="workspace-page__header">
      <div className="min-w-0">
        {eyebrow && <div className="workspace-page__eyebrow">{eyebrow}</div>}
        <h1 className="workspace-page__title">{title}</h1>
        {subtitle && <p className="workspace-page__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="workspace-page__actions">{actions}</div>}
    </header>
    {children}
  </div>
);

// ──────────────────────────────────────────
// Compact Header (44px top bar)
// ──────────────────────────────────────────
export const CompactHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, subtitle, actions, children }) => (
  <div className="ns-page workspace-page">
    <div className="workspace-page__header mb-4">
      <div className="flex items-center gap-3">
        <h1 className="workspace-page__title text-lg">{title}</h1>
        {subtitle && <span className="workspace-page__subtitle m-0 text-xs">{subtitle}</span>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {children}
  </div>
);

// ──────────────────────────────────────────
// KPI Ribbon (compact metric pills)
// ──────────────────────────────────────────
export const KpiRibbon: React.FC<{
  items: Array<{ label: string; value: string | number; accent?: string; onClick?: () => void }>;
}> = ({ items }) => (
  <div className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-3 overflow-x-auto pb-2 mb-4 sm:auto-cols-fr sm:grid-flow-row sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
    {items.map((item, i) => (
      <button
        key={i}
        onClick={item.onClick}
        className={`glass-subtle clay-card min-h-[82px] rounded-2xl px-4 py-3 text-left border border-[var(--ns-glass-line)] transition-all hover:border-[var(--ns-teal)] ${
          item.onClick ? 'cursor-pointer' : ''
        }`}
      >
        <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>
          {item.label}
        </div>
        <div className="text-2xl font-black mt-0.5" style={{ color: item.accent || 'var(--ns-ink)' }}>
          {item.value}
        </div>
      </button>
    ))}
  </div>
);

// ──────────────────────────────────────────
// Summary Strip (horizontal glass band with metrics)
// ──────────────────────────────────────────
export const SummaryStrip: React.FC<{
  items: Array<{ label: string; value: string | number; color?: string }>;
}> = ({ items }) => (
  <div className="ns-glass-band rounded-3xl border border-[var(--ns-glass-line)] px-5 py-3.5 mb-4 grid grid-flow-col auto-cols-max items-center gap-x-6 gap-y-2 overflow-x-auto sm:grid-flow-row sm:grid-cols-2 lg:grid-cols-4">
    {items.map((item, i) => (
      <div key={i} className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>
          {item.label}
        </span>
        <span className="text-xl font-black" style={{ color: item.color || 'var(--ns-ink)' }}>
          {item.value}
        </span>
      </div>
    ))}
  </div>
);

// ──────────────────────────────────────────
// Split Layout (two-column)
// ──────────────────────────────────────────
export const SplitLayout: React.FC<{
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: string;
  gap?: string;
}> = ({ left, right, leftWidth = 'lg:w-2/3', gap = 'gap-6' }) => (
  <div className={`flex flex-col lg:flex-row ${gap}`}>
    <div className={`${leftWidth} w-full min-w-0`}>{left}</div>
    <div className="flex-1 min-w-0">{right}</div>
  </div>
);

// ──────────────────────────────────────────
// Filter Sidebar (left panel)
// ──────────────────────────────────────────
export const FilterSidebar: React.FC<{
  children: React.ReactNode;
  width?: string;
}> = ({ children, width = 'w-80' }) => (
  <div className={`${width} w-full shrink-0 glass clay-card rounded-3xl border border-[var(--ns-glass-line)] p-4 h-fit lg:sticky lg:top-4`}>
    {children}
  </div>
);

// ──────────────────────────────────────────
// Detail Drawer (right-sliding panel)
// ──────────────────────────────────────────
export const DetailDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}> = ({ open, onClose, title, children, width = 'max-w-md' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="ns-scrim absolute inset-0" onClick={onClose} />
      <div className={`glass-strong clay-card relative ${width} w-full h-full border-l border-[var(--ns-glass-line)] flex flex-col`}>
        <div className="ns-glass-band flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3">
          <h2 className="text-base font-bold" style={{ color: 'var(--ns-ink)' }}>{title}</h2>
          <button onClick={onClose} className="clay-btn clay-btn-secondary rounded-lg p-1.5">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────
// Segmented Tabs (glass pill toggle)
// ──────────────────────────────────────────
export const SegmentedTabs: React.FC<{
  tabs: Array<{ label: string; value: string }>;
  active: string;
  onChange: (value: string) => void;
}> = ({ tabs, active, onChange }) => (
  <div className="flex max-w-full gap-1 overflow-x-auto p-1.5 glass-subtle rounded-2xl border border-[var(--ns-glass-line)] w-fit">
    {tabs.map((tab) => (
      <button
        key={tab.value}
        onClick={() => onChange(tab.value)}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
          active === tab.value
            ? 'glass text-[var(--ns-ink)] shadow-xs'
            : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)]'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

// ──────────────────────────────────────────
// Bento Grid (asymmetric tile grid)
// ──────────────────────────────────────────
export const BentoGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-min">
    {children}
  </div>
);

export const BentoTile: React.FC<{
  size?: 'small' | 'medium' | 'large' | 'full';
  children: React.ReactNode;
  className?: string;
}> = ({ size = 'small', children, className = '' }) => {
  const sizeClasses = {
    small: 'col-span-1',
    medium: 'md:col-span-2',
    large: 'md:col-span-2 lg:col-span-2 row-span-2',
    full: 'col-span-full',
  };
  return (
    <div className={`glass rounded-2xl border border-[var(--ns-glass-line)] p-5 ${sizeClasses[size]} ${className}`}>
      {children}
    </div>
  );
};

// ──────────────────────────────────────────
// Settings Rail (left vertical tab navigation)
// ──────────────────────────────────────────
export const SettingsRail: React.FC<{
  tabs: Array<{ label: string; value: string; icon?: LucideIcon }>;
  active: string;
  onChange: (value: string) => void;
}> = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 flex-col glass-subtle rounded-2xl border border-[var(--ns-glass-line)] p-2 w-56 shrink-0">
    {tabs.map((tab) => {
      const Icon = tab.icon;
      return (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
            active === tab.value
              ? 'glass text-[var(--ns-ink)] shadow-xs'
              : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)] hover:bg-white/5'
          }`}
        >
          {Icon && <Icon size={15} />}
          {tab.label}
        </button>
      );
    })}
  </div>
);

// ──────────────────────────────────────────
// Compact Stat (small metric for ribbons)
// ──────────────────────────────────────────
export const CompactStat: React.FC<{
  label: string;
  value: string | number;
  color?: string;
}> = ({ label, value, color }) => (
  <div className="text-center">
    <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>
      {label}
    </div>
    <div className="text-xl font-black mt-0.5" style={{ color: color || 'var(--ns-ink)' }}>
      {value}
    </div>
  </div>
);

// ──────────────────────────────────────────
// Stat Tile (metric card)
// ──────────────────────────────────────────
export const StatTile: React.FC<{
  label: string;
  value: string | number;
  note?: string;
  icon?: LucideIcon;
  accent?: boolean;
  onClick?: () => void;
}> = ({ label, value, note, icon: Icon, accent, onClick }) => (
  <div
    className={`glass group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 ${
      accent ? 'border-[var(--ns-gold)] ring-1 ring-[var(--ns-gold)]/40' : ''
    } ${onClick ? 'cursor-pointer select-none hover:-translate-y-1' : ''}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
  >
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: 'var(--ns-muted)' }}>
        {label}
      </span>
      {Icon && (
        <span className="glass-subtle clay-badge flex h-9 w-9 items-center justify-center rounded-xl transition-colors group-hover:text-[var(--ns-teal)] border border-[var(--ns-glass-line)]" style={{ color: 'var(--ns-teal)' }}>
          <Icon size={16} />
        </span>
      )}
    </div>
    <div className="mt-3.5 text-[28px] font-black tracking-tight ns-number" style={{ color: 'var(--ns-ink)' }}>
      {value}
    </div>
    {note && (
      <div className="mt-1 text-[11px] font-bold" style={{ color: 'var(--ns-muted)' }}>
        {note}
      </div>
    )}
    {onClick && (
      <div className="mt-2.5 flex items-center gap-1 text-[11px] font-extrabold text-[var(--ns-teal)] opacity-90 transition-opacity group-hover:opacity-100">
        <ArrowUpRight size={13} /> View in table
      </div>
    )}
  </div>
);

// ──────────────────────────────────────────
// Section (glass card with header)
// ──────────────────────────────────────────
export const Section: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`glass overflow-hidden rounded-2xl ${className}`}>
    <div className="ns-glass-band flex flex-col gap-2 border-b border-[var(--ns-glass-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-[15px] font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12px] font-semibold" style={{ color: 'var(--ns-muted)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

// ──────────────────────────────────────────
// Toolbar (search + filters bar)
// ──────────────────────────────────────────
export const Toolbar: React.FC<{
  search?: string;
  onSearch?: (v: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
}> = ({ search, onSearch, placeholder = 'Search…', children }) => (
  <div className="ns-glass-band flex flex-col gap-2.5 border-b border-[var(--ns-glass-line)] p-4 sm:flex-row sm:items-center">
    {onSearch !== undefined && <SearchInput value={search || ''} onChange={onSearch} placeholder={placeholder} className="w-full sm:w-80" />}
    <div className="flex flex-wrap gap-2 sm:ml-auto">{children}</div>
  </div>
);

// ──────────────────────────────────────────
// Table Frame & Empty Table
// ──────────────────────────────────────────
export const TableFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-x-auto">{children}</div>
);

export const EmptyTable: React.FC<{
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <EmptyState title={title} subtitle={subtitle} action={action} />
);

// ──────────────────────────────────────────
// Icon Button
// ──────────────────────────────────────────
export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <button
    {...props}
    className={`clay-btn clay-btn-secondary flex h-9 w-9 items-center justify-center rounded-xl transition ${className}`}
    style={{ color: 'var(--ns-ink)' }}
  >
    {children}
  </button>
);
