// ============================================
// NS LUXURY VILLA — Inventory Management
// Section #22: Professional Operational Stock & Supply Tracking
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  SelectInput,
  Button,
  Badge,
  Modal,
  FormField,
  TextInput,
  showToast,
} from '../../components/ui';
import { Boxes, Plus, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { inventoryApi, InventoryItemRecord } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '@nslv/shared';

const INVENTORY_CATEGORIES = ['RESTAURANT', 'BAR', 'POOL', 'HOUSEKEEPING', 'MAINTENANCE', 'OFFICE'];
const UNITS = ['pcs', 'bottles', 'kg', 'liters', 'packs', 'boxes'];

export const InventoryPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [inventory, setInventory] = useState<InventoryItemRecord[]>([]);
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission(PERMISSIONS.INVENTORY_MANAGE);
  const canAdjust = hasPermission(PERMISSIONS.INVENTORY_ADJUST);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('HOUSEKEEPING');
  const [unit, setUnit] = useState('pcs');
  const [inStock, setInStock] = useState('10');
  const [minStock, setMinStock] = useState('5');
  const [unitCost, setUnitCost] = useState('0');
  const [notes, setNotes] = useState('');

  const [adjustModal, setAdjustModal] = useState<InventoryItemRecord | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.list({
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
        lowStockOnly,
      });
      setInventory(res.data);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, lowStockOnly]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleCreateStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      showToast('error', 'Item name is required');
      return;
    }
    try {
      await inventoryApi.create({
        sku: sku || undefined,
        name,
        category,
        unit,
        quantity: parseInt(inStock, 10) || 0,
        minQuantity: parseInt(minStock, 10) || 0,
        costPrice: parseFloat(unitCost) || 0,
        notes: notes || undefined,
      });
      showToast('success', `Item ${name} added to stock catalog`);
      setCreateModalOpen(false);
      setName('');
      setSku('');
      setNotes('');
      fetchInventory();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to add stock item.');
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal) return;
    const qty = parseInt(adjustQty, 10);
    if (!Number.isInteger(qty) || qty === 0) {
      showToast('error', 'Adjustment must be a non-zero whole number.');
      return;
    }
    try {
      await inventoryApi.adjustStock(adjustModal.id, qty, adjustReason || undefined);
      showToast('success', 'Stock level updated.');
      setAdjustModal(null);
      setAdjustQty('');
      setAdjustReason('');
      fetchInventory();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to adjust stock.');
    }
  };

  const handleDelete = async (item: InventoryItemRecord) => {
    if (!window.confirm(`Delete inventory item ${item.name} (${item.sku})?`)) return;
    try {
      await inventoryApi.remove(item.id);
      showToast('success', 'Inventory item deleted.');
      fetchInventory();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete item.');
    }
  };

  const columns = [
    {
      key: 'sku',
      header: 'SKU Code',
      render: (row: InventoryItemRecord) => <span className="font-mono text-xs font-semibold text-[#F4F4F2]">{row.sku}</span>,
    },
    {
      key: 'name',
      header: 'Item Description',
      render: (row: InventoryItemRecord) => (
        <div>
          <div className="font-semibold text-[#F4F4F2]">{row.name}</div>
          <div className="text-[11px] text-[#A0A5AD]">{row.category}</div>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Current Stock',
      align: 'center' as const,
      render: (row: InventoryItemRecord) => {
        const isLow = row.lowStock;
        return (
          <div className="flex items-center justify-center gap-1.5 font-mono font-semibold text-xs">
            <span className={isLow ? 'text-amber-400' : 'text-[#F4F4F2]'}>{row.quantity} {row.unit}</span>
            {isLow && (
              <span title="Low Stock Threshold Reached">
                <AlertTriangle size={13} className="text-amber-400" />
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'minQuantity',
      header: 'Reorder Level',
      align: 'center' as const,
      render: (row: InventoryItemRecord) => <span className="font-mono text-xs text-[#6E737B]">{row.minQuantity} {row.unit}</span>,
    },
    {
      key: 'costPrice',
      header: 'Unit Cost',
      align: 'right' as const,
      render: (row: InventoryItemRecord) => <span className="font-mono text-xs text-[#F4F4F2]">GHS {(Number(row.costPrice) || 0).toFixed(2)}</span>,
    },
    {
      key: 'status',
      header: 'Stock Status',
      align: 'center' as const,
      render: (row: InventoryItemRecord) => (
        <Badge label={row.lowStock ? 'Reorder Needed' : 'Adequate'} variant={row.lowStock ? 'warning' : 'success'} />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (row: InventoryItemRecord) => (
        <div className="flex items-center justify-end gap-1">
          {canAdjust && (
            <button onClick={() => setAdjustModal(row)} className="p-1.5 hover:bg-[#232733] rounded text-[#A0A5AD] hover:text-[#F4F4F2]" title="Adjust Stock">
              <RefreshCw size={14} />
            </button>
          )}
          {canManage && (
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
        title="Inventory & Stock Tracking"
        subtitle="Operational supplies, housekeeping stock levels, reorder thresholds & movement"
        actions={
          canManage && (
            <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus size={14} /> Add Stock Item
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#1C1F28] border border-[#2B303E] rounded-md">
        <div className="flex items-center gap-2">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search item name or SKU..." className="w-72" />
          <SelectInput value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-44">
            <option value="">All Categories</option>
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </SelectInput>
          <Button variant={lowStockOnly ? 'primary' : 'ghost'} size="sm" onClick={() => setLowStockOnly((v) => !v)}>
            <AlertTriangle size={14} /> Low Stock
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchInventory}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={inventory}
        loading={loading}
        emptyTitle="No inventory items found"
        emptySubtitle="Try adjusting search or add a new stock item."
        keyFn={(i) => i.id}
      />

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Add New Stock Item" size="md">
        <form onSubmit={handleCreateStockItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="SKU Code">
              <TextInput value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Auto-generated if blank" />
            </FormField>
            <FormField label="Category" required>
              <SelectInput value={category} onChange={(e) => setCategory(e.target.value)} required>
                {INVENTORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectInput>
            </FormField>
          </div>

          <FormField label="Item Description" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Full item name" required />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unit" required>
              <SelectInput value={unit} onChange={(e) => setUnit(e.target.value)} required>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Unit Cost (GHS)">
              <TextInput type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Initial Quantity">
              <TextInput type="number" value={inStock} onChange={(e) => setInStock(e.target.value)} />
            </FormField>
            <FormField label="Reorder Level">
              <TextInput type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            </FormField>
          </div>

          <FormField label="Notes">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </FormField>

          <div className="pt-4 border-t border-[#2B303E] flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add Stock Item
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title={`Adjust Stock — ${adjustModal?.name ?? ''}`} size="sm">
        <form onSubmit={handleAdjust} className="space-y-4">
          <FormField label="Quantity Change" required>
            <TextInput
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="e.g. +5 to receive, -2 for usage"
              required
            />
          </FormField>
          <FormField label="Reason">
            <TextInput value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. New shipment received" />
          </FormField>
          <div className="pt-4 border-t border-[#2B303E] flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdjustModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Apply Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InventoryPage;
