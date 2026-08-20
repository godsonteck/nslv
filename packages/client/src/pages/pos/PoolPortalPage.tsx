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
import { Button, FormField, TextInput, SelectInput, showToast, LoadingState, Modal } from '../../components/ui';
import { ShellPage, Section, StatTile } from '../../components/common/WorkspaceUI';
import { formatCurrency } from '@nslv/shared';
import { receiptCompanyBlock } from '../../lib/company';
import { villaAssets } from '../../assets';
import { useAuthStore } from '../../stores/authStore';

const POOL_PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'];

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

      if (loadedServices.length > 0) {
        if (!selectedServiceId || !loadedServices.some((s) => s.id === selectedServiceId)) {
          setSelectedServiceId(loadedServices[0].id);
          setCustomUnitPrice(String(loadedServices[0].price || '100'));
        }
        if (!chargeServiceId) {
          setChargeServiceId(loadedServices[0].id);
          setChargeUnitPrice(String(loadedServices[0].price || '100'));
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

  // When service selection changes, update unit price
  const handleServiceChange = (id: string) => {
    setSelectedServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) {
      setCustomUnitPrice(String(svc.price || '0'));
    }
  };

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const unitPriceNum = Number(customUnitPrice) || Number(selectedService?.price || 0);
  const countNum = Math.max(1, Number(partySize) || 1);
  const totalDue = isComplimentary ? 0 : unitPriceNum * countNum;

  // Accurate Local-Time Stats Calculation
  const todayAttendance = useMemo(() => attendance.filter((entry) => isSameDay(entry.createdAt)), [attendance]);
  const todayTransactions = useMemo(() => transactions.filter((tx) => isSameDay(tx.createdAt)), [transactions]);

  const totalVisitorsToday = useMemo(() => todayAttendance.reduce((sum, entry) => sum + Number(entry.partySize || 0), 0), [todayAttendance]);
  const salesToday = useMemo(() => todayTransactions.reduce((sum, tx) => sum + Number(tx.totalAmount || 0), 0), [todayTransactions]);
  const totalPaidSwimmersToday = useMemo(() => todayTransactions.reduce((sum, tx) => sum + Number(tx.quantity || 0), 0), [todayTransactions]);

  // Match each attendance record with its transaction without double-matching
  const matchedAttendanceList = useMemo(() => {
    const usedTxIds = new Set<string>();
    return attendance.map((entry) => {
      // Find matching transaction
      const matchedTx = transactions.find((tx) => {
        if (usedTxIds.has(tx.id)) return false;
        // 1) Explicit link: transaction notes reference this entry id (no time limit)
        const refMatch = tx.notes && tx.notes.includes(`#ENT:${entry.id}`);
        if (refMatch) return true;
        // 2) Fallback for unmarked/legacy transactions: same name on the same calendar day
        const nameMatch = tx.notes && tx.notes.toLowerCase().includes(entry.visitorName.toLowerCase());
        const dayMatch = isSameDay(tx.createdAt, new Date(entry.createdAt));
        return nameMatch && dayMatch;
      });

      if (matchedTx) {
        usedTxIds.add(matchedTx.id);
      }

      return {
        ...entry,
        matchedTx,
        isPaid: !!matchedTx,
        amountPaid: matchedTx ? Number(matchedTx.totalAmount || 0) : 0,
        paymentMethod: matchedTx ? matchedTx.paymentMethod : entry.notes?.toLowerCase().includes('complimentary') ? 'COMPLIMENTARY' : 'UNPAID',
      };
    });
  }, [attendance, transactions]);

  // Print Official Pool Receipt
  const printPoolReceipt = (data: {
    receiptNo?: string;
    visitorName: string;
    phone?: string;
    partySize: number;
    serviceName: string;
    unitPrice: number;
    totalAmount: number;
    paymentMethod: string;
    createdAt?: string;
    notes?: string;
  }) => {
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
          <tr>
            <td>${data.serviceName}</td>
            <td class="r">${data.partySize} × ${formatCurrency(data.unitPrice)}</td>
            <td class="r font-bold">${formatCurrency(data.totalAmount)}</td>
          </tr>
        </tbody>
      </table>
      <div class="total">
        <span>TOTAL AMOUNT PAID</span>
        <span>${formatCurrency(data.totalAmount)}</span>
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

      let txData: any = null;

      // 2. If charging, create pool transaction
      if (!isComplimentary && totalDue > 0) {
        let svcId = selectedServiceId;
        if (!svcId && services.length > 0) {
          svcId = services[0].id;
        }

        if (svcId) {
          const res = await posApi.createPoolTransaction({
            serviceId: svcId,
            quantity: count,
            paymentMethod,
            notes: `${notes ? `${nameTrimmed} (${count} pax) · ${notes}` : `${nameTrimmed} (${count} pax)`}${entryId ? ` · #ENT:${entryId}` : ''}`,
            idempotencyKey: crypto.randomUUID(),
          });
          txData = res?.data;
        }
      }

      showToast('success', `Pool entry for ${nameTrimmed} (${count} pax) recorded successfully!`);

      // 3. Print receipt if requested
      if (printNow) {
        printPoolReceipt({
          receiptNo: txData?.transactionNo,
          visitorName: nameTrimmed,
          phone: phone.trim() || undefined,
          partySize: count,
          serviceName: isComplimentary ? 'Complimentary / Resident Access' : selectedService?.name || 'Pool Day Pass',
          unitPrice: isComplimentary ? 0 : unitPriceNum,
          totalAmount: totalDue,
          paymentMethod: isComplimentary ? 'COMPLIMENTARY' : paymentMethod,
          notes: notes.trim() || undefined,
        });
      }

      // Reset form
      setVisitorName('');
      setPhone('');
      setPartySize('1');
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
    const svc = services[0];
    if (svc) {
      setChargeServiceId(svc.id);
      setChargeUnitPrice(String(svc.price || '100'));
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
        serviceId: chargeServiceId || services[0]?.id,
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
              className="border-[#C5A880]/50 text-[#C5A880] hover:bg-[#C5A880]/10 font-bold"
            >
              <Settings size={14} /> Adjust Pool Prices
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load}>
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
                      <label className="text-xs font-semibold text-[#A0A5AD]">Pass / Service Type *</label>
                      {canAdjustPrices && (
                        <button
                          type="button"
                          onClick={() => setPricingModalOpen(true)}
                          className="text-[11px] text-[#C5A880] hover:underline font-semibold flex items-center gap-1"
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
                      {services.length === 0 && <option value="">Standard Day Pass — GHS 100</option>}
                      {services.map((s) => (
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

                {/* Free / Resident Toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="complimentaryCheck"
                    checked={isComplimentary}
                    onChange={(e) => setIsComplimentary(e.target.checked)}
                    className="h-4 w-4 rounded border-[#2B303E] bg-[#14161D] text-[#C5A880] focus:ring-[#C5A880]"
                  />
                  <label htmlFor="complimentaryCheck" className="text-xs text-[#A0A5AD] cursor-pointer">
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
                <div className="rounded-xl bg-[#14161D] border border-[#2B303E] p-4 text-xs">
                  <div className="flex items-center justify-between text-[#A0A5AD] mb-1">
                    <span>Rate × Headcount:</span>
                    <span>
                      {formatCurrency(isComplimentary ? 0 : unitPriceNum)} × {countNum} swimmer{countNum > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-extrabold text-base pt-2 border-t border-[#2B303E]/50">
                    <span className="text-[#F4F4F2]">Total Amount Due:</span>
                    <span className="font-mono text-amber-300">
                      {isComplimentary ? 'FREE' : formatCurrency(totalDue)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 bg-[#C5A880] text-[#10131A] hover:bg-[#b59870] font-bold"
                    loading={busy}
                  >
                    <Printer size={15} /> Record &amp; Print Receipt
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={(e) => handleSubmitEntry(e, false)}
                    className="text-[#A0A5AD]"
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
            <div className="flex items-center justify-between border-b border-[#2B303E] pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('entries')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'entries'
                      ? 'bg-[#C5A880] text-[#10131A]'
                      : 'text-[#A0A5AD] hover:text-[#F4F4F2] hover:bg-[#14161D]'
                  }`}
                >
                  Swimmer Entries Log ({attendance.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'transactions'
                      ? 'bg-[#C5A880] text-[#10131A]'
                      : 'text-[#A0A5AD] hover:text-[#F4F4F2] hover:bg-[#14161D]'
                  }`}
                >
                  Paid Transactions &amp; Receipts ({transactions.length})
                </button>
              </div>

              <div className="text-[11px] text-[#6E737B]">
                Showing {activeTab === 'entries' ? attendance.length : transactions.length} records
              </div>
            </div>

            {activeTab === 'entries' ? (
              <Section
                title="Registered Swimmer Entries"
                subtitle="All visitor entries. Re-print receipts, attach payments to unpaid entries, or edit."
              >
                {matchedAttendanceList.length === 0 ? (
                  <div className="p-12 text-center text-xs text-[#6E737B]">
                    <Waves size={32} className="mx-auto mb-2 opacity-30 text-[#C5A880]" />
                    No pool entries recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[#2B303E]/50 max-h-[640px] overflow-y-auto">
                    {matchedAttendanceList.map((entry) => {
                      const amountPaid = entry.amountPaid;
                      const isPaid = entry.isPaid;
                      const paymentMethodName = entry.paymentMethod;

                      return (
                        <div
                          key={entry.id}
                          className="p-4 hover:bg-[#14161D]/60 transition-colors flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-[#F4F4F2] text-sm truncate">
                                {entry.visitorName}
                              </span>
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#232733] text-amber-300">
                                <Users size={11} /> {entry.partySize} {entry.partySize > 1 ? 'Swimmers' : 'Swimmer'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isPaid
                                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                                    : entry.paymentMethod === 'COMPLIMENTARY'
                                      ? 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                                      : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                                }`}
                              >
                                {isPaid
                                  ? `PAID · ${formatCurrency(amountPaid)} (${paymentMethodName})`
                                  : entry.paymentMethod === 'COMPLIMENTARY'
                                    ? 'COMPLIMENTARY'
                                    : 'UNPAID / ENTRY ONLY'}
                              </span>
                            </div>

                            <div className="text-[11px] text-[#6E737B] flex items-center gap-2">
                              <span>
                                {new Date(entry.createdAt).toLocaleString([], {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                              {entry.phone && (
                                <span className="flex items-center gap-1 font-mono text-[#A0A5AD]">
                                  <Phone size={10} /> {entry.phone}
                                </span>
                              )}
                            </div>

                            {entry.notes && (
                              <div className="text-[10px] text-[#A0A5AD] italic bg-[#14161D] px-2 py-0.5 rounded inline-block">
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
                                className="text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/30 font-bold"
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
                                    serviceName: entry.matchedTx?.service?.name || 'Pool Day Pass',
                                    unitPrice: entry.matchedTx ? Number(entry.matchedTx.unitPrice || 0) : 0,
                                    totalAmount: amountPaid,
                                    paymentMethod: paymentMethodName,
                                    createdAt: entry.createdAt,
                                    notes: entry.notes,
                                  })
                                }
                                className="text-[#C5A880] border-[#C5A880]/40 hover:bg-[#C5A880]/10"
                                title="Print Official Receipt"
                              >
                                <Printer size={13} /> Print
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditAttendance(entry)}
                              className="text-[#A0A5AD] hover:text-[#F4F4F2]"
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
                              className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
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
                  <div className="p-12 text-center text-xs text-[#6E737B]">
                    <ReceiptText size={32} className="mx-auto mb-2 opacity-30 text-[#C5A880]" />
                    No paid transactions recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[#2B303E]/50 max-h-[640px] overflow-y-auto">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-4 hover:bg-[#14161D]/60 transition-colors flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#F4F4F2] text-sm">
                              {tx.transactionNo || 'POL-TX'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#232733] text-amber-300 font-mono">
                              {tx.service?.name || 'Pool Pass'} × {tx.quantity}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
                              {formatCurrency(Number(tx.totalAmount || 0))}
                            </span>
                          </div>

                          <div className="text-[11px] text-[#6E737B] flex items-center gap-2">
                            <span>
                              {new Date(tx.createdAt).toLocaleString([], {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                            <span className="font-bold text-[#A0A5AD]">Method: {tx.paymentMethod}</span>
                          </div>

                          {tx.notes && (
                            <div className="text-[10px] text-[#A0A5AD] italic bg-[#14161D] px-2 py-0.5 rounded inline-block">
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
                            className="text-[#C5A880] border-[#C5A880]/40 hover:bg-[#C5A880]/10"
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
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
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
            <div className="p-3 bg-[#14161D] border border-[#2B303E] rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-[#A0A5AD]">
                <span>Visitor Name:</span>
                <span className="font-bold text-[#F4F4F2]">{chargingEntry.visitorName}</span>
              </div>
              <div className="flex justify-between text-[#A0A5AD]">
                <span>Swimmers Count:</span>
                <span className="font-bold text-amber-300">{chargingEntry.partySize} Swimmers</span>
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
                {services.map((s) => (
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

            <div className="p-3 bg-[#181B24] border border-[#C5A880]/40 rounded-xl flex justify-between items-center text-sm font-bold">
              <span className="text-[#F4F4F2]">Total To Collect:</span>
              <span className="text-amber-300 font-mono">
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
                className="bg-[#C5A880] text-[#10131A] font-bold"
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
                className="bg-[#C5A880] text-[#10131A] font-bold"
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
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 flex items-start gap-3">
              <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
              <div>
                <div className="font-bold text-red-300">Are you sure you want to delete this pool record?</div>
                <div className="text-[11px] text-red-200/80 mt-1">
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
                className="bg-red-600 hover:bg-red-500 text-white font-bold"
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
              <div className="text-[#A0A5AD]">
                Manage standard pool pass rates, rental items, and prices charged at reception.
              </div>
              {!showAddService && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddService(true)}
                  className="bg-[#C5A880]/10 border-[#C5A880] text-[#C5A880] hover:bg-[#C5A880]/20 font-bold shrink-0"
                >
                  <Plus size={13} /> Add Pass Rate
                </Button>
              )}
            </div>

            {/* Add New Service Form */}
            {showAddService && (
              <form
                onSubmit={handleCreateNewService}
                className="p-4 rounded-xl bg-[#14161D] border border-[#C5A880]/40 space-y-3"
              >
                <div className="flex items-center justify-between font-bold text-[#C5A880]">
                  <span>Add New Pool Pass / Service</span>
                  <button
                    type="button"
                    onClick={() => setShowAddService(false)}
                    className="text-[#6E737B] hover:text-[#F4F4F2]"
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
                    className="bg-[#C5A880] text-[#10131A] font-bold"
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
                        ? 'bg-[#181B24] border-[#2B303E]'
                        : 'bg-[#14161D]/50 border-[#2B303E]/40 opacity-70'
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
                            className="bg-[#C5A880] text-[#10131A] font-bold"
                          >
                            <Save size={13} /> Save Price
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#F4F4F2] text-sm">{svc.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                svc.isAvailable
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {svc.isAvailable ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {svc.description && (
                            <div className="text-[11px] text-[#A0A5AD]">{svc.description}</div>
                          )}
                          <div className="text-base font-extrabold text-amber-300 font-mono pt-1">
                            {formatCurrency(Number(svc.price || 0))}
                          </div>
                        </div>

                        {/* Actions: Edit Price, Toggle Available, Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditingService(svc)}
                            className="text-[#C5A880] border-[#C5A880]/40 hover:bg-[#C5A880]/10 font-bold"
                            title="Edit Price and Details"
                          >
                            <Edit2 size={13} /> Change Price
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleServiceAvailability(svc.id, svc.isAvailable)}
                            className={svc.isAvailable ? 'text-amber-400 hover:bg-amber-950/40' : 'text-emerald-400 hover:bg-emerald-950/40'}
                            title={svc.isAvailable ? 'Deactivate Pass' : 'Activate Pass'}
                          >
                            <Power size={13} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteService(svc.id, svc.name)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
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

            <div className="flex justify-end pt-2 border-t border-[#2B303E]">
              <Button
                type="button"
                variant="primary"
                onClick={() => setPricingModalOpen(false)}
                className="bg-[#C5A880] text-[#10131A] font-bold px-6"
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