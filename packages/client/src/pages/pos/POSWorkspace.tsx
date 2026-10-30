// ============================================
// NS LUXURY VILLA — POS Workspace
// Restaurant & Bar Point of Sale Workstation
// ============================================

import React, { useEffect, useMemo, useState } from 'react';
import { categoriesApi, posApi, staysApi } from '../../services/apiService';
import { clearGetCache } from '../../services/api';
import {
  Plus, Minus, RefreshCw, Receipt, Search, Printer, Pencil,
  Trash2, Power, ShoppingBag, UtensilsCrossed, Wine, X,
} from 'lucide-react';
import { Button, SelectInput, TextInput, showToast, LoadingState, statusBadge, Modal, FormField } from '../../components/ui';
import { TenderSplit, makeTenderRow, parseTenders, tendersCoverTotal, type TenderRow } from '../../components/ui/TenderSplit';
import { formatCurrency, PERMISSIONS } from '@nslv/shared';
import { useAuthStore } from '../../stores/authStore';
import { villaAssets } from '../../assets';
import { receiptCompanyBlock } from '../../lib/company';

type Kind = 'restaurant' | 'bar';

const CATEGORIES: Record<Kind, string[]> = {
  restaurant: ['STARTERS', 'MAINS', 'DESSERTS', 'BEVERAGES', 'SPECIALS'],
  bar: ['COCKTAILS', 'WINES', 'BEERS', 'SPIRITS', 'SOFT_DRINKS', 'SNACKS'],
};
const emptyForm = { name: '', category: '', price: '', description: '' };

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_MONEY: 'Mobile money',
  BANK_TRANSFER: 'Bank transfer',
  ROOM_CHARGE: 'Room charge',
};

const ACCENT = {
  restaurant: { color: 'var(--ns-gold)', btn: 'glass ns-glass-hover text-[var(--ns-gold)]' },
  bar: { color: 'var(--ns-purple)', btn: 'glass ns-glass-hover text-[var(--ns-purple)]' },
};

export const POSWorkspace: React.FC<{ kind: Kind }> = ({ kind }) => {
  const [items, setItems] = useState<any[]>([]);
  const [managedCategories, setManagedCategories] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [stays, setStays] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentType, setPaymentType] = useState('CASH');
  const [tenders, setTenders] = useState<TenderRow[]>([makeTenderRow()]);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [selectedStay, setSelectedStay] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('ALL');
  const canManage = useAuthStore((s) => s.hasPermission(kind === 'restaurant' ? PERMISSIONS.RESTAURANT_MENU : PERMISSIONS.BAR_MENU));
  const [manageOpen, setManageOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [mForm, setMForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const ac = ACCENT[kind];
  const Icon = kind === 'restaurant' ? UtensilsCrossed : Wine;

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
  const catName = (i: any) => i.category?.name || i.category || 'General';
  const cats = ['ALL', ...Array.from(new Set(items.map((i) => catName(i))))];
  const visible = items.filter(
    (i) => (category === 'ALL' || catName(i) === category) && (!q || i.name?.toLowerCase().includes(q.toLowerCase())),
  );

  const add = (item: any) => {
    setIdempotencyKey(null);
    setTenders([makeTenderRow()]);
    setCart((c) => {
      const x = c.find((i) => i.id === item.id);
      return x ? c.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)) : [...c, { ...item, quantity: 1 }];
    });
  };
  const dec = (id: string) => {
    setIdempotencyKey(null);
    setTenders([makeTenderRow()]);
    setCart((c) => c.flatMap((i) => (i.id === id ? (i.quantity > 1 ? [{ ...i, quantity: i.quantity - 1 }] : []) : [i])));
  };
  const removeLine = (id: string) => {
    setIdempotencyKey(null);
    setTenders([makeTenderRow()]);
    setCart((c) => c.filter((i) => i.id !== id));
  };
  const total = useMemo(() => cart.reduce((s, i) => s + Number(i.price || 0) * i.quantity, 0), [cart]);
  const totalQty = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const cartMap = useMemo(() => Object.fromEntries(cart.map((i) => [i.id, i.quantity])), [cart]);

  const submit = async () => {
    if (!cart.length) return;
    if (paymentType === 'SPLIT' && !tendersCoverTotal(tenders, total)) {
      showToast('error', 'Tender amounts must fully cover the order total');
      return;
    }
    try {
      setSubmitting(true);
      const requestKey = idempotencyKey ?? crypto.randomUUID();
      setIdempotencyKey(requestKey);
      const stay = stays.find((s) => s.id === selectedStay);
      const splitTenders = paymentType === 'SPLIT' ? parseTenders(tenders) : undefined;
      const body = {
        items: cart.map((i) => ({ itemId: i.id, quantity: i.quantity })),
        guestId: stay?.guestId,
        roomId: paymentType === 'ROOM_CHARGE' ? stay?.roomId || undefined : undefined,
        paymentMethod: paymentType === 'SPLIT' ? (splitTenders?.[0]?.method ?? 'CASH') : paymentType,
        ...(splitTenders ? { tenders: splitTenders } : {}),
        idempotencyKey: requestKey,
      };
      if (kind === 'restaurant') await posApi.createRestaurantOrder(body);
      else await posApi.createBarOrder(body);
      showToast('success', paymentType === 'ROOM_CHARGE' ? 'Order posted to the guest folio' : 'Order recorded successfully');
      setCart([]);
      setTenders([makeTenderRow()]);
      setIdempotencyKey(null);
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
      h1{font-size:15px;text-align:center;margin:0 0 4px} .company{text-align:center;font-size:10px;line-height:1.45;color:#444;margin-bottom:8px}.sub{text-align:center;font-size:10px;color:#555;margin-bottom:16px}
      .logo{display:block;margin:0 auto 10px;width:56px;height:56px;border-radius:12px;object-fit:cover}
      .row{display:flex;justify-content:space-between;font-size:11px;margin:2px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0} th{font-size:10px;text-align:left;border-bottom:1px solid #999;padding:4px 0}
      td{padding:3px 0;font-size:11px} td.r,th.r{text-align:right}
      .total{border-top:1px solid #111;padding-top:8px;font-size:13px;font-weight:bold;display:flex;justify-content:space-between}
      .foot{text-align:center;font-size:10px;color:#555;margin-top:18px;border-top:1px dashed #999;padding-top:8px}
      @media print{.noprint{display:none}}</style></head><body>
      <img src="${logoUrl}" alt="NS Luxury Villa" class="logo"/>
      ${receiptCompanyBlock()}<div class="sub">${title} · OFFICIAL RECEIPT</div>
      <div class="row"><span>Order No</span><span>${order.orderNo}</span></div>
      <div class="row"><span>Date</span><span>${new Date(order.createdAt).toLocaleString()}</span></div>
      <div class="row"><span>Payment</span><span>${paymentLabel}</span></div>
      <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Total</th></tr></thead><tbody>${lines}</tbody></table>
      <div class="total"><span>Amount paid</span><span>${formatCurrency(Number(order.totalAmount || 0))}</span></div>
      <div class="foot">Currency: GHS · This is a computer-generated receipt.<br/>Thank you for visiting NS Luxury Villa.</div>
      <div class="noprint" style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 24px;font-size:12px">Print receipt</button></div>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-300">
      {/* Compact Header */}
      <div className="ns-glass-band flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--ns-glass-line)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl glass border border-[var(--ns-gold)]/40 text-[var(--ns-gold)]">
            <Icon size={15} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>{kind === 'restaurant' ? 'Restaurant' : 'Bar'} POS</h1>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Select items, choose payment method, and complete order.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button size="sm" variant="outline" onClick={openAddItem}>
              <Plus size={14} /> Add Item
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { clearGetCache(); void load(); }}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">

          {/* ── Menu Panel ──────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {/* Category filter bar */}
            <div className="ns-card glass p-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ns-muted)]" />
                <input
                  className="ns-input h-9 w-full pl-9 text-xs"
                  placeholder="Search menu…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cats.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ns-glass-hover ${
                      category === c
                        ? 'ns-glass-selected text-[var(--ns-ink)] shadow'
                        : 'ns-glass-band text-[var(--ns-muted)] hover:text-[var(--ns-ink)] border border-[var(--ns-glass-line)]'
                    }`}
                    style={category === c ? { color: ac.color, borderColor: ac.color } : {}}
                  >
                    {c === 'ALL' ? 'All' : c.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu items grid */}
            {visible.length === 0 ? (
              <div className="ns-card glass p-14 text-center">
                <Icon size={28} className="mx-auto mb-3 opacity-20" style={{ color: ac.color }} />
                <p className="text-xs text-[var(--ns-muted)]">No items match this filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((i) => {
                  const inCart = cartMap[i.id] || 0;
                  const off = i.isAvailable === false;
                  return (
                    <div
                      key={i.id}
                      onClick={() => !off && add(i)}
                      className={`ns-card glass relative flex flex-col justify-between p-3 transition-all cursor-pointer group ${
                        off ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-lg'
                      }`}
                      style={inCart > 0 ? { borderColor: ac.color } : {}}
                    >
                      {inCart > 0 && (
                        <span
                          className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-bold text-[var(--ns-ink)] shadow"
                          style={{ backgroundColor: 'var(--ns-glass-1)' }}
                        >
                          {inCart}
                        </span>
                      )}
                      <div>
                        <div className="text-[11px] font-bold text-[var(--ns-ink)] leading-tight line-clamp-2">{i.name}</div>
                        <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--ns-muted)]">
                          {catName(i).replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-[var(--ns-glass-line)] pt-2">
                        <span className="text-[11px] font-extrabold" style={{ color: ac.color }}>
                          {formatCurrency(Number(i.price || 0))}
                        </span>
                        {off ? (
                          <span className="rounded ns-glass-band px-1.5 py-0.5 text-[8px] font-bold uppercase text-[var(--ns-warning)]">
                            Sold out
                          </span>
                        ) : (
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded text-[var(--ns-ink)] opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: 'var(--ns-glass-1)' }}
                          >
                            <Plus size={10} />
                          </span>
                        )}
                      </div>
                      {canManage && (
                        <div className="mt-2 flex items-center gap-1 border-t border-[var(--ns-glass-line)] pt-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleItem(i)} title={off ? 'Enable' : 'Disable'} className="rounded p-1 text-[var(--ns-muted)] hover:text-[var(--ns-gold)] transition-colors">
                            <Power size={10} />
                          </button>
                          <button onClick={() => openEditItem(i)} title="Edit" className="rounded p-1 text-[var(--ns-muted)] hover:text-[var(--ns-gold)] transition-colors">
                            <Pencil size={10} />
                          </button>
                          <button onClick={() => removeItem(i)} title="Delete" className="rounded p-1 text-[var(--ns-muted)] hover:text-[var(--ns-danger)] transition-colors">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Order Panel ──────────────────────────────────── */}
          <div className="ns-card glass flex flex-col gap-0 overflow-hidden sticky top-4">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--ns-glass-line)] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--ns-muted)]">Current Order</div>
                <div className="text-xs font-extrabold text-[var(--ns-ink)] mt-0.5">
                  {totalQty > 0 ? `${totalQty} item${totalQty > 1 ? 's' : ''}` : 'Empty'}
                </div>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => { setCart([]); setIdempotencyKey(null); }}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--ns-muted)] hover:text-[var(--ns-danger)] flex items-center gap-1 transition-colors"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            {/* Cart lines */}
            <div className="flex-1 px-4 py-3 min-h-[140px] max-h-[300px] overflow-y-auto space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                  <ShoppingBag size={22} className="text-[var(--ns-muted)] opacity-40 mb-2" />
                  <div className="text-[10px] text-[var(--ns-muted)]">Select items from the menu</div>
                </div>
              ) : (
                cart.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 rounded-lg ns-glass-band border border-[var(--ns-glass-line)] px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-[var(--ns-ink)] text-[11px]">{i.name}</div>
                      <div className="text-[9px] text-[var(--ns-muted)]">{formatCurrency(Number(i.price))} each</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => dec(i.id)} className="flex h-5 w-5 items-center justify-center rounded border border-[var(--ns-glass-line)] text-[var(--ns-muted)] hover:text-[var(--ns-ink)] transition-colors">
                        <Minus size={9} />
                      </button>
                      <span className="w-5 text-center font-bold text-[var(--ns-ink)] text-[11px]">{i.quantity}</span>
                      <button onClick={() => add(i)} className="flex h-5 w-5 items-center justify-center rounded text-[var(--ns-ink)]" style={{ backgroundColor: 'var(--ns-glass-1)' }}>
                        <Plus size={9} />
                      </button>
                    </div>
                    <span className="w-14 text-right font-bold text-[11px]" style={{ color: ac.color }}>{formatCurrency(Number(i.price) * i.quantity)}</span>
                    <button onClick={() => removeLine(i.id)} className="text-[var(--ns-muted)] hover:text-[var(--ns-danger)] transition-colors">
                      <X size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Totals & payment */}
            {cart.length > 0 && (
              <div className="border-t border-[var(--ns-glass-line)] px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--ns-muted)]">Order Total</span>
                  <span className="text-lg font-extrabold" style={{ color: ac.color }}>{formatCurrency(total)}</span>
                </div>

                <SelectInput value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="SPLIT">Split Payment</option>
                  <option value="ROOM_CHARGE">Charge to Guest Folio</option>
                </SelectInput>

                {paymentType === 'SPLIT' && (
                  <TenderSplit total={total} rows={tenders} onChange={setTenders} />
                )}

                {paymentType === 'ROOM_CHARGE' && (
                  <SelectInput value={selectedStay} onChange={(e) => setSelectedStay(e.target.value)} required>
                    <option value="">Select in-house guest</option>
                    {stays.map((s) => (
                      <option key={s.id} value={s.id}>
                        Room {s.room?.number || '—'} · {[s.guest?.firstName, s.guest?.lastName].filter(Boolean).join(' ') || 'Guest'}
                      </option>
                    ))}
                  </SelectInput>
                )}

                <button
                  disabled={submitting || !cart.length || (paymentType === 'ROOM_CHARGE' && !selectedStay) || (paymentType === 'SPLIT' && !tendersCoverTotal(tenders, total))}
                  onClick={submit}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-extrabold tracking-wider uppercase transition-all ${ac.btn} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Receipt size={13} />}
                  Post Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Posted Orders ──────────────────────────────── */}
      <div className="glass rounded-2xl border border-[var(--ns-glass-line)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] px-5 py-3.5 ns-glass-band">
          <div className="flex items-center gap-2">
            <Receipt size={14} className="text-[var(--ns-teal)]" />
            <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>Posted Orders</h2>
          </div>
          <p className="text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>Recent transactions at this workstation</p>
        </div>
        <div className="overflow-x-auto">
          {orders.length === 0 ? (
            <div className="p-10 text-center text-xs text-[var(--ns-muted)]">No orders posted yet.</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--ns-glass-line)]">
                  {['Order No', 'Payment', 'Status', 'Amount', ''].map((h) => (
                    <th key={h} className={`px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--ns-muted)] ${h === 'Amount' || h === '' ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-glass-line)]">
                {orders.slice(0, 12).map((o) => (
                  <tr key={o.id} className="ns-glass-hover transition-colors">
                    <td className="px-5 py-3 font-mono text-[11px] font-extrabold text-[var(--ns-ink)]">{o.orderNo}</td>
                    <td className="px-5 py-3 text-[11px] text-[var(--ns-muted)]">{PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod}</td>
                    <td className="px-5 py-3">{statusBadge(o.status || 'COMPLETED')}</td>
                    <td className="px-5 py-3 text-right text-[11px] font-extrabold" style={{ color: ac.color }}>
                      {formatCurrency(Number(o.totalAmount || 0))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => printReceipt(o)}>
                        <Printer size={12} /> Print
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Menu Item Modal ──────────────────────────────── */}
      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title={editingItem ? `Edit item` : `New menu item`}>
        <form onSubmit={saveItem} className="space-y-4 p-6">
          <FormField label="Name" required>
            <TextInput required value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} placeholder="Item name" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" required>
              <SelectInput required value={mForm.category} onChange={(e) => setMForm({ ...mForm, category: e.target.value })}>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Price (GHS)" required>
              <TextInput required type="number" min="0" step="0.01" value={mForm.price} onChange={(e) => setMForm({ ...mForm, price: e.target.value })} placeholder="0.00" />
            </FormField>
          </div>
          <FormField label="Description">
            <TextInput value={mForm.description} onChange={(e) => setMForm({ ...mForm, description: e.target.value })} placeholder="Short description (optional)" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setManageOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingItem ? 'Save Changes' : 'Add Item'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};