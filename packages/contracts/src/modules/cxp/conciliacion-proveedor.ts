import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpConciliacionProveedor {
  idConciliacionProv: number;
  idProveedor: number;
  periodoDesde: string;
  periodoHasta: string;
  saldoEmpresa: number;
  saldoProveedor: number;
  diferencia: number;
  estado: "BORRADOR" | "EN_REVISION" | "CONCILIADA" | "CERRADA";
  elaboradaPor: number;
  fechaElaboracion: string;
  cerradaPor: number | null;
  fechaCierre: string | null;
  observaciones: string | null;
}

export const createCxpConciliacionProveedorSchema = z.strictObject({
  idProveedor: cxpNumber({"integer": true}),
  periodoDesde: cxpDate(false),
  periodoHasta: cxpDate(false),
  saldoEmpresa: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  saldoProveedor: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  diferencia: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  estado: z.enum(["BORRADOR", "EN_REVISION", "CONCILIADA", "CERRADA"] as const).default("BORRADOR" as any),
  elaboradaPor: cxpNumber({"integer": true}),
  cerradaPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaCierre: cxpDate(true).nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export const updateCxpConciliacionProveedorSchema = z.strictObject({
  idProveedor: cxpNumber({"integer": true}).optional(),
  periodoDesde: cxpDate(false).optional(),
  periodoHasta: cxpDate(false).optional(),
  saldoEmpresa: cxpNumber({"precision": 18, "scale": 2}).optional(),
  saldoProveedor: cxpNumber({"precision": 18, "scale": 2}).optional(),
  diferencia: cxpNumber({"precision": 18, "scale": 2}).optional(),
  estado: z.enum(["BORRADOR", "EN_REVISION", "CONCILIADA", "CERRADA"] as const).optional(),
  elaboradaPor: cxpNumber({"integer": true}).optional(),
  cerradaPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaCierre: cxpDate(true).nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export type CreateCxpConciliacionProveedorInput = z.infer<typeof createCxpConciliacionProveedorSchema>;
export type UpdateCxpConciliacionProveedorInput = z.infer<typeof updateCxpConciliacionProveedorSchema>;
