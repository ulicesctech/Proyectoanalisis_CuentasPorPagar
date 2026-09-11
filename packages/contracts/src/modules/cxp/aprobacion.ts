import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpAprobacion {
  idAprobacion: number;
  idRegla: number | null;
  idDocumento: number | null;
  idPago: number | null;
  idLote: number | null;
  idCuentaBancaria: number | null;
  idCompromiso: number | null;
  idPeriodo: number | null;
  nivel: number;
  idRolAprobador: number;
  idUsuarioAprobador: number | null;
  delegadoPor: number | null;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA" | "DELEGADA" | "CANCELADA";
  accion: string | null;
  fechaSolicitud: string;
  fechaDecision: string | null;
  observacion: string | null;
}

export const createCxpAprobacionSchema = z.strictObject({
  idRegla: cxpNumber({"integer": true}).nullable().optional(),
  idDocumento: cxpNumber({"integer": true}).nullable().optional(),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  idLote: cxpNumber({"integer": true}).nullable().optional(),
  idCuentaBancaria: cxpNumber({"integer": true}).nullable().optional(),
  idCompromiso: cxpNumber({"integer": true}).nullable().optional(),
  idPeriodo: cxpNumber({"integer": true}).nullable().optional(),
  nivel: cxpNumber({"precision": 4, "scale": 0, "integer": true}),
  idRolAprobador: cxpNumber({"integer": true}),
  idUsuarioAprobador: cxpNumber({"integer": true}).nullable().optional(),
  delegadoPor: cxpNumber({"integer": true}).nullable().optional(),
  estado: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA", "DELEGADA", "CANCELADA"] as const).default("PENDIENTE" as any),
  accion: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres").nullable().optional(),
  fechaDecision: cxpDate(true).nullable().optional(),
  observacion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export const updateCxpAprobacionSchema = z.strictObject({
  idRegla: cxpNumber({"integer": true}).nullable().optional(),
  idDocumento: cxpNumber({"integer": true}).nullable().optional(),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  idLote: cxpNumber({"integer": true}).nullable().optional(),
  idCuentaBancaria: cxpNumber({"integer": true}).nullable().optional(),
  idCompromiso: cxpNumber({"integer": true}).nullable().optional(),
  idPeriodo: cxpNumber({"integer": true}).nullable().optional(),
  nivel: cxpNumber({"precision": 4, "scale": 0, "integer": true}).optional(),
  idRolAprobador: cxpNumber({"integer": true}).optional(),
  idUsuarioAprobador: cxpNumber({"integer": true}).nullable().optional(),
  delegadoPor: cxpNumber({"integer": true}).nullable().optional(),
  estado: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA", "DELEGADA", "CANCELADA"] as const).optional(),
  accion: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres").nullable().optional(),
  fechaDecision: cxpDate(true).nullable().optional(),
  observacion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export type CreateCxpAprobacionInput = z.infer<typeof createCxpAprobacionSchema>;
export type UpdateCxpAprobacionInput = z.infer<typeof updateCxpAprobacionSchema>;
