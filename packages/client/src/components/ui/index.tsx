// ============================================
// NS LUXURY VILLA — UI Component Library
// PMS Workstation Primitives (Light Theme + Solid Vibrant Quick Link Tiles)
// ============================================

import React, { useEffect, useRef } from 'react';
import { X, Search, ChevronLeft, ChevronRight, ArrowRightCircle } from 'lucide-react';

// ──────────────────────────────────────────
// Department Solid Tile Color Definition
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

const quickLinkStyles: Record<
  QuickLinkCategory,
  {
    bg: string;
    actionBg: string;
  }
> = {
  booking: {
    bg: 'bg-gradient-to-br from-[#F39C12] to-[#E67E22]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  food: {
    bg: 'bg-gradient-to-br from-[#00B4D8] to-[#0096C7]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  pool: {
    bg: 'bg-gradient-to-br from-[#10B981] to-[#059669]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  party: {
    bg: 'bg-gradient-to-br from-[#0077B6] to-[#023E8A]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  checkout: {
    bg: 'bg-gradient-to-br from-[#10B981] to-[#047857]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  settlement: {
    bg: 'bg-gradient-to-br from-[#E74C3C] to-[#C0392B]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  bookingReport: {
    bg: 'bg-gradient-to-br from-[#34495E] to-[#2C3E50]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  foodReport: {
    bg: 'bg-gradient-to-br from-[#00B4D8] to-[#0077B6]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  poolReport: {
    bg: 'bg-gradient-to-br from-[#2980B9] to-[#1F618D]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  partyReport: {
    bg: 'bg-gradient-to-br from-[#27AE60] to-[#1E8449]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  servicesReport: {
    bg: 'bg-gradient-to-br from-[#16A085] to-[#117A65]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  laundryReport: {
    bg: 'bg-gradient-to-br from-[#8E44AD] to-[#71368A]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  expenses: {
    bg: 'bg-gradient-to-br from-[#5D6D7E] to-[#34495E]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
  inventory: {
    bg: 'bg-gradient-to-br from-[#D35400] to-[#A04000]',
    actionBg: 'bg-black/15 hover:bg-black/25',
  },
};

// ──────────────────────────────────────────
// Vibrant Solid Quick Link Tile (Matching Reference Image)
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
  const style = quickLinkStyles[category] || quickLinkStyles.booking;

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden shadow-lg cursor-pointer transform hover:-translate-y-1 transition-all duration-200 text-white select-none ${style.bg}`}
    >
      {/* Tile Body */}
      <div className="relative p-5 min-h-[120px] flex flex-col justify-between z-10">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-white font-['Outfit'] drop-shadow-sm">
            {title}
          </h3>
          <p className="text-xs font-medium text-white/90 mt-1 leading-snug">
            {subtitle}
          </p>
        </div>

        {/* Large Iconic Watermark Graphic on Right */}
        <div className="absolute right-3 top-3 opacity-25 pointer-events-none transform scale-125 text-white">
          {watermarkIcon}
        </div>
      </div>

      {/* Bottom Action Strip */}
      <div
        className={`px-4 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white border-t border-white/10 transition-colors ${style.actionBg}`}
      >
        <span>{actionText}</span>
        <ArrowRightCircle size={15} />
      </div>
    </div>
  );
};

// ──────────────────────────────────────────
// Button (Light Theme)
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
    primary: 'bg-[#174B59] hover:bg-[#0E3440] text-white font-semibold shadow-[0_6px_16px_rgba(23,75,89,.14)]',
    secondary: 'bg-[#F4F6F4] hover:bg-[#E9ECE9] text-[#27383F] border border-[#DDE2DE]',
    accent: 'bg-[#B18A55] hover:bg-[#9B7648] text-white font-semibold shadow-[0_6px_16px_rgba(177,138,85,.16)]',
    danger: 'bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm',
    ghost: 'bg-transparent hover:bg-black/5 text-[#4A5568] hover:text-[#1A202C]',
    outline: 'bg-white hover:bg-[#F7F8F6] text-[#27383F] border border-[#DDE2DE]',
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
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
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
    available: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    reserved: 'bg-blue-100 text-blue-800 border-blue-300',
    occupied: 'bg-rose-100 text-rose-800 border-rose-300',
    dirty: 'bg-amber-100 text-amber-800 border-amber-300',
    cleaning: 'bg-purple-100 text-purple-800 border-purple-300',
    ready: 'bg-teal-100 text-teal-800 border-teal-300',
    maintenance: 'bg-gray-100 text-gray-800 border-gray-300',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    warning: 'bg-amber-100 text-amber-800 border-amber-300',
    danger: 'bg-red-100 text-red-800 border-red-300',
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    neutral: 'bg-slate-100 text-slate-700 border-slate-300',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide border ${cls[variant]}`}>
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
    className="border-2 border-slate-200 border-t-[#1B4965] rounded-full animate-spin"
  />
);

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading workstation data...' }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Spinner size={24} />
    <p className="mt-3 text-xs text-[#718096] font-medium">{message}</p>
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
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <div className="ns-eyebrow">NSVilla operations</div>
      <div className="mt-1 flex items-center gap-3">
        <h1 className="font-[Manrope] text-[26px] font-extrabold tracking-[-0.04em] text-[#14232B]">{title}</h1>
        {badge && <span className="rounded-full border border-[#e7dccb] bg-[#f7f0e5] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#a8761e]">{badge}</span>}
      </div>
      {subtitle && <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#7a858a]">{subtitle}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
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
  <div className={`ns-card p-5 ${accent ? 'border-[#f1a83f]/45 ring-1 ring-[#f1a83f]/15' : ''}`}>
    <div className="flex items-center justify-between"><span className="text-[9px] font-extrabold uppercase tracking-[.15em] text-[#849095]">{label}</span>{indicator && <div className="text-[#a8761e]">{indicator}</div>}</div>
    <div className={`ns-number mt-3 text-[27px] font-extrabold ${accent ? 'text-[#16a4d4]' : 'text-[#14232b]'}`}>{value}</div>
    {subtext && <div className="mt-1 text-[10px] leading-4 text-[#8b9599]">{subtext}</div>}
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
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dfe4e0] bg-[#fbfcfa] px-5 py-12 text-center">
    {icon && <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2f5f2] text-[#718086]">{icon}</div>}
    <h3 className="text-sm font-extrabold text-[#26363e]">{title}</h3>
    {subtitle && <p className="mt-1 max-w-sm text-[11px] leading-5 text-[#899397]">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ──────────────────────────────────────────
// Data Table (Clean Light Surface)
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
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-[#4A5568]">
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
          <tbody className="divide-y divide-slate-200">
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
                    onRowClick ? 'cursor-pointer hover:bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-[#2D3748] ${
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
  <div className="flex items-center justify-between mt-4 text-xs text-[#718096]">
    <span>Showing {total.toLocaleString()} total entries</span>
    <div className="flex items-center gap-1.5">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="p-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-[#2D3748] font-bold px-3 text-xs">
        Page {page} of {totalPages || 1}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="p-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="ns-input w-full pl-9 pr-8 py-2.5 text-xs text-[#2D3748] placeholder-slate-400"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
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
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, size = 'md', children }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-xs sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`my-auto flex max-h-[calc(100dvh-1.5rem)] w-full min-h-0 ${sizes[size]} flex-col rounded-xl border border-slate-300 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-slate-50">
          <h2 className="text-base font-bold text-[#1A202C] font-['Outfit']">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-500" aria-label={`Close ${title}`}>
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">{children}</div>
      </div>
    </div>
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
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 flex justify-end">
      <div className="w-full max-w-xl bg-white border-l border-slate-300 h-full flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#1A202C] font-['Outfit']">{title}</h2>
            {subtitle && <p className="text-xs text-[#718096]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-500">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
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
  <div className="mb-4">
    <label className="block text-xs font-bold text-[#4A5568] mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }> = ({
  error,
  className = '',
  ...props
}) => (
  <input
    {...props}
    className={`w-full bg-white border ${
      error ? 'border-red-500' : 'border-slate-300'
    } rounded-[10px] px-3 py-2.5 text-xs text-[#1A202C] placeholder-slate-400 focus:outline-none focus:border-[#B18A55] focus:ring-2 focus:ring-[#B18A55]/10 transition-all ${className}`}
  />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }> = ({
  error,
  className = '',
  children,
  ...props
}) => (
  <select
    {...props}
    className={`w-full bg-white border ${
      error ? 'border-red-500' : 'border-slate-300'
    } rounded-[10px] px-3 py-2.5 text-xs text-[#1A202C] focus:outline-none focus:border-[#B18A55] focus:ring-2 focus:ring-[#B18A55]/10 transition-all ${className}`}
  >
    {children}
  </select>
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

  return (
    <div className="fixed bottom-5 right-5 z-[100] space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-3 p-3.5 rounded-lg bg-white border border-slate-200 shadow-xl text-xs font-medium"
        >
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
            t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`} />
          <span className="flex-1 text-slate-800">{t.message}</span>
          <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
