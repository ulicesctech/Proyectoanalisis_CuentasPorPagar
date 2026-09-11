import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpEvento {
  idEvento: number;
  idEventoPadre: number | null;
  idProveedor: number | null;
  idCuentaBancaria: number | null;
  idCompromiso: number | null;
  idDocumento: number | null;
  idLote: number | null;
  idPago: number | null;
  idAplicacion: number | null;
  idConciliacionProv: number | null;
  idPeriodo: number | null;
  tipoEvento: string;
  asunto: string;
  detalle: string | null;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  montoRelacionado: number | null;
  canal: string | null;
  mencionesJson: string | null;
  resultadoJson: string | null;
  prioridad: "CRITICA" | "ALTA" | "NORMAL" | "BAJA";
  estado: "ABIERTO" | "EN_PROCESO" | "CERRADO" | "CANCELADO";
  usuarioAsignado: number | null;
  fechaLimite: string | null;
  usuarioEvento: number;
  fechaEvento: string;
  fechaCierre: string | null;
}

export const createCxpEventoSchema = z.strictObject({
  idEventoPadre: cxpNumber({"integer": true}).nullable().optional(),
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  idCuentaBancaria: cxpNumber({"integer": true}).nullable().optional(),
  idCompromiso: cxpNumber({"integer": true}).nullable().optional(),
  idDocumento: cxpNumber({"integer": true}).nullable().optional(),
  idLote: cxpNumber({"integer": true}).nullable().optional(),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  idAplicacion: cxpNumber({"integer": true}).nullable().optional(),
  idConciliacionProv: cxpNumber({"integer": true}).nullable().optional(),
  idPeriodo: cxpNumber({"integer": true}).nullable().optional(),
  tipoEvento: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres"),
  asunto: z.string().trim().min(1, "Este campo es obligatorio").max(250, "Máximo 250 caracteres"),
  detalle: z.string().trim().min(1, "Este campo es obligatorio").max(2000, "Máximo 2000 caracteres").nullable().optional(),
  estadoAnterior: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  estadoNuevo: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  montoRelacionado: cxpNumber({"precision": 18, "scale": 2}).nullable().optional(),
  canal: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  mencionesJson: z.string().trim().min(1, "Este campo es obligatorio").max(30000, "Máximo 30000 caracteres").nullable().optional(),
  resultadoJson: z.string().trim().min(1, "Este campo es obligatorio").max(30000, "Máximo 30000 caracteres").nullable().optional(),
  prioridad: z.enum(["CRITICA", "ALTA", "NORMAL", "BAJA"] as const).default("NORMAL" as any),
  estado: z.enum(["ABIERTO", "EN_PROCESO", "CERRADO", "CANCELADO"] as const).default("ABIERTO" as any),
  usuarioAsignado: cxpNumber({"integer": true}).nullable().optional(),
  fechaLimite: cxpDate(true).nullable().optional(),
  usuarioEvento: cxpNumber({"integer": true}),
  fechaCierre: cxpDate(true).nullable().optional(),
});

export const updateCxpEventoSchema = z.strictObject({
  idEventoPadre: cxpNumber({"integer": true}).nullable().optional(),
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  idCuentaBancaria: cxpNumber({"integer": true}).nullable().optional(),
  idCompromiso: cxpNumber({"integer": true}).nullable().optional(),
  idDocumento: cxpNumber({"integer": true}).nullable().optional(),
  idLote: cxpNumber({"integer": true}).nullable().optional(),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  idAplicacion: cxpNumber({"integer": true}).nullable().optional(),
  idConciliacionProv: cxpNumber({"integer": true}).nullable().optional(),
  idPeriodo: cxpNumber({"integer": true}).nullable().optional(),
  tipoEvento: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres").optional(),
  asunto: z.string().trim().min(1, "Este campo es obligatorio").max(250, "Máximo 250 caracteres").optional(),
  detalle: z.string().trim().min(1, "Este campo es obligatorio").max(2000, "Máximo 2000 caracteres").nullable().optional(),
  estadoAnterior: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  estadoNuevo: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  montoRelacionado: cxpNumber({"precision": 18, "scale": 2}).nullable().optional(),
  canal: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  mencionesJson: z.string().trim().min(1, "Este campo es obligatorio").max(30000, "Máximo 30000 caracteres").nullable().optional(),
  resultadoJson: z.string().trim().min(1, "Este campo es obligatorio").max(30000, "Máximo 30000 caracteres").nullable().optional(),
  prioridad: z.enum(["CRITICA", "ALTA", "NORMAL", "BAJA"] as const).optional(),
  estado: z.enum(["ABIERTO", "EN_PROCESO", "CERRADO", "CANCELADO"] as const).optional(),
  usuarioAsignado: cxpNumber({"integer": true}).nullable().optional(),
  fechaLimite: cxpDate(true).nullable().optional(),
  usuarioEvento: cxpNumber({"integer": true}).optional(),
  fechaCierre: cxpDate(true).nullable().optional(),
});

export type CreateCxpEventoInput = z.infer<typeof createCxpEventoSchema>;
export type UpdateCxpEventoInput = z.infer<typeof updateCxpEventoSchema>;
