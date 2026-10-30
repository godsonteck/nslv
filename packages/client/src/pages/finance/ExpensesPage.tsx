// ============================================
// NS LUXURY VILLA — Expenditure Management
// Property Expenditures & Operational Outflows
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency, PERMISSIONS } from '@nslv/shared';
import {
  Receipt,
  Plus,
  RefreshCw,
  Trash2,
  Check,
  X,
  Pencil,
  Settings,
  FileText,
  Search,
} from 'lucide-react';
import {
  Button,
  Modal,
  FormField,
  TextInput,
  SelectInput,
  showToast,
  statusBadge,
  LoadingState,
} from '../../components/ui';
import { categoriesApi, expensesApi, ExpenseRecord } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { CategoryManager } from '../../components/admin/CategoryManager';

const EXPENSE_CATEGORIES = [
  'UTILITIES',
  'SUPPLIES',
  'MAINTENANCE',
  'STAFF',
  'MARKETING',
  'FOOD',
  'BEVERAGES',
  'OTHER',
];

export const ExpensesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission(PERMISSIONS.EXPENSES_CREATE);
  const canApprove = hasPermission(PERMISSIONS.EXPENSES_APPROVE);
  const canDelete = hasPermission(PERMISSIONS.EXPENSES_DELETE);
  const canManageCategories = hasPermission(PERMISSIONS.CATEGORIES_MANAGE);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [category, setCategory] = useState('UTILITIES');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [incurredOn, setIncurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expensesApi.list({
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setExpenses(res.data.items);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to load expenditures.');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const loadCategories = useCallback(async () => {
    try {
      const result = await categoriesApi.listAll({ type: 'EXPENDITURE' });
      setExpenseCategories(result.data.map((item) => item.name));
    } catch {
      setExpenseCategories([]);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const categoryOptions = expenseCategories.length > 0 ? expenseCategories : EXPENSE_CATEGORIES;

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setCategory(categoryOptions[0] ?? 'OTHER');
    setDescription('');
    setAmount('');
    setVendor('');
    setPaymentMethod('CASH');
    setIncurredOn(new Date().toISOString().slice(0, 10));
    setNotes('');
  };

  const openCreate = () => {
    resetExpenseForm();
    setCreateModalOpen(true);
  };

  const openEdit = (expense: ExpenseRecord) => {
    setEditingExpense(expense);
    setCategory(expense.category);
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setVendor(expense.vendor ?? '');
    setPaymentMethod(expense.paymentMethod ?? 'CASH');
    setIncurredOn(new Date(expense.incurredOn).toISOString().slice(0, 10));
    setNotes(expense.notes ?? '');
    setCreateModalOpen(true);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || parseFloat(amount) <= 0) {
      showToast('error', 'Please enter a valid expenditure description and positive amount');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category,
        description: description.trim(),
        amount: parseFloat(amount),
        vendor: vendor.trim() || undefined,
        paymentMethod,
        incurredOn,
        notes: notes.trim() || undefined,
      };
      if (editingExpense) {
        await expensesApi.update(editingExpense.id, payload);
        showToast('success', 'Expenditure voucher updated.');
      } else {
        await expensesApi.create(payload);
        showToast('success', 'Expenditure voucher created and submitted for approval.');
      }
      setCreateModalOpen(false);
      resetExpenseForm();
      fetchExpenses();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to save expenditure.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (exp: ExpenseRecord, status: string) => {
    try {
      await expensesApi.setStatus(exp.id, status);
      showToast('success', status === 'APPROVED' ? 'Expenditure approved.' : 'Expenditure rejected.');
      fetchExpenses();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to update expenditure status.');
    }
  };

  const handleDelete = async (exp: ExpenseRecord) => {
    if (!window.confirm(`Delete expenditure ${exp.expenseNo} (${exp.description})? This cannot be undone.`)) return;
    try {
      await expensesApi.remove(exp.id);
      showToast('success', 'Expenditure record deleted.');
      fetchExpenses();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete expenditure.');
    }
  };

  // Filtered list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        (e.vendor && e.vendor.toLowerCase().includes(q)) ||
        (e.expenseNo && e.expenseNo.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [expenses, searchQuery]);

  // Aggregate stats
  const totalApproved = useMemo(() => {
    return expenses
      .filter((e) => e.status === 'APPROVED')
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [expenses]);

  const pendingCount = useMemo(() => {
    return expenses.filter((e) => e.status === 'PENDING').length;
  }, [expenses]);

  const pendingTotal = useMemo(() => {
    return expenses
      .filter((e) => e.status === 'PENDING')
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [expenses]);

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-300">
      {/* ── Compact Header ── */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Receipt size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>
              Property Expenditures
            </h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>
              Expense vouchers, supplier payments &amp; department disbursements
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManageCategories && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryManagerOpen(true)}
              className="gap-1.5 border-[var(--ns-glass-line)] text-[var(--ns-ink)] ns-glass-hover text-[11px] font-semibold"
            >
              <Settings size={13} /> Categories
            </Button>
          )}
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={openCreate}
              className="gap-1.5 glass ns-glass-hover text-[var(--ns-gold)] shadow-sm font-semibold text-[11px]"
            >
              <Plus size={12} /> New Expense Voucher
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Ribbon ── */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Approved Expenses</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{formatCurrency(totalApproved)}</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Pending Approvals</div>
          <div className="text-xl font-black mt-0.5" style={{ color: pendingCount > 0 ? 'var(--ns-warning)' : 'var(--ns-ink)' }}>
            {pendingCount} <span className="text-xs font-bold" style={{ color: 'var(--ns-muted)' }}>vouchers</span>
          </div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Pending Value</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{formatCurrency(pendingTotal)}</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Total Recorded</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{expenses.length}</div>
        </div>
      </div>

      {/* ── Expenditure Vouchers Table ── */}
      <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-[var(--ns-teal)]" />
            <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Expenditure Vouchers</h2>
            <span className="text-[10px] font-bold glass-subtle rounded-full px-2 py-0.5 border border-[var(--ns-glass-line)]" style={{ color: 'var(--ns-muted)' }}>
              {filteredExpenses.length}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchExpenses} className="h-8 gap-1.5 text-[11px] text-[var(--ns-muted)] glass-subtle ns-glass-hover">
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>

        {/* Compact Filter Bar */}
        <div className="flex flex-col gap-2.5 border-b border-[var(--ns-glass-line)] p-4 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ns-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by description, vendor, or voucher #..."
              className="ns-input glass-input w-full pl-7 pr-3 py-1.5 text-[11px]"
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <SelectInput
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-40 text-xs glass-input"
            >
              <option value="">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-36 text-xs glass-input"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </SelectInput>
          </div>
        </div>

        {loading ? (
          <div className="p-12"><LoadingState /></div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-16 text-center text-xs text-[var(--ns-muted)]">
            {expenses.length === 0 ? 'No expenditure vouchers recorded.' : 'No expenditures match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--ns-glass-line)] ns-glass-band text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                  <th className="py-3 px-5">Voucher #</th>
                  <th className="py-3 px-5">Category & Description</th>
                  <th className="py-3 px-5">Vendor / Payee</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Method</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-glass-line)]">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="ns-glass-hover transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-[var(--ns-gold)]">
                      {exp.expenseNo || exp.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-[var(--ns-ink)] text-xs">{exp.description}</div>
                      <div className="text-[10px] font-semibold text-[var(--ns-muted)]">{exp.category}</div>
                    </td>
                    <td className="py-3.5 px-5 font-medium text-[var(--ns-ink)]">
                      {exp.vendor || '—'}
                    </td>
                    <td className="py-3.5 px-5 text-[var(--ns-muted)] font-mono text-[11px]">
                      {new Date(exp.incurredOn).toLocaleDateString('en-GH')}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex rounded-md glass-subtle px-2 py-0.5 text-[10px] font-bold text-[var(--ns-ink)]">
                        {exp.paymentMethod || 'CASH'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-sm font-black text-[var(--ns-danger)]">
                      −{formatCurrency(Number(exp.amount))}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      {statusBadge(exp.status)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canApprove && exp.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(exp, 'APPROVED')}
                              className="flex h-7 w-7 items-center justify-center rounded-lg glass text-[var(--ns-success)] ns-glass-hover transition-colors"
                              title="Approve Voucher"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => handleApprove(exp, 'REJECTED')}
                              className="flex h-7 w-7 items-center justify-center rounded-lg glass text-[var(--ns-danger)] ns-glass-hover transition-colors"
                              title="Reject Voucher"
                            >
                              <X size={13} />
                            </button>
                          </>
                        )}
                        {canCreate && exp.status !== 'APPROVED' && (
                          <button
                            onClick={() => openEdit(exp)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ns-muted)] ns-glass-hover transition-colors bg-[var(--ns-glass-1)]"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(exp)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ns-danger)] ns-glass-hover transition-colors bg-[var(--ns-glass-1)]"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Create / Edit Expenditure ── */}
      <Modal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          resetExpenseForm();
        }}
        title={editingExpense ? `Edit Expenditure — ${editingExpense.expenseNo}` : 'Record Property Expenditure'}
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category" required>
              <SelectInput value={category} onChange={(e) => setCategory(e.target.value)} required>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Incurred On" required>
              <TextInput type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} required />
            </FormField>
          </div>

          <FormField label="Expenditure Description" required>
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Linen restock, Generator diesel, Pool chemicals"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount (GHS)" required>
              <TextInput
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </FormField>
            <FormField label="Payment Method">
              <SelectInput value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </SelectInput>
            </FormField>
          </div>

          <FormField label="Vendor / Payee">
            <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. ECG Electricity, TotalEnergies, Ho Central Market" />
          </FormField>

          <FormField label="Notes / Reference (optional)">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Invoice # or receipt details" />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-glass-line)]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreateModalOpen(false);
                resetExpenseForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} className="glass ns-glass-hover text-[var(--ns-teal)]">
              {editingExpense ? 'Save Changes' : 'Submit Voucher'}
            </Button>
          </div>
        </form>
      </Modal>

      {categoryManagerOpen && (
        <CategoryManager
          type="EXPENDITURE"
          title="Manage Expenditure Categories"
          onClose={() => {
            setCategoryManagerOpen(false);
            void loadCategories();
          }}
        />
      )}
    </div>
  );
};

export default ExpensesPage;
