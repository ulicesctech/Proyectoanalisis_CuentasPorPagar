import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpDocumentoDetalle {
  idDetalle: number;
  idDocumento: number;
  codigoArticulo: string | null;
  idDetalleOc: number | null;
  idDetalleRecepcion: number | null;
  numeroLinea: number;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  impuesto: number;
  retencion: number;
  totalLinea: number;
  cuentaContable: string | null;
  centroCosto: string | null;
  idDepartamento: number | null;
  proyecto: string | null;
  cantidadOrdenada: number | null;
  cantidadRecibida: number | null;
  cantidadFacturada: number | null;
  precioOrdenado: number | null;
  precioFacturado: number | null;
  diferenciaCantidad: number;
  diferenciaPrecio: number;
  resultadoTresVias: "NO_APLICA" | "COINCIDE" | "DENTRO_TOLERANCIA" | "DIFERENCIA" | "BLOQUEADO";
}

export const createCxpDocumentoDetalleSchema = z.strictObject({
  idDocumento: cxpNumber({"integer": true}),
  codigoArticulo: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  idDetalleOc: cxpNumber({"integer": true}).nullable().optional(),
  idDetalleRecepcion: cxpNumber({"integer": true}).nullable().optional(),
  numeroLinea: cxpNumber({"precision": 6, "scale": 0, "integer": true}),
  descripcion: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres"),
  cantidad: cxpNumber({"precision": 18, "scale": 4}),
  unidadMedida: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres").default("UNIDAD" as any),
  precioUnitario: cxpNumber({"precision": 18, "scale": 6}),
  descuento: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  impuesto: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  retencion: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  cuentaContable: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  centroCosto: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  idDepartamento: cxpNumber({"integer": true}).nullable().optional(),
  proyecto: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  cantidadOrdenada: cxpNumber({"precision": 18, "scale": 4}).nullable().optional(),
  cantidadRecibida: cxpNumber({"precision": 18, "scale": 4}).nullable().optional(),
  cantidadFacturada: cxpNumber({"precision": 18, "scale": 4}).nullable().optional(),
  precioOrdenado: cxpNumber({"precision": 18, "scale": 6}).nullable().optional(),
  precioFacturado: cxpNumber({"precision": 18, "scale": 6}).nullable().optional(),
  diferenciaCantidad: cxpNumber({"precision": 18, "scale": 4}).default(0.0 as any),
  diferenciaPrecio: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  resultadoTresVias: z.enum(["NO_APLICA", "COINCIDE", "DENTRO_TOLERANCIA", "DIFERENCIA", "BLOQUEADO"] as const).default("NO_APLICA" as any),
});

export const updateCxpDocumentoDetalleSchema = z.strictObject({
  idDocumento: cxpNumber({"integer": true}).optional(),
  codigoArticulo: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  idDetalleOc: cxpNumber({"integer": true}).nullable().optional(),
  idDetalleRecepcion: cxpNumber({"integer": true}).nullable().optional(),
  numeroLinea: cxpNumber({"precision": 6, "scale": 0, "integer": true}).optional(),
  descripcion: z.string().trim().min(1, "Este campo es obligatorio").max(500, "Máximo 500 caracteres").optional(),
  cantidad: cxpNumber({"precision": 18, "scale": 4}).optional(),
  unidadMedida: z.string().trim().min(1, "Este campo es obligatorio").max(30, "Máximo 30 caracteres").optional(),
  precioUnitario: cxpNumber({"precision": 18, "scale": 6}).optional(),
  descuento: cxpNumber({"precision": 18, "scale": 2}).optional(),
  impuesto: cxpNumber({"precision": 18, "scale": 2}).optional(),
  retencion: cxpNumber({"precision": 18, "scale": 2}).optional(),
  cuentaContable: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  centroCosto: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  idDepartamento: cxpNumber({"integer": true}).nullable().optional(),
  proyecto: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  cantidadOrdenada: cxpNumber({"precision": 18, "scale": 4}).nullable().optional(),
  cantidadRecibida: cxpNumber({"precision": 18, "scale": 4}).nullable().optional(),
  cantidadFacturada: cxpNumber({"precision": 18, "scale": 4}).nullable().optional(),
  precioOrdenado: cxpNumber({"precision": 18, "scale": 6}).nullable().optional(),
  precioFacturado: cxpNumber({"precision": 18, "scale": 6}).nullable().optional(),
  diferenciaCantidad: cxpNumber({"precision": 18, "scale": 4}).optional(),
  diferenciaPrecio: cxpNumber({"precision": 18, "scale": 2}).optional(),
  resultadoTresVias: z.enum(["NO_APLICA", "COINCIDE", "DENTRO_TOLERANCIA", "DIFERENCIA", "BLOQUEADO"] as const).optional(),
});

export type CreateCxpDocumentoDetalleInput = z.infer<typeof createCxpDocumentoDetalleSchema>;
export type UpdateCxpDocumentoDetalleInput = z.infer<typeof updateCxpDocumentoDetalleSchema>;
