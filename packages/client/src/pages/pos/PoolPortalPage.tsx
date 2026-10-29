// ============================================
// NS LUXURY VILLA — Pool Services & Entry Counter
// Record Entry, Charge Pool Services, Print Receipts & Correct Mistakes
// Admin Pool Price Adjustment, Tally Reconciliation & Ledger
// ============================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users,
  RefreshCw,
  ClipboardCheck,
  Waves,
  ReceiptText,
  Printer,
  Edit2,
  Trash2,
  AlertTriangle,
  CreditCard,
  Phone,
  CheckCircle,
  Settings,
  Plus,
  Power,
  Save,
  X,
  DollarSign,
  Info,
  Check,
} from 'lucide-react';
import { posApi } from '../../services/apiService';
import { clearGetCache } from '../../services/api';
import { Button, FormField, TextInput, SelectInput, showToast, LoadingState, Modal } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
import { formatCurrency } from '@nslv/shared';
import { receiptCompanyBlock } from '../../lib/company';
import { villaAssets } from '../../assets';
import { useAuthStore } from '../../stores/authStore';

const POOL_PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'];

// Towels are sold as an optional add-on, never as a pass option.
const isTowelService = (s: any): boolean =>
  !!s && (s.category === 'TOWEL_RENTAL' || /towel/i.test(String(s.name || '')));

// Helper to check if a date is on the same local calendar day
function isSameDay(dateStr: string | Date, targetDate: Date = new Date()): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
}

export default function PoolPortalPage() {
  const canAdjustPrices = useAuthStore((s) => s.hasPermission('pool.manage') || s.hasRole('Admin') || s.hasRole('Manager'));
  const [attendance, setAttendance] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'entries' | 'transactions'>('entries');

  // Entry Form State
  const [visitorName, setVisitorName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState('1');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customUnitPrice, setCustomUnitPrice] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [isComplimentary, setIsComplimentary] = useState(false);
  const [towelQty, setTowelQty] = useState('0');
  const [notes, setNotes] = useState('');

  // Editing Entry Modal State
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPartySize, setEditPartySize] = useState('1');
  const [editNotes, setEditNotes] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  // Quick Charge / Add Payment Modal State (for previously recorded unpaid entries)
  const [chargingEntry, setChargingEntry] = useState<any | null>(null);
  const [chargeServiceId, setChargeServiceId] = useState('');
  const [chargeUnitPrice, setChargeUnitPrice] = useState('');
  const [chargePayMethod, setChargePayMethod] = useState('CASH');
  const [chargeBusy, setChargeBusy] = useState(false);

  // Deleting Modal State
  const [deletingItem, setDeletingItem] = useState<{ type: 'attendance' | 'transaction'; id: string; name: string; amount?: number } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Admin Pricing Management State
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServicePrice, setEditServicePrice] = useState('');
  const [editServiceCategory, setEditServiceCategory] = useState('DAY_PASS');
  const [editServiceDesc, setEditServiceDesc] = useState('');
  const [priceSaving, setPriceSaving] = useState(false);

  // New Service Form State
  const [showAddService, setShowAddService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('DAY_PASS');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceSaving, setNewServiceSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [att, svc, allSvc, txs] = await Promise.all([
        posApi.getPoolAttendance(),
        posApi.getPoolServices(),
        posApi.getPoolServices({ includeUnavailable: true }),
        posApi.getPoolTransactions(),
      ]);
      setAttendance(att.data || []);
      const loadedServices = svc.data || [];
      setServices(loadedServices);
      setAllServices(allSvc.data || loadedServices);
      setTransactions(txs.data || []);

      const passList = loadedServices.filter((s) => !isTowelService(s));
      if (passList.length > 0) {
        if (!selectedServiceId || !passList.some((s) => s.id === selectedServiceId)) {
          setSelectedServiceId(passList[0].id);
          setCustomUnitPrice(String(passList[0].price || '50'));
        }
        if (!chargeServiceId || !passList.some((s) => s.id === chargeServiceId)) {
          setChargeServiceId(passList[0].id);
          setChargeUnitPrice(String(passList[0].price || '50'));
        }
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to load pool data');
    } finally {
      setLoading(false);
    }
  }, [selectedServiceId, chargeServiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    clearGetCache();
    void load();
  };

  // When service selection changes, update unit price
  const handleServiceChange = (id: string) => {
    setSelectedServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) {
      setCustomUnitPrice(String(svc.price || '0'));
    }
  };

  const passServices = useMemo(() => services.filter((s) => !isTowelService(s)), [services]);
  const towelService = useMemo(() => services.find((s) => isTowelService(s)), [services]);
  const selectedService = passServices.find((s) => s.id === selectedServiceId);
  const unitPriceNum = Number(customUnitPrice) || Number(selectedService?.price || 0);
  const countNum = Math.max(1, Number(partySize) || 1);
  const towelUnitPrice = Number(towelService?.price || 0);
  const towelCount = Math.max(0, Math.floor(Number(towelQty) || 0));
  const passTotal = isComplimentary ? 0 : unitPriceNum * countNum;
  const towelTotal = isComplimentary ? 0 : towelUnitPrice * towelCount;
  const totalDue = passTotal + towelTotal;

  // Accurate Local-Time Stats Calculation
  const todayAttendance = useMemo(() => attendance.filter((entry) => isSameDay(entry.createdAt)), [attendance]);
  const todayTransactions = useMemo(() => transactions.filter((tx) => isSameDay(tx.createdAt)), [transactions]);

  const totalVisitorsToday = useMemo(() => todayAttendance.reduce((sum, entry) => sum + Number(entry.partySize || 0), 0), [todayAttendance]);
  const salesToday = useMemo(() => todayTransactions.reduce((sum, tx) => sum + Number(tx.totalAmount || 0), 0), [todayTransactions]);
  const totalPaidSwimmersToday = useMemo(
    () => todayTransactions.filter((tx) => !isTowelService(tx.service)).reduce((sum, tx) => sum + Number(tx.quantity || 0), 0),
    [todayTransactions],
  );

  // Match each attendance record with its transaction without double-matching
  const matchedAttendanceList = useMemo(() => {
    const usedTxIds = new Set<string>();
    return attendance.map((entry) => {
      // A single entry can have more than one transaction (e.g. pass + towels).
      const matches = transactions.filter((tx) => {
        if (usedTxIds.has(tx.id)) return false;
        // 1) Explicit link: transaction notes reference this entry id (no time limit)
        const refMatch = tx.notes && tx.notes.includes(`#ENT:${entry.id}`);
        if (refMatch) return true;
        // 2) Fallback for unmarked/legacy transactions: same name on the same calendar day
        const nameMatch = tx.notes && tx.notes.toLowerCase().includes(entry.visitorName.toLowerCase());
        const dayMatch = isSameDay(tx.createdAt, new Date(entry.createdAt));
        return nameMatch && dayMatch;
      });

      matches.forEach((tx) => usedTxIds.add(tx.id));

      const primaryTx = matches.find((tx) => !isTowelService(tx.service)) || matches[0];
      const amountPaid = matches.reduce((sum, tx) => sum + Number(tx.totalAmount || 0), 0);

      return {
        ...entry,
        transactions: matches,
        matchedTx: primaryTx,
        isPaid: matches.length > 0,
        amountPaid,
        paymentMethod: primaryTx
          ? primaryTx.paymentMethod
          : entry.notes?.toLowerCase().includes('complimentary')
            ? 'COMPLIMENTARY'
            : 'UNPAID',
      };
    });
  }, [attendance, transactions]);

  // Print Official Pool Receipt
  const printPoolReceipt = (data: {
    receiptNo?: string;
    visitorName: string;
    phone?: string;
    partySize: number;
    serviceName?: string;
    unitPrice?: number;
    items?: { name: string; qty: number; unitPrice: number; total: number }[];
    totalAmount: number;
    paymentMethod: string;
    createdAt?: string;
    notes?: string;
  }) => {
    const lineItems =
      data.items && data.items.length > 0
        ? data.items
        : [
            {
              name: data.serviceName || 'Pool Day Pass',
              qty: data.partySize,
              unitPrice: Number(data.unitPrice || 0),
              total: Number(data.totalAmount || 0),
            },
          ];
    const receiptTotal = lineItems.reduce((sum, it) => sum + Number(it.total || 0), 0);
    const win = window.open('', '_blank', 'width=380,height=600');
    if (!win) return;
    const logoUrl = new URL(villaAssets.logo, window.location.href).href;
    const receiptDate = data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString();
    const receiptNo =
      data.receiptNo ||
      `POL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

    win.document.write(`<!DOCTYPE html><html><head><title>POOL RECEIPT - ${receiptNo}</title><style>
      body{font-family:'Courier New',monospace;font-size:12px;color:#111;padding:24px;width:320px;margin:0 auto}
      h1{font-size:15px;text-align:center;margin:0 0 4px}
      .company{text-align:center;font-size:10px;line-height:1.45;color:#444;margin-bottom:8px}
      .sub{text-align:center;font-size:10px;font-weight:bold;color:#111;margin-bottom:12px;border-top:1px solid #111;border-bottom:1px solid #111;padding:4px 0}
      .logo{display:block;margin:0 auto 10px;width:56px;height:56px;border-radius:12px;object-fit:cover}
      .row{display:flex;justify-content:space-between;font-size:11px;margin:3px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th{font-size:10px;text-align:left;border-bottom:1px solid #999;padding:4px 0}
      td{padding:4px 0;font-size:11px}
      td.r,th.r{text-align:right}
      .total{border-top:1px solid #111;padding-top:8px;font-size:13px;font-weight:bold;display:flex;justify-content:space-between}
      .foot{text-align:center;font-size:10px;color:#555;margin-top:18px;border-top:1px dashed #999;padding-top:8px}
      @media print{.noprint{display:none}}
    </style></head><body>
      <img src="${logoUrl}" alt="NS Luxury Villa" class="logo"/>
      ${receiptCompanyBlock()}
      <div class="sub">POOL &amp; SWIMMING ENTRY RECEIPT</div>
      <div class="row"><span>Receipt No:</span><span style="font-weight:bold">${receiptNo}</span></div>
      <div class="row"><span>Date:</span><span>${receiptDate}</span></div>
      <div class="row"><span>Guest / Lead:</span><span style="font-weight:bold">${data.visitorName}</span></div>
      ${data.phone ? `<div class="row"><span>Phone:</span><span>${data.phone}</span></div>` : ''}
      <div class="row"><span>Swimmers:</span><span>${data.partySize} Person${data.partySize > 1 ? 's' : ''}</span></div>
      <div class="row"><span>Payment Method:</span><span style="font-weight:bold">${data.paymentMethod}</span></div>
      <table>
        <thead>
          <tr><th>Item / Service</th><th class="r">Qty × Rate</th><th class="r">Total</th></tr>
        </thead>
        <tbody>
          ${lineItems
            .map(
              (it) => `<tr>
            <td>${it.name}</td>
            <td class="r">${it.qty} × ${formatCurrency(it.unitPrice)}</td>
            <td class="r font-bold">${formatCurrency(it.total)}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>
      <div class="total">
        <span>TOTAL AMOUNT PAID</span>
        <span>${formatCurrency(receiptTotal)}</span>
      </div>
      ${data.notes ? `<div style="font-size:10px;color:#666;margin-top:8px">Notes: ${data.notes}</div>` : ''}
      <div class="foot">
        Currency: GHS · Valid for pool access on date of issue.<br/>
        Thank you for visiting NS Luxury Villa!
      </div>
      <div class="noprint" style="text-align:center;margin-top:16px">
        <button onclick="window.print()" style="padding:8px 24px;font-size:12px;font-weight:bold;cursor:pointer">Print receipt</button>
      </div>
    </body></html>`);
    win.document.close();
  };

  // Submit Entry + Payment & Trigger Print
  const handleSubmitEntry = async (e: React.FormEvent, printNow = true) => {
    e.preventDefault();
    const nameTrimmed = visitorName.trim();
    if (!nameTrimmed) {
      showToast('error', 'Please enter visitor or group lead name.');
      return;
    }
    const count = Number(partySize);
    if (!Number.isInteger(count) || count < 1) {
      showToast('error', 'Please enter a valid number of people.');
      return;
    }

    try {
      setBusy(true);

      // 1. Record Attendance Entry
      const attRes = await posApi.createPoolAttendance({
        visitorName: nameTrimmed,
        phone: phone.trim() || undefined,
        partySize: count,
        notes: isComplimentary ? `Complimentary access · ${notes.trim()}` : notes.trim() || undefined,
      });
      const entryId = attRes?.data?.id;

      const noteBase = `${nameTrimmed} (${count} pax)${notes.trim() ? ` · ${notes.trim()}` : ''}${entryId ? ` · #ENT:${entryId}` : ''}`;

      let txData: any = null;
      let towelTxData: any = null;
      const receiptItems: { name: string; qty: number; unitPrice: number; total: number }[] = [];

      // 2. If charging, create the pass transaction (and an optional towel add-on)
      if (!isComplimentary) {
        let svcId = selectedServiceId;
        if (!svcId && passServices.length > 0) {
          svcId = passServices[0].id;
        }

        if (svcId && passTotal > 0) {
          const res = await posApi.createPoolTransaction({
            serviceId: svcId,
            quantity: count,
            paymentMethod,
            notes: noteBase,
            idempotencyKey: crypto.randomUUID(),
          });
          txData = res?.data;
          receiptItems.push({
            name: selectedService?.name || 'Pool Day Pass',
            qty: count,
            unitPrice: unitPriceNum,
            total: passTotal,
          });
        }

        if (towelService && towelCount > 0 && towelTotal > 0) {
          const res = await posApi.createPoolTransaction({
            serviceId: towelService.id,
            quantity: towelCount,
            paymentMethod,
            notes: `${noteBase} · ${towelCount} towel${towelCount > 1 ? 's' : ''}`,
            idempotencyKey: crypto.randomUUID(),
          });
          towelTxData = res?.data;
          receiptItems.push({
            name: towelService.name,
            qty: towelCount,
            unitPrice: towelUnitPrice,
            total: towelTotal,
          });
        }
      }

      showToast('success', `Pool entry for ${nameTrimmed} (${count} pax) recorded successfully!`);

      // 3. Print receipt if requested
      if (printNow) {
        printPoolReceipt({
          receiptNo: txData?.transactionNo || towelTxData?.transactionNo,
          visitorName: nameTrimmed,
          phone: phone.trim() || undefined,
          partySize: count,
          items: isComplimentary
            ? [{ name: 'Complimentary / Resident Access', qty: count, unitPrice: 0, total: 0 }]
            : receiptItems,
          totalAmount: totalDue,
          paymentMethod: isComplimentary ? 'COMPLIMENTARY' : paymentMethod,
          notes: notes.trim() || undefined,
        });
      }

      // Reset form
      setVisitorName('');
      setPhone('');
      setPartySize('1');
      setTowelQty('0');
      setNotes('');
      setIsComplimentary(false);

      await load();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to record pool entry');
    } finally {
      setBusy(false);
    }
  };

  // Open Quick Charge Modal for unpaid previous entries
  const openChargeEntry = (entry: any) => {
    setChargingEntry(entry);
    const svc = passServices[0];
    if (svc) {
      setChargeServiceId(svc.id);
      setChargeUnitPrice(String(svc.price || '50'));
    }
    setChargePayMethod('CASH');
  };

  // Save Quick Charge for previous unpaid entry
  const handleSaveChargeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chargingEntry) return;

    const count = Number(chargingEntry.partySize || 1);
    const unitPrice = Number(chargeUnitPrice) || 100;
    const total = count * unitPrice;

    try {
      setChargeBusy(true);
      const res = await posApi.createPoolTransaction({
        serviceId: chargeServiceId || passServices[0]?.id,
        quantity: count,
        paymentMethod: chargePayMethod,
        notes: `${chargingEntry.visitorName} (${count} pax) · Payment recorded${chargingEntry.id ? ` · #ENT:${chargingEntry.id}` : ''}`,
        idempotencyKey: crypto.randomUUID(),
      });

      showToast('success', `Payment of ${formatCurrency(total)} recorded for ${chargingEntry.visitorName}!`);

      printPoolReceipt({
        receiptNo: res?.data?.transactionNo,
        visitorName: chargingEntry.visitorName,
        phone: chargingEntry.phone,
        partySize: count,
        serviceName: services.find((s) => s.id === chargeServiceId)?.name || 'Pool Day Pass',
        unitPrice: unitPrice,
        totalAmount: total,
        paymentMethod: chargePayMethod,
        notes: chargingEntry.notes,
      });

      setChargingEntry(null);
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setChargeBusy(false);
    }
  };

  // Open Edit Modal
  const openEditAttendance = (entry: any) => {
    setEditingEntry(entry);
    setEditName(entry.visitorName || '');
    setEditPhone(entry.phone || '');
    setEditPartySize(String(entry.partySize || 1));
    setEditNotes(entry.notes || '');
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    const nameTrim = editName.trim();
    if (!nameTrim) {
      showToast('error', 'Visitor name is required.');
      return;
    }
    const size = Number(editPartySize);
    if (!Number.isInteger(size) || size < 1) {
      showToast('error', 'Number of people must be at least 1.');
      return;
    }

    try {
      setEditBusy(true);
      await posApi.updatePoolAttendance(editingEntry.id, {
        visitorName: nameTrim,
        phone: editPhone.trim() || undefined,
        partySize: size,
        notes: editNotes.trim() || undefined,
      });
      showToast('success', 'Pool entry details updated.');
      setEditingEntry(null);
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update entry');
    } finally {
      setEditBusy(false);
    }
  };

  // Execute Deletion
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      setDeleteBusy(true);
      if (deletingItem.type === 'attendance') {
        await posApi.deletePoolAttendance(deletingItem.id);
        showToast('success', `Attendance entry for ${deletingItem.name} removed.`);
      } else {
        await posApi.deletePoolTransaction(deletingItem.id);
        showToast('success', `Pool charge ${deletingItem.name} deleted.`);
      }
      setDeletingItem(null);
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete record');
    } finally {
      setDeleteBusy(false);
    }
  };

  // Admin: Start Editing a Pool Service / Price
  const startEditingService = (svc: any) => {
    setEditingServiceId(svc.id);
    setEditServiceName(svc.name);
    setEditServicePrice(String(svc.price));
    setEditServiceCategory(svc.category || 'DAY_PASS');
    setEditServiceDesc(svc.description || '');
  };

  // Admin: Save Service Updates (Name, Price, Category, Description)
  const handleSaveServicePrice = async (svcId: string) => {
    const priceVal = Number(editServicePrice);
    if (isNaN(priceVal) || priceVal < 0) {
      showToast('error', 'Please enter a valid price greater than or equal to 0.');
      return;
    }
    if (!editServiceName.trim()) {
      showToast('error', 'Service name cannot be empty.');
      return;
    }

    try {
      setPriceSaving(true);
      await posApi.updatePoolService(svcId, {
        name: editServiceName.trim(),
        price: priceVal,
        category: editServiceCategory,
        description: editServiceDesc.trim() || undefined,
      });
      showToast('success', `Pool price for "${editServiceName.trim()}" updated to ${formatCurrency(priceVal)}!`);
      setEditingServiceId(null);
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update pool price');
    } finally {
      setPriceSaving(false);
    }
  };

  // Admin: Toggle Availability
  const handleToggleServiceAvailability = async (svcId: string, currentStatus: boolean) => {
    try {
      await posApi.togglePoolService(svcId, !currentStatus);
      showToast('success', `Pool service ${!currentStatus ? 'activated' : 'deactivated'}.`);
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to toggle service status');
    }
  };

  // Admin: Delete Service
  const handleDeleteService = async (svcId: string, svcName: string) => {
    if (!window.confirm(`Are you sure you want to remove pool service "${svcName}"?`)) return;
    try {
      await posApi.deletePoolService(svcId);
      showToast('success', `Pool service "${svcName}" deleted.`);
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete service');
    }
  };

  // Admin: Create New Pool Service / Pass
  const handleCreateNewService = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = newServiceName.trim();
    if (!nameTrim) {
      showToast('error', 'Service name is required.');
      return;
    }
    const priceVal = Number(newServicePrice);
    if (isNaN(priceVal) || priceVal < 0) {
      showToast('error', 'Price must be a valid number.');
      return;
    }

    try {
      setNewServiceSaving(true);
      await posApi.createPoolService({
        name: nameTrim,
        price: priceVal,
        category: newServiceCategory || 'DAY_PASS',
        description: newServiceDesc.trim() || undefined,
      });
      showToast('success', `Pool service "${nameTrim}" created at ${formatCurrency(priceVal)}!`);
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDesc('');
      setShowAddService(false);
      await load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create pool service');
    } finally {
      setNewServiceSaving(false);
    }
  };

  return (
    <ShellPage
      eyebrow="POOL · RECEPTION DESK &amp; CASHIER"
      title="Pool services"
      subtitle="Sell pool passes, record visitor attendance, print official receipts, and manage entries."
      actions={
        <div className="flex items-center gap-2">
          {canAdjustPrices && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPricingModalOpen(true)}
              className="border-[var(--ns-gold)] text-[var(--ns-gold)] ns-glass-hover font-bold"
            >
              <Settings size={14} /> Adjust Pool Prices
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      }
    >
      {/* 4 Summary Stat Cards with Accurate Reconciliation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total Swimmers Today"
          value={`${totalVisitorsToday} Swimmers`}
          note={`${todayAttendance.length} registered group${todayAttendance.length !== 1 ? 's' : ''}`}
          icon={Users}
          accent
        />
        <StatTile
          label="Paid Swimmers / Sales"
          value={`${totalPaidSwimmersToday} Swimmers`}
          note={`${todayTransactions.length} transaction${todayTransactions.length !== 1 ? 's' : ''}`}
          icon={ClipboardCheck}
        />
        <StatTile
          label="Pool Sales Today"
          value={formatCurrency(salesToday)}
          note="Accrued from paid pool passes"
          icon={Waves}
          accent
        />
        <StatTile
          label="Complimentary / Unpaid"
          value={`${Math.max(0, totalVisitorsToday - totalPaidSwimmersToday)} Swimmers`}
          note="Residents or uncollected entries"
          icon={ReceiptText}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading pool records..." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Unified Record Entry & Cashier Form */}
          <div className="lg:col-span-5">
            <Section title="Record Entry &amp; Charge" subtitle="Enter visitor details, select pass rate, and print receipt.">
              <form onSubmit={(e) => handleSubmitEntry(e, true)} className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Visitor / Group Lead Name" required>
                    <TextInput
                      required
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="e.g. Abu Sadiq"
                    />
                  </FormField>
                  <FormField label="Phone Number (Optional)">
                    <TextInput
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0597975124"
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Number of Swimmers / People" required>
                    <TextInput
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={partySize}
                      onChange={(e) => setPartySize(e.target.value)}
                    />
                  </FormField>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[var(--ns-muted)]">Pass / Service Type *</label>
                      {canAdjustPrices && (
                        <button
                          type="button"
                          onClick={() => setPricingModalOpen(true)}
                          className="text-[11px] text-[var(--ns-gold)] hover:underline font-semibold flex items-center gap-1"
                          title="Adjust prices or add new pool passes"
                        >
                          <Settings size={11} /> Adjust Prices
                        </button>
                      )}
                    </div>
                    <SelectInput
                      value={selectedServiceId}
                      onChange={(e) => handleServiceChange(e.target.value)}
                    >
                      {passServices.length === 0 && <option value="">Standard Day Pass — GHS 50</option>}
                      {passServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {formatCurrency(Number(s.price || 0))}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Rate per person (GHS)">
                    <TextInput
                      type="number"
                      min="0"
                      step="1"
                      disabled={isComplimentary}
                      value={isComplimentary ? '0' : customUnitPrice}
                      onChange={(e) => setCustomUnitPrice(e.target.value)}
                      placeholder="Rate per person"
                    />
                  </FormField>

                  <FormField label="Payment Method" required>
                    <SelectInput
                      disabled={isComplimentary}
                      value={isComplimentary ? 'COMPLIMENTARY' : paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      {POOL_PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>
                </div>

                {/* Optional Towel Add-on (separate from the pass) */}
                {towelService && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label={`Towels — Optional${towelUnitPrice > 0 ? ` (${formatCurrency(towelUnitPrice)} each)` : ''}`}>
                      <TextInput
                        type="number"
                        min="0"
                        step="1"
                        disabled={isComplimentary}
                        value={isComplimentary ? '0' : towelQty}
                        onChange={(e) => setTowelQty(e.target.value)}
                        placeholder="0"
                      />
                    </FormField>
                    <div className="flex items-end pb-1">
                      <p className="text-[11px] text-[var(--ns-muted)] leading-snug">
                        Not included in the pass. Leave at 0 if no towel is issued.
                      </p>
                    </div>
                  </div>
                )}

                {/* Free / Resident Toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="complimentaryCheck"
                    checked={isComplimentary}
                    onChange={(e) => setIsComplimentary(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--ns-glass-line)] glass-input text-[var(--ns-gold)] focus:ring-[var(--ns-gold)]"
                  />
                  <label htmlFor="complimentaryCheck" className="text-xs text-[var(--ns-muted)] cursor-pointer">
                    Complimentary / In-House Hotel Resident (Free Access)
                  </label>
                </div>

                <FormField label="Notes / Comments (Optional)">
                  <TextInput
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Towel issued, Room 102 guest, etc."
                  />
                </FormField>

                {/* Total Summary Box */}
                <div className="rounded-xl ns-glass-band border border-[var(--ns-glass-line)] p-4 text-xs">
                  <div className="flex items-center justify-between text-[var(--ns-muted)] mb-1">
                    <span>Rate × Headcount:</span>
                    <span>
                      {formatCurrency(isComplimentary ? 0 : unitPriceNum)} × {countNum} swimmer{countNum > 1 ? 's' : ''}
                    </span>
                  </div>
                  {!isComplimentary && towelCount > 0 && (
                    <div className="flex items-center justify-between text-[var(--ns-muted)] mb-1">
                      <span>Towels{towelService ? ` (${towelService.name})` : ''}:</span>
                      <span>
                        {formatCurrency(towelUnitPrice)} × {towelCount} towel{towelCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between font-extrabold text-base pt-2 border-t border-[var(--ns-glass-line)]">
                    <span className="text-[var(--ns-ink)]">Total Amount Due:</span>
                    <span className="font-mono text-[var(--ns-gold)]">
                      {isComplimentary ? 'FREE' : formatCurrency(totalDue)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 glass text-[var(--ns-ink)] ns-glass-hover font-bold"
                    loading={busy}
                  >
                    <Printer size={15} /> Record &amp; Print Receipt
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={(e) => handleSubmitEntry(e, false)}
                    className="text-[var(--ns-muted)]"
                  >
                    <CheckCircle size={14} /> Record Only
                  </Button>
                </div>
              </form>
            </Section>
          </div>

          {/* Right Column: Attendance & Entries Log + Cashier Transactions Tab */}
          <div className="lg:col-span-7 space-y-4">
            {/* Tab Navigation */}
            <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('entries')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'entries'
                      ? 'ns-glass-selected text-[var(--ns-ink)]'
                      : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)] ns-glass-hover'
                  }`}
                >
                  Swimmer Entries Log ({attendance.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'transactions'
                      ? 'ns-glass-selected text-[var(--ns-ink)]'
                      : 'text-[var(--ns-muted)] hover:text-[var(--ns-ink)] ns-glass-hover'
                  }`}
                >
                  Paid Transactions &amp; Receipts ({transactions.length})
                </button>
              </div>

              <div className="text-[11px] text-[var(--ns-muted)]">
                Showing {activeTab === 'entries' ? attendance.length : transactions.length} records
              </div>
            </div>

            {activeTab === 'entries' ? (
              <Section
                title="Registered Swimmer Entries"
                subtitle="All visitor entries. Re-print receipts, attach payments to unpaid entries, or edit."
              >
                {matchedAttendanceList.length === 0 ? (
                  <div className="p-12 text-center text-xs text-[var(--ns-muted)]">
                    <Waves size={32} className="mx-auto mb-2 opacity-30 text-[var(--ns-gold)]" />
                    No pool entries recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--ns-glass-line)] max-h-[640px] overflow-y-auto">
                    {matchedAttendanceList.map((entry) => {
                      const amountPaid = entry.amountPaid;
                      const isPaid = entry.isPaid;
                      const paymentMethodName = entry.paymentMethod;

                      return (
                        <div
                          key={entry.id}
                          className="p-4 ns-glass-hover transition-colors flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-[var(--ns-ink)] text-sm truncate">
                                {entry.visitorName}
                              </span>
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold glass-subtle text-[var(--ns-warning)] border border-[var(--ns-warning)]">
                                <Users size={11} /> {entry.partySize} {entry.partySize > 1 ? 'Swimmers' : 'Swimmer'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isPaid
                                    ? 'glass-subtle text-[var(--ns-success)] border border-[var(--ns-success)]'
                                    : entry.paymentMethod === 'COMPLIMENTARY'
                                      ? 'glass-subtle text-[var(--ns-info)] border border-[var(--ns-info)]'
                                      : 'glass-subtle text-[var(--ns-gold)] border border-[var(--ns-warning)]'
                                }`}
                              >
                                {isPaid
                                  ? `PAID · ${formatCurrency(amountPaid)} (${paymentMethodName})`
                                  : entry.paymentMethod === 'COMPLIMENTARY'
                                    ? 'COMPLIMENTARY'
                                    : 'UNPAID / ENTRY ONLY'}
                              </span>
                            </div>

                            <div className="text-[11px] text-[var(--ns-muted)] flex items-center gap-2">
                              <span>
                                {new Date(entry.createdAt).toLocaleString([], {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                              {entry.phone && (
                                <span className="flex items-center gap-1 font-mono text-[var(--ns-muted)]">
                                  <Phone size={10} /> {entry.phone}
                                </span>
                              )}
                            </div>

                            {entry.notes && (
                              <div className="text-[10px] text-[var(--ns-muted)] italic ns-glass-band border border-[var(--ns-glass-line)] px-2 py-0.5 rounded inline-block">
                                Note: {entry.notes}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons: Pay/Print, Edit, Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            {!isPaid ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openChargeEntry(entry)}
                                className="text-[var(--ns-success)] border-[var(--ns-success)] ns-glass-hover font-bold"
                                title="Collect payment and generate receipt"
                              >
                                <DollarSign size={13} /> Collect GHS
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  printPoolReceipt({
                                    receiptNo: entry.matchedTx?.transactionNo,
                                    visitorName: entry.visitorName,
                                    phone: entry.phone,
                                    partySize: entry.partySize,
                                    items: (entry.transactions || []).map((t: any) => ({
                                      name: t.service?.name || 'Pool Pass',
                                      qty: Number(t.quantity || 1),
                                      unitPrice: Number(t.unitPrice || 0),
                                      total: Number(t.totalAmount || 0),
                                    })),
                                    totalAmount: amountPaid,
                                    paymentMethod: paymentMethodName,
                                    createdAt: entry.createdAt,
                                    notes: entry.notes,
                                  })
                                }
                                className="text-[var(--ns-gold)] border-[var(--ns-gold)] ns-glass-hover"
                                title="Print Official Receipt"
                              >
                                <Printer size={13} /> Print
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditAttendance(entry)}
                              className="text-[var(--ns-muted)] hover:text-[var(--ns-ink)]"
                              title="Edit / Correct Entry"
                            >
                              <Edit2 size={13} />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeletingItem({
                                  type: 'attendance',
                                  id: entry.id,
                                  name: `${entry.visitorName} (${entry.partySize} pax)`,
                                })
                              }
                              className="text-[var(--ns-danger)] hover:text-[var(--ns-danger)] ns-glass-hover"
                              title="Delete Entry"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            ) : (
              <Section
                title="Paid Pool Transactions &amp; Receipts"
                subtitle="Official cashier payment ledger for pool passes and rentals."
              >
                {transactions.length === 0 ? (
                  <div className="p-12 text-center text-xs text-[var(--ns-muted)]">
                    <ReceiptText size={32} className="mx-auto mb-2 opacity-30 text-[var(--ns-gold)]" />
                    No paid transactions recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--ns-glass-line)] max-h-[640px] overflow-y-auto">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-4 ns-glass-hover transition-colors flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[var(--ns-ink)] text-sm">
                              {tx.transactionNo || 'POL-TX'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold glass-subtle text-[var(--ns-warning)] border border-[var(--ns-warning)] font-mono">
                              {tx.service?.name || 'Pool Pass'} × {tx.quantity}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold glass-subtle text-[var(--ns-success)] border border-[var(--ns-success)] font-mono">
                              {formatCurrency(Number(tx.totalAmount || 0))}
                            </span>
                          </div>

                          <div className="text-[11px] text-[var(--ns-muted)] flex items-center gap-2">
                            <span>
                              {new Date(tx.createdAt).toLocaleString([], {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                            <span className="font-bold text-[var(--ns-muted)]">Method: {tx.paymentMethod}</span>
                          </div>

                          {tx.notes && (
                            <div className="text-[10px] text-[var(--ns-muted)] italic ns-glass-band px-2 py-0.5 rounded inline-block">
                              {tx.notes}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons: Print, Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              printPoolReceipt({
                                receiptNo: tx.transactionNo,
                                visitorName: tx.notes?.split('(')[0]?.trim() || 'Pool Guest',
                                partySize: tx.quantity || 1,
                                serviceName: tx.service?.name || 'Pool Day Pass',
                                unitPrice: Number(tx.unitPrice || 0),
                                totalAmount: Number(tx.totalAmount || 0),
                                paymentMethod: tx.paymentMethod,
                                createdAt: tx.createdAt,
                                notes: tx.notes,
                              })
                            }
                            className="text-[var(--ns-gold)] border-[var(--ns-gold)] ns-glass-hover"
                            title="Print Official Receipt"
                          >
                            <Printer size={13} /> Print
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeletingItem({
                                type: 'transaction',
                                id: tx.id,
                                name: `${tx.transactionNo} (${formatCurrency(Number(tx.totalAmount || 0))})`,
                              })
                            }
                            className="text-[var(--ns-danger)] hover:text-[var(--ns-danger)] ns-glass-hover"
                            title="Delete Transaction"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>
        </div>
      )}

      {/* Quick Collect Payment Modal (for converting unpaid entries into paid) */}
      {chargingEntry && (
        <Modal
          open={!!chargingEntry}
          onClose={() => setChargingEntry(null)}
          title={`Collect Payment · ${chargingEntry.visitorName} (${chargingEntry.partySize} pax)`}
        >
          <form onSubmit={handleSaveChargeEntry} className="space-y-4 text-xs">
            <div className="p-3 ns-glass-band border border-[var(--ns-glass-line)] rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-[var(--ns-muted)]">
                <span>Visitor Name:</span>
                <span className="font-bold text-[var(--ns-ink)]">{chargingEntry.visitorName}</span>
              </div>
              <div className="flex justify-between text-[var(--ns-muted)]">
                <span>Swimmers Count:</span>
                <span className="font-bold text-[var(--ns-gold)]">{chargingEntry.partySize} Swimmers</span>
              </div>
            </div>

            <FormField label="Select Pool Pass / Service" required>
              <SelectInput
                value={chargeServiceId}
                onChange={(e) => {
                  setChargeServiceId(e.target.value);
                  const svc = services.find((s) => s.id === e.target.value);
                  if (svc) setChargeUnitPrice(String(svc.price || '0'));
                }}
              >
                {passServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatCurrency(Number(s.price || 0))}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Rate per Swimmer (GHS)" required>
                <TextInput
                  type="number"
                  min="0"
                  step="1"
                  value={chargeUnitPrice}
                  onChange={(e) => setChargeUnitPrice(e.target.value)}
                />
              </FormField>

              <FormField label="Payment Method" required>
                <SelectInput
                  value={chargePayMethod}
                  onChange={(e) => setChargePayMethod(e.target.value)}
                >
                  {POOL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </div>

            <div className="p-3 ns-glass-band border border-[var(--ns-gold)] rounded-xl flex justify-between items-center text-sm font-bold">
              <span className="text-[var(--ns-ink)]">Total To Collect:</span>
              <span className="text-[var(--ns-gold)] font-mono">
                {formatCurrency(Number(chargingEntry.partySize || 1) * (Number(chargeUnitPrice) || 0))}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={chargeBusy}
                onClick={() => setChargingEntry(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={chargeBusy}
                className="glass text-[var(--ns-ink)] font-bold"
              >
                <Check size={14} /> Collect &amp; Print Receipt
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <Modal
          open={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title={`Edit Pool Entry · ${editingEntry.visitorName}`}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <FormField label="Visitor / Lead Name" required>
              <TextInput
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </FormField>

            <FormField label="Phone Number">
              <TextInput
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </FormField>

            <FormField label="Number of Swimmers / People" required>
              <TextInput
                required
                type="number"
                min="1"
                step="1"
                value={editPartySize}
                onChange={(e) => setEditPartySize(e.target.value)}
              />
            </FormField>

            <FormField label="Notes">
              <TextInput
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={editBusy}
                onClick={() => setEditingEntry(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={editBusy}
                className="glass text-[var(--ns-ink)] font-bold"
              >
                Save Corrections
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete / Void Confirmation Modal */}
      {deletingItem && (
        <Modal
          open={!!deletingItem}
          onClose={() => !deleteBusy && setDeletingItem(null)}
          title="Delete Pool Record"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl glass-subtle border border-[var(--ns-danger)] flex items-start gap-3">
              <AlertTriangle className="text-[var(--ns-danger)] shrink-0 mt-0.5" size={18} />
              <div>
                <div className="font-bold text-[var(--ns-danger)]">Are you sure you want to delete this pool record?</div>
                <div className="text-[11px] text-[var(--ns-danger)] mt-1">
                  You are deleting the entry for <strong>{deletingItem.name}</strong>. This cannot be undone.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={deleteBusy}
                onClick={() => setDeletingItem(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={deleteBusy}
                onClick={handleConfirmDelete}
                className="glass ns-glass-hover text-[var(--ns-danger)] font-bold"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin: Adjust Pool Prices & Services Modal */}
      {pricingModalOpen && (
        <Modal
          open={pricingModalOpen}
          onClose={() => {
            setPricingModalOpen(false);
            setEditingServiceId(null);
            setShowAddService(false);
          }}
          title="Adjust Pool Prices & Services"
        >
          <div className="space-y-5 text-xs max-h-[75vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <div className="text-[var(--ns-muted)]">
                Manage standard pool pass rates, rental items, and prices charged at reception.
              </div>
              {!showAddService && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddService(true)}
                  className="glass border-[var(--ns-gold)] text-[var(--ns-gold)] ns-glass-hover font-bold shrink-0"
                >
                  <Plus size={13} /> Add Pass Rate
                </Button>
              )}
            </div>

            {/* Add New Service Form */}
            {showAddService && (
              <form
                onSubmit={handleCreateNewService}
                className="p-4 rounded-xl ns-glass-band border border-[var(--ns-gold)] space-y-3"
              >
                <div className="flex items-center justify-between font-bold text-[var(--ns-gold)]">
                  <span>Add New Pool Pass / Service</span>
                  <button
                    type="button"
                    onClick={() => setShowAddService(false)}
                    className="text-[var(--ns-muted)] hover:text-[var(--ns-ink)]"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Pass / Service Name" required>
                    <TextInput
                      required
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="e.g. VIP Day Pass"
                    />
                  </FormField>
                  <FormField label="Price (GHS)" required>
                    <TextInput
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                      placeholder="e.g. 150"
                    />
                  </FormField>
                </div>
                <FormField label="Description (Optional)">
                  <TextInput
                    value={newServiceDesc}
                    onChange={(e) => setNewServiceDesc(e.target.value)}
                    placeholder="e.g. Includes towel and welcome drink"
                  />
                </FormField>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddService(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={newServiceSaving}
                    className="glass text-[var(--ns-ink)] font-bold"
                  >
                    <Save size={13} /> Save New Pass
                  </Button>
                </div>
              </form>
            )}

            {/* List of Pool Services with Inline Price Adjustment */}
            <div className="space-y-3">
              {allServices.map((svc) => {
                const isEditing = editingServiceId === svc.id;

                return (
                  <div
                    key={svc.id}
                    className={`p-4 rounded-xl border transition-all ${
                      svc.isAvailable
                        ? 'ns-glass-band border-[var(--ns-glass-line)]'
                        : 'ns-glass-band border-[var(--ns-glass-line)] opacity-70'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField label="Service Name" required>
                            <TextInput
                              value={editServiceName}
                              onChange={(e) => setEditServiceName(e.target.value)}
                            />
                          </FormField>
                          <FormField label="Price (GHS)" required>
                            <TextInput
                              type="number"
                              min="0"
                              step="1"
                              value={editServicePrice}
                              onChange={(e) => setEditServicePrice(e.target.value)}
                            />
                          </FormField>
                        </div>
                        <FormField label="Description">
                          <TextInput
                            value={editServiceDesc}
                            onChange={(e) => setEditServiceDesc(e.target.value)}
                          />
                        </FormField>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={priceSaving}
                            onClick={() => setEditingServiceId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            loading={priceSaving}
                            onClick={() => handleSaveServicePrice(svc.id)}
                            className="glass text-[var(--ns-ink)] font-bold"
                          >
                            <Save size={13} /> Save Price
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[var(--ns-ink)] text-sm">{svc.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                svc.isAvailable
                                  ? 'glass-subtle text-[var(--ns-success)] border border-[var(--ns-success)]'
                                  : 'ns-glass-band text-[var(--ns-muted)]'
                              }`}
                            >
                              {svc.isAvailable ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {svc.description && (
                            <div className="text-[11px] text-[var(--ns-muted)]">{svc.description}</div>
                          )}
                          <div className="text-base font-extrabold text-[var(--ns-gold)] font-mono pt-1">
                            {formatCurrency(Number(svc.price || 0))}
                          </div>
                        </div>

                        {/* Actions: Edit Price, Toggle Available, Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditingService(svc)}
                            className="text-[var(--ns-gold)] border-[var(--ns-gold)] ns-glass-hover font-bold"
                            title="Edit Price and Details"
                          >
                            <Edit2 size={13} /> Change Price
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleServiceAvailability(svc.id, svc.isAvailable)}
                            className={svc.isAvailable ? 'text-[var(--ns-warning)] ns-glass-hover' : 'text-[var(--ns-success)] ns-glass-hover'}
                            title={svc.isAvailable ? 'Deactivate Pass' : 'Activate Pass'}
                          >
                            <Power size={13} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteService(svc.id, svc.name)}
                            className="text-[var(--ns-danger)] hover:text-[var(--ns-danger)] ns-glass-hover"
                            title="Delete Service"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--ns-glass-line)]">
              <Button
                type="button"
                variant="primary"
                onClick={() => setPricingModalOpen(false)}
                className="glass text-[var(--ns-ink)] font-bold px-6"
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ShellPage>
  );
}
