// RF-19 Estadística de compras: respuesta de GET /api/cxp/reportes/estadistica.
// Los importes son TOTAL_LOCAL (total neto × tipo de cambio), en la moneda local.

export type CxpEstadisticaAgrupacion = 'PERIODO' | 'PROVEEDOR' | 'CENTRO_COSTO';

export interface CxpEstadisticaFiltros {
  fechaInicio: string;
  fechaFin: string;
  idProveedor?: number;
  centroCosto?: string;
  moneda?: string;
  estado?: string;
  agrupacion?: CxpEstadisticaAgrupacion;
}

/** Fila agrupada según `agrupacion`; se conserva para Excel y PDF. */
export interface CxpEstadisticaFila {
  periodo: string;
  idProveedor: number | null;
  centroCosto: string | null;
  tipoDocumento: string | null;
  moneda: string | null;
  cantidad: number;
  subtotal: number;
  impuestoTotal: number;
  retencionTotal: number;
  totalNeto: number;
  totalLocal: number;
  participacion: number;
  /** Compara la fila con el total del período anterior completo; para la variación global usar resumen.variacionTotal. */
  variacion: number | null;
  variacionTexto: string;
}

export interface CxpEstadisticaMes {
  periodo: string;
  cantidad: number;
  totalLocal: number;
}

/** Proveedores ordenados por compras; posición 1 es el mayor. */
export interface CxpEstadisticaProveedor {
  posicion: number;
  idProveedor: number | null;
  nombreProveedor: string | null;
  cantidad: number;
  totalLocal: number;
  /** Porcentaje del total del período, con dos decimales. */
  participacion: number;
}

export interface CxpEstadisticaTipoDocumento {
  tipoDocumento: string;
  cantidad: number;
  totalLocal: number;
  participacion: number;
}

export interface CxpEstadisticaResumen {
  porMes: CxpEstadisticaMes[];
  porProveedor: CxpEstadisticaProveedor[];
  porTipoDocumento: CxpEstadisticaTipoDocumento[];
  /** % de cambio del total contra el período anterior de igual duración; null sin compras en ese período. */
  variacionTotal: number | null;
}

export interface CxpEstadisticaReporte {
  fechaInicio: string;
  fechaFin: string;
  agrupacion: string;
  detalle: CxpEstadisticaFila[];
  totales: {
    cantidadDocumentos: number;
    subtotal: number;
    impuestoTotal: number;
    retencionTotal: number;
    totalNeto: number;
    totalLocal: number;
  };
  periodoComparable: {
    fechaInicio: string;
    fechaFin: string;
    totalLocal: number;
    disponible: boolean;
  };
  validacion: {
    estado: 'VALIDO' | 'CON_ADVERTENCIAS' | 'INVALIDO';
    errores: string[];
    advertencias: string[];
  };
  resumen: CxpEstadisticaResumen;
}

export interface CxpEstadisticaRespuesta {
  success: true;
  data: CxpEstadisticaReporte;
}
