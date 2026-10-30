// ============================================
// NS LUXURY VILLA — UI Component Library
// PMS Workstation Primitives (Theme-Aware Clear Glass)
// ============================================

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, ChevronLeft, ChevronRight, ArrowRightCircle } from 'lucide-react';

// ──────────────────────────────────────────
// Department Semantic Accent Definition
// ──────────────────────────────────────────
export type QuickLinkCategory =
  | 'booking'
  | 'food'
  | 'pool'
  | 'party'
  | 'checkout'
  | 'settlement'
  | 'bookingReport'
  | 'foodReport'
  | 'poolReport'
  | 'partyReport'
  | 'servicesReport'
  | 'laundryReport'
  | 'expenses'
  | 'inventory';

const quickLinkAccents: Record<QuickLinkCategory, string> = {
  booking: 'var(--ns-gold)',
  food: 'var(--ns-teal)',
  pool: 'var(--ns-success)',
  party: 'var(--ns-info)',
  checkout: 'var(--ns-success)',
  settlement: 'var(--ns-danger)',
  bookingReport: 'var(--ns-ink)',
  foodReport: 'var(--ns-teal)',
  poolReport: 'var(--ns-info)',
  partyReport: 'var(--ns-success)',
  servicesReport: 'var(--ns-teal)',
  laundryReport: 'var(--ns-purple)',
  expenses: 'var(--ns-muted)',
  inventory: 'var(--ns-warning)',
};

// ──────────────────────────────────────────
// Clear Glass Quick Link Tile
// ──────────────────────────────────────────
interface QuickLinkTileProps {
  category: QuickLinkCategory;
  title: string;
  subtitle: string;
  actionText: string;
  watermarkIcon: React.ReactNode;
  onClick: () => void;
}

export const QuickLinkTile: React.FC<QuickLinkTileProps> = ({
  category,
  title,
  subtitle,
  actionText,
  watermarkIcon,
  onClick,
}) => {
  const accent = quickLinkAccents[category] || quickLinkAccents.booking;

  return (
    <div
      onClick={onClick}
      className="glass relative rounded-2xl overflow-hidden shadow-lg cursor-pointer transform hover:-translate-y-1 transition-all duration-200 text-[var(--ns-ink)] select-none border"
      style={{ borderColor: accent }}
    >
      {/* Tile Body */}
      <div className="relative p-5 min-h-[120px] flex flex-col justify-between z-10">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-[var(--ns-ink)] font-['Outfit'] drop-shadow-sm">
            {title}
          </h3>
          <p className="text-xs font-medium text-[var(--ns-muted)] mt-1 leading-snug">
            {subtitle}
          </p>
        </div>

        {/* Large Iconic Watermark Graphic on Right */}
        <div className="absolute right-3 top-3 opacity-25 pointer-events-none transform scale-125" style={{ color: accent }}>
          {watermarkIcon}
        </div>
      </div>

      {/* Bottom Action Strip */}
      <div
        className="ns-glass-band ns-glass-hover px-4 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider border-t border-[var(--ns-glass-line)] transition-colors"
        style={{ color: accent }}
      >
        <span>{actionText}</span>
        <ArrowRightCircle size={15} />
      </div>
    </div>
  );
};

// ──────────────────────────────────────────
// Button (Tactile Claymorphic Clear Glass)
// ──────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variantClasses = {
    primary: 'clay-btn clay-btn-primary',
    secondary: 'clay-btn clay-btn-secondary',
    accent: 'clay-btn clay-btn-accent',
    danger: 'clay-btn clay-btn-danger',
    ghost: 'clay-btn clay-btn-ghost',
    outline: 'clay-btn clay-btn-outline',
  };
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
    md: 'px-4 py-2 text-xs font-medium rounded-md gap-2',
    lg: 'px-5 py-2.5 text-sm font-medium rounded-md gap-2',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
      {children}
    </button>
  );
};

// ──────────────────────────────────────────
// Badge & Status System
// ──────────────────────────────────────────
interface BadgeProps {
  label: string;
  variant?: 'available' | 'reserved' | 'occupied' | 'dirty' | 'cleaning' | 'ready' | 'maintenance' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral' }) => {
  const cls = {
    available: 'bg-transparent text-[var(--ns-success)] border-emerald-500/55',
    reserved: 'bg-transparent text-[var(--ns-warning)] border-amber-500/55',
    occupied: 'bg-transparent text-[var(--ns-danger)] border-rose-500/55',
    dirty: 'bg-transparent text-[var(--ns-warning)] border-amber-600/55',
    cleaning: 'bg-transparent text-[var(--ns-purple)] border-purple-500/55',
    ready: 'bg-transparent text-[var(--ns-teal)] border-teal-500/55',
    maintenance: 'bg-transparent text-[var(--ns-muted)] border-slate-500/55',
    success: 'bg-transparent text-[var(--ns-success)] border-emerald-500/55',
    warning: 'bg-transparent text-[var(--ns-warning)] border-amber-500/55',
    danger: 'bg-transparent text-[var(--ns-danger)] border-rose-500/55',
    info: 'bg-transparent text-[var(--ns-info)] border-sky-500/55',
    neutral: 'bg-transparent text-[var(--ns-muted)] border-slate-400/55',
  };
  return (
    <span className={`glass-subtle clay-badge inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wide border ${cls[variant]}`}>
      {label}
    </span>
  );
};

export const statusBadge = (status: string): React.ReactElement => {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    AVAILABLE: { label: 'Available', variant: 'available' },
    RESERVED: { label: 'Reserved', variant: 'reserved' },
    OCCUPIED: { label: 'Occupied', variant: 'occupied' },
    DIRTY: { label: 'Dirty', variant: 'dirty' },
    CLEANING: { label: 'Cleaning', variant: 'cleaning' },
    READY: { label: 'Ready', variant: 'ready' },
    OUT_OF_SERVICE: { label: 'Out of Service', variant: 'maintenance' },
    MAINTENANCE: { label: 'Maintenance', variant: 'maintenance' },
    ACTIVE: { label: 'Active', variant: 'success' },
    SUSPENDED: { label: 'Suspended', variant: 'warning' },
    DEACTIVATED: { label: 'Deactivated', variant: 'danger' },
    CONFIRMED: { label: 'Confirmed', variant: 'reserved' },
    CHECKED_IN: { label: 'Checked In', variant: 'occupied' },
    CHECKED_OUT: { label: 'Checked Out', variant: 'neutral' },
    CANCELLED: { label: 'Cancelled', variant: 'danger' },
    PAID: { label: 'Paid', variant: 'success' },
    PENDING: { label: 'Pending', variant: 'warning' },
    APPROVED: { label: 'Approved', variant: 'success' },
    REJECTED: { label: 'Rejected', variant: 'danger' },
    PARTIAL: { label: 'Partial', variant: 'info' },
  };
  const cfg = map[status.toUpperCase()] ?? { label: status, variant: 'neutral' };
  return <Badge label={cfg.label} variant={cfg.variant} />;
};

// ──────────────────────────────────────────
// Spinner & Loading State
// ──────────────────────────────────────────
export const Spinner: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="border-2 border-[var(--ns-glass-line)] border-t-[var(--ns-teal)] rounded-full animate-spin"
  />
);

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading workstation data...' }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Spinner size={24} />
    <p className="mt-3 text-xs text-[var(--ns-muted)] font-medium">{message}</p>
  </div>
);

// ──────────────────────────────────────────
// Page Header
// ──────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, badge, actions }) => (
  <header className="workspace-page__header mb-5">
    <div>
      <div className="workspace-page__eyebrow">Property operations</div>
      <div className="mt-1 flex flex-wrap items-center gap-2.5">
        <h1 className="workspace-page__title">{title}</h1>
        {badge && <span className="glass clay-badge rounded-full border border-[var(--ns-teal)]/55 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.12em]" style={{ color: 'var(--ns-teal)' }}>{badge}</span>}
      </div>
      {subtitle && <p className="workspace-page__subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="workspace-page__actions">{actions}</div>}
  </header>
);

// ──────────────────────────────────────────
// Metric Card
// ──────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  indicator?: React.ReactNode;
  accent?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtext, indicator, accent = false }) => (
  <div className={`ns-card glass p-5 ${accent ? 'border-[var(--ns-gold)] ring-1 ring-[var(--ns-gold)]' : ''}`}>
    <div className="flex items-center justify-between"><span className="text-[9px] font-extrabold uppercase tracking-[.15em] text-[var(--ns-muted)]">{label}</span>{indicator && <div className="text-[var(--ns-gold)]">{indicator}</div>}</div>
    <div className={`ns-number mt-3 text-[27px] font-extrabold ${accent ? 'text-[var(--ns-teal)]' : 'text-[var(--ns-ink)]'}`}>{value}</div>
    {subtext && <div className="mt-1 text-[10px] leading-4 text-[var(--ns-muted)]">{subtext}</div>}
  </div>
);

// ──────────────────────────────────────────
// Empty State
// ──────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, action }) => (
  <div className="glass clay-card flex min-h-48 flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--ns-glass-line)] px-5 py-12 text-center">
    {icon && <div className="glass-subtle mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--ns-muted)]">{icon}</div>}
    <h3 className="text-sm font-extrabold text-[var(--ns-ink)]">{title}</h3>
    {subtitle && <p className="mt-1 max-w-sm text-[11px] leading-5 text-[var(--ns-muted)]">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ──────────────────────────────────────────
// Data Table (Clear Glass Surface)
// ──────────────────────────────────────────
interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  keyFn: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyTitle = 'No entries recorded',
  emptySubtitle = 'There are no records matching your operational criteria.',
  keyFn,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="glass clay-card ns-table border border-[var(--ns-glass-line)] rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-[var(--ns-glass-line)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-4 py-3 font-bold text-[11px] uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ns-glass-line)]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={keyFn(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer ns-glass-hover' : 'ns-glass-hover'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-[var(--ns-ink)] ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────
interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, total, onPageChange }) => (
  <div className="glass-subtle flex items-center justify-between mt-4 rounded-2xl border border-[var(--ns-glass-line)] px-3 py-2.5 text-xs text-[var(--ns-muted)]">
    <span>Showing {total.toLocaleString()} total entries</span>
    <div className="flex items-center gap-1.5">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="clay-btn clay-btn-secondary p-1.5 rounded-lg border border-[var(--ns-glass-line)] text-[var(--ns-ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-[var(--ns-ink)] font-bold px-3 text-xs">
        Page {page} of {totalPages || 1}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="clay-btn clay-btn-secondary p-1.5 rounded-lg border border-[var(--ns-glass-line)] text-[var(--ns-ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  </div>
);

// ──────────────────────────────────────────
// Search Input (Zero-Lag Typing + Fast Debounced Query)
// ──────────────────────────────────────────
interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search records...',
  className = 'w-64',
  debounceMs = 200,
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize local input state with external value changes
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newVal: string) => {
    setLocalValue(newVal);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (debounceMs <= 0) {
      onChange(newVal);
    } else {
      debounceTimerRef.current = setTimeout(() => {
        onChange(newVal);
      }, debounceMs);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      onChange(localValue);
    } else if (e.key === 'Escape') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setLocalValue('');
      onChange('');
    }
  };

  const handleClear = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setLocalValue('');
    onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ns-muted)] pointer-events-none" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="ns-input w-full pl-9 pr-8 py-2.5 text-xs font-bold text-[var(--ns-ink)] placeholder:text-[var(--ns-muted)]"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--ns-muted)] hover:text-[var(--ns-ink)] rounded-full ns-glass-hover transition-colors"
          title="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};

// ──────────────────────────────────────────
// Modal & Drawer
// ──────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, subtitle, size = 'md', children, footer }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="ns-scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass-strong my-auto flex max-h-[calc(100dvh-1.5rem)] w-full min-h-0 ${sizes[size]} flex-col rounded-3xl sm:max-h-[calc(100dvh-2rem)] overflow-hidden transition-all shadow-2xl border border-[var(--ns-glass-line)]`}
        style={{ color: 'var(--ns-ink)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4.5 border-b border-[var(--ns-glass-line)] shrink-0 ns-glass-band"
        >
          <div>
            <h2 className="text-base font-bold font-['Manrope']" style={{ color: 'var(--ns-ink)' }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--ns-muted)' }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg ns-glass-hover text-[var(--ns-muted)] hover:text-[var(--ns-ink)] transition"
            aria-label={`Close ${title}`}
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--ns-glass-line)] text-[var(--ns-ink)] shrink-0 ns-glass-band"
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, subtitle, children }) => {
  if (!open) return null;
  return createPortal(
    <div className="ns-scrim fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div
        className="glass-strong w-full max-w-xl border-l border-[var(--ns-glass-line)] h-full flex flex-col"
        style={{ color: 'var(--ns-ink)' }}
      >
        <div
          className="px-6 py-4 border-b border-[var(--ns-glass-line)] flex items-center justify-between shrink-0"
        >
          <div>
            <h2 className="text-base font-bold font-['Manrope']" style={{ color: 'var(--ns-ink)' }}>{title}</h2>
            {subtitle && <p className="text-xs" style={{ color: 'var(--ns-muted)' }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg ns-glass-hover text-[var(--ns-muted)] hover:text-[var(--ns-ink)] transition"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

// ──────────────────────────────────────────
// Form Fields
// ──────────────────────────────────────────
interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, error, required, children }) => (
  <div className="mb-3.5">
    <label className="block text-xs font-extrabold mb-1.5 tracking-tight" style={{ color: 'var(--ns-ink)' }}>
      {label} {required && <span className="text-[var(--ns-danger)]">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-[var(--ns-danger)] mt-1">{error}</p>}
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }> = ({
  error,
  className = '',
  style,
  ...props
}) => (
  <input
    {...props}
    style={{ color: 'var(--ns-ink)', ...style }}
    className={`glass-input w-full border ${
      error ? 'border-red-500' : 'border-[var(--ns-glass-line)]'
    } rounded-[10px] px-3.5 py-2.5 text-xs placeholder:text-[var(--ns-muted)] transition-all ${className}`}
  />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }> = ({
  error,
  className = '',
  children,
  style,
  ...props
}) => (
  <select
    {...props}
    style={{ color: 'var(--ns-ink)', ...style }}
    className={`glass-input w-full border ${
      error ? 'border-red-500' : 'border-[var(--ns-glass-line)]'
    } rounded-[10px] px-3.5 py-2.5 text-xs transition-all ${className}`}
  >
    {children}
  </select>
);

export const TextareaInput: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }> = ({
  error,
  className = '',
  style,
  ...props
}) => (
  <textarea
    {...props}
    style={{ color: 'var(--ns-ink)', ...style }}
    className={`glass-input w-full border ${
      error ? 'border-red-500' : 'border-[var(--ns-glass-line)]'
    } rounded-[10px] px-3.5 py-2.5 text-xs placeholder:text-[var(--ns-muted)] transition-all ${className}`}
  />
);

// ──────────────────────────────────────────
// Toasts
// ──────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

let toastListeners: Array<(t: { id: string; type: ToastType; message: string }) => void> = [];
let toastId = 0;

export function showToast(type: ToastType, message: string) {
  const id = String(++toastId);
  toastListeners.forEach((cb) => cb({ id, type, message }));
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = React.useState<{ id: string; type: ToastType; message: string }[]>([]);

  useEffect(() => {
    const handler = (t: { id: string; type: ToastType; message: string }) => {
      setToasts((prev) => {
        if (prev.some((x) => x.message === t.message)) return prev;
        return [...prev, t];
      });
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter((l) => l !== handler); };
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const toastClasses: Record<ToastType, string> = {
    success: 'text-[var(--ns-success)] border-[var(--ns-success)]',
    error: 'text-[var(--ns-danger)] border-[var(--ns-danger)]',
    warning: 'text-[var(--ns-warning)] border-[var(--ns-warning)]',
    info: 'text-[var(--ns-info)] border-[var(--ns-info)]',
  };

  return (
    <div className="fixed bottom-5 right-5 z-[100] space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass-strong flex items-start gap-3 p-3.5 rounded-lg border text-xs font-medium ${toastClasses[t.type]}`}
        >
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
            t.type === 'success' ? 'bg-[var(--ns-success)]' : t.type === 'error' ? 'bg-[var(--ns-danger)]' : t.type === 'warning' ? 'bg-[var(--ns-warning)]' : 'bg-[var(--ns-info)]'
          }`} />
          <span className="flex-1">{t.message}</span>
          <button onClick={() => remove(t.id)} className="shrink-0" style={{ color: 'var(--ns-muted)' }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
