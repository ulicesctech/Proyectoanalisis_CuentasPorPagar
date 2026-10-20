// RF-21 Retenciones (IVA, ISR u otras): respuesta de GET /api/cxp/reportes/retenciones.
// Los códigos de tributo los define cada regla tributaria; no son una lista fija.

export interface CxpRetencionesFiltros {
  fechaInicio: string;
  fechaFin: string;
  codigoTributo?: string;
  idProveedor?: number;
  idDocumento?: number;
  numeroConstancia?: string;
  estado?: string;
  idSucursal?: number;
  moneda?: string;
}

export interface CxpRetencionDetalle {
  idTributo: number;
  idDocumento: number;
  idProveedor: number | null;
  nombreProveedor: string | null;
  idSucursal: number | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  fechaDocumento: string | null;
  moneda: string | null;
  tipoTributo: string | null;
  codigoTributo: string | null;
  nombreTributo: string | null;
  baseImponible: number;
  porcentaje: number;
  monto: number;
  montoRecuperable: number;
  montoNoRecuperable: number;
  numeroConstancia: string | null;
  periodoFiscal: string | null;
  fechaAplicacion: string | null;
  estado: string | null;
}

/** Agrupa todas las monedas; para importes por moneda usar resumenPorMes. */
export interface CxpRetencionResumenTributo {
  tipoTributo: string;
  codigoTributo: string;
  nombreTributo: string;
  cantidad: number;
  baseImponible: number;
  monto: number;
  montoRecuperable: number;
  montoNoRecuperable: number;
}

/** Tendencia: un registro por mes de aplicación (YYYY-MM), moneda y tributo. */
export interface CxpRetencionResumenMes {
  periodo: string;
  moneda: string;
  codigoTributo: string;
  nombreTributo: string;
  cantidad: number;
  baseImponible: number;
  monto: number;
}

export interface CxpRetencionProveedorTributo {
  codigoTributo: string;
  nombreTributo: string;
  monto: number;
}

/** Proveedores ordenados por monto retenido dentro de cada moneda. */
export interface CxpRetencionResumenProveedor {
  idProveedor: number | null;
  nombreProveedor: string | null;
  moneda: string;
  cantidad: number;
  baseImponible: number;
  monto: number;
  /** Retenciones que ya tienen número de constancia. */
  conConstancia: number;
  porTributo: CxpRetencionProveedorTributo[];
}

export interface CxpRetencionesReporte {
  fechaInicio: string;
  fechaFin: string;
  detalle: CxpRetencionDetalle[];
  resumenPorTributo: CxpRetencionResumenTributo[];
  resumenPorMes: CxpRetencionResumenMes[];
  resumenPorProveedor: CxpRetencionResumenProveedor[];
  totales: {
    cantidad: number;
    baseImponible: number;
    monto: number;
    montoRecuperable: number;
    montoNoRecuperable: number;
  };
}

/** Esta ruta devuelve el reporte junto a `success`, no dentro de `data`. */
export type CxpRetencionesRespuesta = { success: true } & CxpRetencionesReporte;
