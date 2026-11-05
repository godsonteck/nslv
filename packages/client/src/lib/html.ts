// ============================================
// NS LUXURY VILLA — HTML Safety Helpers
// ============================================

/**
 * Escape a value for interpolation into an HTML document.
 *
 * Receipt, folio and voucher templates are built as strings and written into a
 * same-origin print window. Guest names, menu items, notes and references are
 * operator-entered data, so any of them could otherwise inject markup into a
 * document that shares the app's origin (and therefore its localStorage auth
 * token).
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Open a blank print window and detach it from the application.
 *
 * Receipt, folio and voucher templates are written into this window, so it
 * shares the app's origin — and therefore access to its localStorage auth
 * token. Clearing `opener` means injected content cannot reach back into the
 * app that opened it.
 */
export const openPrintWindow = (features: string): Window | null => {
  if (typeof window === 'undefined') return null;

  const win = window.open('', '_blank', features);
  if (!win) return null;

  try {
    win.opener = null;
  } catch {
    // A browser may refuse the assignment; the window still prints normally.
  }

  return win;
};
