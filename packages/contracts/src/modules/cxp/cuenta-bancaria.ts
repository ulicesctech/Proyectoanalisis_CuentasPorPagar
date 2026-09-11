import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpCuentaBancaria {
  idCuentaBancaria: number;
  tipoTitular: "EMPRESA" | "PROVEEDOR";
  idEmpresa: number | null;
  idProveedor: number | null;
  bancoNombre: string;
  codigoBanco: string | null;
  titular: string;
  numeroCuenta: string;
  tipoCuenta: "MONETARIA" | "AHORRO" | "TARJETA" | "OTRA";
  moneda: string;
  pais: string;
  codigoSwift: string | null;
  codigoIban: string | null;
  esPrincipal: "S" | "N";
  titularCoincide: "S" | "N";
  estado: "ACTIVA" | "INACTIVA" | "BLOQUEADA";
  estadoAprobacion: "PENDIENTE" | "APROBADA" | "RECHAZADA" | "REQUIERE_REVALIDACION";
  motivoBloqueo: string | null;
  fechaVerificacion: string | null;
  verificadoPor: number | null;
  creadoPor: number;
  fechaCreacion: string;
  modificadoPor: number | null;
  fechaModificacion: string | null;
}

export const createCxpCuentaBancariaSchema = z.strictObject({
  tipoTitular: z.enum(["EMPRESA", "PROVEEDOR"] as const),
  idEmpresa: cxpNumber({"integer": true}).nullable().optional(),
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  bancoNombre: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres"),
  codigoBanco: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres").nullable().optional(),
  titular: z.string().trim().min(1, "Este campo es obligatorio").max(200, "Máximo 200 caracteres"),
  numeroCuenta: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres"),
  tipoCuenta: z.enum(["MONETARIA", "AHORRO", "TARJETA", "OTRA"] as const),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").default("GTQ" as any),
  pais: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").default("GUATEMALA" as any),
  codigoSwift: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  codigoIban: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  esPrincipal: z.enum(["S", "N"] as const).default("N" as any),
  titularCoincide: z.enum(["S", "N"] as const).default("N" as any),
  estado: z.enum(["ACTIVA", "INACTIVA", "BLOQUEADA"] as const).default("ACTIVA" as any),
  estadoAprobacion: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA", "REQUIERE_REVALIDACION"] as const).default("PENDIENTE" as any),
  motivoBloqueo: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").nullable().optional(),
  fechaVerificacion: cxpDate(true).nullable().optional(),
  verificadoPor: cxpNumber({"integer": true}).nullable().optional(),
  creadoPor: cxpNumber({"integer": true}),
  modificadoPor: cxpNumber({"integer": true}).nullable().optional(),
});

export const updateCxpCuentaBancariaSchema = z.strictObject({
  tipoTitular: z.enum(["EMPRESA", "PROVEEDOR"] as const).optional(),
  idEmpresa: cxpNumber({"integer": true}).nullable().optional(),
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  bancoNombre: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").optional(),
  codigoBanco: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres").nullable().optional(),
  titular: z.string().trim().min(1, "Este campo es obligatorio").max(200, "Máximo 200 caracteres").optional(),
  numeroCuenta: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").optional(),
  tipoCuenta: z.enum(["MONETARIA", "AHORRO", "TARJETA", "OTRA"] as const).optional(),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").optional(),
  pais: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").optional(),
  codigoSwift: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  codigoIban: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  esPrincipal: z.enum(["S", "N"] as const).optional(),
  titularCoincide: z.enum(["S", "N"] as const).optional(),
  estado: z.enum(["ACTIVA", "INACTIVA", "BLOQUEADA"] as const).optional(),
  estadoAprobacion: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA", "REQUIERE_REVALIDACION"] as const).optional(),
  motivoBloqueo: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").nullable().optional(),
  fechaVerificacion: cxpDate(true).nullable().optional(),
  verificadoPor: cxpNumber({"integer": true}).nullable().optional(),
  creadoPor: cxpNumber({"integer": true}).optional(),
  modificadoPor: cxpNumber({"integer": true}).nullable().optional(),
});

export type CreateCxpCuentaBancariaInput = z.infer<typeof createCxpCuentaBancariaSchema>;
export type UpdateCxpCuentaBancariaInput = z.infer<typeof updateCxpCuentaBancariaSchema>;
