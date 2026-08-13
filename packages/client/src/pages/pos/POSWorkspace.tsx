import React, { useEffect, useMemo, useState } from 'react';
import { categoriesApi, posApi, staysApi } from '../../services/apiService';
import { Plus, Minus, ShoppingBag, RefreshCw, Receipt, Search, Printer, Pencil, Trash2, Power } from 'lucide-react';
import { Button, SelectInput, TextInput, showToast, LoadingState, statusBadge, Modal, FormField } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
import { formatCurrency, PERMISSIONS } from '@nslv/shared';
import { useAuthStore } from '../../stores/authStore';
import { villaAssets } from '../../assets';

type Kind = 'restaurant' | 'bar';

const CATEGORIES: Record<Kind, string[]> = {
  restaurant: ['STARTERS', 'MAINS', 'DESSERTS', 'BEVERAGES', 'SPECIALS'],
  bar: ['COCKTAILS', 'WINES', 'BEERS', 'SPIRITS', 'SOFT_DRINKS', 'SNACKS'],
};
const emptyForm = { name: '', category: '', price: '', description: '' };

export const POSWorkspace: React.FC<{ kind: Kind }> = ({ kind }) => {
  const [items, setItems] = useState<any[]>([]);
  const [managedCategories, setManagedCategories] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [stays, setStays] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentType, setPaymentType] = useState('DIRECT');
  const [selectedStay, setSelectedStay] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('ALL');
  const canManage = useAuthStore((s) => s.hasPermission(kind === 'restaurant' ? PERMISSIONS.RESTAURANT_MENU : PERMISSIONS.BAR_MENU));
  const [manageOpen, setManageOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [mForm, setMForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [a, b, c] = await Promise.all([
        kind === 'restaurant' ? posApi.getRestaurantItems() : posApi.getBarItems(),
        kind === 'restaurant' ? posApi.getRestaurantOrders() : posApi.getBarOrders(),
        staysApi.getActiveStays(),
      ]);
      setItems(a.data || []);
      setOrders(b.data || []);
      setStays(c.data || []);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load POS data');
    } finally {
      setLoading(false);
    }
  };
  const loadCategories = async () => {
    try {
      const result = await categoriesApi.listByType(kind === 'restaurant' ? 'RESTAURANT' : 'BAR');
      setManagedCategories(result.data.map((item) => item.name));
    } catch {
      setManagedCategories([]);
    }
  };
  useEffect(() => {
    void load();
    void loadCategories();
  }, [kind]);

  const categoryOptions = managedCategories.length > 0 ? managedCategories : CATEGORIES[kind];

  const cats = ['ALL', ...Array.from(new Set(items.map((i) => i.category?.name || i.category || 'General')))];
  const visible = items.filter(
    (i) =>
      (category === 'ALL' || (i.category?.name || i.category || 'General') === category) &&
      (!q || i.name?.toLowerCase().includes(q.toLowerCase())),
  );

  const add = (item: any) =>
    setCart((c) => {
      const x = c.find((i) => i.id === item.id);
      return x ? c.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)) : [...c, { ...item, quantity: 1 }];
    });
  const dec = (id: string) =>
    setCart((c) => c.flatMap((i) => (i.id === id ? (i.quantity > 1 ? [{ ...i, quantity: i.quantity - 1 }] : []) : [i])));
  const total = useMemo(() => cart.reduce((s, i) => s + Number(i.price || 0) * i.quantity, 0), [cart]);

  const submit = async () => {
    if (!cart.length) return;
    try {
      setSubmitting(true);
      const stay = stays.find((s) => s.id === selectedStay);
      const body = {
        items: cart.map((i) => ({ itemId: i.id, quantity: i.quantity })),
        guestId: stay?.guestId,
        roomId: paymentType === 'ROOM_CHARGE' ? stay?.roomId || undefined : undefined,
        paymentMethod: paymentType === 'DIRECT' ? 'CASH' : 'ROOM_CHARGE',
      };
      if (kind === 'restaurant') await posApi.createRestaurantOrder(body);
      else await posApi.createBarOrder(body);
      showToast('success', paymentType === 'ROOM_CHARGE' ? 'Order posted to the guest folio' : 'Order recorded successfully');
      setCart([]);
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  const openAddItem = () => {
    setEditingItem(null);
    setMForm({ ...emptyForm, category: categoryOptions[0] || '' });
    setManageOpen(true);
  };

  const openEditItem = (item: any) => {
    setEditingItem(item);
    setMForm({ name: item.name, category: item.category || '', price: String(item.price), description: item.description || '' });
    setManageOpen(true);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mForm.name.trim() || !mForm.category || !mForm.price) return;
    setSaving(true);
    try {
      const body = { name: mForm.name, category: mForm.category, price: Number(mForm.price), description: mForm.description };
      if (editingItem) {
        if (kind === 'restaurant') await posApi.updateRestaurantItem(editingItem.id, body);
        else await posApi.updateBarItem(editingItem.id, body);
      } else {
        if (kind === 'restaurant') await posApi.createRestaurantItem(body);
        else await posApi.createBarItem(body);
      }
      showToast('success', editingItem ? 'Item updated' : 'Item added to the menu');
      setManageOpen(false);
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to save item');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item: any) => {
    if (!window.confirm(`Delete "${item.name}"? If it has been ordered before it will be archived instead.`)) return;
    try {
      if (kind === 'restaurant') await posApi.deleteRestaurantItem(item.id);
      else await posApi.deleteBarItem(item.id);
      showToast('success', 'Item removed');
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to delete item');
    }
  };

  const toggleItem = async (item: any) => {
    try {
      if (kind === 'restaurant') await posApi.toggleRestaurantItem(item.id, !item.isAvailable);
      else await posApi.toggleBarItem(item.id, !item.isAvailable);
      showToast('success', item.isAvailable ? 'Item taken off the menu' : 'Item back on the menu');
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unable to change availability');
    }
  };

  const printReceipt = (order: any) => {
    const win = window.open('', '_blank', 'width=380,height=560');
    if (!win) return;
    const title = kind === 'restaurant' ? 'RESTAURANT RECEIPT' : 'BAR RECEIPT';
    const paymentLabel =
      order.paymentMethod === 'ROOM_CHARGE'
        ? `Charged to folio${order.room ? ` · Room ${order.room?.number ?? ''}` : ''}`
        : order.paymentMethod;
    const lines = (order.orderItems || [])
      .map(
        (li: any) =>
          `<tr><td>${li.item?.name || 'Item'}</td><td class="r">${li.quantity} × ${formatCurrency(Number(li.unitPrice || 0))}</td><td class="r">${formatCurrency(Number(li.totalPrice || 0))}</td></tr>`,
      )
      .join('');
    const logoUrl = new URL(villaAssets.logo, window.location.href).href;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{font-family:'Courier New',monospace;font-size:12px;color:#111;padding:24px;width:320px;margin:0 auto}
      h1{font-size:15px;text-align:center;margin:0 0 4px} .sub{text-align:center;font-size:10px;color:#555;margin-bottom:16px}
      .logo{display:block;margin:0 auto 10px;width:56px;height:56px;border-radius:12px;object-fit:cover}
      .row{display:flex;justify-content:space-between;font-size:11px;margin:2px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0} th{font-size:10px;text-align:left;border-bottom:1px solid #999;padding:4px 0}
      td{padding:3px 0;font-size:11px} td.r,th.r{text-align:right}
      .total{border-top:1px solid #111;padding-top:8px;font-size:13px;font-weight:bold;display:flex;justify-content:space-between}
      .foot{text-align:center;font-size:10px;color:#555;margin-top:18px;border-top:1px dashed #999;padding-top:8px}
      @media print{.noprint{display:none}}</style></head><body>
      <img src="${logoUrl}" alt="NS Luxury Villa" class="logo"/>
      <h1>NS LUXURY VILLA</h1><div class="sub">${title}</div>
      <div class="row"><span>Order No</span><span>${order.orderNo}</span></div>
      <div class="row"><span>Date</span><span>${new Date(order.createdAt).toLocaleString()}</span></div>
      <div class="row"><span>Payment</span><span>${paymentLabel}</span></div>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Total</th></tr></thead><tbody>${lines}</tbody></table>
      <div class="total"><span>Total</span><span>${formatCurrency(Number(order.totalAmount || 0))}</span></div>
      <div class="foot">Thank you for visiting NS Luxury Villa</div>
      <div class="noprint" style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 24px;font-size:12px">Print receipt</button></div>
      </body></html>`);
    win.document.close();
  };

  return (
    <ShellPage
      eyebrow={`${kind.toUpperCase()} · POINT OF SALE`}
      title={`${kind === 'restaurant' ? 'Restaurant' : 'Bar'} service`}
      subtitle="A focused order workstation connected to the live property database."
      actions={
        <div className="flex items-center gap-2">
          {canManage && (
            <Button size="sm" onClick={openAddItem}>
              <Plus size={14} /> Add item
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Menu items" value={items.length} icon={ShoppingBag} />
        <StatTile label="Orders loaded" value={orders.length} icon={Receipt} />
        <StatTile label="Current order" value={formatCurrency(total)} note={`${cart.reduce((s, i) => s + i.quantity, 0)} item(s)`} accent />
      </div>
      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <Section title="Menu" subtitle="Only items returned by the live menu API">
            <div className="border-b border-[#e8ebe8] p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#899397]" />
                  <input className="ns-input h-10 w-full pl-9 text-xs" placeholder="Search menu…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="flex gap-1 overflow-x-auto">
                  {cats.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`whitespace-nowrap rounded-xl px-3 py-2 text-[10px] font-extrabold ${
                        category === c ? 'bg-[#174b59] text-white' : 'border border-[#dfe4e0] bg-white text-[#718086]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {visible.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#899397]">No menu items are configured yet.</div>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((i) => (
                  <div
                    key={i.id}
                    onClick={() => add(i)}
                    className="cursor-pointer rounded-2xl border border-[#e7ebe8] bg-[#fbfcfa] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#cbd5d0] hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold text-[#26363e]">{i.name}</div>
                        <div className="mt-1 text-[10px] text-[#899397]">{i.category?.name || i.category || 'General'}</div>
                      </div>
                      <span className="text-xs font-extrabold text-[#8d693c]">{formatCurrency(Number(i.price || 0))}</span>
                    </div>
                    {i.isAvailable === false && <div className="mt-3">{statusBadge('OUT_OF_SERVICE')}</div>}
                    {canManage && (
                      <div className="mt-3 flex items-center gap-1.5 border-t border-[#edf0ed] pt-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleItem(i)}
                          title={i.isAvailable ? 'Take off menu' : 'Put on menu'}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e0e5e2] bg-white text-[#657278] hover:bg-[#f7f9f7]"
                        >
                          <Power size={12} />
                        </button>
                        <button
                          onClick={() => openEditItem(i)}
                          title="Edit item"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e0e5e2] bg-white text-[#657278] hover:bg-[#f7f9f7]"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => removeItem(i)}
                          title="Delete item"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e0e5e2] bg-white text-[#b23a3a] hover:bg-[#fdf1f1]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section title="Current order" subtitle="Review before posting">
            <div className="p-4">
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dfe4e0] p-10 text-center">
                  <ShoppingBag className="mx-auto text-[#a0aaad]" />
                  <div className="mt-3 text-xs font-extrabold text-[#59676d]">Order is empty</div>
                  <div className="mt-1 text-[10px] text-[#929da0]">Select menu items to begin.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 rounded-xl bg-[#f7f8f6] p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-[#26363e]">{i.name}</div>
                        <div className="text-[10px] text-[#899397]">{formatCurrency(Number(i.price))} each</div>
                      </div>
                      <button onClick={() => dec(i.id)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dfe4e0] bg-white">
                        <Minus size={12} />
                      </button>
                      <span className="w-4 text-center text-xs font-extrabold">{i.quantity}</span>
                      <button onClick={() => add(i)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dfe4e0] bg-white">
                        <Plus size={12} />
                      </button>
                      <strong className="w-20 text-right text-xs">{formatCurrency(Number(i.price) * i.quantity)}</strong>
                    </div>
                  ))}
                  <div className="mt-4 border-t border-[#e8ebe8] pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#899397]">Total</span>
                      <strong className="text-xl text-[#20343e]">{formatCurrency(total)}</strong>
                    </div>
                    <div className="mt-4 space-y-3">
                      <SelectInput value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                        <option value="DIRECT">Direct payment · Cash</option>
                        <option value="ROOM_CHARGE">Charge to guest folio</option>
                      </SelectInput>
                      {paymentType === 'ROOM_CHARGE' && (
                        <SelectInput value={selectedStay} onChange={(e) => setSelectedStay(e.target.value)} required>
                          <option value="">Select in-house guest</option>
                          {stays.map((s) => (
                            <option key={s.id} value={s.id}>
                              Room {s.room?.number || '—'} · {s.guest?.firstName || 'Guest'} {s.guest?.lastName || ''}
                            </option>
                          ))}
                        </SelectInput>
                      )}
                      <Button
                        className="w-full"
                        loading={submitting}
                        disabled={paymentType === 'ROOM_CHARGE' && !selectedStay}
                        onClick={submit}
                      >
                        <Receipt size={14} /> Post order
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      )}
      <Section title="Posted orders" subtitle="Recent transactions recorded at this workstation">
        <div className="overflow-x-auto">
          {orders.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#899397]">No orders have been posted yet.</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.12em] text-[#7d898d]">
                <tr>
                  <th className="px-5 py-3">Order no.</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ed]">
                {orders.slice(0, 10).map((o) => (
                  <tr key={o.id} className="hover:bg-[#fbfcfa]">
                    <td className="px-5 py-3 font-mono text-[11px] font-extrabold text-[#26363e]">{o.orderNo}</td>
                    <td className="px-5 py-3 text-[11px] text-[#718086]">{o.paymentMethod}</td>
                    <td className="px-5 py-3">{statusBadge(o.status || 'COMPLETED')}</td>
                    <td className="px-5 py-3 text-right text-[11px] font-extrabold text-[#26363e]">
                      {formatCurrency(Number(o.totalAmount || 0))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => printReceipt(o)}>
                        <Printer size={13} /> Print
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title={editingItem ? `Edit ${kind} item` : `New ${kind} item`}
      >
        <form onSubmit={saveItem} className="space-y-4 p-6">
          <FormField label="Name" required>
            <TextInput required value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} placeholder="Item name" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" required>
              <SelectInput required value={mForm.category} onChange={(e) => setMForm({ ...mForm, category: e.target.value })}>
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
                value={mForm.price}
                onChange={(e) => setMForm({ ...mForm, price: e.target.value })}
                placeholder="0.00"
              />
            </FormField>
          </div>
          <FormField label="Description">
            <TextInput
              value={mForm.description}
              onChange={(e) => setMForm({ ...mForm, description: e.target.value })}
              placeholder="Short description (optional)"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setManageOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingItem ? 'Save changes' : 'Add item'}
            </Button>
          </div>
        </form>
      </Modal>
    </ShellPage>
  );
};
