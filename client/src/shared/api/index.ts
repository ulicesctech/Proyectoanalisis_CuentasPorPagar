// Cliente API único para todo el frontend. No uses fetch() suelto en los
// módulos: todo el equipo pasa por aquí para que la base URL, el manejo de
// errores y el formato de respuesta sean consistentes en toda la app.

import { sessionCsrfToken } from '../../modules/cxp/auth/session';
import { API_BASE_URL } from './base';

const BASE_URL = API_BASE_URL;

/** Base del API para descargas de archivos (p. ej. PDF), que no pasan por apiClient (JSON). */
export { API_BASE_URL };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const csrf = path.startsWith('/cxp/') && !['GET', 'HEAD'].includes(options.method ?? 'GET') ? sessionCsrfToken() : null;
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: path.startsWith('/cxp/') ? 'include' : options.credentials,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...options.headers,
    },
  });
  if (path.startsWith('/cxp/') && response.status === 401) window.dispatchEvent(new Event('cxp:session-expired'));

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      body?.error ?? `Error ${response.status}`,
      response.status,
      body?.details,
    );
  }

  return body as T;
}

export const apiRequest = request;

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  uploadDte: <T>(path: string, file: File) => request<T>(path, {
    method: 'POST', body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
  }),
  async download(path: string): Promise<Blob> {
    const response = await fetch(`${BASE_URL}${path}`, { credentials: path.startsWith('/cxp/') ? 'include' : 'same-origin' });
    if (path.startsWith('/cxp/') && response.status === 401) window.dispatchEvent(new Event('cxp:session-expired'));
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.error ?? `Error ${response.status}`, response.status, body?.details);
    }
    return response.blob();
  },
};

/** Construye un query string ignorando valores undefined/vacíos. */
export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const usable = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== '',
  );
  if (usable.length === 0) return '';
  return '?' + new URLSearchParams(usable.map(([k, v]) => [k, String(v)])).toString();
}
