// RF-17 Antigüedad de saldos: respuesta de GET /api/cxp/reportes/antiguedad.

/** Rangos que calcula la consulta Oracle a partir de FECHA_VENCIMIENTO y la fecha de corte. */
export const RANGOS_ANTIGUEDAD = [
  'NO VENCIDO', 'SIN VENCIMIENTO', '1-30', '31-60', '61-90', '91-120', 'MAS DE 120',
] as const;
export type CxpRangoAntiguedad = (typeof RANGOS_ANTIGUEDAD)[number];

/** Rangos cuyo saldo ya está vencido a la fecha de corte. */
export const RANGOS_ANTIGUEDAD_VENCIDOS: readonly CxpRangoAntiguedad[] = ['1-30', '31-60', '61-90', '91-120', 'MAS DE 120'];

export interface CxpAntiguedadFiltros {
  fechaCorte: string;
  idProveedor?: number;
  moneda?: string;
  estado?: string;
  centroCosto?: string;
  rangoAntiguedad?: CxpRangoAntiguedad;
}

/** Una factura con su saldo histórico al corte (no el saldo actual). */
export interface CxpAntiguedadDetalle {
  idDocumento: number;
  idProveedor: number;
  nombreProveedor: string | null;
  numeroDocumento: string | null;
  tipoDocumento: string | null;
  fechaDocumento: string | null;
  fechaVencimiento: string | null;
  moneda: string | null;
  totalNeto: number;
  saldoHistorico: number;
  diasAntiguedad: number;
  rangoAntiguedad: string;
  centroCosto: string | null;
}

/** Importes de monedas distintas nunca se suman entre sí. */
export interface CxpAntiguedadResumenMoneda {
  moneda: string;
  cantidadDocumentos: number;
  saldoTotal: number;
  saldoVencido: number;
  saldoNoVencido: number;
}

export interface CxpAntiguedadResumenRango {
  moneda: string;
  rango: CxpRangoAntiguedad;
  cantidadDocumentos: number;
  saldo: number;
}

/** Proveedores ordenados por saldo dentro de cada moneda; posición 1 es la mayor deuda. */
export interface CxpAntiguedadProveedor {
  posicion: number;
  idProveedor: number;
  nombreProveedor: string | null;
  moneda: string;
  cantidadDocumentos: number;
  saldoTotal: number;
  saldoVencido: number;
  diasMaximos: number;
  /** Porcentaje del saldo total de su moneda, con dos decimales. */
  participacion: number;
}

export interface CxpAntiguedadReporte {
  fechaCorte: string;
  detalle: CxpAntiguedadDetalle[];
  /** Totales históricos del reporte; si hay varias monedas, usar resumenPorMoneda. */
  totales: {
    cantidadDocumentos: number;
    saldoTotal: number;
  };
  resumenPorMoneda: CxpAntiguedadResumenMoneda[];
  resumenPorRango: CxpAntiguedadResumenRango[];
  rankingProveedores: CxpAntiguedadProveedor[];
}

export interface CxpAntiguedadRespuesta {
  success: true;
  data: CxpAntiguedadReporte;
}
