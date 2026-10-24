import React from 'react';
import { LucideIcon, Search, Plus, RefreshCw, ArrowUpRight } from 'lucide-react';
import { Button, SearchInput, EmptyState, Spinner } from '../ui';

export const ShellPage: React.FC<{
  eyebrow?: string; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode;
}> = ({eyebrow,title,subtitle,actions,children}) => (
  <div className="ns-page space-y-6 pb-12">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#c59a58]">{eyebrow}</div>}
        <h1
          className="mt-1 text-[26px] sm:text-[30px] font-black tracking-tight font-serif"
          style={{ color: 'var(--ns-ink)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-1 max-w-2xl text-[13px] leading-relaxed"
            style={{ color: 'var(--ns-muted)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
    {children}
  </div>
);

export const StatTile: React.FC<{label:string; value:string|number; note?:string; icon?:LucideIcon; accent?:boolean; onClick?:()=>void}> = ({label,value,note,icon:Icon,accent,onClick}) => (
  <div
    className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 ${
      accent
        ? 'border-[#c59a58]/50 shadow-[0_8px_24px_rgba(197,154,88,0.12)]'
        : 'border-[var(--ns-line)] hover:border-[#c59a58]/40 hover:shadow-[0_8px_24px_rgba(20,35,43,0.05)]'
    } ${onClick ? 'cursor-pointer select-none group' : ''}`}
    style={{
      backgroundColor: accent ? undefined : 'var(--ns-surface)',
      backgroundImage: accent ? 'linear-gradient(135deg, rgba(197,154,88,0.15), var(--ns-surface))' : undefined,
    }}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
  >
    <div className="flex items-start justify-between gap-3">
      <span
        className="text-[10px] font-extrabold uppercase tracking-[.18em]"
        style={{ color: 'var(--ns-muted)' }}
      >
        {label}
      </span>
      {Icon && (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors group-hover:bg-[#c59a58]/20 group-hover:text-[#b88738]"
          style={{ backgroundColor: 'var(--ns-surface-2)', color: 'var(--ns-teal)' }}
        >
          <Icon size={16} />
        </span>
      )}
    </div>
    <div
      className="mt-3.5 text-[28px] font-black tracking-tight"
      style={{ color: 'var(--ns-ink)' }}
    >
      {value}
    </div>
    {note && (
      <div
        className="mt-1 text-[11px] font-medium"
        style={{ color: 'var(--ns-muted)' }}
      >
        {note}
      </div>
    )}
    {onClick && (
      <div className="mt-2.5 flex items-center gap-1 text-[10px] font-bold text-[#b88738] opacity-80 transition-opacity group-hover:opacity-100">
        <ArrowUpRight size={11} /> View in table
      </div>
    )}
  </div>
);

export const Section: React.FC<{title:string; subtitle?:string; action?:React.ReactNode; children:React.ReactNode; className?:string}> = ({title,subtitle,action,children,className=''}) => (
  <section
    className={`overflow-hidden rounded-2xl border border-[var(--ns-line)] shadow-sm ${className}`}
    style={{ backgroundColor: 'var(--ns-surface)' }}
  >
    <div
      className="flex flex-col gap-2 border-b border-[var(--ns-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ backgroundColor: 'var(--ns-surface-2)' }}
    >
      <div>
        <h2 className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--ns-ink)' }}>{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--ns-muted)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const Toolbar: React.FC<{search?:string; onSearch?:(v:string)=>void; placeholder?:string; children?:React.ReactNode}> = ({search,onSearch,placeholder='Search…',children}) => (
  <div
    className="flex flex-col gap-2.5 border-b border-[var(--ns-line)] p-4 sm:flex-row sm:items-center"
    style={{ backgroundColor: 'var(--ns-surface-2)' }}
  >
    {onSearch !== undefined && <SearchInput value={search||''} onChange={onSearch} placeholder={placeholder} className="w-full sm:w-80" />}
    <div className="flex flex-wrap gap-2 sm:ml-auto">{children}</div>
  </div>
);

export const TableFrame: React.FC<{children:React.ReactNode}> = ({children}) => <div className="overflow-x-auto">{children}</div>;

export const EmptyTable: React.FC<{title:string; subtitle:string; action?:React.ReactNode}> = ({title,subtitle,action}) => (
  <EmptyState title={title} subtitle={subtitle} action={action}/>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({className='',children,...props}) => (
  <button
    {...props}
    className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--ns-line)] transition hover:border-[#c59a58]/50 hover:bg-[var(--ns-surface-2)] ${className}`}
    style={{ backgroundColor: 'var(--ns-surface)', color: 'var(--ns-ink)' }}
  >
    {children}
  </button>
);
