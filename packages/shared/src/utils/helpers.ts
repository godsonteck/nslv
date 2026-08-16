// ============================================
// NS LUXURY VILLA — Shared Utilities
// Currency, date, and formatting helpers
// ============================================

/**
 * Format amount as Ghana Cedis (GHS)
 * Uses proper locale formatting with 2 decimal places.
 *
 * @example formatCurrency(1780) → "GHS 1,780.00"
 * @example formatCurrency(85.5) → "GHS 85.50"
 */
export function formatCurrency(amount: number, currencyCode = 'GHS'): string {
  const formatted = new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const sign = amount < 0 ? '-' : '';
  return `${sign}${currencyCode} ${formatted}`;
}

/**
 * Format a date string or Date object for display.
 * Uses the Africa/Accra timezone by default.
 *
 * @example formatDate('2024-03-15T10:30:00Z') → "15 Mar 2024"
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  },
  timezone = 'Africa/Accra',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { ...options, timeZone: timezone });
}

/**
 * Format a date+time for display.
 *
 * @example formatDateTime('2024-03-15T10:30:00Z') → "15 Mar 2024, 10:30 AM"
 */
export function formatDateTime(
  date: string | Date,
  timezone = 'Africa/Accra',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

/**
 * Format a time for display.
 *
 * @example formatTime('2024-03-15T10:30:00Z') → "10:30 AM"
 */
export function formatTime(
  date: string | Date,
  timezone = 'Africa/Accra',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

/**
 * Format a guest's name cleanly handling single names and null/omitted last names.
 *
 * @example formatGuestName({ firstName: 'Kwame', lastName: 'Mensah' }) → "Kwame Mensah"
 * @example formatGuestName({ firstName: 'Kwame', lastName: null }) → "Kwame"
 * @example formatGuestName({ firstName: 'Kwame', lastName: '' }) → "Kwame"
 */
export function formatGuestName(
  guest?: { firstName?: string | null; lastName?: string | null } | null,
  fallback = '—',
): string {
  if (!guest) return fallback;
  const first = (guest.firstName ?? '').trim();
  const last = (guest.lastName ?? '').trim();
  if (first && last) return `${first} ${last}`;
  return first || last || fallback;
}

/**
 * Get a user's display name (full name or username fallback)
 */
export function getDisplayName(
  user: { firstName?: string; lastName?: string; username?: string } | null,
): string {
  if (!user) return 'Unknown';
  const first = (user.firstName ?? '').trim();
  const last = (user.lastName ?? '').trim();
  if (first && last) {
    return `${first} ${last}`;
  }
  return first || last || user.username || 'Unknown';
}

/**
 * Get initials from a name for avatar display
 *
 * @example getInitials('John Doe') → "JD"
 * @example getInitials('John') → "JO"
 */
export function getInitials(name: string, maxLength = 2): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, maxLength)
    .join('')
    .toUpperCase();
}

/**
 * Generate a human-readable reference number
 *
 * @example generateReference('RES') → "RES-20240315-A7K2"
 */
export function generateReference(prefix: string): string {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const randomPart = Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase();
  return `${prefix}-${datePart}-${randomPart}`;
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(checkIn: string | Date, checkOut: string | Date): number {
  const start = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const end = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Delay helper for retry mechanisms
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON, returning null on failure
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
