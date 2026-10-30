// ============================================
// NS LUXURY VILLA — Inventory Management
// Operational Stock, Supplies, Housekeeping & Beverage Tracking
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Plus,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Settings,
  Layers,
  ArrowUpDown,
  Search,
  CheckCircle2,
} from 'lucide-react';
import {
  Button,
  Modal,
  FormField,
  TextInput,
  SelectInput,
  showToast,
  LoadingState,
} from '../../components/ui';
import { categoriesApi, inventoryApi, InventoryItemRecord } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, PERMISSIONS } from '@nslv/shared';
import { CategoryManager } from '../../components/admin/CategoryManager';

const INVENTORY_CATEGORIES = ['RESTAURANT', 'BAR', 'POOL', 'HOUSEKEEPING', 'MAINTENANCE', 'OFFICE'];
const UNITS = ['pcs', 'bottles', 'kg', 'liters', 'packs', 'boxes'];

export const InventoryPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [inventory, setInventory] = useState<InventoryItemRecord[]>([]);
  const [managedCategories, setManagedCategories] = useState<string[]>([]);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission(PERMISSIONS.INVENTORY_MANAGE);
  const canAdjust = hasPermission(PERMISSIONS.INVENTORY_ADJUST);
  const canManageCategories = hasPermission(PERMISSIONS.CATEGORIES_MANAGE);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('HOUSEKEEPING');
  const [unit, setUnit] = useState('pcs');
  const [inStock, setInStock] = useState('10');
  const [minStock, setMinStock] = useState('5');
  const [unitCost, setUnitCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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

  const loadCategories = useCallback(async () => {
    try {
      const result = await categoriesApi.listAll({ type: 'INVENTORY' });
      setManagedCategories(result.data.map((item) => item.name));
    } catch {
      setManagedCategories([]);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const categoryOptions = managedCategories.length > 0 ? managedCategories : INVENTORY_CATEGORIES;

  const handleCreateStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Item name is required');
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.create({
        sku: sku.trim() || undefined,
        name: name.trim(),
        category,
        unit,
        quantity: parseInt(inStock, 10) || 0,
        minQuantity: parseInt(minStock, 10) || 0,
        costPrice: parseFloat(unitCost) || 0,
        notes: notes.trim() || undefined,
      });
      showToast('success', `Item "${name}" added to inventory.`);
      setCreateModalOpen(false);
      setName('');
      setSku('');
      setNotes('');
      fetchInventory();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to add stock item.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal) return;
    const qty = parseInt(adjustQty, 10);
    if (!Number.isInteger(qty) || qty === 0) {
      showToast('error', 'Adjustment must be a non-zero whole number (e.g. +10 or -5).');
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.adjustStock(adjustModal.id, qty, adjustReason.trim() || undefined);
      showToast('success', 'Stock level updated.');
      setAdjustModal(null);
      setAdjustQty('');
      setAdjustReason('');
      fetchInventory();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to adjust stock.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItemRecord) => {
    if (!window.confirm(`Delete inventory item "${item.name}" (${item.sku})?`)) return;
    try {
      await inventoryApi.remove(item.id);
      showToast('success', 'Inventory item deleted.');
      fetchInventory();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete item.');
    }
  };

  // Metrics
  const lowStockCount = useMemo(() => {
    return inventory.filter((i) => i.lowStock).length;
  }, [inventory]);

  const totalValuation = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0), 0);
  }, [inventory]);

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-300">
      {/* ── Compact Header ── */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Boxes size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>
              Inventory & Stock Levels
            </h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>
              Housekeeping, F&B stock, maintenance supplies & reorder levels
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManageCategories && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryManagerOpen(true)}
              className="gap-1.5 border-[var(--ns-glass-line)] glass ns-glass-hover text-[var(--ns-ink)] shadow-xs text-[11px] font-semibold"
            >
              <Settings size={12} /> Categories
            </Button>
          )}
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setCategory(categoryOptions[0] ?? 'HOUSEKEEPING');
                setCreateModalOpen(true);
              }}
              className="gap-1.5 glass text-[var(--ns-teal)] shadow-md text-[11px] font-bold ns-glass-hover"
            >
              <Plus size={12} /> Add Stock Item
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Ribbon ── */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Tracked Items</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-ink)' }}>{inventory.length}</div>
        </div>
        <div className={`glass-subtle rounded-xl px-4 py-2.5 text-left border transition-all shrink-0 ${lowStockCount > 0 ? 'border-[var(--ns-warning)] ring-1 ring-[var(--ns-warning)]/30' : 'border-[var(--ns-glass-line)]'}`}>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Low Stock Alerts</div>
          <div className="text-xl font-black mt-0.5" style={{ color: lowStockCount > 0 ? 'var(--ns-warning)' : 'var(--ns-ink)' }}>{lowStockCount} items</div>
        </div>
        <div className="glass-subtle rounded-xl px-4 py-2.5 text-left border border-[var(--ns-glass-line)] shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Inventory Value</div>
          <div className="text-xl font-black mt-0.5" style={{ color: 'var(--ns-gold)' }}>{formatCurrency(totalValuation)}</div>
        </div>
      </div>

      {/* ── Inventory Section Table ── */}
      <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-[var(--ns-glass-line)] p-4 sm:flex-row sm:items-center sm:justify-between ns-glass-band">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-[var(--ns-teal)]" />
            <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Stock Catalog & Inventory Movements</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchInventory} className="h-8 gap-1.5 text-xs text-[var(--ns-muted)]">
              <RefreshCw size={13} /> Refresh
            </Button>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ns-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search item name or SKU code…"
                className="ns-input h-9 pl-8 pr-3 text-xs glass-input border-[var(--ns-glass-line)] w-56"
              />
            </div>
            <SelectInput
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-44 text-xs"
            >
              <option value="">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
            <Button
              variant={lowStockOnly ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setLowStockOnly((v) => !v)}
              className={`h-9 gap-1.5 text-xs font-semibold ${
                lowStockOnly ? 'ns-glass-selected ns-glass-hover text-[var(--ns-warning)] border-[var(--ns-warning)]' : 'border-[var(--ns-glass-line)]'
              }`}
            >
              <AlertTriangle size={13} /> Low Stock Only
            </Button>
          </div>
        </div>
        <div className="p-4">

        {loading ? (
          <div className="p-12"><LoadingState /></div>
        ) : inventory.length === 0 ? (
          <div className="p-16 text-center text-xs text-[var(--ns-muted)]">
            No inventory items found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--ns-glass-line)] ns-glass-band text-[10px] font-extrabold uppercase tracking-wider text-[var(--ns-muted)]">
                  <th className="py-3 px-5">SKU Code</th>
                  <th className="py-3 px-5">Item Description & Category</th>
                  <th className="py-3 px-5 text-center">In Stock</th>
                  <th className="py-3 px-5 text-center">Reorder Level</th>
                  <th className="py-3 px-5 text-right">Unit Cost</th>
                  <th className="py-3 px-5 text-center">Stock Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-glass-line)]">
                {inventory.map((item) => {
                  const isLow = item.lowStock;

                  return (
                    <tr key={item.id} className="ns-glass-hover transition-colors">
                      <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-[var(--ns-gold)]">
                        {item.sku || '—'}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[var(--ns-ink)] text-xs">{item.name}</div>
                        <div className="text-[10px] font-semibold text-[var(--ns-muted)]">{item.category}</div>
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono font-bold text-xs">
                        <span className={isLow ? 'text-[var(--ns-warning)] font-extrabold' : 'text-[var(--ns-ink)]'}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono text-[11px] text-[var(--ns-muted)]">
                        {item.minQuantity} {item.unit}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold text-[var(--ns-ink)]">
                        {formatCurrency(Number(item.costPrice) || 0)}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-md glass-subtle px-2 py-0.5 text-[10px] font-bold text-[var(--ns-warning)] border border-[var(--ns-warning)]">
                            <AlertTriangle size={10} /> Reorder Needed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md glass-subtle px-2 py-0.5 text-[10px] font-bold text-[var(--ns-success)] border border-[var(--ns-success)]">
                            <CheckCircle2 size={10} /> Sufficient
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canAdjust && (
                            <button
                              onClick={() => {
                                setAdjustModal(item);
                                setAdjustQty('');
                                setAdjustReason('');
                              }}
                              className="flex h-7 px-2 items-center gap-1 rounded-lg text-xs font-semibold text-[var(--ns-teal)] ns-glass-hover transition-colors"
                              title="Adjust Stock Level"
                            >
                              <ArrowUpDown size={12} className="text-[var(--ns-gold)]" /> Adjust
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ns-danger)] ns-glass-hover transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>

      {/* ── Modal: Add Stock Item ── */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Inventory Item"
      >
        <form onSubmit={handleCreateStockItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="SKU / Barcode">
              <TextInput value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. AMEN-SHMP-50" />
            </FormField>
            <FormField label="Category" required>
              <SelectInput value={category} onChange={(e) => setCategory(e.target.value)} required>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          </div>

          <FormField label="Item Name & Specification" required>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Luxury Villa Shampoo 50ml or Fresh Towel Set"
              required
            />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Unit of Measure" required>
              <SelectInput value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Initial Stock Qty" required>
              <TextInput
                type="number"
                min="0"
                value={inStock}
                onChange={(e) => setInStock(e.target.value)}
                placeholder="10"
                required
              />
            </FormField>
            <FormField label="Minimum Reorder Threshold" required>
              <TextInput
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="5"
                required
              />
            </FormField>
          </div>

          <FormField label="Unit Cost Price (GHS)">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0.00"
            />
          </FormField>

          <FormField label="Notes / Supplier Details (optional)">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Supplied by West African Amenities" />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-glass-line)]">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} className="glass ns-glass-hover text-[var(--ns-ink)]">
              Save Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Adjust Stock Level ── */}
      <Modal
        open={!!adjustModal}
        onClose={() => setAdjustModal(null)}
        title={adjustModal ? `Adjust Stock Level — ${adjustModal.name}` : 'Adjust Stock'}
      >
        {adjustModal && (
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="rounded-xl border border-[var(--ns-gold)] glass-subtle p-4 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-[var(--ns-gold)]">Current Balance</span>
                <div className="text-base font-bold text-[var(--ns-ink)]">
                  {adjustModal.quantity} {adjustModal.unit}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase text-[var(--ns-muted)]">Reorder Level</span>
                <div className="text-sm font-semibold text-[var(--ns-muted)]">
                  {adjustModal.minQuantity} {adjustModal.unit}
                </div>
              </div>
            </div>

            <FormField label="Quantity Change (+ to add, - to deduct)" required>
              <TextInput
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. 20 (received delivery) or -5 (damaged/used)"
                required
              />
            </FormField>

            <FormField label="Adjustment Reason" required>
              <TextInput
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Weekly replenishment, stocktake audit, damaged items"
                required
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ns-glass-line)]">
              <Button type="button" variant="ghost" onClick={() => setAdjustModal(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving} className="glass ns-glass-hover text-[var(--ns-ink)]">
                Update Stock
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {categoryManagerOpen && (
        <CategoryManager
          type="INVENTORY"
          title="Manage Inventory Categories"
          onClose={() => {
            setCategoryManagerOpen(false);
            void loadCategories();
          }}
        />
      )}
    </div>
  );
};

export default InventoryPage;
