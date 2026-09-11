import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpConciliacionProveedorDetalle {
  idDetConciliacion: number;
  idConciliacionProv: number;
  idDocumento: number | null;
  idPago: number | null;
  tipoRegistro: "DOCUMENTO" | "PAGO" | "AJUSTE_EXTERNO";
  referenciaProveedor: string | null;
  fechaEmpresa: string | null;
  fechaProveedor: string | null;
  montoEmpresa: number | null;
  montoProveedor: number | null;
  diferencia: number;
  resultado: "COINCIDE" | "DIFERENCIA_FECHA" | "DIFERENCIA_MONTO" | "NO_REGISTRADO_EMPRESA" | "NO_REGISTRADO_PROVEEDOR" | "EN_REVISION";
  observaciones: string | null;
}

export const createCxpConciliacionProveedorDetalleSchema = z.strictObject({
  idConciliacionProv: cxpNumber({"integer": true}),
  idDocumento: cxpNumber({"integer": true}).nullable().optional(),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  tipoRegistro: z.enum(["DOCUMENTO", "PAGO", "AJUSTE_EXTERNO"] as const),
  referenciaProveedor: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").nullable().optional(),
  fechaEmpresa: cxpDate(false).nullable().optional(),
  fechaProveedor: cxpDate(false).nullable().optional(),
  montoEmpresa: cxpNumber({"precision": 18, "scale": 2}).nullable().optional(),
  montoProveedor: cxpNumber({"precision": 18, "scale": 2}).nullable().optional(),
  diferencia: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  resultado: z.enum(["COINCIDE", "DIFERENCIA_FECHA", "DIFERENCIA_MONTO", "NO_REGISTRADO_EMPRESA", "NO_REGISTRADO_PROVEEDOR", "EN_REVISION"] as const),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export const updateCxpConciliacionProveedorDetalleSchema = z.strictObject({
  idConciliacionProv: cxpNumber({"integer": true}).optional(),
  idDocumento: cxpNumber({"integer": true}).nullable().optional(),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  tipoRegistro: z.enum(["DOCUMENTO", "PAGO", "AJUSTE_EXTERNO"] as const).optional(),
  referenciaProveedor: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").nullable().optional(),
  fechaEmpresa: cxpDate(false).nullable().optional(),
  fechaProveedor: cxpDate(false).nullable().optional(),
  montoEmpresa: cxpNumber({"precision": 18, "scale": 2}).nullable().optional(),
  montoProveedor: cxpNumber({"precision": 18, "scale": 2}).nullable().optional(),
  diferencia: cxpNumber({"precision": 18, "scale": 2}).optional(),
  resultado: z.enum(["COINCIDE", "DIFERENCIA_FECHA", "DIFERENCIA_MONTO", "NO_REGISTRADO_EMPRESA", "NO_REGISTRADO_PROVEEDOR", "EN_REVISION"] as const).optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export type CreateCxpConciliacionProveedorDetalleInput = z.infer<typeof createCxpConciliacionProveedorDetalleSchema>;
export type UpdateCxpConciliacionProveedorDetalleInput = z.infer<typeof updateCxpConciliacionProveedorDetalleSchema>;
