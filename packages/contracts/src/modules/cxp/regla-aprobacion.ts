import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpReglaAprobacion {
  idRegla: number;
  tipoEntidad: "DOCUMENTO" | "PAGO" | "LOTE" | "CUENTA_BANCARIA" | "COMPROMISO" | "PERIODO";
  nombreRegla: string;
  idProveedor: number | null;
  idDepartamento: number | null;
  centroCosto: string | null;
  proyecto: string | null;
  moneda: string | null;
  montoDesde: number;
  montoHasta: number | null;
  requiereSinOc: "S" | "N" | null;
  requiereDiferencia: "S" | "N" | null;
  nivel: number;
  idRolAprobador: number;
  cantidadAprobadores: number;
  permiteDelegacion: "S" | "N";
  vigenteDesde: string;
  vigenteHasta: string | null;
  activa: "S" | "N";
  creadaPor: number;
  fechaCreacion: string;
}

export const createCxpReglaAprobacionSchema = z.strictObject({
  tipoEntidad: z.enum(["DOCUMENTO", "PAGO", "LOTE", "CUENTA_BANCARIA", "COMPROMISO", "PERIODO"] as const),
  nombreRegla: z.string().trim().min(1, "Este campo es obligatorio").max(150, "Máximo 150 caracteres"),
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  idDepartamento: cxpNumber({"integer": true}).nullable().optional(),
  centroCosto: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  proyecto: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").nullable().optional(),
  montoDesde: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  montoHasta: cxpNumber({"precision": 18, "scale": 2}).nullable().optional(),
  requiereSinOc: z.enum(["S", "N"] as const).nullable().optional(),
  requiereDiferencia: z.enum(["S", "N"] as const).nullable().optional(),
  nivel: cxpNumber({"precision": 4, "scale": 0, "integer": true}),
  idRolAprobador: cxpNumber({"integer": true}),
  cantidadAprobadores: cxpNumber({"precision": 3, "scale": 0, "integer": true}).default(1.0 as any),
  permiteDelegacion: z.enum(["S", "N"] as const).default("S" as any),
  vigenteDesde: cxpDate(false).optional(),
  vigenteHasta: cxpDate(false).nullable().optional(),
  activa: z.enum(["S", "N"] as const).default("S" as any),
  creadaPor: cxpNumber({"integer": true}),
});

export const updateCxpReglaAprobacionSchema = z.strictObject({
  tipoEntidad: z.enum(["DOCUMENTO", "PAGO", "LOTE", "CUENTA_BANCARIA", "COMPROMISO", "PERIODO"] as const).optional(),
  nombreRegla: z.string().trim().min(1, "Este campo es obligatorio").max(150, "Máximo 150 caracteres").optional(),
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  idDepartamento: cxpNumber({"integer": true}).nullable().optional(),
  centroCosto: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  proyecto: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").nullable().optional(),
  montoDesde: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoHasta: cxpNumber({"precision": 18, "scale": 2}).nullable().optional(),
  requiereSinOc: z.enum(["S", "N"] as const).nullable().optional(),
  requiereDiferencia: z.enum(["S", "N"] as const).nullable().optional(),
  nivel: cxpNumber({"precision": 4, "scale": 0, "integer": true}).optional(),
  idRolAprobador: cxpNumber({"integer": true}).optional(),
  cantidadAprobadores: cxpNumber({"precision": 3, "scale": 0, "integer": true}).optional(),
  permiteDelegacion: z.enum(["S", "N"] as const).optional(),
  vigenteDesde: cxpDate(false).optional(),
  vigenteHasta: cxpDate(false).nullable().optional(),
  activa: z.enum(["S", "N"] as const).optional(),
  creadaPor: cxpNumber({"integer": true}).optional(),
});

export type CreateCxpReglaAprobacionInput = z.infer<typeof createCxpReglaAprobacionSchema>;
export type UpdateCxpReglaAprobacionInput = z.infer<typeof updateCxpReglaAprobacionSchema>;
