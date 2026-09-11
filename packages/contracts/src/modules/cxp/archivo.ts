import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpArchivo {
  idArchivo: number;
  idProveedor: number | null;
  idCuentaBancaria: number | null;
  idCompromiso: number | null;
  idDocumento: number | null;
  idLote: number | null;
  idPago: number | null;
  idAplicacion: number | null;
  idConciliacionProv: number | null;
  idEvento: number | null;
  categoria: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanoBytes: number;
  uriAlmacenamiento: string;
  hashSha256: string;
  versionArchivo: number;
  esVersionActual: "S" | "N";
  cargadoPor: number;
  fechaCarga: string;
}

export const createCxpArchivoSchema = z.strictObject({
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  idCuentaBancaria: cxpNumber({"integer": true}).nullable().optional(),
  idCompromiso: cxpNumber({"integer": true}).nullable().optional(),
  idDocumento: cxpNumber({"integer": true}).nullable().optional(),
  idLote: cxpNumber({"integer": true}).nullable().optional(),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  idAplicacion: cxpNumber({"integer": true}).nullable().optional(),
  idConciliacionProv: cxpNumber({"integer": true}).nullable().optional(),
  idEvento: cxpNumber({"integer": true}).nullable().optional(),
  categoria: z.string().trim().min(1, "Este campo es obligatorio").max(40, "Máximo 40 caracteres"),
  nombreArchivo: z.string().trim().min(1, "Este campo es obligatorio").max(255, "Máximo 255 caracteres"),
  tipoMime: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres"),
  tamanoBytes: cxpNumber({"precision": 18, "scale": 0, "integer": true}),
  uriAlmacenamiento: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres"),
  hashSha256: z.string().trim().min(1, "Este campo es obligatorio").max(64, "Máximo 64 caracteres"),
  versionArchivo: cxpNumber({"precision": 6, "scale": 0, "integer": true}).default(1.0 as any),
  esVersionActual: z.enum(["S", "N"] as const).default("S" as any),
  cargadoPor: cxpNumber({"integer": true}),
});

export const updateCxpArchivoSchema = z.strictObject({
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  idCuentaBancaria: cxpNumber({"integer": true}).nullable().optional(),
  idCompromiso: cxpNumber({"integer": true}).nullable().optional(),
  idDocumento: cxpNumber({"integer": true}).nullable().optional(),
  idLote: cxpNumber({"integer": true}).nullable().optional(),
  idPago: cxpNumber({"integer": true}).nullable().optional(),
  idAplicacion: cxpNumber({"integer": true}).nullable().optional(),
  idConciliacionProv: cxpNumber({"integer": true}).nullable().optional(),
  idEvento: cxpNumber({"integer": true}).nullable().optional(),
  categoria: z.string().trim().min(1, "Este campo es obligatorio").max(40, "Máximo 40 caracteres").optional(),
  nombreArchivo: z.string().trim().min(1, "Este campo es obligatorio").max(255, "Máximo 255 caracteres").optional(),
  tipoMime: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").optional(),
  tamanoBytes: cxpNumber({"precision": 18, "scale": 0, "integer": true}).optional(),
  uriAlmacenamiento: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").optional(),
  hashSha256: z.string().trim().min(1, "Este campo es obligatorio").max(64, "Máximo 64 caracteres").optional(),
  versionArchivo: cxpNumber({"precision": 6, "scale": 0, "integer": true}).optional(),
  esVersionActual: z.enum(["S", "N"] as const).optional(),
  cargadoPor: cxpNumber({"integer": true}).optional(),
});

export type CreateCxpArchivoInput = z.infer<typeof createCxpArchivoSchema>;
export type UpdateCxpArchivoInput = z.infer<typeof updateCxpArchivoSchema>;
