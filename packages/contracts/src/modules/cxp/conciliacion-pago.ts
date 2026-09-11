import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpConciliacionPago {
  idConciliacionPago: number;
  idPago: number;
  idCuentaBancaria: number;
  referenciaMovimiento: string;
  fechaMovimiento: string;
  montoBanco: number;
  montoSistema: number;
  diferenciaMonto: number;
  tipoCoincidencia: "AUTOMATICA" | "MANUAL" | "TOLERANCIA" | "SIN_COINCIDENCIA";
  estado: "PENDIENTE" | "CONCILIADO_AUTOMATICO" | "CONCILIADO_MANUAL" | "EN_REVISION" | "RECHAZADO";
  conciliadoPor: number | null;
  fechaConciliacion: string | null;
  observaciones: string | null;
}

export const createCxpConciliacionPagoSchema = z.strictObject({
  idPago: cxpNumber({"integer": true}),
  idCuentaBancaria: cxpNumber({"integer": true}),
  referenciaMovimiento: z.string().trim().min(1, "Este campo es obligatorio").max(150, "Máximo 150 caracteres"),
  fechaMovimiento: cxpDate(false),
  montoBanco: cxpNumber({"precision": 18, "scale": 2}),
  montoSistema: cxpNumber({"precision": 18, "scale": 2}),
  diferenciaMonto: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  tipoCoincidencia: z.enum(["AUTOMATICA", "MANUAL", "TOLERANCIA", "SIN_COINCIDENCIA"] as const),
  estado: z.enum(["PENDIENTE", "CONCILIADO_AUTOMATICO", "CONCILIADO_MANUAL", "EN_REVISION", "RECHAZADO"] as const).default("PENDIENTE" as any),
  conciliadoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaConciliacion: cxpDate(true).nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export const updateCxpConciliacionPagoSchema = z.strictObject({
  idPago: cxpNumber({"integer": true}).optional(),
  idCuentaBancaria: cxpNumber({"integer": true}).optional(),
  referenciaMovimiento: z.string().trim().min(1, "Este campo es obligatorio").max(150, "Máximo 150 caracteres").optional(),
  fechaMovimiento: cxpDate(false).optional(),
  montoBanco: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoSistema: cxpNumber({"precision": 18, "scale": 2}).optional(),
  diferenciaMonto: cxpNumber({"precision": 18, "scale": 2}).optional(),
  tipoCoincidencia: z.enum(["AUTOMATICA", "MANUAL", "TOLERANCIA", "SIN_COINCIDENCIA"] as const).optional(),
  estado: z.enum(["PENDIENTE", "CONCILIADO_AUTOMATICO", "CONCILIADO_MANUAL", "EN_REVISION", "RECHAZADO"] as const).optional(),
  conciliadoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaConciliacion: cxpDate(true).nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export type CreateCxpConciliacionPagoInput = z.infer<typeof createCxpConciliacionPagoSchema>;
export type UpdateCxpConciliacionPagoInput = z.infer<typeof updateCxpConciliacionPagoSchema>;
