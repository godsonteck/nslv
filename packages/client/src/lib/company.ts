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
}

/** Converts a numeric GHS amount into English words (e.g. 1250.50 → "One Thousand Two Hundred Fifty Ghana Cedis and Fifty Pesewas Only"). */
function amountToWords(num: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHundreds(n: number): string {
    let result = '';
    if (n >= 100) { result += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
    if (n >= 20)  { result += tens[Math.floor(n / 10)] + ' '; n %= 10; }
    if (n > 0)    { result += ones[n] + ' '; }
    return result;
  }

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 1000) return convertHundreds(n);
    if (n < 1_000_000) return convert(Math.floor(n / 1000)) + 'Thousand ' + convertHundreds(n % 1000);
    if (n < 1_000_000_000) return convert(Math.floor(n / 1_000_000)) + 'Million ' + convert(n % 1_000_000);
    return convert(Math.floor(n / 1_000_000_000)) + 'Billion ' + convert(n % 1_000_000_000);
  }

  if (!Number.isFinite(num) || num < 0) return '';
  const cedis = Math.floor(num);
  const pesewas = Math.round((num - cedis) * 100);
  let words = (cedis === 0 ? 'Zero' : convert(cedis).trim()) + ' Ghana Cedi' + (cedis !== 1 ? 's' : '');
  if (pesewas > 0) words += ' and ' + convert(pesewas).trim() + ' Pesewa' + (pesewas !== 1 ? 's' : '');
  return words + ' Only';
}

// Prints an optional per-transaction receipt for a single payment/refund record
// (DEPOSIT partial payments on reservations, folio payments, refunds).
export const printPaymentReceipt = (payment: any, context?: PaymentReceiptContext) => {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=440,height=680');
  if (!win) return;

  const type = context?.type || payment.type;
  const isRefund = type === 'REFUND';
  // A deposit that fully settles its reservation prints as a normal payment,
  // never as a partial payment.
  const settled = context?.fullySettled ?? payment.fullySettled ?? false;
  const isDeposit = type === 'DEPOSIT' && !settled;
  const isGroup = context?.isGroup ?? false;

  const title      = isRefund ? 'REFUND RECEIPT' : isDeposit ? 'PART PAYMENT RECEIPT' : 'OFFICIAL PAYMENT RECEIPT';
  const typeLabel  = isRefund ? 'Refund' : isDeposit ? 'Part Payment / Deposit' : 'Full Payment';
  const paidLabel  = isRefund ? 'Amount Refunded' : 'Amount Received';
  const accentHex  = isRefund ? '#b91c1c' : isDeposit ? '#92400e' : '#065f46';
  const accentBg   = isRefund ? '#fef2f2' : isDeposit ? '#fffbeb' : '#ecfdf5';
  const accentBorder = isRefund ? '#fca5a5' : isDeposit ? '#fcd34d' : '#6ee7b7';

  const amount = (() => { const n = Number(payment.amount); return Number.isFinite(n) ? n : 0; })();
  const amountWords = amountToWords(amount);

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

  // Build optional rows (only emit HTML if the value exists)
  const optRow = (label: string, value: string | undefined | null) =>
    value ? `<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(value)}</td></tr>` : '';

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body{
      font-family:'Inter',sans-serif;
      font-size:11.5px;
      color:#111827;
      background:#f9fafb;
      padding:0;
      width:380px;
      margin:0 auto;
    }
    .page{
      background:#fff;
      width:380px;
      padding:28px 28px 24px;
      border:1px solid #e5e7eb;
    }

    /* ── Header ── */
    .header{text-align:center;padding-bottom:16px;border-bottom:2px solid #111827}
    .logo{width:52px;height:52px;border-radius:10px;object-fit:cover;margin:0 auto 10px;display:block;box-shadow:0 1px 4px rgba(0,0,0,.12)}
    .co-name{font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#111827}
    .co-detail{font-size:9.5px;color:#6b7280;line-height:1.6;margin-top:3px}

    /* ── Receipt title band ── */
    .title-band{
      background:${accentBg};
      border:1px solid ${accentBorder};
      border-radius:6px;
      text-align:center;
      padding:8px 12px;
      margin:14px 0 0;
    }
    .title-band .doc-title{font-size:12px;font-weight:800;letter-spacing:.08em;color:${accentHex};text-transform:uppercase}
    .title-band .receipt-no{font-size:9px;color:#6b7280;margin-top:2px;font-family:'Courier New',monospace;letter-spacing:.05em}

    /* ── Group badge ── */
    .group-badge{
      background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;
      text-align:center;padding:5px 10px;margin-top:10px;
      font-size:9.5px;font-weight:700;color:#1d4ed8;letter-spacing:.06em;text-transform:uppercase
    }

    /* ── Detail table ── */
    .details{width:100%;border-collapse:collapse;margin-top:14px}
    .details tr{border-bottom:1px solid #f3f4f6}
    .details tr:last-child{border-bottom:none}
    .details td{padding:5.5px 2px;vertical-align:top;line-height:1.4}
    .details .lbl{font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;width:38%;padding-right:8px}
    .details .val{font-size:11px;font-weight:500;color:#111827;text-align:right}

    /* ── Divider ── */
    .divider{border:none;border-top:1px dashed #d1d5db;margin:14px 0}

    /* ── Amount box ── */
    .amount-box{
      background:${accentBg};
      border:1.5px solid ${accentBorder};
      border-radius:8px;
      padding:12px 16px;
      margin-top:4px;
    }
    .amount-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${accentHex};margin-bottom:4px}
    .amount-figure{font-size:22px;font-weight:800;color:${accentHex};letter-spacing:-.01em}
    .amount-words{
      font-size:9px;
      font-style:italic;
      color:#374151;
      margin-top:6px;
      border-top:1px solid ${accentBorder};
      padding-top:5px;
      line-height:1.5;
    }
    .amount-words strong{font-style:normal;font-weight:700}

    /* ── Signature ── */
    .sig-row{display:flex;justify-content:space-between;margin-top:22px;gap:16px}
    .sig-col{flex:1;border-top:1px solid #9ca3af;padding-top:4px}
    .sig-label{font-size:8.5px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}

    /* ── Footer ── */
    .footer{text-align:center;margin-top:18px;padding-top:12px;border-top:1px dashed #d1d5db}
    .footer p{font-size:9px;color:#6b7280;line-height:1.6}
    .footer .tagline{font-size:9.5px;font-weight:600;color:#374151;margin-top:3px}

    /* ── Print button ── */
    .print-btn{
      display:block;width:100%;margin-top:18px;padding:10px;
      background:#111827;color:#fff;border:none;border-radius:6px;
      font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.03em;
    }
    .print-btn:hover{background:#1f2937}

    @media print{
      body{background:#fff}
      .page{border:none;padding:12px}
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
      Tel: ${esc(company.phone)} &nbsp;|&nbsp; ${esc(company.email)}<br/>
      ${esc(company.website)}
    </div>
  </div>

  <!-- ── Title band ── -->
  <div class="title-band">
    <div class="doc-title">${esc(title)}</div>
    <div class="receipt-no">${esc(receiptNo)}</div>
  </div>

  ${isGroup ? `<div class="group-badge">&#9651; Group Booking${context?.roomCount ? ` &middot; ${context.roomCount} Room${context.roomCount !== 1 ? 's' : ''}` : ''}</div>` : ''}

  <!-- ── Detail rows ── -->
  <table class="details">
    <tbody>
      ${optRow(isGroup ? 'Lead Guest' : 'Guest', guestName)}
      ${optRow(isGroup ? 'Group Booking Ref' : 'Booking Ref', context?.bookingRef)}
      ${optRow('Room', context?.roomNumber)}
      <tr><td class="lbl">Date &amp; Time</td><td class="val">${esc(dateStr)}</td></tr>
      <tr><td class="lbl">Payment Method</td><td class="val">${esc((payment.method || '—').replace(/_/g, ' '))}</td></tr>
      <tr><td class="lbl">Payment Type</td><td class="val">${esc(typeLabel)}</td></tr>
      ${optRow('Reference / Txn No.', payment.reference || null)}
      ${optRow('Received By', payment.processorName || null)}
    </tbody>
  </table>

  <hr class="divider"/>

  <!-- ── Amount box ── -->
  <div class="amount-box">
    <div class="amount-label">${esc(paidLabel)}</div>
    <div class="amount-figure">${esc(formatCurrency(amount))}</div>
    ${amountWords ? `<div class="amount-words"><strong>In words:</strong> ${esc(amountWords)}</div>` : ''}
  </div>

  <!-- ── Signature lines ── -->
  <div class="sig-row noprint" style="margin-top:24px">
    <div class="sig-col"><div class="sig-label">Cashier / Issued by</div></div>
    <div class="sig-col"><div class="sig-label">Guest Signature</div></div>
  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <p>This is an official computer-generated receipt. No signature required.</p>
    <p class="tagline">Thank you for choosing NS Luxury Villa &mdash; Ho, Ghana</p>
  </div>

  <!-- ── Print button (screen only) ── -->
  <button class="print-btn noprint" onclick="window.print()">&#128438; Print Receipt</button>

</div>
</body>
</html>`);

  win.document.close();
};
