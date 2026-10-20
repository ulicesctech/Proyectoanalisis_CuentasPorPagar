import type { CxpAntiguedadFiltros, CxpAntiguedadReporte, CxpAntiguedadRespuesta, CxpRangoAntiguedad } from '@erp/contracts';
import { apiClient, buildQueryString } from '../../../shared/api';

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

export const antiguedadApi = {
  async consultar(filtros: CxpAntiguedadFiltros): Promise<CxpAntiguedadReporte> {
    return (await apiClient.get<CxpAntiguedadRespuesta>(`/cxp/reportes/antiguedad${consulta(filtros)}`)).data;
  },
  async exportar(filtros: CxpAntiguedadFiltros, formato: 'excel' | 'pdf') {
    const ruta = formato === 'excel' ? 'exportar' : 'exportar-pdf';
    const blob = await apiClient.download(`/cxp/reportes/antiguedad/${ruta}${consulta(filtros)}`);
    guardar(blob, `Reporte_Antiguedad_${filtros.fechaCorte}.${formato === 'excel' ? 'xlsx' : 'pdf'}`);
  },
};

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
