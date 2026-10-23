import { formatCurrency } from '@nslv/shared';
import { villaAssets } from '../assets';

// Authoritative guest-facing property details. Keep these aligned with VILLA_* deployment settings.
export const company = {
  legalName: 'NS LUXURY VILLA',
  address: 'VH-0102-0933, Torgbui Sapeh St, Ho, Ghana',
  phone: '+233 535 572 774',
  email: 'nsvilla4u@gmail.com',
  website: 'www.nsvilla.com',
  currency: 'GHS',
} as const;

export const receiptCompanyBlock = () => `
  <h1>${company.legalName}</h1>
  <div class="company">${company.address}<br/>Tel: ${company.phone}<br/>${company.email} &nbsp;|&nbsp; ${company.website}</div>
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

// Prints a clean, simple, official per-transaction receipt for a payment/refund record
export const printPaymentReceipt = (payment: any, context?: PaymentReceiptContext) => {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=420,height=720');
  if (!win) return;

  const type = context?.type || payment.type;
  const isRefund = type === 'REFUND';
  const isGroup = context?.isGroup ?? false;

  const amount = (() => { const n = Number(payment.amount); return Number.isFinite(n) ? n : 0; })();
  const amountDue = context?.amountDue !== undefined && context.amountDue !== null ? Number(context.amountDue) : null;
  const tenderedAmount = context?.tenderedAmount !== undefined && context.tenderedAmount !== null ? Number(context.tenderedAmount) : null;

  // Remaining balance
  let remainingBalance: number | null = null;
  if (context?.remainingBalance !== undefined && context.remainingBalance !== null) {
    remainingBalance = Math.max(0, Number(context.remainingBalance));
  } else if (amountDue !== null) {
    remainingBalance = Math.max(0, amountDue - amount);
  }

  // Change given
  let changeGiven: number | null = null;
  if (context?.changeGiven !== undefined && context.changeGiven !== null) {
    changeGiven = Math.max(0, Number(context.changeGiven));
  } else if (tenderedAmount !== null && tenderedAmount > amount) {
    changeGiven = Math.max(0, tenderedAmount - amount);
  }

  // Settled determination: true if explicitly marked or if remaining balance is zero
  const settled = context?.fullySettled ?? (remainingBalance !== null ? remainingBalance <= 0.005 : type === 'PAYMENT');
  const isDeposit = !isRefund && !settled;

  const title = isRefund ? 'REFUND RECEIPT' : isDeposit ? 'PART PAYMENT RECEIPT' : 'OFFICIAL PAYMENT RECEIPT';
  const typeLabel = isRefund ? 'Refund' : isDeposit ? 'Part Payment / Deposit' : 'Full Payment';
  const statusBadge = isRefund
    ? '<span class="badge badge-refund">REFUND</span>'
    : isDeposit
    ? '<span class="badge badge-deposit">PART PAYMENT</span>'
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body{
      font-family:'Inter',sans-serif;
      font-size:11.5px;
      color:#111827;
      background:#f8fafc;
      padding:16px 0;
      margin:0 auto;
      width:380px;
    }
    .page{
      background:#fff;
      width:380px;
      padding:24px 22px;
      border:1px solid #e2e8f0;
      border-radius:8px;
    }

    /* ── Header ── */
    .header{text-align:center;padding-bottom:12px;border-bottom:1.5px solid #0f172a}
    .logo{width:48px;height:48px;border-radius:8px;object-fit:cover;margin:0 auto 8px;display:block}
    .co-name{font-size:15px;font-weight:800;letter-spacing:.05em;color:#0f172a}
    .co-detail{font-size:9.5px;color:#64748b;line-height:1.5;margin-top:2px}

    /* ── Receipt Banner ── */
    .title-band{
      text-align:center;
      padding:10px 12px 8px;
      margin-top:12px;
      border-bottom:1px dashed #cbd5e1;
    }
    .title-band .doc-title{font-size:13px;font-weight:800;letter-spacing:.06em;color:#0f172a}
    .title-band .receipt-no{font-size:9.5px;color:#64748b;margin-top:2px;font-family:monospace}
    .badge-wrap{margin-top:6px}
    .badge{
      display:inline-block;padding:2px 8px;border-radius:4px;
      font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
    }
    .badge-full{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
    .badge-deposit{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
    .badge-refund{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}

    .group-tag{
      background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;
      border-radius:4px;padding:3px 8px;margin-top:8px;font-size:9px;font-weight:700;text-align:center;
    }

    /* ── Details ── */
    .details{width:100%;border-collapse:collapse;margin-top:12px}
    .details tr{border-bottom:1px solid #f1f5f9}
    .details td{padding:5px 0;line-height:1.4}
    .details .lbl{font-size:10px;font-weight:600;color:#64748b;width:42%}
    .details .val{font-size:11px;font-weight:600;color:#0f172a;text-align:right}

    /* ── Settlement Box ── */
    .settle-box{
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:6px;
      margin-top:14px;
      overflow:hidden;
    }
    .settle-table{width:100%;border-collapse:collapse}
    .settle-table td{padding:6px 10px;font-size:11px}
    .settle-table tr{border-bottom:1px solid #edf2f7}
    .settle-table tr:last-child{border-bottom:none}
    .s-lbl{color:#475569;font-weight:500}
    .s-val{font-weight:700;text-align:right;color:#0f172a}
    .s-paid td{font-size:12.5px;font-weight:800;color:#047857;background:#f0fdf4}
    .s-change td{font-size:12px;font-weight:800;color:#047857;background:#ecfdf5}
    .s-balance td{font-size:12px;font-weight:800;color:#b45309;background:#fffbeb}

    /* ── Footer ── */
    .footer{
      text-align:center;
      margin-top:16px;
      padding-top:10px;
      border-top:1px dashed #cbd5e1;
    }
    .footer p{font-size:9px;color:#64748b;line-height:1.5}
    .footer .tagline{font-size:9.5px;font-weight:600;color:#334155;margin-top:2px}

    /* ── Action buttons (screen only) ── */
    .print-btn{
      display:block;width:100%;margin-top:14px;padding:9px;
      background:#0f172a;color:#fff;border:none;border-radius:6px;
      font-size:12px;font-weight:600;cursor:pointer;
    }
    .print-btn:hover{background:#1e293b}

    @media print{
      body{background:#fff;padding:0;width:auto}
      .page{border:none;padding:8px;border-radius:0;width:100%}
      .noprint{display:none!important}
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ── Header ── -->
  <div class="header">
    <img src="${logoUrl}" alt="NS Luxury Villa" class="logo"/>
    <div class="co-name">${esc(company.legalName)}</div>
    <div class="co-detail">
      ${esc(company.address)}<br/>
      Tel: ${esc(company.phone)} &nbsp;|&nbsp; ${esc(company.email)}
    </div>
  </div>

  <!-- ── Receipt title & badge ── -->
  <div class="title-band">
    <div class="doc-title">${esc(title)}</div>
    <div class="receipt-no">${esc(receiptNo)}</div>
    <div class="badge-wrap">${statusBadge}</div>
  </div>

  ${isGroup ? `<div class="group-tag">&#9651; Group Booking${context?.roomCount ? ` &middot; ${context.roomCount} Rooms` : ''}</div>` : ''}

  <!-- ── Transaction Details ── -->
  <table class="details">
    <tbody>
      ${optRow(isGroup ? 'Lead Guest' : 'Guest Name', guestName)}
      ${optRow('Booking Reference', context?.bookingRef)}
      ${optRow('Room', context?.roomNumber)}
      <tr><td class="lbl">Date &amp; Time</td><td class="val">${esc(dateStr)}</td></tr>
      <tr><td class="lbl">Payment Method</td><td class="val">${esc((payment.method || '—').replace(/_/g, ' '))}</td></tr>
      <tr><td class="lbl">Payment Type</td><td class="val">${esc(typeLabel)}</td></tr>
      ${optRow('Reference / Txn', payment.reference || null)}
      ${optRow('Received By', payment.processorName || null)}
    </tbody>
  </table>

  <!-- ── Settlement Summary ── -->
  <div class="settle-box">
    <table class="settle-table">
      ${amountDue !== null ? `
      <tr>
        <td class="s-lbl">Money Supposed to be Paid (Amount Due)</td>
        <td class="s-val">${esc(formatCurrency(amountDue))}</td>
      </tr>` : ''}
      <tr class="s-paid">
        <td class="s-lbl" style="color:#047857">${isRefund ? 'Amount Refunded' : 'Amount Paid'}</td>
        <td class="s-val" style="color:#047857">${esc(formatCurrency(amount))}</td>
      </tr>
      ${tenderedAmount !== null && tenderedAmount !== amount ? `
      <tr>
        <td class="s-lbl">Cash Tendered (Handed Over)</td>
        <td class="s-val">${esc(formatCurrency(tenderedAmount))}</td>
      </tr>` : ''}
      ${changeGiven !== null && changeGiven > 0.005 ? `
      <tr class="s-change">
        <td class="s-lbl" style="color:#047857">&#8594; Change Given to Guest</td>
        <td class="s-val" style="color:#047857">${esc(formatCurrency(changeGiven))}</td>
      </tr>` : ''}
      ${remainingBalance !== null && remainingBalance > 0.005 ? `
      <tr class="s-balance">
        <td class="s-lbl" style="color:#b45309">&#8594; Remaining Balance to be Paid</td>
        <td class="s-val" style="color:#b45309">${esc(formatCurrency(remainingBalance))}</td>
      </tr>` : ''}
      ${settled && !isRefund ? `
      <tr style="background:#f0fdf4">
        <td class="s-lbl" style="color:#047857;font-weight:700">Remaining Balance</td>
        <td class="s-val" style="color:#047857">GHS 0.00 (Fully Settled)</td>
      </tr>` : ''}
    </table>
  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <p>Official computer-generated receipt &bull; No signature required.</p>
    <p class="tagline">Thank you for choosing NS Luxury Villa &mdash; Ho, Ghana</p>
  </div>

  <!-- ── Print Button (Screen only) ── -->
  <button class="print-btn noprint" onclick="window.print()">&#128438; Print Receipt</button>

</div>
</body>
</html>`);

  win.document.close();
};
