import React from 'react';
import { Plus, X } from 'lucide-react';
import { SelectInput, TextInput, Button } from './index';

// ============================================
// Split / multi-tender payment editor
// A guest paying part cash + part Mobile Money (or more methods) is recorded
// as one action: each row becomes its own Payment ledger row on the server.
// ============================================

export const TENDER_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

export interface TenderRow {
  method: string;
  amount: string;
  reference: string;
}

export type TenderMethod = 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER';

export function makeTenderRow(method = 'CASH', amount = '', reference = ''): TenderRow {
  return { method, amount, reference };
}

export function parseTenders(rows: TenderRow[]): { method: TenderMethod; amount: number; reference?: string }[] | undefined {
  const filled = rows.filter((r) => r.method && r.amount !== '' && Number(r.amount) > 0);
  if (filled.length === 0) return undefined;
  return filled.map((r) => ({
    method: r.method as TenderMethod,
    amount: Number(r.amount),
    ...(r.reference.trim() ? { reference: r.reference.trim() } : {}),
  }));
}

export function tendersCoverTotal(rows: TenderRow[], total: number): boolean {
  const covered = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  return Math.abs(covered - total) < 0.005;
}

interface TenderSplitProps {
  total: number;
  rows: TenderRow[];
  onChange: (rows: TenderRow[]) => void;
  disabled?: boolean;
  maxRows?: number;
}

export const TenderSplit: React.FC<TenderSplitProps> = ({ total, rows, onChange, disabled, maxRows = 4 }) => {
  const covered = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const remaining = total - covered;
  const canAdd = rows.length < maxRows;

  const update = (index: number, patch: Partial<TenderRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  const needsReference = (method: string) => method === 'MOBILE_MONEY' || method === 'BANK_TRANSFER';

  return (
    <div className="space-y-2.5">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-[#f7f8f6] p-2.5">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#667278] mb-1">Method</label>
              <SelectInput value={row.method} disabled={disabled} onChange={(e) => update(i, { method: e.target.value })}>
                {TENDER_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#667278] mb-1">Amount (GHS)</label>
              <TextInput
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={row.amount}
                disabled={disabled}
                placeholder={i === rows.length - 1 && remaining > 0 ? remaining.toFixed(2) : '0.00'}
                onChange={(e) => update(i, { amount: e.target.value })}
              />
            </div>
            <button
              type="button"
              disabled={disabled || rows.length <= 1}
              onClick={() => remove(i)}
              title="Remove method"
              className="mb-1 rounded-lg p-1.5 text-[#667278] hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X size={14} />
            </button>
          </div>
          {needsReference(row.method) && (
            <div className="mt-2">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[#667278] mb-1">
                {row.method === 'MOBILE_MONEY' ? 'Mobile money number' : 'Bank reference'}
              </label>
              <TextInput
                value={row.reference}
                disabled={disabled}
                placeholder={row.method === 'MOBILE_MONEY' ? 'e.g. 024 000 0000' : 'e.g. Txn ID'}
                onChange={(e) => update(i, { reference: e.target.value })}
              />
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" disabled={disabled || !canAdd} onClick={() => onChange([...rows, makeTenderRow('CASH', '', '')])}>
          <Plus size={13} /> Add method
        </Button>
        <div className={`text-xs font-bold ${Math.abs(remaining) < 0.005 ? 'text-emerald-600' : remaining < 0 ? 'text-red-600' : 'text-[#667278]'}`}>
          {Math.abs(remaining) < 0.005 ? 'Fully covered' : remaining < 0 ? `Over by GHS ${Math.abs(remaining).toFixed(2)}` : `Remaining GHS ${remaining.toFixed(2)}`}
        </div>
      </div>
    </div>
  );
};