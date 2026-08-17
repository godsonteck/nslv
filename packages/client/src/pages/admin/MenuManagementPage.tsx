import React, { useEffect, useState } from 'react';
import { posApi, categoriesApi } from '../../services/apiService';
import { ShellPage, Section } from '../../components/common/WorkspaceUI';
import { Button, Modal, FormField, TextInput, SelectInput, showToast, LoadingState } from '../../components/ui';
import { UtensilsCrossed, Wine, Waves, Plus, Pencil, Trash2, RefreshCw, Power } from 'lucide-react';
import { formatCurrency } from '@nslv/shared';
import { CategoryManager } from '../../components/admin/CategoryManager';

type Domain = 'restaurant' | 'bar' | 'pool';
const DOMAINS: { id: Domain; label: string; icon: any }[] = [
  { id: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { id: 'bar', label: 'Bar', icon: Wine },
  { id: 'pool', label: 'Pool', icon: Waves },
];

const CATEGORY_TYPES: Record<Domain, string> = {
  restaurant: 'RESTAURANT',
  bar: 'BAR',
  pool: 'POOL',
};

const emptyForm = { name: '', category: '', price: '', description: '' };

export const MenuManagementPage: React.FC = () => {
  const [domain, setDomain] = useState<Domain>('restaurant');
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState('');
  const [includeOff, setIncludeOff] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      let i: any[] = [],
        o: any[] = [],
        c: any[] = [];

      // Load categories
      try {
        const catResult = await categoriesApi.listByType(CATEGORY_TYPES[domain]);
        c = catResult.data;
      } catch {
        // Categories API may not be authorized for all users, continue with hardcoded defaults
        c = [];
      }
      setCategories(c);

      // Load items and orders
      if (domain === 'restaurant') {
        [i, o] = await Promise.all([
          posApi.getRestaurantItems().then((r) => r.data || []),
          posApi.getRestaurantOrders().then((r) => r.data || []),
        ]);
      } else if (domain === 'bar') {
        [i, o] = await Promise.all([
          posApi.getBarItems().then((r) => r.data || []),
          posApi.getBarOrders().then((r) => r.data || []),
        ]);
      } else {
        [i, o] = await Promise.all([
          posApi.getPoolServices().then((r) => r.data || []),
          posApi.getPoolTransactions().then((r) => r.data || []),
        ]);
      }
      setItems(i);
      setOrders(o);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load menu data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [domain]);

  const create = (body: any) =>
    domain === 'restaurant'
      ? posApi.createRestaurantItem(body)
      : domain === 'bar'
        ? posApi.createBarItem(body)
        : posApi.createPoolService(body);

  const update = (id: string, body: any) =>
    domain === 'restaurant'
      ? posApi.updateRestaurantItem(id, body)
      : domain === 'bar'
        ? posApi.updateBarItem(id, body)
        : posApi.updatePoolService(id, body);

  const toggle = (id: string, isAvailable: boolean) =>
    domain === 'restaurant'
      ? posApi.toggleRestaurantItem(id, isAvailable)
      : domain === 'bar'
        ? posApi.toggleBarItem(id, isAvailable)
        : posApi.togglePoolService(id, isAvailable);

  const remove = (id: string) =>
    domain === 'restaurant'
      ? posApi.deleteRestaurantItem(id)
      : domain === 'bar'
        ? posApi.deleteBarItem(id)
        : posApi.deletePoolService(id);

  const getDefaultCategories = () => {
    const defaults: Record<Domain, string[]> = {
      restaurant: ['STARTERS', 'MAINS', 'DESSERTS', 'BEVERAGES', 'SPECIALS'],
      bar: ['COCKTAILS', 'WINES', 'BEERS', 'SPIRITS', 'SOFT_DRINKS', 'SNACKS'],
      pool: ['DAY_PASS', 'CABANA_RENTAL', 'TOWEL_RENTAL', 'POOL_SNACKS', 'BEVERAGES'],
    };
    return defaults[domain];
  };

  const categoryOptions = categories.length > 0 ? categories.map((c) => c.name) : getDefaultCategories();

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, category: categoryOptions[0] || '' });
    setOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category || '',
      price: String(item.price),
      description: item.description || '',
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        description: form.description,
      };
      if (editing) await update(editing.id, body);
      else await create(body);
      showToast('success', editing ? 'Item updated' : 'Item created');
      setOpen(false);
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to save item');
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (item: any) => {
    try {
      await toggle(item.id, !item.isAvailable);
      showToast('success', item.isAvailable ? 'Item taken off the menu' : 'Item back on the menu');
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to change availability');
    }
  };

  const onRemove = async (item: any) => {
    if (!window.confirm(`Delete "${item.name}"? If it has been ordered before it will be archived instead.`)) return;
    try {
      await remove(item.id);
      showToast('success', 'Item deleted');
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to delete item');
    }
  };

  const visible = items.filter(
    (i) => (!q || i.name?.toLowerCase().includes(q.toLowerCase())) && (includeOff || i.isAvailable !== false),
  );
  const domainLabel = DOMAINS.find((d) => d.id === domain)?.label || domain;

  return (
    <ShellPage
      eyebrow="ADMINISTRATION · MENU & POS"
      title="Menu & point of sale"
      subtitle="Full control over the restaurant, bar and pool menus, pricing, availability and posted orders."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} /> Add item
          </Button>
        </>
      }
    >
      <div className="flex gap-1.5">
        {DOMAINS.map((d) => (
          <button
            key={d.id}
            onClick={() => setDomain(d.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-extrabold ${
              domain === d.id
                ? 'bg-[#16a4d4] text-white'
                : 'border border-[#dfe4e0] bg-white text-[#718086]'
            }`}
          >
            <d.icon size={15} /> {d.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Section
          title={`${domainLabel} menu`}
          subtitle={
            includeOff
              ? 'Showing active and archived items.'
              : 'Showing only items available for ordering.'
          }
          action={
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="inc-off"
                checked={includeOff}
                onChange={(e) => setIncludeOff(e.target.checked)}
                className="h-4 w-4 accent-[#16a4d4]"
              />
              <label htmlFor="inc-off" className="text-[10px] font-bold text-[#718086]">
                Show archived
              </label>
            </div>
          }
        >
          <div className="border-b border-[#e8ebe8] bg-[#fbfcfa] p-4">
            <input
              className="ns-input h-10 w-full text-xs"
              placeholder="Search menu…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {loading ? (
            <LoadingState />
          ) : visible.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#899397]">
              No items found{includeOff ? '' : ' — check "Show archived" to see hidden items'}.
            </div>
          ) : (
            <div className="divide-y divide-[#edf0ed]">
              {visible.map((i) => (
                <div key={i.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#fbfcfa]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {i.isAvailable === false ? (
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#b23a3a]">
                          Archived
                        </span>
                      ) : (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#2d8a68]" />
                      )}
                      <span className="truncate text-xs font-extrabold text-[#26363e]">{i.name}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#8a9598]">
                      {i.category}
                      {i.description ? ` · ${i.description}` : ''}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-extrabold text-[#a8761e]">
                    {formatCurrency(Number(i.price || 0))}
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => onToggle(i)}
                      title={i.isAvailable ? 'Take off menu' : 'Put on menu'}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e5e2] bg-white text-[#657278] hover:bg-[#f7f9f7]"
                    >
                      <Power size={14} />
                    </button>
                    <button
                      onClick={() => openEdit(i)}
                      title="Edit item"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e5e2] bg-white text-[#657278] hover:bg-[#f7f9f7]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onRemove(i)}
                      title="Delete item"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e5e2] bg-white text-[#b23a3a] hover:bg-[#fdf1f1]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="space-y-6">
          <Section title="Posted orders" subtitle={`Recent ${domainLabel.toLowerCase()} transactions`}>
            <div className="divide-y divide-[#edf0ed]">
              {orders.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#899397]">No orders yet.</div>
              ) : (
                orders.slice(0, 8).map((o) => (
                  <div key={o.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-extrabold text-[#26363e]">{o.orderNo}</span>
                      <span className="text-[11px] font-extrabold text-[#a8761e]">
                        {formatCurrency(Number(o.totalAmount || 0))}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-[#8a9598]">
                      <span>
                        {o.paymentMethod} · {o.paymentStatus}
                      </span>
                      <span>{new Date(o.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Section>

          <Section title="Categories" subtitle={`Manage ${domainLabel.toLowerCase()} categories`}>
            <div className="px-5 py-3">
              {categories.length === 0 ? (
                <div className="text-[10px] text-[#8a9598] mb-3">
                  Using default categories. Create custom categories to manage your menu.
                </div>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCategoryManagerOpen(true)}
                className="w-full"
              >
                <Plus size={14} /> Manage categories
              </Button>
            </div>
          </Section>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${domainLabel} item` : `New ${domainLabel} item`}>
        <form onSubmit={save} className="space-y-4 p-6">
          <FormField label="Name" required>
            <TextInput
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Item name"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" required>
              <SelectInput
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c.replaceAll('_', ' ')}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Price (GHS)" required>
              <TextInput
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
              />
            </FormField>
          </div>

          <FormField label="Description">
            <TextInput
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short description (optional)"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Add item'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        title={`Manage ${domainLabel} Categories`}
        size="md"
      >
        <div className="p-6">
          <CategoryManager
            type={CATEGORY_TYPES[domain]}
            title={`${domainLabel} Categories`}
            onClose={() => {
              setCategoryManagerOpen(false);
              void load();
            }}
          />
        </div>
      </Modal>
    </ShellPage>
  );
};

export default MenuManagementPage;
