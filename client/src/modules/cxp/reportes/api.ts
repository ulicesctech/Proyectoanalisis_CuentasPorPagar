import type {
  CxpAntiguedadFiltros, CxpAntiguedadReporte, CxpAntiguedadRespuesta, CxpRangoAntiguedad,
  CxpRetencionesFiltros, CxpRetencionesReporte, CxpRetencionesRespuesta,
  CxpEstadisticaFiltros, CxpEstadisticaReporte, CxpEstadisticaRespuesta,
} from '@erp/contracts';
import { apiClient, buildQueryString } from '../../../shared/api';

export type FormatoExportacion = 'excel' | 'pdf';

const consulta = (filtros: CxpAntiguedadFiltros) => buildQueryString({
  fechaCorte: filtros.fechaCorte, idProveedor: filtros.idProveedor, moneda: filtros.moneda,
  estado: filtros.estado, centroCosto: filtros.centroCosto, rangoAntiguedad: filtros.rangoAntiguedad,
});

/** Descarga un blob con el nombre indicado sin abrir otra pestaña. */
function guardar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Las rutas de reportes exportan en `<base>/exportar` (Excel) y `<base>/exportar-pdf`. */
async function exportarReporte(base: string, query: string, nombre: string, formato: FormatoExportacion) {
  const blob = await apiClient.download(`${base}/${formato === 'excel' ? 'exportar' : 'exportar-pdf'}${query}`);
  guardar(blob, `${nombre}.${formato === 'excel' ? 'xlsx' : 'pdf'}`);
}

export const antiguedadApi = {
  async consultar(filtros: CxpAntiguedadFiltros): Promise<CxpAntiguedadReporte> {
    return (await apiClient.get<CxpAntiguedadRespuesta>(`/cxp/reportes/antiguedad${consulta(filtros)}`)).data;
  },
  exportar: (filtros: CxpAntiguedadFiltros, formato: FormatoExportacion) =>
    exportarReporte('/cxp/reportes/antiguedad', consulta(filtros), `Reporte_Antiguedad_${filtros.fechaCorte}`, formato),
};

const consultaRetenciones = (filtros: CxpRetencionesFiltros) => buildQueryString({
  fechaInicio: filtros.fechaInicio, fechaFin: filtros.fechaFin, codigoTributo: filtros.codigoTributo,
  idProveedor: filtros.idProveedor, idDocumento: filtros.idDocumento, numeroConstancia: filtros.numeroConstancia,
  estado: filtros.estado, idSucursal: filtros.idSucursal, moneda: filtros.moneda,
});

export const retencionesApi = {
  async consultar(filtros: CxpRetencionesFiltros): Promise<CxpRetencionesReporte> {
    const { success: _success, ...reporte } = await apiClient.get<CxpRetencionesRespuesta>(`/cxp/reportes/retenciones${consultaRetenciones(filtros)}`);
    return reporte;
  },
  exportar: (filtros: CxpRetencionesFiltros, formato: FormatoExportacion) =>
    exportarReporte('/cxp/reportes/retenciones', consultaRetenciones(filtros),
      `Reporte_Retenciones_${filtros.fechaInicio}_${filtros.fechaFin}`, formato),
};

const consultaEstadistica = (filtros: CxpEstadisticaFiltros) => buildQueryString({
  fechaInicio: filtros.fechaInicio, fechaFin: filtros.fechaFin, idProveedor: filtros.idProveedor,
  centroCosto: filtros.centroCosto, moneda: filtros.moneda, estado: filtros.estado, agrupacion: filtros.agrupacion,
});

export const estadisticaApi = {
  async consultar(filtros: CxpEstadisticaFiltros): Promise<CxpEstadisticaReporte> {
    return (await apiClient.get<CxpEstadisticaRespuesta>(`/cxp/reportes/estadistica${consultaEstadistica(filtros)}`)).data;
  },
  exportar: (filtros: CxpEstadisticaFiltros, formato: FormatoExportacion) =>
    exportarReporte('/cxp/reportes/estadistica', consultaEstadistica(filtros),
      `Estadistica_Compras_${filtros.fechaInicio}_${filtros.fechaFin}`, formato),
};

/**
 * Importe en moneda local (TOTAL_LOCAL = total neto × tipo de cambio). No se antepone un
 * código porque ningún parámetro del sistema define cuál es la moneda local.
 */
export const formatoLocal = (value: number) =>
  new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

/** Colores por posición para series dinámicas (tributos, proveedores); clases literales para Tailwind. */
export const SERIE_COLOR = ['bg-blue-600', 'bg-amber-500', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-600', 'bg-cyan-600'] as const;
export const serieColor = (indice: number) => SERIE_COLOR[indice % SERIE_COLOR.length];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "2026-09" → "sep 2026". */
export const etiquetaMes = (periodo: string) => /^\d{4}-\d{2}$/.test(periodo)
  ? `${MESES[Number(periodo.slice(5, 7)) - 1]} ${periodo.slice(0, 4)}` : periodo;

export const RANGO_ETIQUETA: Record<CxpRangoAntiguedad, string> = {
  'NO VENCIDO': 'Por vencer',
  'SIN VENCIMIENTO': 'Sin vencimiento',
  '1-30': '1 a 30 días',
  '31-60': '31 a 60 días',
  '61-90': '61 a 90 días',
  '91-120': '91 a 120 días',
  'MAS DE 120': 'Más de 120 días',
};

/**
 * Rangos en orden de antigüedad. Se derivan de RANGO_ETIQUETA (el tipo obliga a cubrir todos)
 * y no de RANGOS_ANTIGUEDAD: Vite conserva en caché una copia previa de @erp/contracts hasta
 * reiniciarse con --force, y una constante nueva llegaría como undefined.
 */
export const RANGOS = Object.keys(RANGO_ETIQUETA) as CxpRangoAntiguedad[];

/** Clases completas por rango: Tailwind solo genera las que aparecen literalmente. */
export const RANGO_COLOR: Record<CxpRangoAntiguedad, string> = {
  'NO VENCIDO': 'bg-emerald-500',
  'SIN VENCIMIENTO': 'bg-slate-400',
  '1-30': 'bg-amber-400',
  '31-60': 'bg-orange-500',
  '61-90': 'bg-red-500',
  '91-120': 'bg-red-700',
  'MAS DE 120': 'bg-rose-900',
};

/** Fecha de hoy en Guatemala (YYYY-MM-DD), la misma zona que usa el servidor. */
export const hoyGuatemala = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

/** Primer día del año en curso (Guatemala), para rangos de fechas por defecto. */
export const inicioDeAnio = () => `${hoyGuatemala().slice(0, 4)}-01-01`;
