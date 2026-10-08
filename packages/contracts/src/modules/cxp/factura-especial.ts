import { z } from 'zod';
import { cxpDate, cxpNumber } from './validation';
import { cxpMoneyMultiply, cxpMoneySum } from './decimal';
import { cxpToday } from './time';

// ---------------------------------------------------------------------------
// Reglas tributarias (CXP_REGLA_TRIBUTARIA)
// ---------------------------------------------------------------------------

export const CXP_TIPOS_TRIBUTO_REGLA = ['IMPUESTO', 'RETENCION'] as const;
export const CXP_ESTADOS_REGLA_TRIBUTARIA = ['VIGENTE', 'REEMPLAZADA', 'FINALIZADA'] as const;

export interface CxpReglaTributaria {
  idReglaTributaria: number;
  codigoRegla: string;
  versionRegla: number;
  idReglaAnterior: number | null;
  tipoDocumento: string;
  tipoTributo: (typeof CXP_TIPOS_TRIBUTO_REGLA)[number];
  codigoTributo: string;
  nombreTributo: string;
  porcentaje: number;
  montoFijo: number;
  baseDesde: number;
  baseHasta: number | null;
  sobreExcedente: 'S' | 'N';
  moneda: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  estado: (typeof CXP_ESTADOS_REGLA_TRIBUTARIA)[number];
  motivoCambio: string | null;
  creadaPor: number;
  fechaCreacion: string;
  modificadaPor: number | null;
  fechaModificacion: string | null;
  /** Facturas especiales cuyos tributos se calcularon con esta versión. */
  documentosAplicados?: number;
}

const usuario = cxpNumber({ integer: true }).refine(value => value > 0, 'Selecciona el usuario que realiza la operación');
const codigo = (max: number) => z.string().trim().min(1, 'Este campo es obligatorio').max(max, `Máximo ${max} caracteres`)
  .transform(value => value.toUpperCase())
  .refine(value => /^[A-Z0-9_-]+$/.test(value), 'Usa solo letras, números, guion o guion bajo');
const porcentaje = cxpNumber({ precision: 9, scale: 6 }).refine(value => value >= 0 && value <= 100, 'El porcentaje debe estar entre 0 y 100');
const monto = cxpNumber({ precision: 18, scale: 2 }).refine(value => value >= 0, 'El monto no puede ser negativo');

/** Valores que definen el cálculo; se repiten en cada versión de la regla. */
const calculoRegla = {
  porcentaje,
  montoFijo: monto.default(0),
  baseDesde: monto.default(0),
  baseHasta: monto.nullable().optional(),
  sobreExcedente: z.enum(['S', 'N']).default('N'),
};

function rangoBase<T extends { baseDesde: number; baseHasta?: number | null }>(value: T, ctx: z.RefinementCtx) {
  if (value.baseHasta != null && value.baseHasta < value.baseDesde) {
    ctx.addIssue({ code: 'custom', path: ['baseHasta'], message: 'La base máxima no puede ser menor a la mínima' });
  }
}

export const createCxpReglaTributariaSchema = z.strictObject({
  codigoRegla: codigo(30),
  tipoTributo: z.enum(CXP_TIPOS_TRIBUTO_REGLA),
  codigoTributo: codigo(30),
  nombreTributo: z.string().trim().min(1, 'Este campo es obligatorio').max(120, 'Máximo 120 caracteres'),
  moneda: z.string().trim().length(3, 'La moneda debe tener tres letras').transform(value => value.toUpperCase()).nullable().optional(),
  vigenteDesde: cxpDate(false),
  vigenteHasta: cxpDate(false).nullable().optional(),
  creadaPor: usuario,
  ...calculoRegla,
}).superRefine((value, ctx) => {
  rangoBase(value, ctx);
  if (value.vigenteHasta && value.vigenteHasta < value.vigenteDesde) {
    ctx.addIssue({ code: 'custom', path: ['vigenteHasta'], message: 'La vigencia final no puede ser anterior a la inicial' });
  }
});

/** Una modificación crea una versión nueva que aplica desde vigenteDesde (hoy o después). */
export const nuevaVersionReglaTributariaSchema = z.strictObject({
  vigenteDesde: cxpDate(false),
  motivoCambio: z.string().trim().min(5, 'Describe el motivo del cambio (mínimo 5 caracteres)').max(500, 'Máximo 500 caracteres'),
  usuario,
  ...calculoRegla,
}).superRefine((value, ctx) => {
  rangoBase(value, ctx);
  if (value.vigenteDesde < cxpToday()) {
    ctx.addIssue({ code: 'custom', path: ['vigenteDesde'], message: 'Una modificación solo puede aplicar desde hoy o una fecha futura' });
  }
});

export const finalizarReglaTributariaSchema = z.strictObject({
  vigenteHasta: cxpDate(false),
  motivoCambio: z.string().trim().min(5, 'Describe el motivo (mínimo 5 caracteres)').max(500, 'Máximo 500 caracteres'),
  usuario,
});

export type CreateCxpReglaTributariaInput = z.infer<typeof createCxpReglaTributariaSchema>;
export type NuevaVersionReglaTributariaInput = z.infer<typeof nuevaVersionReglaTributariaSchema>;
export type FinalizarReglaTributariaInput = z.infer<typeof finalizarReglaTributariaSchema>;

// ---------------------------------------------------------------------------
// Cálculo de tributos (compartido por la vista previa del cliente y el servidor)
// ---------------------------------------------------------------------------

export type CxpReglaCalculo = Pick<CxpReglaTributaria,
  'idReglaTributaria' | 'codigoRegla' | 'versionRegla' | 'tipoTributo' | 'codigoTributo' | 'nombreTributo'
  | 'porcentaje' | 'montoFijo' | 'baseDesde' | 'baseHasta' | 'sobreExcedente'>;

export interface CxpTributoCalculado {
  idReglaTributaria: number;
  codigoRegla: string;
  versionRegla: number;
  tipoTributo: 'IMPUESTO' | 'RETENCION';
  codigoTributo: string;
  nombreTributo: string;
  baseImponible: number;
  porcentaje: number;
  monto: number;
}

export interface CxpCalculoFacturaEspecial {
  baseImponible: number;
  tributos: CxpTributoCalculado[];
  impuestoTotal: number;
  retencionTotal: number;
  totalBruto: number;
  totalNeto: number;
}

/** Indica si la regla cubre la base imponible (tramo BASE_DESDE..BASE_HASTA). */
export function cxpReglaCubreBase(regla: Pick<CxpReglaCalculo, 'baseDesde' | 'baseHasta'>, base: number): boolean {
  return base >= Number(regla.baseDesde) && (regla.baseHasta == null || base <= Number(regla.baseHasta));
}

/**
 * Aplica las reglas vigentes a la base imponible (monto de la operación menos
 * descuento). Monto = monto fijo + porcentaje × (base, o excedente sobre
 * BASE_DESDE si la regla lo indica), redondeado a 2 decimales como Oracle.
 * Las reglas que no cubren la base se omiten; dos reglas para el mismo
 * tributo y tipo son un conflicto de configuración.
 */
export function cxpCalcularFacturaEspecial(subtotal: number, descuento: number, reglas: readonly CxpReglaCalculo[]): CxpCalculoFacturaEspecial {
  const baseImponible = cxpMoneySum(subtotal, -descuento);
  if (baseImponible < 0) throw new RangeError('El descuento no puede superar el monto de la operación');
  const aplicables = reglas.filter(regla => cxpReglaCubreBase(regla, baseImponible));
  const vistos = new Map<string, CxpReglaCalculo>();
  for (const regla of aplicables) {
    const clave = `${regla.tipoTributo}:${regla.codigoTributo}`;
    const previa = vistos.get(clave);
    if (previa) {
      throw new RangeError(`Las reglas ${previa.codigoRegla} y ${regla.codigoRegla} aplican al mismo tributo (${regla.codigoTributo}, ${regla.tipoTributo}). Ajusta sus tramos o vigencias.`);
    }
    vistos.set(clave, regla);
  }
  const tributos = aplicables.map(regla => {
    const sobre = regla.sobreExcedente === 'S' ? cxpMoneySum(baseImponible, -Number(regla.baseDesde)) : baseImponible;
    const variable = cxpMoneyMultiply(sobre, Number(regla.porcentaje) / 100);
    return {
      idReglaTributaria: regla.idReglaTributaria, codigoRegla: regla.codigoRegla, versionRegla: regla.versionRegla,
      tipoTributo: regla.tipoTributo, codigoTributo: regla.codigoTributo, nombreTributo: regla.nombreTributo,
      baseImponible, porcentaje: Number(regla.porcentaje), monto: cxpMoneySum(Number(regla.montoFijo), variable),
    };
  }).sort((a, b) => a.tipoTributo.localeCompare(b.tipoTributo) || a.codigoTributo.localeCompare(b.codigoTributo));
  const impuestoTotal = cxpMoneySum(...tributos.filter(t => t.tipoTributo === 'IMPUESTO').map(t => t.monto));
  const retencionTotal = cxpMoneySum(...tributos.filter(t => t.tipoTributo === 'RETENCION').map(t => t.monto));
  const totalBruto = cxpMoneySum(baseImponible, impuestoTotal);
  const totalNeto = cxpMoneySum(totalBruto, -retencionTotal);
  if (totalNeto < 0) throw new RangeError('Las retenciones superan el total de la operación. Revisa las reglas tributarias.');
  return { baseImponible, tributos, impuestoTotal, retencionTotal, totalBruto, totalNeto };
}

// ---------------------------------------------------------------------------
// Facturas especiales (CXP_DOCUMENTO + CXP_FACTURA_ESPECIAL)
// ---------------------------------------------------------------------------

export const CXP_ETAPAS_FACTURA_ESPECIAL = ['PREPARACION', 'REVISION', 'APROBACION', 'APROBADA', 'EMITIDA', 'RECHAZADA', 'ANULADA'] as const;
export type CxpEtapaFacturaEspecial = (typeof CXP_ETAPAS_FACTURA_ESPECIAL)[number];

/** Etapa del flujo PREPARACIÓN → REVISIÓN → APROBACIÓN → EMISIÓN → ANULACIÓN. */
export function cxpEtapaFacturaEspecial(estadoDocumento: string, estadoEmision: string): CxpEtapaFacturaEspecial {
  if (estadoDocumento === 'ANULADA' || estadoEmision === 'ANULADA') return 'ANULADA';
  if (estadoEmision === 'EMITIDA') return 'EMITIDA';
  if (estadoDocumento === 'PENDIENTE_REVISION') return 'REVISION';
  if (estadoDocumento === 'PENDIENTE_APROBACION') return 'APROBACION';
  if (estadoDocumento === 'APROBADA') return 'APROBADA';
  if (estadoDocumento === 'RECHAZADA') return 'RECHAZADA';
  return 'PREPARACION';
}

export interface CxpFacturaEspecialResumen {
  idDocumento: number;
  idFacturaEspecial: number;
  serie: string;
  numeroDocumento: string;
  idProveedor: number;
  proveedorNombre: string;
  proveedorNit: string | null;
  proveedorCui: string | null;
  fechaDocumento: string;
  moneda: string;
  subtotal: number;
  impuestoTotal: number;
  retencionTotal: number;
  totalNeto: number;
  estado: string;
  estadoEmision: 'PENDIENTE' | 'EMITIDA' | 'ANULADA';
  etapa: CxpEtapaFacturaEspecial;
  numeroConstancia: string | null;
  fechaEmision: string | null;
}

export interface CxpFacturaEspecialTributo {
  idTributo: number;
  idReglaTributaria: number | null;
  codigoRegla: string | null;
  versionRegla: number | null;
  tipoTributo: string;
  codigoTributo: string;
  nombreTributo: string;
  baseImponible: number;
  porcentaje: number;
  monto: number;
  numeroConstancia: string | null;
  periodoFiscal: string | null;
  fechaAplicacion: string;
  estado: string;
}

export interface CxpFacturaEspecialAprobacion {
  idAprobacion: number;
  nivel: number;
  estado: string;
  idUsuarioAprobador: number | null;
  usuarioAprobador: string | null;
  fechaSolicitud: string;
  fechaDecision: string | null;
  observacion: string | null;
}

export interface CxpFacturaEspecialMovimiento {
  idEvento: number;
  tipoEvento: string;
  asunto: string;
  detalle: string | null;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  montoRelacionado: number | null;
  usuarioEvento: number;
  usuario: string | null;
  fechaEvento: string;
}

export interface CxpFacturaEspecialDetalle extends CxpFacturaEspecialResumen {
  idSucursal: number;
  tipoCambio: number;
  descuentoTotal: number;
  totalBruto: number;
  saldoPendiente: number;
  montoAplicado: number;
  referenciaExterna: string | null;
  fechaVencimiento: string | null;
  idDepartamento: number | null;
  centroCosto: string | null;
  cuentaContable: string | null;
  proveedorDireccion: string | null;
  descripcionOperacion: string;
  observaciones: string | null;
  estadoContable: string;
  motivoRechazo: string | null;
  motivoAnulacion: string | null;
  anuladoPor: number | null;
  fechaAnulacion: string | null;
  revisadoPor: number | null;
  fechaRevision: string | null;
  observacionRevision: string | null;
  emitidoPor: number | null;
  hashConstancia: string | null;
  creadoPor: number;
  fechaCreacion: string;
  tributos: CxpFacturaEspecialTributo[];
  aprobaciones: CxpFacturaEspecialAprobacion[];
  historial: CxpFacturaEspecialMovimiento[];
  /** Acciones disponibles en la etapa actual (la autorización se valida al ejecutarlas). */
  acciones: CxpAccionFacturaEspecial[];
}

export type CxpAccionFacturaEspecial = 'editar' | 'enviarRevision' | 'revisar' | 'devolver' | 'aprobar' | 'rechazar' | 'reabrir' | 'emitir' | 'anular' | 'constancia';

const texto = (max: number) => z.string().trim().min(1, 'Este campo es obligatorio').max(max, `Máximo ${max} caracteres`);
const identificacion = z.string().trim().max(20, 'Máximo 20 caracteres').transform(value => value.toUpperCase()).nullable().optional();

const datosFacturaEspecial = {
  idProveedor: cxpNumber({ integer: true }).refine(value => value > 0, 'Selecciona el proveedor'),
  idSucursal: cxpNumber({ integer: true }).refine(value => value > 0, 'Selecciona la sucursal'),
  fechaDocumento: cxpDate(false),
  fechaVencimiento: cxpDate(false).nullable().optional(),
  moneda: z.string().trim().length(3, 'La moneda debe tener tres letras').transform(value => value.toUpperCase()).default('GTQ'),
  tipoCambio: cxpNumber({ precision: 18, scale: 8 }).refine(value => value > 0, 'El tipo de cambio debe ser mayor a cero').default(1),
  subtotal: cxpNumber({ precision: 18, scale: 2 }).refine(value => value > 0, 'El monto de la operación debe ser mayor a cero'),
  descuentoTotal: monto.default(0),
  referenciaExterna: texto(120),
  proveedorNombre: z.string().trim().max(200, 'Máximo 200 caracteres').nullable().optional(),
  proveedorNit: identificacion,
  proveedorCui: identificacion,
  proveedorDireccion: z.string().trim().max(300, 'Máximo 300 caracteres').nullable().optional(),
  descripcionOperacion: texto(1000),
  idDepartamento: cxpNumber({ integer: true }).nullable().optional(),
  centroCosto: z.string().trim().max(50, 'Máximo 50 caracteres').nullable().optional(),
  cuentaContable: z.string().trim().max(50, 'Máximo 50 caracteres').nullable().optional(),
  observaciones: z.string().trim().max(1500, 'Máximo 1500 caracteres').nullable().optional(),
};

function reglasFactura(value: { subtotal?: number; descuentoTotal?: number; fechaDocumento?: string; fechaVencimiento?: string | null }, ctx: z.RefinementCtx) {
  if (value.subtotal !== undefined && value.descuentoTotal !== undefined && value.descuentoTotal > value.subtotal) {
    ctx.addIssue({ code: 'custom', path: ['descuentoTotal'], message: 'El descuento no puede superar el monto de la operación' });
  }
  if (value.fechaDocumento && value.fechaDocumento > cxpToday()) {
    ctx.addIssue({ code: 'custom', path: ['fechaDocumento'], message: 'La fecha de la operación no puede ser posterior a hoy' });
  }
  if (value.fechaDocumento && value.fechaVencimiento && value.fechaVencimiento < value.fechaDocumento) {
    ctx.addIssue({ code: 'custom', path: ['fechaVencimiento'], message: 'El vencimiento no puede ser anterior a la fecha de la operación' });
  }
}

export const createCxpFacturaEspecialSchema = z.strictObject({ ...datosFacturaEspecial, usuario }).superRefine(reglasFactura);
export const updateCxpFacturaEspecialSchema = z.strictObject({ ...datosFacturaEspecial, usuario }).superRefine(reglasFactura);
/** Vista previa del cálculo: no requiere usuario ni guarda nada. */
export const calcularCxpFacturaEspecialSchema = z.strictObject({
  fechaDocumento: cxpDate(false),
  moneda: z.string().trim().length(3).transform(value => value.toUpperCase()).default('GTQ'),
  subtotal: cxpNumber({ precision: 18, scale: 2 }).refine(value => value >= 0, 'El monto no puede ser negativo'),
  descuentoTotal: monto.default(0),
});

export const accionCxpFacturaEspecialSchema = z.strictObject({
  usuario,
  observacion: z.string().trim().max(1000, 'Máximo 1000 caracteres').nullable().optional(),
});
export const motivoCxpFacturaEspecialSchema = z.strictObject({
  usuario,
  motivo: z.string().trim().min(5, 'Describe el motivo (mínimo 5 caracteres)').max(1000, 'Máximo 1000 caracteres'),
});

export type CreateCxpFacturaEspecialInput = z.infer<typeof createCxpFacturaEspecialSchema>;
export type UpdateCxpFacturaEspecialInput = z.infer<typeof updateCxpFacturaEspecialSchema>;
export type CalcularCxpFacturaEspecialInput = z.infer<typeof calcularCxpFacturaEspecialSchema>;
export type AccionCxpFacturaEspecialInput = z.infer<typeof accionCxpFacturaEspecialSchema>;
export type MotivoCxpFacturaEspecialInput = z.infer<typeof motivoCxpFacturaEspecialSchema>;
