export declare class ApiClientError extends Error {
    code: string;
    details?: Record<string, string[]>;
    constructor(message: string, code?: string, details?: Record<string, string[]>);
}
export declare function apiFetch<T>(endpoint: string, options?: RequestInit, accessToken?: string | null): Promise<T>;
//# sourceMappingURL=api.d.ts.map