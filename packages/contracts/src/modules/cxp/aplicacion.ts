import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpAplicacion {
  idAplicacion: number;
  idDocumentoDestino: number;
  idPago: number | null;
  idDocumentoOrigen: number | null;
  idDocumentoCxc: number | null;
  tipoAplicacion: "PAGO" | "ANTICIPO" | "NOTA_CREDITO" | "COMPENSACION_CXC" | "AJUSTE";
  fechaAplicacion: string;
  montoPrincipal: number;
  montoDescuento: number;
  montoRetencion: number;
  diferenciaCambiaria: number;
  montoTotalAplicado: number;
  saldoAnterior: number | null;
  saldoPosterior: number | null;
  estadoCxc: "NO_APLICA" | "PENDIENTE" | "CONFIRMADA" | "RECHAZADA";
  estado: "PENDIENTE" | "APLICADA" | "REVERTIDA" | "CANCELADA";
  aplicadoPor: number;
  revertidoPor: number | null;
  fechaReverso: string | null;
  motivoReverso: string | null;
}

export const createCxpAplicacionSchema = z.strictObject({
  idDocumentoDestino: cxpNumber({"integer": true}),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  idDocumentoOrigen: cxpNumber({"integer": true}).nullable().optional(),
  idDocumentoCxc: cxpNumber({"integer": true}).nullable().optional(),
  tipoAplicacion: z.enum(["PAGO", "ANTICIPO", "NOTA_CREDITO", "COMPENSACION_CXC", "AJUSTE"] as const),
  fechaAplicacion: cxpDate(true).optional(),
  montoPrincipal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  montoDescuento: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  montoRetencion: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  diferenciaCambiaria: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  montoTotalAplicado: cxpNumber({"precision": 18, "scale": 2}),
  estadoCxc: z.enum(["NO_APLICA", "PENDIENTE", "CONFIRMADA", "RECHAZADA"] as const).default("NO_APLICA" as any),
  estado: z.enum(["PENDIENTE", "APLICADA", "REVERTIDA", "CANCELADA"] as const).default("PENDIENTE" as any),
  aplicadoPor: cxpNumber({"integer": true}),
  revertidoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaReverso: cxpDate(true).nullable().optional(),
  motivoReverso: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export const updateCxpAplicacionSchema = z.strictObject({
  idDocumentoDestino: cxpNumber({"integer": true}).optional(),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  idDocumentoOrigen: cxpNumber({"integer": true}).nullable().optional(),
  idDocumentoCxc: cxpNumber({"integer": true}).nullable().optional(),
  tipoAplicacion: z.enum(["PAGO", "ANTICIPO", "NOTA_CREDITO", "COMPENSACION_CXC", "AJUSTE"] as const).optional(),
  fechaAplicacion: cxpDate(true).optional(),
  montoPrincipal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoDescuento: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoRetencion: cxpNumber({"precision": 18, "scale": 2}).optional(),
  diferenciaCambiaria: cxpNumber({"precision": 18, "scale": 2}).optional(),
  montoTotalAplicado: cxpNumber({"precision": 18, "scale": 2}).optional(),
  estadoCxc: z.enum(["NO_APLICA", "PENDIENTE", "CONFIRMADA", "RECHAZADA"] as const).optional(),
  estado: z.enum(["PENDIENTE", "APLICADA", "REVERTIDA", "CANCELADA"] as const).optional(),
  aplicadoPor: cxpNumber({"integer": true}).optional(),
  revertidoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaReverso: cxpDate(true).nullable().optional(),
  motivoReverso: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
});

export type CreateCxpAplicacionInput = z.infer<typeof createCxpAplicacionSchema>;
export type UpdateCxpAplicacionInput = z.infer<typeof updateCxpAplicacionSchema>;
