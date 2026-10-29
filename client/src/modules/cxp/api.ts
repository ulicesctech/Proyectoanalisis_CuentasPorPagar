// Cliente HTTP de CXP; la sesión viaja en una cookie HttpOnly.
import { API_BASE_URL, ApiError, apiRequest, buildQueryString } from '../../shared/api';

export { API_BASE_URL, ApiError, buildQueryString };

export function cxpHeaders(headers?: HeadersInit): Record<string, string> {
  const base = headers instanceof Headers ? Object.fromEntries(headers.entries())
    : Array.isArray(headers) ? Object.fromEntries(headers) : { ...(headers ?? {}) };
  return base;
}

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, headers: cxpHeaders(options.headers) });
}

export { request as apiRequest };

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  uploadDte: <T>(path: string, file: File) => request<T>(path, {
    method: 'POST', body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
  }),
  async download(path: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}${path}`, { headers: cxpHeaders(), credentials: 'include' });
    if (response.status === 401) window.dispatchEvent(new Event('cxp:session-expired'));
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.error ?? `Error ${response.status}`, response.status, body?.details);
    }
    return response.blob();
  },
};
