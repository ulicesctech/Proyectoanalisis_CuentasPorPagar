import type {
  CxpAntiguedadFiltros, CxpAntiguedadReporte, CxpAntiguedadRespuesta, CxpRangoAntiguedad,
  CxpRetencionesFiltros, CxpRetencionesReporte, CxpRetencionesRespuesta,
  CxpEstadisticaFiltros, CxpEstadisticaReporte, CxpEstadisticaRespuesta, CxpParametro, CxpDocumentoMonedas,
} from '@erp/contracts';
import { apiClient, buildQueryString } from '../api';

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

/** Moneda local del ERP: TOTAL_LOCAL (total neto × tipo de cambio) se expresa en quetzales. */
export const MONEDA_LOCAL = 'GTQ';

/** Importe de la estadística de compras (TOTAL_LOCAL) con su moneda. */
export const formatoLocal = (value: number) =>
  `${MONEDA_LOCAL} ${new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

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

export type Periodo = { fechaInicio: string; fechaFin: string };

const fechaValida = (texto: string | null): texto is string => {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
};

/**
 * Período compartido entre las pestañas de reportes (`?desde=&hasta=`). Un valor ausente o
 * inválido vuelve al año en curso hasta hoy; en Antigüedad, `hasta` es la fecha de corte.
 */
export function leerPeriodo(params: URLSearchParams): Periodo {
  const hoy = hoyGuatemala();
  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const fechaFin = fechaValida(hasta) && hasta <= hoy ? hasta : hoy;
  const fechaInicio = fechaValida(desde) && desde <= fechaFin ? desde : (inicioDeAnio() <= fechaFin ? inicioDeAnio() : fechaFin);
  return { fechaInicio, fechaFin };
}

export const parametrosPeriodo = (periodo: Periodo) => new URLSearchParams({ desde: periodo.fechaInicio, hasta: periodo.fechaFin });

/** Período y filtros de un reporte en la URL; los filtros vacíos no se escriben. */
export function parametrosReporte(periodo: Periodo, filtros: Record<string, string | undefined> = {}) {
  const params = parametrosPeriodo(periodo);
  for (const [clave, valor] of Object.entries(filtros)) if (valor) params.set(clave, valor);
  return params;
}

/** Filtro leído de la URL: si no cumple el formato esperado se ignora. */
export const filtroUrl = (params: URLSearchParams, clave: string, formato: RegExp) => {
  const valor = params.get(clave)?.trim() ?? '';
  return formato.test(valor) ? valor : '';
};
export const FORMATO_ID = /^[1-9]\d{0,9}$/;
export const FORMATO_MONEDA = /^[A-Z]{3}$/;
export const formatoTexto = (maximo: number) => new RegExp(`^.{1,${maximo}}$`);

const dosDigitos = (numero: number) => String(numero).padStart(2, '0');
/** Último día del mes (mes de 1 a 12). */
const ultimoDia = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const mesDesplazado = (anio: number, mes: number, delta: number) => {
  const indice = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(indice / 12), mes: (indice % 12) + 1 };
};

export interface AtajoPeriodo { clave: string; etiqueta: string; periodo: Periodo }

/** Períodos frecuentes, calculados con la fecha de Guatemala y sin pasar de hoy. */
export function atajosPeriodo(hoy = hoyGuatemala()): AtajoPeriodo[] {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const anterior = mesDesplazado(anio, mes, -1);
  const hace3 = mesDesplazado(anio, mes, -2);
  return [
    { clave: 'mes', etiqueta: 'Este mes', periodo: { fechaInicio: `${anio}-${dosDigitos(mes)}-01`, fechaFin: hoy } },
    { clave: 'mes-anterior', etiqueta: 'Mes anterior', periodo: {
      fechaInicio: `${anterior.anio}-${dosDigitos(anterior.mes)}-01`,
      fechaFin: `${anterior.anio}-${dosDigitos(anterior.mes)}-${dosDigitos(ultimoDia(anterior.anio, anterior.mes))}`,
    } },
    { clave: 'tres-meses', etiqueta: 'Últimos 3 meses', periodo: { fechaInicio: `${hace3.anio}-${dosDigitos(hace3.mes)}-01`, fechaFin: hoy } },
    { clave: 'anio', etiqueta: 'Este año', periodo: { fechaInicio: `${anio}-01-01`, fechaFin: hoy } },
    { clave: 'anio-anterior', etiqueta: 'Año anterior', periodo: { fechaInicio: `${anio - 1}-01-01`, fechaFin: `${anio - 1}-12-31` } },
  ];
}

export interface AtajoCorte { clave: string; etiqueta: string; fecha: string }

/** Fechas de corte frecuentes para la antigüedad de saldos. */
export function atajosCorte(hoy = hoyGuatemala()): AtajoCorte[] {
  const anio = Number(hoy.slice(0, 4));
  const anterior = mesDesplazado(anio, Number(hoy.slice(5, 7)), -1);
  return [
    { clave: 'hoy', etiqueta: 'Hoy', fecha: hoy },
    { clave: 'cierre-mes', etiqueta: 'Cierre del mes anterior',
      fecha: `${anterior.anio}-${dosDigitos(anterior.mes)}-${dosDigitos(ultimoDia(anterior.anio, anterior.mes))}` },
    { clave: 'cierre-anio', etiqueta: 'Cierre del año anterior', fecha: `${anio - 1}-12-31` },
  ];
}

let monedas: Promise<CxpDocumentoMonedas['monedas']> | null = null;

/** Monedas del catálogo del ERP (la misma lista del registro de documentos); se pide una sola vez. */
export function catalogoMonedas(): Promise<CxpDocumentoMonedas['monedas']> {
  monedas ??= apiClient.get<CxpDocumentoMonedas>('/cxp/documentos/monedas')
    .then(respuesta => respuesta.monedas)
    .catch(error => { monedas = null; throw error; });
  return monedas;
}

/** Valida un período escrito por el usuario; devuelve el mensaje de error o null. */
export function errorPeriodo(periodo: Periodo): string | null {
  if (!periodo.fechaInicio || !periodo.fechaFin) return 'Indica las fechas Desde y Hasta.';
  if (periodo.fechaInicio > periodo.fechaFin) return 'La fecha Desde no puede ser posterior a Hasta.';
  if (periodo.fechaFin > hoyGuatemala()) return 'La fecha Hasta no puede ser posterior a hoy.';
  return null;
}

/**
 * Días de anticipación para marcar un documento como próximo a vencer, según el parámetro
 * DIAS_ALERTA_VENCIMIENTO de CXP_PARAMETRO. Sin parámetro activo no se marca ninguno.
 */
export async function diasAlertaVencimiento(): Promise<number | null> {
  const { data } = await apiClient.get<{ data: CxpParametro[] }>(`/cxp/parametros${buildQueryString({ search: 'DIAS_ALERTA_VENCIMIENTO' })}`);
  const parametro = data.find(item => item.codigo === 'DIAS_ALERTA_VENCIMIENTO' && item.activo !== 'N');
  const dias = Number(parametro?.valorNumero);
  return parametro && Number.isInteger(dias) && dias >= 0 ? dias : null;
}

/** Días calendario de `desde` a `hasta` (YYYY-MM-DD). */
export const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
