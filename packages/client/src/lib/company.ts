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
  const win = window.open('', '_blank', 'width=440,height=760');
  if (!win) return;

  const type = context?.type || payment.type;
  const isRefund = type === 'REFUND';
  const isGroup = context?.isGroup ?? false;

  const amount = (() => { const n = Number(payment.amount); return Number.isFinite(n) ? n : 0; })();
  const amountWords = amountToWords(amount);
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

  const title = isRefund ? 'OFFICIAL REFUND RECEIPT' : isDeposit ? 'PARTIAL PAYMENT RECEIPT' : 'OFFICIAL PAYMENT RECEIPT';
  const typeLabel = isRefund ? 'Refund' : isDeposit ? 'Deposit / Part Payment' : 'Full Payment (Settled)';
  const statusBadge = isRefund
    ? '<span class="badge badge-refund">REFUND</span>'
    : isDeposit
    ? '<span class="badge badge-deposit">PART PAYMENT</span>'
    : '<span class="badge badge-full">&#10003; PAID IN FULL</span>';

  const processedAt = payment.processedAt || payment.createdAt;
  const dateStr = processedAt
    ? new Date(processedAt).toLocaleString('en-GH', { dateStyle: 'long', timeStyle: 'short' })
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
      padding:18px 0;
      margin:0 auto;
      width:400px;
    }
    .page{
      background:#fff;
      width:400px;
      padding:28px 24px 22px;
      border:1px solid #cbd5e1;
      border-radius:10px;
      box-shadow:0 2px 10px rgba(0,0,0,.04);
    }

    /* ── Header ── */
    .header{text-align:center;padding-bottom:14px;border-bottom:2px solid #0f172a}
    .logo{width:50px;height:50px;border-radius:10px;object-fit:cover;margin:0 auto 8px;display:block;border:1px solid #e2e8f0}
    .co-name{font-family:'Cinzel',serif;font-size:16px;font-weight:800;letter-spacing:.08em;color:#0f172a}
    .co-sub{font-size:8.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#854d0e;margin-top:2px}
    .co-detail{font-size:9.5px;color:#475569;line-height:1.5;margin-top:4px}

    /* ── Receipt Title & Status Bar ── */
    .title-band{
      text-align:center;
      padding:12px 12px 10px;
      margin-top:12px;
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:8px;
    }
    .doc-title{font-size:13px;font-weight:800;letter-spacing:.06em;color:#0f172a;text-transform:uppercase}
    .receipt-no{font-size:10px;font-weight:600;color:#64748b;margin-top:2px;font-family:monospace;letter-spacing:.05em}
    .badge-wrap{margin-top:6px}
    .badge{
      display:inline-block;padding:3px 10px;border-radius:5px;
      font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
    }
    .badge-full{background:#ecfdf5;color:#047857;border:1.5px solid #a7f3d0}
    .badge-deposit{background:#fffbeb;color:#b45309;border:1.5px solid #fde68a}
    .badge-refund{background:#fef2f2;color:#b91c1c;border:1.5px solid #fecaca}

    .group-tag{
      background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;
      border-radius:5px;padding:4px 10px;margin-top:10px;font-size:9.5px;font-weight:700;text-align:center;letter-spacing:.03em;
    }

    /* ── Details Table ── */
    .details{width:100%;border-collapse:collapse;margin-top:14px}
    .details tr{border-bottom:1px solid #f1f5f9}
    .details tr:last-child{border-bottom:none}
    .details td{padding:5.5px 0;line-height:1.4}
    .details .lbl{font-size:10px;font-weight:600;color:#64748b;width:40%;text-transform:uppercase;letter-spacing:.03em}
    .details .val{font-size:11.5px;font-weight:600;color:#0f172a;text-align:right}

    /* ── Official Amount Box (Core Figure) ── */
    .amount-box{
      background:${isRefund ? '#fef2f2' : isDeposit ? '#fffbeb' : '#f0fdf4'};
      border:1.5px solid ${isRefund ? '#fca5a5' : isDeposit ? '#fcd34d' : '#86efac'};
      border-radius:8px;
      padding:12px 14px;
      margin-top:14px;
      text-align:center;
    }
    .amount-lbl{font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${isRefund ? '#b91c1c' : isDeposit ? '#92400e' : '#047857'}}
    .amount-val{font-size:24px;font-weight:800;letter-spacing:-.02em;color:${isRefund ? '#991b1b' : isDeposit ? '#78350f' : '#065f46'};margin:3px 0 6px}
    .amount-words{
      font-size:9.5px;
      color:#334155;
      background:#fff;
      border:1px solid ${isRefund ? '#fecaca' : isDeposit ? '#fde68a' : '#bbf7d0'};
      border-radius:6px;
      padding:6px 10px;
      line-height:1.45;
      font-weight:600;
    }
    .amount-words strong{color:#0f172a;font-weight:700}

    /* ── Settlement Audit Summary ── */
    .settle-box{
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:8px;
      margin-top:12px;
      overflow:hidden;
    }
    .settle-table{width:100%;border-collapse:collapse}
    .settle-table td{padding:6.5px 12px;font-size:11px}
    .settle-table tr{border-bottom:1px solid #edf2f7}
    .settle-table tr:last-child{border-bottom:none}
    .s-lbl{color:#475569;font-weight:500}
    .s-val{font-weight:700;text-align:right;color:#0f172a}
    .s-change td{font-size:11.5px;font-weight:800;color:#047857;background:#ecfdf5}
    .s-balance td{font-size:11.5px;font-weight:800;color:#b45309;background:#fffbeb}

    /* ── Certification / Cashier Row ── */
    .auth-block{
      margin-top:16px;
      padding-top:10px;
      border-top:1px dashed #cbd5e1;
      display:flex;
      justify-content:space-between;
      align-items:center;
      font-size:9.5px;
      color:#64748b;
    }
    .auth-title{font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:.04em}
    .auth-name{color:#334155;font-weight:600}

    /* ── Footer ── */
    .footer{
      text-align:center;
      margin-top:14px;
      padding-top:10px;
      border-top:1.5px solid #0f172a;
    }
    .footer .tagline{font-size:10px;font-weight:700;color:#0f172a;letter-spacing:.03em}
    .footer .contact{font-size:9px;color:#64748b;margin-top:2px}

    /* ── Action buttons (screen only) ── */
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

  <!-- ── Header ── -->
  <div class="header">
    <img src="${logoUrl}" alt="NS Luxury Villa" class="logo"/>
    <div class="co-name">${esc(company.legalName)}</div>
    <div class="co-sub">Hospitality &amp; Luxury Accommodation</div>
    <div class="co-detail">
      ${esc(company.address)}<br/>
      Tel: ${esc(company.phone)} &nbsp;|&nbsp; Email: ${esc(company.email)}
    </div>
  </div>

  <!-- ── Title & Status ── -->
  <div class="title-band">
    <div class="doc-title">${esc(title)}</div>
    <div class="receipt-no">${esc(receiptNo)}</div>
    <div class="badge-wrap">${statusBadge}</div>
  </div>

  ${isGroup ? `<div class="group-tag">&#9651; Group Booking (${context?.roomCount ? `${context.roomCount} Rooms` : 'Multi-Room'})</div>` : ''}

  <!-- ── Transaction Details ── -->
  <table class="details">
    <tbody>
      ${optRow(isGroup ? 'Lead Guest' : 'Received From', guestName)}
      ${optRow('Booking Reference', context?.bookingRef)}
      ${optRow('Room Number', context?.roomNumber)}
      <tr><td class="lbl">Date &amp; Time</td><td class="val">${esc(dateStr)}</td></tr>
      <tr><td class="lbl">Payment Method</td><td class="val">${esc((payment.method || '—').replace(/_/g, ' '))}</td></tr>
      <tr><td class="lbl">Transaction Type</td><td class="val">${esc(typeLabel)}</td></tr>
      ${optRow('Transaction Reference', payment.reference || null)}
    </tbody>
  </table>

  <!-- ── Official Amount Received Box ── -->
  <div class="amount-box">
    <div class="amount-lbl">${isRefund ? 'Total Amount Refunded' : 'Total Amount Received'}</div>
    <div class="amount-val">${esc(formatCurrency(amount))}</div>
    ${amountWords ? `<div class="amount-words"><strong>Amount in words:</strong> ${esc(amountWords)}</div>` : ''}
  </div>

  <!-- ── Settlement & Balance Breakdown ── -->
  <div class="settle-box">
    <table class="settle-table">
      ${amountDue !== null ? `
      <tr>
        <td class="s-lbl">Total Bill / Amount Due</td>
        <td class="s-val">${esc(formatCurrency(amountDue))}</td>
      </tr>` : ''}
      <tr>
        <td class="s-lbl" style="color:#0f172a;font-weight:600">${isRefund ? 'Amount Refunded' : 'Amount Paid (This Transaction)'}</td>
        <td class="s-val" style="color:#047857;font-weight:800">${esc(formatCurrency(amount))}</td>
      </tr>
      ${tenderedAmount !== null && tenderedAmount !== amount ? `
      <tr>
        <td class="s-lbl">Cash Handed Over</td>
        <td class="s-val">${esc(formatCurrency(tenderedAmount))}</td>
      </tr>` : ''}
      ${changeGiven !== null && changeGiven > 0.005 ? `
      <tr class="s-change">
        <td class="s-lbl">&#8594; Change Returned to Guest</td>
        <td class="s-val">${esc(formatCurrency(changeGiven))}</td>
      </tr>` : ''}
      ${remainingBalance !== null && remainingBalance > 0.005 ? `
      <tr class="s-balance">
        <td class="s-lbl">&#8594; Outstanding Balance Due</td>
        <td class="s-val">${esc(formatCurrency(remainingBalance))}</td>
      </tr>` : ''}
      ${settled && !isRefund ? `
      <tr style="background:#f0fdf4">
        <td class="s-lbl" style="color:#047857;font-weight:700">Account Balance</td>
        <td class="s-val" style="color:#047857">GHS 0.00 &mdash; Fully Settled</td>
      </tr>` : ''}
    </table>
  </div>

  <!-- ── Authorized Cashier Certification ── -->
  <div class="auth-block">
    <div>
      <span class="auth-title">Issued By:</span>
      <span class="auth-name"> ${esc(payment.processorName || 'Front Desk Cashier')}</span>
    </div>
    <div style="font-family:monospace;letter-spacing:.05em;color:#047857;font-weight:700">
      AUTHENTICATED
    </div>
  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <p class="tagline">Thank you for choosing NS Luxury Villa &bull; Ho, Ghana</p>
    <p class="contact">For reservations and support: ${esc(company.phone)} &bull; ${esc(company.website)}</p>
  </div>

  <!-- ── Print Button (Screen only) ── -->
  <button class="print-btn noprint" onclick="window.print()">&#128438; Print Official Receipt</button>

</div>
</body>
</html>`);

  win.document.close();
};
