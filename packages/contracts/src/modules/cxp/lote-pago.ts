import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpLotePago {
  idLote: number;
  idSucursal: number;
  idCuentaOrigen: number;
  codigoLote: string;
  tipoLote: "PROVEEDORES" | "IMPUESTOS" | "NOMINA" | "CAJA_CHICA" | "REEMBOLSOS" | "OTRO";
  fechaCreacion: string;
  fechaEjecucion: string;
  moneda: string;
  cantidadPagos: number;
  montoTotal: number;
  estado: "BORRADOR" | "PENDIENTE_APROBACION" | "APROBADO" | "ENVIADO" | "EN_PROCESO" | "EJECUTADO" | "PARCIAL" | "RECHAZADO" | "ANULADO";
  creadoPor: number;
  enviadoPor: number | null;
  fechaEnvio: string | null;
  motivoRechazo: string | null;
  motivoAnulacion: string | null;
  observaciones: string | null;
}

export const createCxpLotePagoSchema = z.strictObject({
  idSucursal: cxpNumber({"integer": true}),
  idCuentaOrigen: cxpNumber({"integer": true}),
  codigoLote: z.string().trim().min(1, "Este campo es obligatorio").max(40, "Máximo 40 caracteres"),
  tipoLote: z.enum(["PROVEEDORES", "IMPUESTOS", "NOMINA", "CAJA_CHICA", "REEMBOLSOS", "OTRO"] as const).default("PROVEEDORES" as any),
  fechaEjecucion: cxpDate(false),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").default("GTQ" as any),
  cantidadPagos: cxpNumber({"precision": 8, "scale": 0, "integer": true}).default(0.0 as any),
  montoTotal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  estado: z.enum(["BORRADOR", "PENDIENTE_APROBACION", "APROBADO", "ENVIADO", "EN_PROCESO", "EJECUTADO", "PARCIAL", "RECHAZADO", "ANULADO"] as const).default("BORRADOR" as any),
  creadoPor: cxpNumber({"integer": true}),
  enviadoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaEnvio: cxpDate(true).nullable().optional(),
  motivoRechazo: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoAnulacion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export const updateCxpLotePagoSchema = z.strictObject({
  idSucursal: cxpNumber({"integer": true}).optional(),
  idCuentaOrigen: cxpNumber({"integer": true}).optional(),
  codigoLote: z.string().trim().min(1, "Este campo es obligatorio").max(40, "Máximo 40 caracteres").optional(),
  tipoLote: z.enum(["PROVEEDORES", "IMPUESTOS", "NOMINA", "CAJA_CHICA", "REEMBOLSOS", "OTRO"] as const).optional(),
  fechaEjecucion: cxpDate(false).optional(),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").optional(),
  cantidadPagos: cxpNumber({"precision": 8, "scale": 0, "integer": true}).optional(),
  montoTotal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  estado: z.enum(["BORRADOR", "PENDIENTE_APROBACION", "APROBADO", "ENVIADO", "EN_PROCESO", "EJECUTADO", "PARCIAL", "RECHAZADO", "ANULADO"] as const).optional(),
  creadoPor: cxpNumber({"integer": true}).optional(),
  enviadoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaEnvio: cxpDate(true).nullable().optional(),
  motivoRechazo: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoAnulacion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export type CreateCxpLotePagoInput = z.infer<typeof createCxpLotePagoSchema>;
export type UpdateCxpLotePagoInput = z.infer<typeof updateCxpLotePagoSchema>;
