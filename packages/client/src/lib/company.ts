import { formatCurrency } from '@nslv/shared';
import { villaAssets } from '../assets';

// Authoritative guest-facing property details. Keep these aligned with VILLA_* deployment settings.
export const company = {
  legalName: 'NS LUXURY VILLA',
  slogan: 'Arrive as a guest, stay as family',
  address: 'Lokoe, Ho, Ghana',
  digitalAddress: 'VH-0102-0933',
  phone: '+233 535 572 774',
  email: 'nsvilla4u@gmail.com',
  website: 'www.nsvilla.com',
  currency: 'GHS',
} as const;

export const receiptCompanyBlock = () => `
  <h1>${company.legalName}</h1>
  <div class="company">${company.address} &nbsp;|&nbsp; Digital Address: ${company.digitalAddress}<br/>Tel: ${company.phone}<br/>${company.email} &nbsp;|&nbsp; ${company.website}</div>
`;

interface PaymentReceiptContext {
  guestName?: string;
  bookingRef?: string;
  reservationId?: string;
  roomNumber?: string;
  /** Overrides payment.type when the record does not carry it (e.g. reservation deposit select) */
  type?: 'PAYMENT' | 'DEPOSIT' | 'REFUND';
  /** True when this deposit completes the reservation — print as a full payment receipt. */
  fullySettled?: boolean;
  /** True when this is a group booking deposit receipt. */
  isGroup?: boolean;
  /** Number of rooms in the group (shown on group receipts). */
  roomCount?: number;
  /** The total amount that was due / supposed to be paid. */
  amountDue?: number;
  /** For cash: how much the guest actually handed over. */
  tenderedAmount?: number;
  /** Remaining balance left to pay after this payment. */
  remainingBalance?: number;
  /** Change given back to guest. */
  changeGiven?: number;
}

/** Converts a numeric GHS amount into formal English words for financial receipts
 *  e.g. 1250.50 → "One Thousand Two Hundred and Fifty Ghana Cedis and Fifty Pesewas Only"
 */
export function amountToWords(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return '';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHundreds(n: number): string {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
      if (n > 0) result += 'and ';
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ones[n % 10] : '') + ' ';
    } else if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  }

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 1000) return convertHundreds(n);
    if (n < 1_000_000) {
      const thousands = Math.floor(n / 1000);
      const rem = n % 1000;
      return convert(thousands).trim() + ' Thousand ' + (rem > 0 && rem < 100 ? 'and ' : '') + convertHundreds(rem);
    }
    if (n < 1_000_000_000) {
      const millions = Math.floor(n / 1_000_000);
      const rem = n % 1_000_000;
      return convert(millions).trim() + ' Million ' + convert(rem);
    }
    return String(n);
  }

  const cedis = Math.floor(num);
  const pesewas = Math.round((num - cedis) * 100);

  let words = '';
  if (cedis > 0) {
    words += convert(cedis).trim() + ' Ghana Cedi' + (cedis !== 1 ? 's' : '');
  }
  if (pesewas > 0) {
    if (cedis > 0) words += ' and ';
    words += convert(pesewas).trim() + ' Pesewa' + (pesewas !== 1 ? 's' : '');
  }
  return words ? words + ' Only' : '';
}

// Prints an official luxury hospitality transaction receipt
export const printPaymentReceipt = (payment: any, context?: PaymentReceiptContext) => {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=460,height=780');
  if (!win) return;

  const type = context?.type || payment.type;
  const isRefund = type === 'REFUND';
  const isGroup = context?.isGroup ?? false;

  const amountPaid = (() => { const n = Number(payment.amount); return Number.isFinite(n) ? n : 0; })();
  const amountWords = amountToWords(amountPaid);

  // Always determine an authoritative Total Amount Due (never null)
  let amountDue: number;
  if (context?.amountDue !== undefined && context.amountDue !== null) {
    amountDue = Number(context.amountDue);
  } else if (payment?.amountDue !== undefined && payment.amountDue !== null) {
    amountDue = Number(payment.amountDue);
  } else if (context?.remainingBalance !== undefined && context.remainingBalance !== null) {
    amountDue = amountPaid + Number(context.remainingBalance);
  } else {
    amountDue = amountPaid;
  }

  const tenderedAmount = context?.tenderedAmount !== undefined && context.tenderedAmount !== null ? Number(context.tenderedAmount) : null;

  // Remaining balance
  let remainingBalance: number = 0;
  if (context?.remainingBalance !== undefined && context.remainingBalance !== null) {
    remainingBalance = Math.max(0, Number(context.remainingBalance));
  } else {
    remainingBalance = Math.max(0, amountDue - amountPaid);
  }

  // Change given
  let changeGiven: number | null = null;
  if (context?.changeGiven !== undefined && context.changeGiven !== null) {
    changeGiven = Math.max(0, Number(context.changeGiven));
  } else if (tenderedAmount !== null && tenderedAmount > amountPaid) {
    changeGiven = Math.max(0, tenderedAmount - amountPaid);
  }

  // Settled determination
  const settled = context?.fullySettled ?? (remainingBalance <= 0.005);
  const isDeposit = !isRefund && !settled;

  const title = isRefund ? 'OFFICIAL REFUND RECEIPT' : isDeposit ? 'PARTIAL PAYMENT RECEIPT' : 'OFFICIAL PAYMENT RECEIPT';
  const typeLabel = isRefund ? 'Refund' : isDeposit ? 'Part Payment / Deposit' : 'Full Payment';
  const statusBadge = isRefund
    ? '<span class="badge badge-refund">REFUND ISSUED</span>'
    : isDeposit
    ? '<span class="badge badge-deposit">PARTIAL PAYMENT</span>'
    : '<span class="badge badge-full">&#10003; PAID IN FULL</span>';

  const processedAt = payment.processedAt || payment.createdAt;
  const dateStr = processedAt
    ? new Date(processedAt).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  const guestName =
    context?.guestName ||
    (payment.guest
      ? `${payment.guest.firstName ?? ''} ${payment.guest.lastName ?? ''}`.trim() || 'Guest'
      : 'Guest');

  const receiptNo = `RCP-${payment.id?.slice(-8).toUpperCase() ?? '00000000'}`;

  const esc = (v: any) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const logoUrl = new URL(villaAssets.logo, window.location.href).href;

  const optRow = (label: string, value: string | undefined | null) =>
    value ? `<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(value)}</td></tr>` : '';

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${title} - ${esc(receiptNo)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Inter:wght@400;500;600;700;800&display=swap');
    body{
      font-family:'Inter',sans-serif;
      font-size:11.5px;
      color:#0f172a;
      background:#f1f5f9;
      padding:16px 0;
      margin:0 auto;
      width:440px;
    }
    .page{
      background:#fff;
      width:440px;
      padding:26px 24px 22px;
      border:1px solid #cbd5e1;
      border-radius:10px;
      box-shadow:0 3px 12px rgba(0,0,0,.05);
    }

    /* ── Header with Top-Right Receipt Box ── */
    .top-header{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:14px;
      padding-bottom:14px;
      border-bottom:2px solid #0f172a;
    }
    .brand-col{display:flex;gap:10px;align-items:center}
    .logo{width:46px;height:46px;border-radius:8px;object-fit:cover;border:1px solid #e2e8f0;flex-shrink:0}
    .co-name{font-family:'Cinzel',serif;font-size:15px;font-weight:800;letter-spacing:.06em;color:#0f172a;line-height:1.2}
    .co-sub{font-size:9.5px;font-style:italic;font-weight:600;color:#854d0e;margin-top:2px;letter-spacing:.01em}
    .co-loc{font-size:9.5px;color:#475569;margin-top:2px;line-height:1.4}
    
    /* ── Official Receipt Box (Top Right) ── */
    .receipt-box{
      background:#f8fafc;
      border:1px solid #cbd5e1;
      border-radius:6px;
      padding:8px 10px;
      text-align:right;
      min-width:145px;
      flex-shrink:0;
    }
    .doc-type{font-size:11px;font-weight:800;letter-spacing:.05em;color:#0f172a;text-transform:uppercase}
    .rcp-num{font-family:monospace;font-size:11.5px;font-weight:800;color:#0f172a;margin-top:2px;letter-spacing:.04em}
    .rcp-date{font-size:9px;color:#64748b;margin-top:2px}
    .badge{
      display:inline-block;padding:2.5px 7px;border-radius:4px;
      font-size:8.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-top:5px;
    }
    .badge-full{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
    .badge-deposit{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
    .badge-refund{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}

    /* ── Property Contact Banner ── */
    .contact-bar{
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:6px;
      padding:6px 10px;
      margin-top:12px;
      display:flex;
      justify-content:space-between;
      font-size:9.5px;
      color:#475569;
    }

    .group-banner{
      background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;
      border-radius:5px;padding:4px 10px;margin-top:10px;font-size:9.5px;font-weight:700;text-align:center;
    }

    /* ── Transaction Details Table ── */
    .details{width:100%;border-collapse:collapse;margin-top:12px}
    .details tr{border-bottom:1px solid #f1f5f9}
    .details tr:last-child{border-bottom:none}
    .details td{padding:5px 0;line-height:1.4}
    .details .lbl{font-size:10px;font-weight:600;color:#64748b;width:38%;text-transform:uppercase;letter-spacing:.03em}
    .details .val{font-size:11.5px;font-weight:600;color:#0f172a;text-align:right}

    /* ── Prominent Billing & Payment Table ── */
    .bill-section{margin-top:14px}
    .section-title{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#475569;margin-bottom:6px}
    .bill-table{width:100%;border-collapse:collapse;border:1.5px solid #0f172a;border-radius:6px;overflow:hidden}
    .bill-table td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:11.5px}
    .bill-table tr:last-child td{border-bottom:none}

    /* 1. Total Amount Due — Unmistakably Prominent */
    .row-due{background:#f8fafc}
    .row-due td{border-bottom:2px solid #cbd5e1}
    .lbl-due{font-size:12px;font-weight:800;color:#0f172a;letter-spacing:.02em}
    .val-due{font-size:16px;font-weight:800;color:#0f172a;text-align:right}

    /* 2. Amount Paid (This Transaction) */
    .row-paid{background:${isRefund ? '#fef2f2' : isDeposit ? '#fffbeb' : '#f0fdf4'}}
    .lbl-paid{font-size:12px;font-weight:800;color:${isRefund ? '#991b1b' : isDeposit ? '#92400e' : '#047857'}}
    .val-paid{font-size:18px;font-weight:800;color:${isRefund ? '#991b1b' : isDeposit ? '#92400e' : '#047857'};text-align:right}
    .words-note{font-size:9.5px;font-weight:600;color:#475569;font-style:italic;margin-top:3px;line-height:1.35}

    /* 3. Tendered & Change */
    .row-tendered td{font-size:11px;color:#475569}
    .row-change{background:#ecfdf5}
    .row-change td{font-size:12px;font-weight:800;color:#047857}

    /* 4. Remaining Balance */
    .row-balance{background:#fff}
    .row-balance.pending{background:#fffbeb}
    .row-balance.settled{background:#f0fdf4}
    .lbl-bal{font-size:12px;font-weight:800}
    .val-bal{font-size:14px;font-weight:800;text-align:right}

    /* ── Authorized Cashier Block ── */
    .auth-block{
      margin-top:14px;
      padding:8px 10px;
      border:1px dashed #cbd5e1;
      border-radius:6px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      font-size:9.5px;
      color:#475569;
    }
    .auth-title{font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:.03em}
    .auth-stamp{font-family:monospace;font-size:10px;font-weight:800;color:#047857;letter-spacing:.05em}

    /* ── Footer ── */
    .footer{
      text-align:center;
      margin-top:14px;
      padding-top:10px;
      border-top:1.5px solid #0f172a;
    }
    .footer .tagline{font-size:10px;font-weight:700;color:#0f172a;letter-spacing:.02em}
    .footer .sub{font-size:9px;color:#64748b;margin-top:2px}

    /* ── Print Button (Screen only) ── */
    .print-btn{
      display:block;width:100%;margin-top:14px;padding:10px;
      background:#0f172a;color:#fff;border:none;border-radius:6px;
      font-size:12px;font-weight:700;cursor:pointer;letter-spacing:.02em;
    }
    .print-btn:hover{background:#1e293b}

    @media print{
      body{background:#fff;padding:0;width:auto}
      .page{border:none;padding:10px;border-radius:0;width:100%;box-shadow:none}
      .noprint{display:none!important}
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ── Top Header with Top-Right Receipt Box ── -->
  <div class="top-header">
    <div class="brand-col">
      <img src="${logoUrl}" alt="NS Luxury Villa" class="logo"/>
      <div>
        <div class="co-name">${esc(company.legalName)}</div>
        <div class="co-sub">&ldquo;${esc(company.slogan)}&rdquo;</div>
        <div class="co-loc">Lokoe, Ho, Ghana</div>
      </div>
    </div>

    <!-- Official Receipt Box on Top Right -->
    <div class="receipt-box">
      <div class="doc-type">${esc(title)}</div>
      <div class="rcp-num">${esc(receiptNo)}</div>
      <div class="rcp-date">${esc(dateStr)}</div>
      <div>${statusBadge}</div>
    </div>
  </div>

  <!-- ── Property Credentials Bar ── -->
  <div class="contact-bar">
    <div><strong>Digital Address:</strong> ${esc(company.digitalAddress)}</div>
    <div><strong>Tel:</strong> ${esc(company.phone)}</div>
    <div><strong>Email:</strong> ${esc(company.email)}</div>
  </div>

  ${isGroup ? `<div class="group-banner">&#9651; Group Booking (${context?.roomCount ? `${context.roomCount} Rooms` : 'Multi-Room'})</div>` : ''}

  <!-- ── Guest & Stay Particulars ── -->
  <table class="details">
    <tbody>
      ${optRow(isGroup ? 'Lead Guest' : 'Received From', guestName)}
      ${optRow('Booking Reference', context?.bookingRef)}
      ${optRow('Room Number', context?.roomNumber)}
      <tr><td class="lbl">Payment Method</td><td class="val">${esc((payment.method || '—').replace(/_/g, ' '))}</td></tr>
      <tr><td class="lbl">Payment Type</td><td class="val">${esc(typeLabel)}</td></tr>
      ${optRow('Transaction Reference', payment.reference || null)}
    </tbody>
  </table>

  <!-- ── Financial Settlement & Audit Breakdown ── -->
  <div class="bill-section">
    <div class="section-title">Billing &amp; Settlement Summary</div>
    <table class="bill-table">
      <tbody>

        <!-- 1. TOTAL AMOUNT DUE (Prominent & Clear) -->
        <tr class="row-due">
          <td>
            <div class="lbl-due">TOTAL AMOUNT DUE (TOTAL BILL)</div>
            <div style="font-size:9.5px;color:#64748b;margin-top:1px">Full charges for reservation / stay</div>
          </td>
          <td class="val-due">${esc(formatCurrency(amountDue))}</td>
        </tr>

        <!-- 2. AMOUNT PAID THIS TRANSACTION -->
        <tr class="row-paid">
          <td>
            <div class="lbl-paid">${isRefund ? 'AMOUNT REFUNDED' : 'AMOUNT PAID (THIS RECEIPT)'}</div>
            ${amountWords ? `<div class="words-note"><strong>In words:</strong> ${esc(amountWords)}</div>` : ''}
          </td>
          <td class="val-paid">${esc(formatCurrency(amountPaid))}</td>
        </tr>

        <!-- 3. CASH TENDERED & CHANGE (if cash & handed over > amount) -->
        ${tenderedAmount !== null && tenderedAmount !== amountPaid ? `
        <tr class="row-tendered">
          <td style="color:#475569;font-weight:600">Cash Handed Over (Tendered)</td>
          <td style="text-align:right;font-weight:700;color:#0f172a">${esc(formatCurrency(tenderedAmount))}</td>
        </tr>` : ''}

        ${changeGiven !== null && changeGiven > 0.005 ? `
        <tr class="row-change">
          <td><strong>Change Returned to Guest</strong></td>
          <td style="text-align:right"><strong>${esc(formatCurrency(changeGiven))}</strong></td>
        </tr>` : ''}

        <!-- 4. REMAINING BALANCE DUE -->
        <tr class="row-balance ${settled ? 'settled' : 'pending'}">
          <td>
            <div class="lbl-bal" style="color:${settled ? '#047857' : '#92400e'}">
              ${settled ? 'ACCOUNT BALANCE' : 'REMAINING BALANCE DUE'}
            </div>
            ${!settled && remainingBalance > 0.005 ? `
              <div style="font-size:9.5px;color:#92400e;margin-top:1px;font-weight:500">Balance left to be cleared</div>
            ` : ''}
          </td>
          <td class="val-bal" style="color:${settled ? '#047857' : '#92400e'}">
            ${settled ? 'GHS 0.00 (Fully Settled)' : esc(formatCurrency(remainingBalance))}
          </td>
        </tr>

      </tbody>
    </table>
  </div>

  <!-- ── Cashier / Front Desk Verification ── -->
  <div class="auth-block">
    <div>
      <span class="auth-title">Served / Issued By:</span>
      <span style="font-weight:600;color:#0f172a"> ${esc(payment.processorName || 'Front Desk Cashier')}</span>
    </div>
    <div class="auth-stamp">&#10003; SYSTEM VERIFIED</div>
  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <p class="tagline">Thank you for choosing NS Luxury Villa &bull; Lokoe, Ho, Ghana</p>
    <p class="sub">Website: ${esc(company.website)} &bull; Phone: ${esc(company.phone)}</p>
  </div>

  <!-- ── Print Button (Screen only) ── -->
  <button class="print-btn noprint" onclick="window.print()">&#128438; Print Official Receipt</button>

</div>
</body>
</html>`);

  win.document.close();
};

export interface CashHandoverSlipData {
  businessDate: string;
  voucherRef?: string;
  handoverTime?: string;
  handedOverBy: string;
  receivedBy: string;
  openingFloat: number;
  cashSales: number;
  manualInflows: number;
  totalCollected: number;
  expenses: number;
  momoDeposits: number;
  totalDeductions: number;
  expectedAmount: number;
  handoverAmount: number;
  remainingCash: number;
  notes?: string;
  byCategory?: Record<string, number>;
}

// Prints an authoritative Close-of-Day Cash Handover Voucher
export const printCashHandoverSlip = (data: CashHandoverSlipData) => {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=540,height=860');
  if (!win) return;

  const esc = (v: any) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const logoUrl = new URL(villaAssets.logo, window.location.href).href;
  const amountWords = amountToWords(data.handoverAmount);
  const voucherRef = data.voucherRef || `HND-${Date.now().toString().slice(-6)}`;
  const dateFormatted = new Date(`${data.businessDate.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormatted = data.handoverTime
    ? new Date(data.handoverTime).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : new Date().toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Cash Handover Voucher - ${esc(voucherRef)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
    body{
      font-family:'Inter',sans-serif;
      font-size:11.5px;
      color:#0f172a;
      background:#f8fafc;
      padding:20px 0;
      margin:0 auto;
      width:500px;
    }
    .page{
      background:#fff;
      width:500px;
      padding:32px 28px 24px;
      border:1px solid #cbd5e1;
      border-radius:12px;
      box-shadow:0 4px 16px rgba(0,0,0,.06);
    }
    .header{text-align:center;padding-bottom:14px;border-bottom:2px solid #c59a58}
    .logo{height:54px;margin-bottom:8px;object-fit:contain}
    .title{font-family:'Cinzel',serif;font-size:16px;font-weight:800;color:#0c1921;letter-spacing:1px;text-transform:uppercase}
    .sub{font-size:10px;font-weight:600;color:#c59a58;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px}
    .address{font-size:10px;color:#64748b;margin-top:4px}
    
    .badge-bar{
      margin:14px 0 16px;
      background:#fcf9f2;
      border:1px solid #e7d8bc;
      border-radius:8px;
      padding:10px 14px;
      display:flex;
      justify-content:space-between;
      align-items:center;
    }
    .badge-bar .ref{font-family:monospace;font-size:13px;font-weight:800;color:#0c1921}
    .badge-bar .status{font-size:10px;font-weight:800;background:#0c1921;color:#fdfbf7;padding:3px 8px;border-radius:4px;letter-spacing:0.5px}

    .meta-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:8px 16px;
      margin-bottom:16px;
      font-size:11px;
    }
    .meta-item .lbl{color:#64748b;font-weight:500;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
    .meta-item .val{color:#0f172a;font-weight:700;margin-top:2px}

    .table-section{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11.5px}
    th{background:#0c1921;color:#fdfbf7;text-align:left;padding:7px 12px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase}
    td{padding:7px 12px;border-bottom:1px solid #f1f5f9}
    tr:last-child td{border-bottom:none}
    .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
    .section-header{background:#f8fafc;font-weight:700;color:#334155;font-size:10.5px}
    .total-row{background:#f1f5f9;font-weight:800;color:#0f172a}
    .highlight-row{background:#fcf9f2;border-top:2px solid #c59a58;border-bottom:2px solid #c59a58}
    .highlight-row td{font-size:13px;font-weight:800;color:#0c1921;padding:10px 12px}

    .words-box{
      background:#f8fafc;
      border:1px dashed #cbd5e1;
      border-radius:6px;
      padding:8px 12px;
      margin-bottom:16px;
      font-size:10.5px;
      color:#334155;
    }
    .words-box strong{color:#0f172a}

    .notes-box{
      background:#fff;
      border:1px solid #e2e8f0;
      border-radius:6px;
      padding:8px 12px;
      margin-bottom:20px;
      font-size:10.5px;
      color:#475569;
    }

    .sign-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:24px;
      margin-top:24px;
      padding-top:16px;
      border-top:1px dashed #cbd5e1;
    }
    .sign-block{text-align:center}
    .sign-line{margin-top:40px;border-bottom:1px solid #0f172a}
    .sign-title{font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-top:6px}
    .sign-name{font-size:11px;font-weight:600;color:#334155;margin-top:2px}

    .footer{text-align:center;margin-top:20px;font-size:9.5px;color:#94a3b8}
    .print-btn{
      display:block;
      width:100%;
      margin-top:20px;
      padding:12px;
      background:#0c1921;
      color:#fdfbf7;
      border:none;
      border-radius:8px;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
      transition:background .2s;
    }
    .print-btn:hover{background:#173c4d}

    @media print{
      body{background:#fff;padding:0;width:100%}
      .page{width:100%;box-shadow:none;border:none;padding:10px}
      .print-btn{display:none}
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <img src="${logoUrl}" alt="${esc(company.legalName)}" class="logo" onerror="this.style.display='none'"/>
    <div class="title">${esc(company.legalName)}</div>
    <div class="sub">Official Close-of-Day Cash Handover Voucher</div>
    <div class="address">${esc(company.address)} &bull; ${esc(company.phone)} &bull; ${esc(company.digitalAddress)}</div>
  </div>

  <div class="badge-bar">
    <div>
      <span style="font-size:9.5px;text-transform:uppercase;color:#71828a;font-weight:700">VOUCHER REFERENCE: </span>
      <span class="ref">${esc(voucherRef)}</span>
    </div>
    <div class="status">&#10003; CASH SETTLED &amp; HANDED OVER</div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <div class="lbl">Business Date</div>
      <div class="val">${esc(dateFormatted)}</div>
    </div>
    <div class="meta-item">
      <div class="lbl">Handover Timestamp</div>
      <div class="val">${esc(timeFormatted)}</div>
    </div>
    <div class="meta-item">
      <div class="lbl">Handed Over By (Reception)</div>
      <div class="val">${esc(data.handedOverBy)}</div>
    </div>
    <div class="meta-item">
      <div class="lbl">Received By (Management)</div>
      <div class="val">${esc(data.receivedBy)}</div>
    </div>
  </div>

  <div class="table-section">
    <table>
      <thead>
        <tr>
          <th>Daily Cash Breakdown</th>
          <th style="text-align:right">Amount (GHS)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Morning Opening Float (Today)</td>
          <td class="num">${esc(formatCurrency(data.openingFloat))}</td>
        </tr>
        <tr>
          <td>Cash Sales &amp; Collections (Front Desk + POS)</td>
          <td class="num">+${esc(formatCurrency(data.cashSales))}</td>
        </tr>
        ${data.manualInflows > 0 ? `
        <tr>
          <td>Manual Cash Inflows</td>
          <td class="num">+${esc(formatCurrency(data.manualInflows))}</td>
        </tr>` : ''}
        <tr class="section-header">
          <td><strong>Total Cash Inflow to Drawer</strong></td>
          <td class="num"><strong>+${esc(formatCurrency(data.totalCollected))}</strong></td>
        </tr>
        <tr>
          <td>Operational Expenses &amp; Drawer Payouts</td>
          <td class="num" style="color:#b91c1c">&minus;${esc(formatCurrency(data.expenses))}</td>
        </tr>
        ${data.momoDeposits > 0 ? `
        <tr>
          <td>MoMo Drawer Cash Transfers</td>
          <td class="num" style="color:#b91c1c">&minus;${esc(formatCurrency(data.momoDeposits))}</td>
        </tr>` : ''}
        <tr class="section-header">
          <td><strong>Total Drawer Deductions</strong></td>
          <td class="num" style="color:#b91c1c"><strong>&minus;${esc(formatCurrency(data.totalDeductions))}</strong></td>
        </tr>
        <tr class="total-row">
          <td><strong>Expected Cash Balance for Handover</strong></td>
          <td class="num"><strong>${esc(formatCurrency(data.expectedAmount))}</strong></td>
        </tr>
        <tr class="highlight-row">
          <td>
            <div style="font-size:11px;color:#c59a58;text-transform:uppercase;letter-spacing:0.5px">Official Handover Amount</div>
            <div style="font-size:14px;font-weight:800;color:#0c1921">ACTUAL CASH HANDED OVER TO MANAGEMENT</div>
          </td>
          <td class="num" style="font-size:16px;font-weight:900;color:#0c1921">
            ${esc(formatCurrency(data.handoverAmount))}
          </td>
        </tr>
        <tr>
          <td>
            <strong>Remaining Cash Retained at Reception Drawer</strong>
            <div style="font-size:9.5px;color:#64748b">Reception does not keep cash overnight; balanced to 0.00 GHS</div>
          </td>
          <td class="num" style="font-weight:800;color:#047857">
            ${esc(formatCurrency(data.remainingCash))}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  ${amountWords ? `
  <div class="words-box">
    <strong>Amount in Words:</strong> ${esc(amountWords)}
  </div>` : ''}

  ${data.notes ? `
  <div class="notes-box">
    <strong>Handover Notes / Verification:</strong> ${esc(data.notes)}
  </div>` : ''}

  <div class="sign-grid">
    <div class="sign-block">
      <div class="sign-line"></div>
      <div class="sign-title">Handed Over By (Receptionist)</div>
      <div class="sign-name">${esc(data.handedOverBy)}</div>
    </div>
    <div class="sign-block">
      <div class="sign-line"></div>
      <div class="sign-title">Received &amp; Verified By (Management)</div>
      <div class="sign-name">${esc(data.receivedBy)}</div>
    </div>
  </div>

  <div class="footer">
    <p>This is an official financial handover voucher of NS LUXURY VILLA.</p>
    <p>Cash is received daily by Management. No front-desk cash is carried overnight.</p>
  </div>

  <button class="print-btn noprint" onclick="window.print()">&#128438; Print Official Handover Voucher</button>
</div>
</body>
</html>`);

  win.document.close();
};
