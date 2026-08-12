// ============================================
// NS LUXURY VILLA — Expenditure Management
// Section #23: Property Expenditures & Operational Outflows
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import { formatCurrency } from '@nslv/shared';
import {
  PageHeader,
  DataTable,
  Button,
  statusBadge,
  Modal,
  FormField,
  TextInput,
  SelectInput,
  showToast,
} from '../../components/ui';
import { Receipt, Plus, RefreshCw, Trash2, Check, X } from 'lucide-react';
import { expensesApi, ExpenseRecord } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';

const EXPENSE_CATEGORIES = ['UTILITIES', 'SUPPLIES', 'MAINTENANCE', 'STAFF', 'MARKETING', 'FOOD', 'BEVERAGES', 'OTHER'];

export const ExpensesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission(PERMISSIONS.EXPENSES_CREATE);
  const canApprove = hasPermission(PERMISSIONS.EXPENSES_APPROVE);
  const canDelete = hasPermission(PERMISSIONS.EXPENSES_DELETE);

  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [category, setCategory] = useState('UTILITIES');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [incurredOn, setIncurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

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

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || parseFloat(amount) <= 0) {
      showToast('error', 'Please enter a valid expenditure description and amount');
      return;
    }
    try {
      await expensesApi.create({
        category,
        description,
        amount: parseFloat(amount),
        vendor: vendor || undefined,
        paymentMethod,
        incurredOn,
        notes: notes || undefined,
      });
      showToast('success', 'Expenditure voucher created and submitted for approval');
      setCreateModalOpen(false);
      setDescription('');
      setAmount('');
      setVendor('');
      setNotes('');
      fetchExpenses();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to create expenditure.');
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
    if (!window.confirm(`Delete expenditure ${exp.expenseNo} (${exp.description})?`)) return;
    try {
      await expensesApi.remove(exp.id);
      showToast('success', 'Expenditure record deleted.');
      fetchExpenses();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete expenditure.');
    }
  };

  const columns = [
    {
      key: 'category',
      header: 'Expenditure Category',
      render: (row: ExpenseRecord) => (
        <div>
          <div className="font-semibold text-[#F4F4F2]">{row.category}</div>
          <div className="text-[11px] text-[#A0A5AD]">{row.description}</div>
        </div>
      ),
    },
    {
      key: 'expenseNo',
      header: 'Voucher No',
      render: (row: ExpenseRecord) => <span className="font-mono text-xs text-[#A0A5AD]">{row.expenseNo}</span>,
    },
    {
      key: 'date',
      header: 'Incurred On',
      render: (row: ExpenseRecord) => (
        <span className="text-xs text-[#A0A5AD]">{new Date(row.incurredOn).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (row: ExpenseRecord) => <span className="text-xs text-[#A0A5AD]">{row.vendor ?? '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right' as const,
      render: (row: ExpenseRecord) => (
        <span className="font-mono font-semibold text-[#F4F4F2]">{formatCurrency(Number(row.amount))}</span>
      ),
    },
    {
      key: 'status',
      header: 'Approval Status',
      align: 'center' as const,
      render: (row: ExpenseRecord) => statusBadge(row.status),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (row: ExpenseRecord) => (
        <div className="flex items-center justify-end gap-1">
          {canApprove && row.status === 'PENDING' && (
            <>
              <button onClick={() => handleApprove(row, 'APPROVED')} className="p-1.5 hover:bg-emerald-500/10 rounded text-[#A0A5AD] hover:text-emerald-400" title="Approve">
                <Check size={14} />
              </button>
              <button onClick={() => handleApprove(row, 'REJECTED')} className="p-1.5 hover:bg-red-500/10 rounded text-[#A0A5AD] hover:text-red-400" title="Reject">
                <X size={14} />
              </button>
            </>
          )}
          {canDelete && (
            <button onClick={() => handleDelete(row)} className="p-1.5 hover:bg-red-500/10 rounded text-[#A0A5AD] hover:text-red-400" title="Delete">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenditure Management"
        subtitle="Property operational outflows, supplier vouchers & department expenses"
        actions={
          canCreate && (
            <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus size={14} /> New Expenditure Voucher
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#1C1F28] border border-[#2B303E] rounded-md">
        <div className="flex items-center gap-2">
          <SelectInput value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-44">
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </SelectInput>
          <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </SelectInput>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchExpenses}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        loading={loading}
        emptyTitle="No expenditure vouchers recorded"
        emptySubtitle="Create an expenditure voucher to log operational costs."
        keyFn={(e) => e.id}
      />

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Record Operational Expenditure" size="md">
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category" required>
              <SelectInput value={category} onChange={(e) => setCategory(e.target.value)} required>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
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
              placeholder="e.g. Linen restock or Generator diesel"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount (GHS)" required>
              <TextInput
                type="number"
                step="0.01"
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
            <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. ECG, Ho Market" />
          </FormField>

          <FormField label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </FormField>

          <div className="pt-4 border-t border-[#2B303E] flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Submit Expenditure Voucher
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExpensesPage;
