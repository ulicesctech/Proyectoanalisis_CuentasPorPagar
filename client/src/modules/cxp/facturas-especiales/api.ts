import type {
  CxpCalculoFacturaEspecial, CxpFacturaEspecialDetalle, CxpFacturaEspecialResumen, CxpReglaTributaria, PaginatedResponse,
} from '@erp/contracts';
import { API_BASE_URL, ApiError, apiClient, buildQueryString } from '../../../shared/api';

export type AccionFlujo = 'enviar-revision' | 'revisar' | 'devolver' | 'aprobar' | 'rechazar' | 'reabrir' | 'emitir' | 'anular';
export interface ResultadoAccion { mensaje: string; factura: CxpFacturaEspecialDetalle }

export const facturasEspecialesApi = {
  list: (params: { page: number; search?: string; etapa?: string }) =>
    apiClient.get<PaginatedResponse<CxpFacturaEspecialResumen>>(`/cxp/facturas-especiales${buildQueryString({ ...params, limit: 10 })}`),
  get: (id: number) => apiClient.get<CxpFacturaEspecialDetalle>(`/cxp/facturas-especiales/${id}`),
  calcular: (data: unknown) => apiClient.post<CxpCalculoFacturaEspecial>('/cxp/facturas-especiales/calcular', data),
  create: (data: unknown) => apiClient.post<ResultadoAccion>('/cxp/facturas-especiales', data),
  update: (id: number, data: unknown) => apiClient.patch<ResultadoAccion>(`/cxp/facturas-especiales/${id}`, data),
  accion: (id: number, accion: AccionFlujo, data: unknown) => apiClient.post<ResultadoAccion>(`/cxp/facturas-especiales/${id}/${accion}`, data),

  /** Descarga la constancia PDF desde el servidor (respuesta binaria, no JSON). */
  async descargarConstancia(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/cxp/facturas-especiales/${id}/constancia`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.error ?? `Error ${response.status}`, response.status);
    }
    const nombre = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? `constancia-${id}.pdf`;
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export const reglasTributariasApi = {
  list: (params: { codigoRegla?: string; estado?: string; search?: string } = {}) =>
    apiClient.get<CxpReglaTributaria[]>(`/cxp/reglas-tributarias${buildQueryString(params)}`),
  create: (data: unknown) => apiClient.post<CxpReglaTributaria>('/cxp/reglas-tributarias', data),
  nuevaVersion: (id: number, data: unknown) => apiClient.post<CxpReglaTributaria>(`/cxp/reglas-tributarias/${id}/versiones`, data),
  finalizar: (id: number, data: unknown) => apiClient.post<CxpReglaTributaria>(`/cxp/reglas-tributarias/${id}/finalizar`, data),
};

/** Mensaje y errores por campo de una respuesta del API. */
export function errorDe(reason: unknown): { mensaje: string; campos: Record<string, string> } {
  if (reason instanceof ApiError) {
    const campos: Record<string, string> = {};
    if (Array.isArray(reason.details)) {
      for (const item of reason.details as Array<{ campo?: string; mensaje?: string }>) if (item.campo && item.mensaje) campos[item.campo] = item.mensaje;
    }
    return { mensaje: reason.message, campos };
  }
  return { mensaje: 'No se pudo completar la operación. Comprueba que el servidor esté iniciado.', campos: {} };
}

export const formatoMonto = (value: number | null | undefined, moneda = 'GTQ') =>
  value == null ? '—' : `${moneda} ${new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

export const formatoFecha = (value: string | null | undefined) => {
  if (!value) return '—';
  const base = `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  return value.length > 10 ? `${base} ${value.slice(11, 16)}` : base;
};
