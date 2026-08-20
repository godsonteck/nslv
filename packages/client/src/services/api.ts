// ============================================
// NS LUXURY VILLA — API Client Service
// Fetch wrapper with JWT headers & auto-refresh
// ============================================

import type { ApiResponse, ApiError } from '@nslv/shared';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const rawApiUrl = (import.meta.env.VITE_API_URL || (isFileProtocol ? 'http://localhost:3001' : '')).replace(/\/+$/, '');
const API_BASE = !rawApiUrl
  ? '/api/v1'
  : rawApiUrl.endsWith('/api/v1')
  ? rawApiUrl
  : `${rawApiUrl}/api/v1`;

export class ApiClientError extends Error {
  public code: string;
  public details?: Record<string, string[]>;

  constructor(message: string, code = 'API_ERROR', details?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface AuthTokensShape {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Single-flight refresh: while a refresh is in-flight, concurrent 401s await the
 * same promise instead of triggering multiple refresh calls.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { useAuthStore } = await import('../stores/authStore');
    const { tokens } = useAuthStore.getState();
    if (!tokens?.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (!data?.success || !data?.data?.accessToken) return false;

      const newTokens: AuthTokensShape = data.data;

      // Re-fetch the profile so cached roles/permissions stay in sync with the
      // freshly issued token. Without this, the client can keep showing nav
      // items the server no longer authorizes after a role/permission change.
      try {
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newTokens.accessToken}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.success && meData?.data) {
            useAuthStore.getState().setAuth(meData.data, newTokens);
            return true;
          }
        }
      } catch {
        // Fall back to the cached user below.
      }

      useAuthStore.getState().setAuth(useAuthStore.getState().user!, newTokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// ── Lightweight GET cache (stale-while-valid) ──
// GET responses are cached briefly so navigation and repeat reads are instant.
// Any successful mutation clears the whole cache, keeping reads fresh.
const CACHE_TTL_MS = 15_000;
const GET_CACHE = new Map<string, { expiresAt: number; value: unknown }>();
const INFLIGHT = new Map<string, Promise<unknown>>();

const getCacheKey = (method: string, url: string, accessToken?: string | null) =>
  `${method}:${url}:${accessToken ?? ''}`;

/**
 * Drop all cached GET responses so the next read performs a real network fetch.
 * Used by explicit "Refresh" buttons, which must always show current data even
 * when a previous load happened within the cache TTL.
 */
export function clearGetCache(): void {
  GET_CACHE.clear();
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string | null,
  _retry = true,
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const key = getCacheKey(method, url, accessToken);
  const useCache = method === 'GET' && options.cache !== 'no-store';

  if (useCache) {
    const hit = GET_CACHE.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }
    const pending = INFLIGHT.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
  }

  const performFetch = async (): Promise<T> => {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let data: any;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new ApiClientError(
          `Server connection error (${response.status} ${response.statusText}). Please check backend API server.`,
          'SERVER_UNREACHABLE',
        );
      }

      // ── Access token expired → refresh once and retry the original request ──
      if (response.status === 401 && _retry) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const { useAuthStore } = await import('../stores/authStore');
          const newToken = useAuthStore.getState().tokens?.accessToken;
          return apiFetch(endpoint, options, newToken, false);
        }
        const { useAuthStore } = await import('../stores/authStore');
        useAuthStore.getState().logout();
        throw new ApiClientError(
          'Your session has expired. Please sign in again.',
          'SESSION_EXPIRED',
        );
      }

      if (!response.ok || !data.success) {
        const err = data as ApiError;
        throw new ApiClientError(
          err?.error?.message || `Request failed with status ${response.status}`,
          err?.error?.code || 'HTTP_ERROR',
          err?.error?.details,
        );
      }

      const result = (data as ApiResponse<T>).data;

      if (useCache) {
        GET_CACHE.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
      } else if (response.ok && method !== 'GET') {
        // Any successful write invalidates cached reads so the next load is fresh.
        GET_CACHE.clear();
      }

      return result;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      throw new ApiClientError(
        (error as Error).message || 'Network error. Please check your connection.',
        'NETWORK_ERROR',
      );
    }
  };

  if (useCache) {
    const pending = INFLIGHT.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
    const promise = performFetch();
    INFLIGHT.set(key, promise);
    void promise
      .catch(() => undefined)
      .finally(() => {
        INFLIGHT.delete(key);
      });
    return promise;
  }

  return performFetch();
}
