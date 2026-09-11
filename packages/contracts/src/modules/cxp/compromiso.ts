import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpCompromiso {
  idCompromiso: number;
  idProveedor: number;
  idSucursal: number;
  idDepartamento: number | null;
  tipoCompromiso: "RECURRENTE" | "CONTRATO" | "PRESTAMO" | "ARRENDAMIENTO" | "FONDO_CAJA_CHICA" | "OBLIGACION_FISCAL" | "OTRO";
  numeroReferencia: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string | null;
  frecuencia: "SEMANAL" | "QUINCENAL" | "MENSUAL" | "BIMESTRAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL" | "VARIABLE" | null;
  numeroCuotas: number | null;
  diaVencimiento: number | null;
  moneda: string;
  montoTotal: number;
  saldoCapital: number;
  tasaInteres: number;
  valorCuota: number;
  garantiaDescripcion: string | null;
  cuentaContable: string | null;
  centroCosto: string | null;
  proyecto: string | null;
  responsablePor: number;
  estado: "BORRADOR" | "PENDIENTE_APROBACION" | "ACTIVO" | "SUSPENDIDO" | "FINALIZADO" | "ANULADO";
  creadoPor: number;
  fechaCreacion: string;
  modificadoPor: number | null;
  fechaModificacion: string | null;
}

export const createCxpCompromisoSchema = z.strictObject({
  idProveedor: cxpNumber({"integer": true}),
  idSucursal: cxpNumber({"integer": true}),
  idDepartamento: cxpNumber({"integer": true}).nullable().optional(),
  tipoCompromiso: z.enum(["RECURRENTE", "CONTRATO", "PRESTAMO", "ARRENDAMIENTO", "FONDO_CAJA_CHICA", "OBLIGACION_FISCAL", "OTRO"] as const),
  numeroReferencia: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres"),
  descripcion: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres"),
  fechaInicio: cxpDate(false),
  fechaFin: cxpDate(false).nullable().optional(),
  frecuencia: z.enum(["SEMANAL", "QUINCENAL", "MENSUAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL", "VARIABLE"] as const).nullable().optional(),
  numeroCuotas: cxpNumber({"precision": 6, "scale": 0, "integer": true}).nullable().optional(),
  diaVencimiento: cxpNumber({"precision": 2, "scale": 0, "integer": true}).nullable().optional(),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").default("GTQ" as any),
  montoTotal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  saldoCapital: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  tasaInteres: cxpNumber({"precision": 9, "scale": 6}).default(0.0 as any),
  valorCuota: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  garantiaDescripcion: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").nullable().optional(),
  cuentaContable: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  centroCosto: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  proyecto: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  responsablePor: cxpNumber({"integer": true}),
  estado: z.enum(["BORRADOR", "PENDIENTE_APROBACION", "ACTIVO", "SUSPENDIDO", "FINALIZADO", "ANULADO"] as const).default("ACTIVO" as any),
  creadoPor: cxpNumber({"integer": true}),
  modificadoPor: cxpNumber({"integer": true}).nullable().optional(),
});

export const updateCxpCompromisoSchema = z.strictObject({
  idProveedor: cxpNumber({"integer": true}).optional(),
  idSucursal: cxpNumber({"integer": true}).optional(),
  idDepartamento: cxpNumber({"integer": true}).nullable().optional(),
  tipoCompromiso: z.enum(["RECURRENTE", "CONTRATO", "PRESTAMO", "ARRENDAMIENTO", "FONDO_CAJA_CHICA", "OBLIGACION_FISCAL", "OTRO"] as const).optional(),
  numeroReferencia: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").optional(),
  descripcion: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").optional(),
  fechaInicio: cxpDate(false).optional(),
  fechaFin: cxpDate(false).nullable().optional(),
  frecuencia: z.enum(["SEMANAL", "QUINCENAL", "MENSUAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL", "VARIABLE"] as const).nullable().optional(),
  numeroCuotas: cxpNumber({"precision": 6, "scale": 0, "integer": true}).nullable().optional(),
  diaVencimiento: cxpNumber({"precision": 2, "scale": 0, "integer": true}).nullable().optional(),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").optional(),
  montoTotal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  saldoCapital: cxpNumber({"precision": 18, "scale": 2}).optional(),
  tasaInteres: cxpNumber({"precision": 9, "scale": 6}).optional(),
  valorCuota: cxpNumber({"precision": 18, "scale": 2}).optional(),
  garantiaDescripcion: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").nullable().optional(),
  cuentaContable: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  centroCosto: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  proyecto: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  responsablePor: cxpNumber({"integer": true}).optional(),
  estado: z.enum(["BORRADOR", "PENDIENTE_APROBACION", "ACTIVO", "SUSPENDIDO", "FINALIZADO", "ANULADO"] as const).optional(),
  creadoPor: cxpNumber({"integer": true}).optional(),
  modificadoPor: cxpNumber({"integer": true}).nullable().optional(),
});

export type CreateCxpCompromisoInput = z.infer<typeof createCxpCompromisoSchema>;
export type UpdateCxpCompromisoInput = z.infer<typeof updateCxpCompromisoSchema>;
