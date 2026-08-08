// ============================================
// NS LUXURY VILLA — API Client Service
// Fetch wrapper with JWT headers & auto-refresh
// ============================================
const API_BASE = '/api/v1';
export class ApiClientError extends Error {
    code;
    details;
    constructor(message, code = 'API_ERROR', details) {
        super(message);
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export async function apiFetch(endpoint, options = {}, accessToken) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
    }
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            const err = data;
            throw new ApiClientError(err?.error?.message || 'An error occurred during the request.', err?.error?.code || 'HTTP_ERROR', err?.error?.details);
        }
        return data.data;
    }
    catch (error) {
        if (error instanceof ApiClientError) {
            throw error;
        }
        throw new ApiClientError(error.message || 'Network error. Please check your connection.', 'NETWORK_ERROR');
    }
}
