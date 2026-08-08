// ============================================
// NS LUXURY VILLA — Reusable UI Components
// Buttons, Badges, Modals, Table, Toast, Spinner
// ============================================

import React, { useEffect, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// ──────────────────────────────────────────
// Button
// ──────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', loading = false, children, className = '', disabled, ...props
}) => {
  const variantClasses = {
    primary: 'bg-[#8C2D19] hover:bg-[#732212] text-white border-transparent',
    secondary: 'bg-[#C49A45] hover:bg-[#AA8233] text-[#0F141C] font-semibold border-transparent',
    danger: 'bg-[#EF4444] hover:bg-[#DC2626] text-white border-transparent',
    ghost: 'bg-transparent hover:bg-[#1C2536] text-[#9CA3AF] hover:text-[#F3F4F6] border-transparent',
    outline: 'bg-transparent hover:bg-[#1C2536] text-[#F3F4F6] border-[#2D3748] hover:border-[#4B5563]',
  };
  const sizeClasses = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-sm' };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#C49A45]/30 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
};

// ──────────────────────────────────────────
// Status Badge
// ──────────────────────────────────────────
interface BadgeProps { label: string; variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; }

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral' }) => {
  const cls = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    neutral: 'bg-[#1C2536] text-[#9CA3AF] border-[#2D3748]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls[variant]}`}>
      {label}
    </span>
  );
};

export const statusBadge = (status: string): React.ReactElement => {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
    ACTIVE: { label: 'Active', variant: 'success' },
    SUSPENDED: { label: 'Suspended', variant: 'warning' },
    DEACTIVATED: { label: 'Deactivated', variant: 'danger' },
  };
  const cfg = map[status] ?? { label: status, variant: 'neutral' };
  return <Badge label={cfg.label} variant={cfg.variant} />;
};

// ──────────────────────────────────────────
// Spinner
// ──────────────────────────────────────────
export const Spinner: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="border-2 border-[#2D3748] border-t-[#C49A45] rounded-full animate-spin"
  />
);

// ──────────────────────────────────────────
// Modal
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
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`w-full ${sizes[size]} bg-[#1C2536] border border-[#2D3748] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between p-5 border-b border-[#2D3748] shrink-0">
          <h2 className="text-sm font-bold text-[#F3F4F6] font-['Outfit'] uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#242F44] rounded-lg text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────
// Toast Notification
// ──────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastProps { type: ToastType; message: string; onClose: () => void; }

export const Toast: React.FC<ToastProps> = ({ type, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const cfg = {
    success: { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />, text: 'text-emerald-400' },
    error: { bg: 'bg-red-500/10 border-red-500/30', icon: <AlertCircle size={16} className="text-red-400 shrink-0" />, text: 'text-red-400' },
    warning: { bg: 'bg-amber-500/10 border-amber-500/30', icon: <AlertTriangle size={16} className="text-amber-400 shrink-0" />, text: 'text-amber-400' },
    info: { bg: 'bg-blue-500/10 border-blue-500/30', icon: <Info size={16} className="text-blue-400 shrink-0" />, text: 'text-blue-400' },
  }[type];

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm ${cfg.bg}`}>
      {cfg.icon}
      <span className="text-[#F3F4F6] text-xs leading-relaxed">{message}</span>
      <button onClick={onClose} className="ml-auto text-[#6B7280] hover:text-[#9CA3AF]"><X size={14} /></button>
    </div>
  );
};

// ──────────────────────────────────────────
// Toast Container Store (simple state)
// ──────────────────────────────────────────
let toastListeners: Array<(t: { id: string; type: ToastType; message: string }) => void> = [];
let toastId = 0;

export function showToast(type: ToastType, message: string) {
  const id = String(++toastId);
  toastListeners.forEach((cb) => cb({ id, type, message }));
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = React.useState<{ id: string; type: ToastType; message: string }[]>([]);

  useEffect(() => {
    const handler = (t: { id: string; type: ToastType; message: string }) =>
      setToasts((prev) => [...prev, t]);
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter((l) => l !== handler); };
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-6 right-6 z-[100] space-y-3 min-w-[300px] max-w-sm">
      {toasts.map((t) => (
        <Toast key={t.id} type={t.type} message={t.message} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
};

// ──────────────────────────────────────────
// Page Header
// ──────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between mb-6">
    <div>
      <h1 className="text-xl font-bold text-[#F3F4F6] font-['Outfit'] tracking-wide">{title}</h1>
      {subtitle && <p className="text-xs text-[#9CA3AF] mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
  </div>
);

// ──────────────────────────────────────────
// Empty State
// ──────────────────────────────────────────
interface EmptyStateProps { icon?: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode; }

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {icon && <div className="mb-4 p-4 bg-[#1C2536] border border-[#2D3748] rounded-2xl text-[#6B7280]">{icon}</div>}
    <h3 className="text-sm font-semibold text-[#9CA3AF]">{title}</h3>
    {subtitle && <p className="text-xs text-[#6B7280] mt-1 max-w-xs">{subtitle}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ──────────────────────────────────────────
// Data Table
// ──────────────────────────────────────────
interface Column<T> { key: string; header: string; render: (row: T) => React.ReactNode; width?: string; }
interface DataTableProps<T> { columns: Column<T>[]; data: T[]; loading?: boolean; emptyMessage?: string; keyFn: (row: T) => string; }

export function DataTable<T>({ columns, data, loading, emptyMessage = 'No records found.', keyFn }: DataTableProps<T>) {
  return (
    <div className="bg-[#1C2536] border border-[#2D3748] rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#2D3748] bg-[#151C28]">
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}
                className="px-4 py-3 text-left font-semibold text-[#9CA3AF] uppercase tracking-wider">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center"><Spinner /></td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-[#6B7280]">{emptyMessage}</td></tr>
          ) : (
            data.map((row) => (
              <tr key={keyFn(row)} className="border-b border-[#232D3F] hover:bg-[#242F44] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-[#F3F4F6]">{col.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────
interface PaginationProps { page: number; totalPages: number; total: number; onPageChange: (p: number) => void; }

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, total, onPageChange }) => (
  <div className="flex items-center justify-between mt-4 text-xs text-[#9CA3AF]">
    <span>{total} total records</span>
    <div className="flex items-center gap-2">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
        className="px-3 py-1.5 rounded-lg border border-[#2D3748] hover:bg-[#1C2536] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        Previous
      </button>
      <span className="text-[#F3F4F6] font-medium">Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
        className="px-3 py-1.5 rounded-lg border border-[#2D3748] hover:bg-[#1C2536] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        Next
      </button>
    </div>
  </div>
);

// ──────────────────────────────────────────
// Search Input
// ──────────────────────────────────────────
import { Search } from 'lucide-react';
interface SearchInputProps { value: string; onChange: (v: string) => void; placeholder?: string; }

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = 'Search...' }) => (
  <div className="relative">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="pl-9 pr-4 py-2 bg-[#121824] border border-[#2D3748] rounded-lg text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#C49A45] transition-colors w-64"
    />
  </div>
);

// ──────────────────────────────────────────
// Form Field Wrapper
// ──────────────────────────────────────────
interface FormFieldProps { label: string; error?: string; required?: boolean; children: React.ReactNode; }

export const FormField: React.FC<FormFieldProps> = ({ label, error, required, children }) => (
  <div className="mb-4">
    <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
      {label} {required && <span className="text-[#EF4444]">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
  </div>
);

// ──────────────────────────────────────────
// Text Input (standard)
// ──────────────────────────────────────────
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> { error?: boolean; }

export const TextInput: React.FC<TextInputProps> = ({ error, className = '', ...props }) => (
  <input
    {...props}
    className={`w-full bg-[#121824] border ${error ? 'border-[#EF4444]' : 'border-[#2D3748]'} rounded-lg px-3 py-2 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#C49A45] transition-colors ${className}`}
  />
);
