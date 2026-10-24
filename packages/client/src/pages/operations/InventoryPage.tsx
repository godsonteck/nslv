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
  PackageCheck,
  TrendingDown,
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
import { ShellPage, Section, StatTile, Toolbar } from '../../components/common/WorkspaceUI';
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
    <ShellPage
      eyebrow="Operations"
      title="Inventory & Stock Levels"
      subtitle="Track housekeeping amenities, food & beverage stock, maintenance supplies, and reorder levels."
      actions={
        <div className="flex items-center gap-2">
          {canManageCategories && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryManagerOpen(true)}
              className="gap-1.5 border-[#e5ebeb] text-[#0c1921]"
            >
              <Settings size={13} /> Categories
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
              className="gap-1.5 bg-[#c59a58] hover:bg-[#b88738] text-white shadow-sm font-semibold"
            >
              <Plus size={14} /> Add Stock Item
            </Button>
          )}
        </div>
      }
    >
      {/* ── Stat Tiles ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Tracked Stock Items"
          value={inventory.length}
          note="Active inventory SKUs in catalog"
          icon={Boxes}
        />
        <StatTile
          label="Low Stock Alerts"
          value={`${lowStockCount} items`}
          note={lowStockCount > 0 ? 'Items below minimum reorder threshold' : 'All items sufficiently stocked'}
          icon={AlertTriangle}
          accent={lowStockCount > 0}
        />
        <StatTile
          label="Total Inventory Value"
          value={formatCurrency(totalValuation)}
          note="Estimated on-hand stock cost valuation"
          icon={PackageCheck}
        />
      </div>

      {/* ── Inventory Section Table ── */}
      <Section
        title="Stock Catalog & Inventory Movements"
        subtitle="Live quantities, reorder thresholds, unit pricing, and quick level adjustments."
        action={
          <Button variant="ghost" size="sm" onClick={fetchInventory} className="h-8 gap-1.5 text-xs text-[#5a6b75]">
            <RefreshCw size={13} /> Refresh
          </Button>
        }
      >
        <Toolbar search={searchQuery} onSearch={setSearchQuery} placeholder="Search item name or SKU code…">
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
              lowStockOnly ? 'bg-amber-600 hover:bg-amber-700 text-white border-transparent' : 'border-[#e5ebeb]'
            }`}
          >
            <AlertTriangle size={13} /> Low Stock Only
          </Button>
        </Toolbar>

        {loading ? (
          <div className="p-12"><LoadingState /></div>
        ) : inventory.length === 0 ? (
          <div className="p-16 text-center text-xs text-[#71828a]">
            No inventory items found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#edf2f2] bg-[#fbfdfd] text-[10px] font-extrabold uppercase tracking-wider text-[#71828a]">
                  <th className="py-3 px-5">SKU Code</th>
                  <th className="py-3 px-5">Item Description & Category</th>
                  <th className="py-3 px-5 text-center">In Stock</th>
                  <th className="py-3 px-5 text-center">Reorder Level</th>
                  <th className="py-3 px-5 text-right">Unit Cost</th>
                  <th className="py-3 px-5 text-center">Stock Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {inventory.map((item) => {
                  const isLow = item.lowStock;

                  return (
                    <tr key={item.id} className="hover:bg-[#fbfcfb] transition-colors">
                      <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-[#b88738]">
                        {item.sku || '—'}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[#0c1921] text-xs">{item.name}</div>
                        <div className="text-[10px] font-semibold text-[#5a6b75]">{item.category}</div>
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono font-bold text-xs">
                        <span className={isLow ? 'text-amber-600 font-extrabold' : 'text-[#0c1921]'}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono text-[11px] text-[#71828a]">
                        {item.minQuantity} {item.unit}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold text-[#0c1921]">
                        {formatCurrency(Number(item.costPrice) || 0)}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                            <AlertTriangle size={10} /> Reorder Needed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
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
                              className="flex h-7 px-2 items-center gap-1 rounded-lg text-xs font-semibold text-[#173c4d] hover:bg-[#173c4d]/5 transition-colors"
                              title="Adjust Stock Level"
                            >
                              <ArrowUpDown size={12} className="text-[#c59a58]" /> Adjust
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
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
      </Section>

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

          <div className="flex justify-end gap-2 pt-3 border-t border-[#edf2f2]">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} className="bg-[#0c1921] hover:bg-[#173c4d] text-white">
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
            <div className="rounded-xl border border-[#c59a58]/30 bg-[#fcf9f2] p-4 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-[#b88738]">Current Balance</span>
                <div className="text-base font-bold text-[#0c1921]">
                  {adjustModal.quantity} {adjustModal.unit}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase text-[#71828a]">Reorder Level</span>
                <div className="text-sm font-semibold text-[#5a6b75]">
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

            <div className="flex justify-end gap-2 pt-3 border-t border-[#edf2f2]">
              <Button type="button" variant="ghost" onClick={() => setAdjustModal(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving} className="bg-[#0c1921] hover:bg-[#173c4d] text-white">
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
    </ShellPage>
  );
};

export default InventoryPage;
