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
