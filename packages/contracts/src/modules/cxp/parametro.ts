import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpParametro {
  idParametro: number;
  grupoParametro: string;
  codigo: string;
  nombre: string;
  valorTexto: string | null;
  valorNumero: number | null;
  activo: "S" | "N";
  modificadoPor: number | null;
  fechaModificacion: string;
}

export const createCxpParametroSchema = z.strictObject({
  grupoParametro: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres"),
  codigo: z.string().trim().min(1, "Este campo es obligatorio").max(60, "Máximo 60 caracteres"),
  nombre: z.string().trim().min(1, "Este campo es obligatorio").max(150, "Máximo 150 caracteres"),
  valorTexto: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").nullable().optional(),
  valorNumero: cxpNumber({"precision": 18, "scale": 6}).nullable().optional(),
  activo: z.enum(["S", "N"] as const).default("S" as any),
  modificadoPor: cxpNumber({"integer": true}).nullable().optional(),
});

export const updateCxpParametroSchema = z.strictObject({
  grupoParametro: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").optional(),
  codigo: z.string().trim().min(1, "Este campo es obligatorio").max(60, "Máximo 60 caracteres").optional(),
  nombre: z.string().trim().min(1, "Este campo es obligatorio").max(150, "Máximo 150 caracteres").optional(),
  valorTexto: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").nullable().optional(),
  valorNumero: cxpNumber({"precision": 18, "scale": 6}).nullable().optional(),
  activo: z.enum(["S", "N"] as const).optional(),
  modificadoPor: cxpNumber({"integer": true}).nullable().optional(),
});

export type CreateCxpParametroInput = z.infer<typeof createCxpParametroSchema>;
export type UpdateCxpParametroInput = z.infer<typeof updateCxpParametroSchema>;
