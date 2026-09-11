import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpPeriodo {
  idPeriodo: number;
  idSucursal: number;
  anio: number;
  mes: number;
  fechaInicio: string;
  fechaFin: string;
  estado: "ABIERTO" | "EN_CIERRE" | "CERRADO" | "REABIERTO";
  saldoInicial: number;
  movimientosDebe: number;
  movimientosHaber: number;
  saldoFinal: number;
  cerradoPor: number | null;
  fechaCierre: string | null;
  reabiertoPor: number | null;
  fechaReapertura: string | null;
  motivoReapertura: string | null;
  observaciones: string | null;
}

export const createCxpPeriodoSchema = z.strictObject({
  idSucursal: cxpNumber({"integer": true}),
  anio: cxpNumber({"precision": 4, "scale": 0, "integer": true}),
  mes: cxpNumber({"precision": 2, "scale": 0, "integer": true}),
  fechaInicio: cxpDate(false),
  fechaFin: cxpDate(false),
  estado: z.enum(["ABIERTO", "EN_CIERRE", "CERRADO", "REABIERTO"] as const).default("ABIERTO" as any),
  saldoInicial: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  movimientosDebe: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  movimientosHaber: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  saldoFinal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  cerradoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaCierre: cxpDate(true).nullable().optional(),
  reabiertoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaReapertura: cxpDate(true).nullable().optional(),
  motivoReapertura: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export const updateCxpPeriodoSchema = z.strictObject({
  idSucursal: cxpNumber({"integer": true}).optional(),
  anio: cxpNumber({"precision": 4, "scale": 0, "integer": true}).optional(),
  mes: cxpNumber({"precision": 2, "scale": 0, "integer": true}).optional(),
  fechaInicio: cxpDate(false).optional(),
  fechaFin: cxpDate(false).optional(),
  estado: z.enum(["ABIERTO", "EN_CIERRE", "CERRADO", "REABIERTO"] as const).optional(),
  saldoInicial: cxpNumber({"precision": 18, "scale": 2}).optional(),
  movimientosDebe: cxpNumber({"precision": 18, "scale": 2}).optional(),
  movimientosHaber: cxpNumber({"precision": 18, "scale": 2}).optional(),
  saldoFinal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  cerradoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaCierre: cxpDate(true).nullable().optional(),
  reabiertoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaReapertura: cxpDate(true).nullable().optional(),
  motivoReapertura: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export type CreateCxpPeriodoInput = z.infer<typeof createCxpPeriodoSchema>;
export type UpdateCxpPeriodoInput = z.infer<typeof updateCxpPeriodoSchema>;
