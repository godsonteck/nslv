// ============================================
// NS LUXURY VILLA — Public / Guest API Client
// Separate token store from the staff workstation.
// ============================================

import { apiBaseUrl } from '../lib/apiBase';

function getApiBase(): string {
  return apiBaseUrl();
}

const ACCESS_KEY = 'nslv_guest_access';
const REFRESH_KEY = 'nslv_guest_refresh';

export class PublicApiError extends Error {
  public code: string;
  public details?: Record<string, string[]>;

  constructor(message: string, code = 'API_ERROR', details?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface GuestTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface GuestAccount {
  id: string;
  email: string;
  emailVerified: boolean;
  status: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
}

export interface PublicBookingConfig {
  publicEnabled: boolean;
  villa: { name: string; address: string; phone: string; email: string; website: string };
  currency: string;
  currencySymbol: string;
  taxRate: number;
  depositPercent: number;
  holdMinutes: number;
  cancellationHours: number;
  maxAdvanceDays: number;
  maxNights: number;
  momoConfigured: boolean;
  momo: { number: string; name: string };
}

export interface RoomTypeAvailability {
  id: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  imageUrls: string[];
  basePrice: number;
  maxAdults: number;
  maxChildren: number;
  amenities: { name: string; icon: string | null; category: string | null }[];
  availableCount: number;
  available: boolean;
  capacityOk: boolean;
  nights: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  depositAmount: number;
  currency: string;
}

export interface PublicBooking {
  id: string;
  confirmationNo: string;
  status: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  room: { number: string | null; name: string | null };
  roomType: { id: string; name: string; imageUrls: string[] } | null;
  baseRate: number;
  taxAmount: number;
  totalAmount: number;
  depositAmount: number;
  amountPaid: number;
  balance: number;
  currency: string;
  holdExpiresAt: string | null;
  guestPaymentReference: string | null;
  paymentSubmittedAt: string | null;
  specialRequests: string | null;
  guest: { firstName: string; lastName: string | null; email: string | null; phone: string | null } | null;
  momo: { number: string; name: string };
}

export interface CreateBookingResult extends Omit<PublicBooking, 'roomType' | 'guest'> {
  reservationId: string;
  nights: number;
  subtotal: number;
  paymentReference: string;
  accountCreated: boolean;
  roomType: { id: string; name: string; imageUrls: string[] };
  guest: { firstName: string; lastName: string; email: string; phone: string };
}

export const guestSession = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  setTokens(tokens: GuestTokens) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  hasSession(): boolean {
    return !!localStorage.getItem(REFRESH_KEY);
  },
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  guest?: boolean;
  retryOnUnauthorized?: boolean;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error?.message || `Request failed (${response.status})`;
    throw new PublicApiError(message, payload?.error?.code || 'API_ERROR', payload?.error?.details);
  }
  return payload?.data;
}

async function refreshGuestTokens(): Promise<boolean> {
  const refreshToken = guestSession.getRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${getApiBase()}/guest-auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    guestSession.clear();
    return false;
  }
  const payload = await response.json().catch(() => null);
  const tokens = payload?.data?.tokens;
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    guestSession.clear();
    return false;
  }
  guestSession.setTokens(tokens);
  return true;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.guest) {
    const token = guestSession.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && options.guest && options.retryOnUnauthorized !== false) {
    const refreshed = await refreshGuestTokens();
    if (refreshed) {
      return request<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  return parseResponse(response) as Promise<T>;
}

export const publicApi = {
  getConfig(): Promise<PublicBookingConfig> {
    return request('/public/config');
  },

  getAvailability(params: {
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children: number;
  }): Promise<RoomTypeAvailability[]> {
    const query = new URLSearchParams({
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      adults: String(params.adults),
      children: String(params.children),
    });
    return request(`/public/availability?${query.toString()}`);
  },

  createBooking(payload: Record<string, unknown>): Promise<CreateBookingResult> {
    return request('/public/bookings', { method: 'POST', body: payload });
  },

  lookupBooking(confirmationNo: string, email: string): Promise<PublicBooking> {
    const query = new URLSearchParams({ email });
    return request(`/public/bookings/${encodeURIComponent(confirmationNo)}?${query.toString()}`);
  },

  submitPaymentReference(confirmationNo: string, email: string, reference: string): Promise<PublicBooking> {
    return request(`/public/bookings/${encodeURIComponent(confirmationNo)}/payment-reference`, {
      method: 'POST',
      body: { email, reference },
    });
  },
};

export const guestAuthApi = {
  async register(payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<{ account: GuestAccount; tokens: GuestTokens | null; requiresVerification?: boolean }> {
    const data = await request<{ account: GuestAccount; tokens: GuestTokens | null; requiresVerification?: boolean }>(
      '/guest-auth/register',
      {
        method: 'POST',
        body: payload,
      },
    );
    if (data.tokens) guestSession.setTokens(data.tokens);
    return data;
  },

  async login(payload: { email: string; password: string }): Promise<{ account: GuestAccount; tokens: GuestTokens }> {
    const data = await request<{ account: GuestAccount; tokens: GuestTokens }>('/guest-auth/login', {
      method: 'POST',
      body: payload,
    });
    guestSession.setTokens(data.tokens);
    return data;
  },

  me(): Promise<GuestAccount> {
    return request('/guest-auth/me', { guest: true });
  },

  resendVerification(email: string) {
    return request<{ sent: boolean }>('/guest-auth/resend-verification', {
      method: 'POST',
      body: { email },
    });
  },

  async logout(): Promise<void> {
    const refreshToken = guestSession.getRefreshToken();
    guestSession.clear();
    if (!refreshToken) return;
    try {
      await request('/guest-auth/logout', { method: 'POST', body: { refreshToken } });
    } catch {
      // Local sign-out is enough.
    }
  },

  verifyEmail(token: string): Promise<{ verified: boolean }> {
    return request('/guest-auth/verify-email', { method: 'POST', body: { token } });
  },

  forgotPassword(email: string): Promise<{ sent: boolean }> {
    return request('/guest-auth/forgot-password', { method: 'POST', body: { email } });
  },

  resetPassword(token: string, password: string): Promise<{ reset: boolean }> {
    return request('/guest-auth/reset-password', { method: 'POST', body: { token, password } });
  },
};

export const guestBookingsApi = {
  list(): Promise<PublicBooking[]> {
    return request('/guest/bookings', { guest: true });
  },

  get(id: string): Promise<PublicBooking> {
    return request(`/guest/bookings/${encodeURIComponent(id)}`, { guest: true });
  },

  cancel(id: string, reason?: string): Promise<PublicBooking> {
    return request(`/guest/bookings/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: { reason },
      guest: true,
    });
  },
};
