import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpDocumentoTributo {
  idTributo: number;
  idDocumento: number;
  idDetalle: number | null;
  tipoTributo: "IMPUESTO" | "RETENCION" | "PERCEPCION";
  codigoTributo: string;
  nombreTributo: string;
  baseImponible: number;
  porcentaje: number;
  monto: number;
  montoRecuperable: number;
  montoNoRecuperable: number;
  incluidoPrecio: "S" | "N";
  numeroConstancia: string | null;
  periodoFiscal: string | null;
  fechaAplicacion: string;
  estado: "CALCULADO" | "APLICADO" | "ANULADO";
  generadoPor: number;
  fechaGeneracion: string;
}

export const createCxpDocumentoTributoSchema = z.strictObject({
  idDocumento: cxpNumber({"integer": true}),
  idDetalle: cxpNumber({"integer": true}).nullable().optional(),
  tipoTributo: z.enum(["IMPUESTO", "RETENCION", "PERCEPCION"] as const),
  codigoTributo: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres"),
  nombreTributo: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres"),
  baseImponible: cxpNumber({"precision": 18, "scale": 2}),
  porcentaje: cxpNumber({"precision": 9, "scale": 6}).default(0.0 as any),
  monto: cxpNumber({"precision": 18, "scale": 2}),
  montoRecuperable: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  montoNoRecuperable: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  incluidoPrecio: z.enum(["S", "N"] as const).default("N" as any),
  numeroConstancia: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  periodoFiscal: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  fechaAplicacion: cxpDate(false).optional(),
  estado: z.enum(["CALCULADO", "APLICADO", "ANULADO"] as const).default("CALCULADO" as any),
  generadoPor: cxpNumber({"integer": true}),
});

export const updateCxpDocumentoTributoSchema = z.strictObject({
  idDocumento: cxpNumber({"integer": true}).optional(),
  idDetalle: cxpNumber({"integer": true}).nullable().optional(),
  tipoTributo: z.enum(["IMPUESTO", "RETENCION", "PERCEPCION"] as const).optional(),
  codigoTributo: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres").optional(),
  nombreTributo: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").optional(),
  baseImponible: cxpNumber({"precision": 18, "scale": 2}).optional(),
  porcentaje: cxpNumber({"precision": 9, "scale": 6}).optional(),
  monto: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoRecuperable: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoNoRecuperable: cxpNumber({"precision": 18, "scale": 2}).optional(),
  incluidoPrecio: z.enum(["S", "N"] as const).optional(),
  numeroConstancia: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  periodoFiscal: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  fechaAplicacion: cxpDate(false).optional(),
  estado: z.enum(["CALCULADO", "APLICADO", "ANULADO"] as const).optional(),
  generadoPor: cxpNumber({"integer": true}).optional(),
});

export type CreateCxpDocumentoTributoInput = z.infer<typeof createCxpDocumentoTributoSchema>;
export type UpdateCxpDocumentoTributoInput = z.infer<typeof updateCxpDocumentoTributoSchema>;
