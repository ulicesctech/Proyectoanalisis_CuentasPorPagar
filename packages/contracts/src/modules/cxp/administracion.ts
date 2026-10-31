import type { CxpRecord } from './types';
import type { PaginationMeta } from '../../pagination';

export const CXP_ADMIN_RESOURCES = ['reglas-aprobacion','aprobaciones','eventos','archivos','conciliaciones-proveedor',
  'conciliaciones-proveedor-detalle','conciliaciones-pago','parametros','periodos','cuentas-bancarias','compromisos'] as const;
export type CxpAdminResource = typeof CXP_ADMIN_RESOURCES[number];
export interface CxpAdminRow { registro: CxpRecord; etiquetas: Record<string,string> }
export interface CxpAdminLista { data: CxpAdminRow[]; meta: PaginationMeta }
export interface CxpAdminReferencia { titulo: string; referencia: string; ruta?: string; idPago?: number; estado?: string; moneda?: string; monto?: number }
export interface CxpAdminDetalle {
  version?: string;
  conciliacion?: {lineas:CxpRecord[];moneda:string|null;impedimentos:string[]};
  item: CxpAdminRow;
  hechos: Array<{ nombre: string; valor: string }>;
  avisos: string[];
  relacionados: CxpAdminReferencia[];
}
export interface CxpAdminPermisos {
  configuracion:boolean; periodos:boolean; registrarCuenta:boolean; decidirCuenta:boolean;
  registrarCompromiso:boolean; elaborarConciliacion:boolean; cerrarConciliacion:boolean;
}
export interface CxpPeriodoConsulta {
  idSucursal: number; fecha: string; disponible: boolean; motivo: string;
  periodos: Array<{idPeriodo:number;estado:string;fechaInicio:string;fechaFin:string}>;
}
export interface CxpConciliacionConsulta {
  moneda: string; base: string; saldoEmpresa: number; saldoProveedor: number | null; diferencia: number | null;
  fuentes: CxpAdminReferencia[]; avisos: string[];
}
