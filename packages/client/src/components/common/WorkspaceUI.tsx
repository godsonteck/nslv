import React from 'react';
import { LucideIcon, Search, Plus, RefreshCw, ArrowUpRight } from 'lucide-react';
import { Button, SearchInput, EmptyState, Spinner } from '../ui';

export const ShellPage: React.FC<{
  eyebrow?: string; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode;
}> = ({eyebrow='NSVILLA OPERATIONS',title,subtitle,actions,children}) => (
  <div className="ns-page space-y-6 pb-10">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="ns-eyebrow">{eyebrow}</div>
        <h1 className="mt-1 text-[30px] font-extrabold tracking-[-.045em] text-[#14232b]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#7a858a]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
    {children}
  </div>
);

export const StatTile: React.FC<{label:string; value:string|number; note?:string; icon?:LucideIcon; accent?:boolean}> = ({label,value,note,icon:Icon,accent}) => (
  <div className={`ns-card p-5 ${accent?'ring-1 ring-[#b18a55]/25':''}`}>
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#8a9598]">{label}</span>
      {Icon && <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f0e8] text-[#9b7648]"><Icon size={16}/></span>}
    </div>
    <div className="ns-number mt-4 text-[29px] font-extrabold text-[#14232b]">{value}</div>
    {note && <div className="mt-1 text-[11px] text-[#899397]">{note}</div>}
  </div>
);

export const Section: React.FC<{title:string; subtitle?:string; action?:React.ReactNode; children:React.ReactNode; className?:string}> = ({title,subtitle,action,children,className=''}) => (
  <section className={`ns-card ${className}`}>
    <div className="flex flex-col gap-2 border-b border-[#e8ebe8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-[14px] font-extrabold text-[#20343e]">{title}</h2>{subtitle&&<p className="mt-0.5 text-[11px] text-[#8a9598]">{subtitle}</p>}</div>
      {action}
    </div>
    {children}
  </section>
);

export const Toolbar: React.FC<{search?:string; onSearch?:(v:string)=>void; placeholder?:string; children?:React.ReactNode}> = ({search,onSearch,placeholder='Search…',children}) => (
  <div className="flex flex-col gap-2 border-b border-[#e8ebe8] bg-[#fbfcfa] p-4 sm:flex-row sm:items-center">
    {onSearch !== undefined && <SearchInput value={search||''} onChange={onSearch} placeholder={placeholder} className="w-full sm:w-80"/>}
    <div className="flex flex-wrap gap-2 sm:ml-auto">{children}</div>
  </div>
);

export const TableFrame: React.FC<{children:React.ReactNode}> = ({children}) => <div className="overflow-x-auto">{children}</div>;

export const EmptyTable: React.FC<{title:string; subtitle:string; action?:React.ReactNode}> = ({title,subtitle,action}) => (
  <EmptyState title={title} subtitle={subtitle} action={action}/>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({className='',children,...props}) => (
  <button {...props} className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[#e0e5e2] bg-white text-[#657278] transition hover:border-[#c9d1cd] hover:bg-[#f7f9f7] ${className}`}>{children}</button>
);
