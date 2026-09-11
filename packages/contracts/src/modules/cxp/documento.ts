import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';

export interface CxpDocumento {
  idDocumento: number;
  idProveedor: number | null;
  idSucursal: number;
  idCondicionCredito: number | null;
  idCompromiso: number | null;
  idDocumentoRelacionado: number | null;
  noFacturaCompra: string | null;
  noOrdenCompra: string | null;
  noRecepcion: string | null;
  tipoDocumento: "FACTURA" | "FACTURA_CAMBIARIA" | "NOTA_CREDITO" | "NOTA_DEBITO" | "RECIBO" | "REEMBOLSO" | "LIQUIDACION_VIATICO" | "GASTO_CAJA_CHICA" | "CUOTA_CONTRATO" | "CUOTA_PRESTAMO" | "OBLIGACION_FISCAL" | "SALDO_INICIAL" | "COMPROBANTE_SERVICIO" | "OTRO";
  naturaleza: "D" | "C";
  origenIngreso: "MANUAL" | "ARCHIVO" | "CORREO" | "IMPORTACION" | "COMPRAS" | "CARGA_MASIVA" | "INTEGRACION" | "PORTAL_PROVEEDOR" | "FACTURACION_ELECTRONICA";
  tipoRegistro: "CON_OC" | "SIN_OC" | "RECURRENTE" | "SALDO_INICIAL" | "IMPORTADO";
  serie: string | null;
  numeroDocumento: string | null;
  uuidFiscal: string | null;
  nitEmisor: string | null;
  referenciaExterna: string | null;
  hashOrigen: string | null;
  fechaDocumento: string | null;
  fechaRecepcion: string;
  fechaContabilizacion: string | null;
  fechaVencimiento: string | null;
  diasCredito: number;
  moneda: string;
  tipoCambio: number;
  fuenteTipoCambio: string | null;
  fechaTipoCambio: string | null;
  subtotal: number;
  descuentoTotal: number;
  impuestoTotal: number;
  retencionTotal: number;
  recargoTotal: number;
  gastoAdicionalTotal: number;
  diferenciaRedondeo: number;
  totalBruto: number;
  totalNeto: number;
  totalLocal: number;
  montoAplicado: number;
  saldoPendiente: number;
  idDepartamento: number | null;
  centroCosto: string | null;
  proyecto: string | null;
  cuentaContable: string | null;
  solicitadoPor: number | null;
  responsablePor: number | null;
  justificacionSinOc: string | null;
  numeroCuota: number | null;
  capitalCuota: number;
  interesCuota: number;
  comisionCuota: number;
  resultadoTresVias: "NO_APLICA" | "COINCIDE" | "DENTRO_TOLERANCIA" | "DIFERENCIA" | "DIF_PRECIO" | "DIF_CANTIDAD" | "NO_RECIBIDO" | "SUPERA_ORDEN" | "SIN_RECEPCION" | "ORDEN_CERRADA" | "ORDEN_ANULADA" | "EN_INVESTIGACION" | "DIFERENCIA_APROBADA" | "BLOQUEADO";
  diferenciaCantidad: number;
  diferenciaPrecio: number;
  diferenciaImpuesto: number;
  diferenciaTotal: number;
  prioridad: "CRITICA" | "ALTA" | "NORMAL" | "BAJA";
  estadoContable: "PENDIENTE" | "ENVIADO" | "CONTABILIZADO" | "ERROR" | "REVERTIDO" | "NO_APLICA";
  numeroAsientoExt: string | null;
  estado: "RECIBIDO" | "PENDIENTE_CLASIFICACION" | "BORRADOR" | "PENDIENTE_REVISION" | "EN_VALIDACION" | "DUPLICADO" | "CON_DIFERENCIAS" | "PENDIENTE_APROBACION" | "APROBADA" | "RECHAZADA" | "CONTABILIZADA" | "PENDIENTE_PAGO" | "PROGRAMADA_PAGO" | "PARCIALMENTE_PAGADA" | "PAGADA" | "VENCIDA" | "BLOQUEADA" | "EN_DISPUTA" | "PARCIALMENTE_APLICADA" | "APLICADA" | "ANULADA" | "CERRADA";
  posibleDuplicado: "S" | "N";
  motivoRechazo: string | null;
  motivoBloqueo: string | null;
  motivoAnulacion: string | null;
  anuladoPor: number | null;
  fechaAnulacion: string | null;
  observaciones: string | null;
  creadoPor: number;
  fechaCreacion: string;
  modificadoPor: number | null;
  fechaModificacion: string | null;
}

export const createCxpDocumentoSchema = z.strictObject({
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  idSucursal: cxpNumber({"integer": true}),
  idCondicionCredito: cxpNumber({"integer": true}).nullable().optional(),
  idCompromiso: cxpNumber({"integer": true}).nullable().optional(),
  idDocumentoRelacionado: cxpNumber({"integer": true}).nullable().optional(),
  noFacturaCompra: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  noOrdenCompra: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  noRecepcion: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  tipoDocumento: z.enum(["FACTURA", "FACTURA_CAMBIARIA", "NOTA_CREDITO", "NOTA_DEBITO", "RECIBO", "REEMBOLSO", "LIQUIDACION_VIATICO", "GASTO_CAJA_CHICA", "CUOTA_CONTRATO", "CUOTA_PRESTAMO", "OBLIGACION_FISCAL", "SALDO_INICIAL", "COMPROBANTE_SERVICIO", "OTRO"] as const),
  naturaleza: z.enum(["D", "C"] as const).default("D" as any),
  origenIngreso: z.enum(["MANUAL", "ARCHIVO", "CORREO", "IMPORTACION", "COMPRAS", "CARGA_MASIVA", "INTEGRACION", "PORTAL_PROVEEDOR", "FACTURACION_ELECTRONICA"] as const).default("MANUAL" as any),
  tipoRegistro: z.enum(["CON_OC", "SIN_OC", "RECURRENTE", "SALDO_INICIAL", "IMPORTADO"] as const).default("SIN_OC" as any),
  serie: z.string().trim().min(1, "Este campo es obligatorio").max(40, "Máximo 40 caracteres").nullable().optional(),
  numeroDocumento: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  uuidFiscal: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  nitEmisor: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  referenciaExterna: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").nullable().optional(),
  hashOrigen: z.string().trim().min(1, "Este campo es obligatorio").max(128, "Máximo 128 caracteres").nullable().optional(),
  fechaDocumento: cxpDate(false).nullable().optional(),
  fechaRecepcion: cxpDate(true).optional(),
  fechaContabilizacion: cxpDate(false).nullable().optional(),
  fechaVencimiento: cxpDate(false).nullable().optional(),
  diasCredito: cxpNumber({"precision": 4, "scale": 0, "integer": true}).default(0.0 as any),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").default("GTQ" as any),
  tipoCambio: cxpNumber({"precision": 18, "scale": 8}).default(1.0 as any),
  fuenteTipoCambio: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  fechaTipoCambio: cxpDate(false).nullable().optional(),
  subtotal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  descuentoTotal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  impuestoTotal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  retencionTotal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  recargoTotal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  gastoAdicionalTotal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  diferenciaRedondeo: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  idDepartamento: cxpNumber({"integer": true}).nullable().optional(),
  centroCosto: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  proyecto: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  cuentaContable: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  solicitadoPor: cxpNumber({"integer": true}).nullable().optional(),
  responsablePor: cxpNumber({"integer": true}).nullable().optional(),
  justificacionSinOc: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  numeroCuota: cxpNumber({"precision": 6, "scale": 0, "integer": true}).nullable().optional(),
  capitalCuota: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  interesCuota: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  comisionCuota: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  resultadoTresVias: z.enum(["NO_APLICA", "COINCIDE", "DENTRO_TOLERANCIA", "DIFERENCIA", "DIF_PRECIO", "DIF_CANTIDAD", "NO_RECIBIDO", "SUPERA_ORDEN", "SIN_RECEPCION", "ORDEN_CERRADA", "ORDEN_ANULADA", "EN_INVESTIGACION", "DIFERENCIA_APROBADA", "BLOQUEADO"] as const).default("NO_APLICA" as any),
  diferenciaCantidad: cxpNumber({"precision": 18, "scale": 4}).default(0.0 as any),
  diferenciaPrecio: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  diferenciaImpuesto: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  diferenciaTotal: cxpNumber({"precision": 18, "scale": 2}).default(0.0 as any),
  prioridad: z.enum(["CRITICA", "ALTA", "NORMAL", "BAJA"] as const).default("NORMAL" as any),
  estadoContable: z.enum(["PENDIENTE", "ENVIADO", "CONTABILIZADO", "ERROR", "REVERTIDO", "NO_APLICA"] as const).default("PENDIENTE" as any),
  numeroAsientoExt: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  estado: z.enum(["RECIBIDO", "PENDIENTE_CLASIFICACION", "BORRADOR", "PENDIENTE_REVISION", "EN_VALIDACION", "DUPLICADO", "CON_DIFERENCIAS", "PENDIENTE_APROBACION", "APROBADA", "RECHAZADA", "CONTABILIZADA", "PENDIENTE_PAGO", "PROGRAMADA_PAGO", "PARCIALMENTE_PAGADA", "PAGADA", "VENCIDA", "BLOQUEADA", "EN_DISPUTA", "PARCIALMENTE_APLICADA", "APLICADA", "ANULADA", "CERRADA"] as const).default("RECIBIDO" as any),
  posibleDuplicado: z.enum(["S", "N"] as const).default("N" as any),
  motivoRechazo: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoBloqueo: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoAnulacion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  anuladoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaAnulacion: cxpDate(true).nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1500, "Máximo 1500 caracteres").nullable().optional(),
  creadoPor: cxpNumber({"integer": true}),
  modificadoPor: cxpNumber({"integer": true}).nullable().optional(),
});

export const updateCxpDocumentoSchema = z.strictObject({
  idProveedor: cxpNumber({"integer": true}).nullable().optional(),
  idSucursal: cxpNumber({"integer": true}).optional(),
  idCondicionCredito: cxpNumber({"integer": true}).nullable().optional(),
  idCompromiso: cxpNumber({"integer": true}).nullable().optional(),
  idDocumentoRelacionado: cxpNumber({"integer": true}).nullable().optional(),
  noFacturaCompra: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  noOrdenCompra: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  noRecepcion: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  tipoDocumento: z.enum(["FACTURA", "FACTURA_CAMBIARIA", "NOTA_CREDITO", "NOTA_DEBITO", "RECIBO", "REEMBOLSO", "LIQUIDACION_VIATICO", "GASTO_CAJA_CHICA", "CUOTA_CONTRATO", "CUOTA_PRESTAMO", "OBLIGACION_FISCAL", "SALDO_INICIAL", "COMPROBANTE_SERVICIO", "OTRO"] as const).optional(),
  naturaleza: z.enum(["D", "C"] as const).optional(),
  origenIngreso: z.enum(["MANUAL", "ARCHIVO", "CORREO", "IMPORTACION", "COMPRAS", "CARGA_MASIVA", "INTEGRACION", "PORTAL_PROVEEDOR", "FACTURACION_ELECTRONICA"] as const).optional(),
  tipoRegistro: z.enum(["CON_OC", "SIN_OC", "RECURRENTE", "SALDO_INICIAL", "IMPORTADO"] as const).optional(),
  serie: z.string().trim().min(1, "Este campo es obligatorio").max(40, "Máximo 40 caracteres").nullable().optional(),
  numeroDocumento: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  uuidFiscal: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  nitEmisor: z.string().trim().min(1, "Este campo es obligatorio").max(20, "Máximo 20 caracteres").nullable().optional(),
  referenciaExterna: z.string().trim().min(1, "Este campo es obligatorio").max(120, "Máximo 120 caracteres").nullable().optional(),
  hashOrigen: z.string().trim().min(1, "Este campo es obligatorio").max(128, "Máximo 128 caracteres").nullable().optional(),
  fechaDocumento: cxpDate(false).nullable().optional(),
  fechaRecepcion: cxpDate(true).optional(),
  fechaContabilizacion: cxpDate(false).nullable().optional(),
  fechaVencimiento: cxpDate(false).nullable().optional(),
  diasCredito: cxpNumber({"precision": 4, "scale": 0, "integer": true}).optional(),
  moneda: z.string().trim().min(1, "Este campo es obligatorio").max(3, "Máximo 3 caracteres").optional(),
  tipoCambio: cxpNumber({"precision": 18, "scale": 8}).optional(),
  fuenteTipoCambio: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  fechaTipoCambio: cxpDate(false).nullable().optional(),
  subtotal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  descuentoTotal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  impuestoTotal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  retencionTotal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  recargoTotal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  gastoAdicionalTotal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  diferenciaRedondeo: cxpNumber({"precision": 18, "scale": 2}).optional(),
  idDepartamento: cxpNumber({"integer": true}).nullable().optional(),
  centroCosto: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  proyecto: z.string().trim().min(1, "Este campo es obligatorio").max(100, "Máximo 100 caracteres").nullable().optional(),
  cuentaContable: z.string().trim().min(1, "Este campo es obligatorio").max(50, "Máximo 50 caracteres").nullable().optional(),
  solicitadoPor: cxpNumber({"integer": true}).nullable().optional(),
  responsablePor: cxpNumber({"integer": true}).nullable().optional(),
  justificacionSinOc: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  numeroCuota: cxpNumber({"precision": 6, "scale": 0, "integer": true}).nullable().optional(),
  capitalCuota: cxpNumber({"precision": 18, "scale": 2}).optional(),
  interesCuota: cxpNumber({"precision": 18, "scale": 2}).optional(),
  comisionCuota: cxpNumber({"precision": 18, "scale": 2}).optional(),
  resultadoTresVias: z.enum(["NO_APLICA", "COINCIDE", "DENTRO_TOLERANCIA", "DIFERENCIA", "DIF_PRECIO", "DIF_CANTIDAD", "NO_RECIBIDO", "SUPERA_ORDEN", "SIN_RECEPCION", "ORDEN_CERRADA", "ORDEN_ANULADA", "EN_INVESTIGACION", "DIFERENCIA_APROBADA", "BLOQUEADO"] as const).optional(),
  diferenciaCantidad: cxpNumber({"precision": 18, "scale": 4}).optional(),
  diferenciaPrecio: cxpNumber({"precision": 18, "scale": 2}).optional(),
  diferenciaImpuesto: cxpNumber({"precision": 18, "scale": 2}).optional(),
  diferenciaTotal: cxpNumber({"precision": 18, "scale": 2}).optional(),
  prioridad: z.enum(["CRITICA", "ALTA", "NORMAL", "BAJA"] as const).optional(),
  estadoContable: z.enum(["PENDIENTE", "ENVIADO", "CONTABILIZADO", "ERROR", "REVERTIDO", "NO_APLICA"] as const).optional(),
  numeroAsientoExt: z.string().trim().min(1, "Este campo es obligatorio").max(80, "Máximo 80 caracteres").nullable().optional(),
  estado: z.enum(["RECIBIDO", "PENDIENTE_CLASIFICACION", "BORRADOR", "PENDIENTE_REVISION", "EN_VALIDACION", "DUPLICADO", "CON_DIFERENCIAS", "PENDIENTE_APROBACION", "APROBADA", "RECHAZADA", "CONTABILIZADA", "PENDIENTE_PAGO", "PROGRAMADA_PAGO", "PARCIALMENTE_PAGADA", "PAGADA", "VENCIDA", "BLOQUEADA", "EN_DISPUTA", "PARCIALMENTE_APLICADA", "APLICADA", "ANULADA", "CERRADA"] as const).optional(),
  posibleDuplicado: z.enum(["S", "N"] as const).optional(),
  motivoRechazo: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoBloqueo: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  motivoAnulacion: z.string().trim().min(1, "Este campo es obligatorio").max(1000, "Máximo 1000 caracteres").nullable().optional(),
  anuladoPor: cxpNumber({"integer": true}).nullable().optional(),
  fechaAnulacion: cxpDate(true).nullable().optional(),
  observaciones: z.string().trim().min(1, "Este campo es obligatorio").max(1500, "Máximo 1500 caracteres").nullable().optional(),
  creadoPor: cxpNumber({"integer": true}).optional(),
  modificadoPor: cxpNumber({"integer": true}).nullable().optional(),
});

export type CreateCxpDocumentoInput = z.infer<typeof createCxpDocumentoSchema>;
export type UpdateCxpDocumentoInput = z.infer<typeof updateCxpDocumentoSchema>;
