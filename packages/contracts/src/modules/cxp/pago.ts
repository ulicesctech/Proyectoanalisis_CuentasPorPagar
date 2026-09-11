import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpPago {
  idPago: number;
  idLote: number | null;
  idProveedor: number;
  idSucursal: number;
  idFormaPago: number;
  idCuentaOrigen: number;
  idCuentaDestino: number;
  idPagoOrigen: number | null;
  codigoPago: string;
  tipoPago: "ORDINARIO" | "ANTICIPO" | "REEMBOLSO" | "REPOSICION_CAJA" | "DEVOLUCION" | "REVERSO" | "COMPENSACION";
  fechaProgramada: string;
  fechaPago: string | null;
  fechaEfectiva: string | null;
  moneda: string;
  tipoCambio: number;
  fuenteTipoCambio: string | null;
  fechaTipoCambio: string | null;
  montoObligacion: number;
  montoDescuento: number;
  montoRetencion: number;
  montoComision: number;
  montoTransferido: number;
  montoAplicado: number;
  montoNoAplicado: number;
  numeroCheque: string | null;
  numeroTransferencia: string | null;
  referenciaBancaria: string | null;
  concepto: string;
  respuestaBanco: string | null;
  estadoContable: "PENDIENTE" | "ENVIADO" | "CONTABILIZADO" | "ERROR" | "REVERTIDO" | "NO_APLICA";
  numeroAsientoExt: string | null;
  claveIdempotencia: string;
  estado: "BORRADOR" | "PROGRAMADO" | "PENDIENTE_APROBACION" | "APROBADO" | "ENVIADO" | "EN_PROCESO" | "EJECUTADO" | "CONFIRMADO" | "PARCIALMENTE_APLICADO" | "APLICADO" | "CONCILIADO" | "RECHAZADO" | "DEVUELTO" | "ANULADO";
  programadoPor: number;
  ejecutadoPor: number | null;
  conciliadoPor: number | null;
  motivoRechazo: string | null;
  motivoDevolucion: string | null;
  motivoAnulacion: string | null;
  fechaCreacion: string;
  fechaModificacion: string | null;
}

export const createCxpPagoSchema = z.strictObject({
  idLote: cxpNumber({"integer": true}).nullable().optional(),
  idProveedor: cxpNumber({"integer": true}),
  idSucursal: cxpNumber({"integer": true}),
  idFormaPago: cxpNumber({"integer": true}),
  idCuentaOrigen: cxpNumber({"integer": true}),
  idCuentaDestino: cxpNumber({"integer": true}),
  idPagoOrigen: cxpNumber({"integer": true}).nullable().optional(),
  codigoPago: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres"),
  tipoPago: z.enum(["ORDINARIO", "ANTICIPO", "REEMBOLSO", "REPOSICION_CAJA", "DEVOLUCION", "REVERSO", "COMPENSACION"] as const).default("ORDINARIO" as any),
  fechaProgramada: cxpDate(false),
  fechaPago: cxpDate(true).nullable().optional(),
  fechaEfectiva: cxpDate(false).nullable().optional(),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").default("GTQ" as any),
  tipoCambio: cxpNumber({"precision": 18, "scale": 8}).default(1.0 as any),
  fuenteTipoCambio: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  fechaTipoCambio: cxpDate(false).nullable().optional(),
  montoObligacion: cxpNumber({"precision": 18, "scale": 2}),
  montoDescuento: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  montoRetencion: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  montoComision: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  numeroCheque: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  numeroTransferencia: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").nullable().optional(),
  referenciaBancaria: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").nullable().optional(),
  concepto: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres"),
  respuestaBanco: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  estadoContable: z.enum(["PENDIENTE", "ENVIADO", "CONTABILIZADO", "ERROR", "REVERTIDO", "NO_APLICA"] as const).default("PENDIENTE" as any),
  numeroAsientoExt: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  claveIdempotencia: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres"),
  estado: z.enum(["BORRADOR", "PROGRAMADO", "PENDIENTE_APROBACION", "APROBADO", "ENVIADO", "EN_PROCESO", "EJECUTADO", "CONFIRMADO", "PARCIALMENTE_APLICADO", "APLICADO", "CONCILIADO", "RECHAZADO", "DEVUELTO", "ANULADO"] as const).default("BORRADOR" as any),
  programadoPor: cxpNumber({"integer": true}),
  ejecutadoPor: cxpNumber({"integer": true}).nullable().optional(),
  conciliadoPor: cxpNumber({"integer": true}).nullable().optional(),
  motivoRechazo: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoDevolucion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoAnulacion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export const updateCxpPagoSchema = z.strictObject({
  idLote: cxpNumber({"integer": true}).nullable().optional(),
  idProveedor: cxpNumber({"integer": true}).optional(),
  idSucursal: cxpNumber({"integer": true}).optional(),
  idFormaPago: cxpNumber({"integer": true}).optional(),
  idCuentaOrigen: cxpNumber({"integer": true}).optional(),
  idCuentaDestino: cxpNumber({"integer": true}).optional(),
  idPagoOrigen: cxpNumber({"integer": true}).nullable().optional(),
  codigoPago: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").optional(),
  tipoPago: z.enum(["ORDINARIO", "ANTICIPO", "REEMBOLSO", "REPOSICION_CAJA", "DEVOLUCION", "REVERSO", "COMPENSACION"] as const).optional(),
  fechaProgramada: cxpDate(false).optional(),
  fechaPago: cxpDate(true).nullable().optional(),
  fechaEfectiva: cxpDate(false).nullable().optional(),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").optional(),
  tipoCambio: cxpNumber({"precision": 18, "scale": 8}).optional(),
  fuenteTipoCambio: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  fechaTipoCambio: cxpDate(false).nullable().optional(),
  montoObligacion: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoDescuento: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoRetencion: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoComision: cxpNumber({"precision": 18, "scale": 2}).optional(),
  numeroCheque: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  numeroTransferencia: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").nullable().optional(),
  referenciaBancaria: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").nullable().optional(),
  concepto: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").optional(),
  respuestaBanco: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  estadoContable: z.enum(["PENDIENTE", "ENVIADO", "CONTABILIZADO", "ERROR", "REVERTIDO", "NO_APLICA"] as const).optional(),
  numeroAsientoExt: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  claveIdempotencia: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").optional(),
  estado: z.enum(["BORRADOR", "PROGRAMADO", "PENDIENTE_APROBACION", "APROBADO", "ENVIADO", "EN_PROCESO", "EJECUTADO", "CONFIRMADO", "PARCIALMENTE_APLICADO", "APLICADO", "CONCILIADO", "RECHAZADO", "DEVUELTO", "ANULADO"] as const).optional(),
  programadoPor: cxpNumber({"integer": true}).optional(),
  ejecutadoPor: cxpNumber({"integer": true}).nullable().optional(),
  conciliadoPor: cxpNumber({"integer": true}).nullable().optional(),
  motivoRechazo: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoDevolucion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoAnulacion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export type CreateCxpPagoInput = z.infer<typeof createCxpPagoSchema>;
export type UpdateCxpPagoInput = z.infer<typeof updateCxpPagoSchema>;
