// ============================================
// API base URL resolution
// Web uses same-origin /api/v1 (Vite proxy or Vercel), while Electron
// development falls back to the local server.
// ============================================

function clean(url: string): string {
  return (url || '').trim().replace(/\/+$/, '');
}

export function getConfiguredApiUrl(): string {
  const fromEnv = clean(import.meta.env.VITE_API_URL || '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'http://localhost:3001';
  }
  return '';
}

export function apiBaseUrl(): string {
  const raw = getConfiguredApiUrl();
  if (!raw) return '/api/v1';
  return raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`;
}
