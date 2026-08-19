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
  <div class="company">${company.address}<br/>Tel: ${company.phone}<br/>${company.email}<br/>${company.website}</div>
`;

interface PaymentReceiptContext {
  guestName?: string;
  bookingRef?: string;
  reservationId?: string;
  roomNumber?: string;
  /** Overrides payment.type when the record does not carry it (e.g. reservation deposit select) */
  type?: 'PAYMENT' | 'DEPOSIT' | 'REFUND';
}

// Prints an optional per-transaction receipt for a single payment/refund record
// (DEPOSIT partial payments on reservations, folio payments, refunds).
export const printPaymentReceipt = (payment: any, context?: PaymentReceiptContext) => {
  if (typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=380,height=560');
  if (!win) return;

  const type = context?.type || payment.type;
  const isRefund = type === 'REFUND';
  const isDeposit = type === 'DEPOSIT';
  const title = isRefund ? 'REFUND RECEIPT' : isDeposit ? 'PARTIAL PAYMENT RECEIPT' : 'PAYMENT RECEIPT';
  const paidLabel = isRefund ? 'Amount refunded' : 'Amount received';

  const amount = (() => {
    const num = Number(payment.amount);
    return Number.isFinite(num) ? num : 0;
  })();
  const processedAt = payment.processedAt || payment.createdAt;
  const guestName =
    context?.guestName ||
    (payment.guest
      ? `${payment.guest.firstName ?? ''} ${payment.guest.lastName ?? ''}`.trim() || 'Guest'
      : 'Guest');
  const esc = (v: any) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const logoUrl = new URL(villaAssets.logo, window.location.href).href;

  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
    body{font-family:'Courier New',monospace;font-size:12px;color:#111;padding:24px;width:320px;margin:0 auto}
    h1{font-size:15px;text-align:center;margin:0 0 4px} .company{text-align:center;font-size:10px;line-height:1.45;color:#444;margin-bottom:8px}.sub{text-align:center;font-size:10px;color:#555;margin-bottom:16px}
    .logo{display:block;margin:0 auto 10px;width:56px;height:56px;border-radius:12px;object-fit:cover}
    .row{display:flex;justify-content:space-between;font-size:11px;margin:3px 0}
    .total{border-top:1px solid #111;padding-top:8px;font-size:13px;font-weight:bold;display:flex;justify-content:space-between;margin-top:14px}
    .foot{text-align:center;font-size:10px;color:#555;margin-top:18px;border-top:1px dashed #999;padding-top:8px}
    @media print{.noprint{display:none}}
  </style></head><body>
    <img src="${logoUrl}" alt="NS Luxury Villa" class="logo"/>
    ${receiptCompanyBlock()}<div class="sub">${title} · OFFICIAL</div>
    <div class="row"><span>Reference</span><span>${esc(payment.reference || payment.id.slice(0, 10))}</span></div>
    ${context?.bookingRef ? `<div class="row"><span>Booking</span><span>${esc(context.bookingRef)}</span></div>` : ''}
    ${context?.roomNumber ? `<div class="row"><span>Room</span><span>${esc(context.roomNumber)}</span></div>` : ''}
    <div class="row"><span>Guest</span><span>${esc(guestName)}</span></div>
    <div class="row"><span>Date</span><span>${processedAt ? esc(new Date(processedAt).toLocaleString()) : '—'}</span></div>
    <div class="row"><span>Method</span><span>${esc(payment.method)}</span></div>
    <div class="row"><span>Type</span><span>${isRefund ? 'Refund' : isDeposit ? 'Deposit / partial payment' : 'Payment'}</span></div>
    ${payment.processorName ? `<div class="row"><span>Received by</span><span>${esc(payment.processorName)}</span></div>` : ''}
    <div class="total"><span>${paidLabel}</span><span>${formatCurrency(amount)}</span></div>
    <div class="foot">Currency: GHS · This is a computer-generated receipt.<br/>Thank you for choosing NS Luxury Villa.</div>
    <div class="noprint" style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 24px;font-size:12px">Print receipt</button></div>
  </body></html>`);
  win.document.close();
};
