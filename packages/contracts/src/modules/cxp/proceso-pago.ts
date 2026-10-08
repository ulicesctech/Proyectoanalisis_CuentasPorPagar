import { z } from 'zod';
import { cxpDate } from './validation';

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const version = z.string().trim().min(1, 'Actualiza el proceso antes de continuar');

export const nuevaContrasenaSchema = z.strictObject({
  idProveedor: id,
  documentos: z.array(id)
    .min(1, 'Selecciona al menos una factura')
    .max(100, 'Selecciona como máximo 100 facturas')
    .refine(
      valores => new Set(valores).size === valores.length,
      'No repitas documentos',
    ),
  idCuentaOrigen: id,
  idCuentaDestino: id,
  idFormaPago: id,
  fecha: cxpDate(false),
  clave: z.string().uuid(),
}).refine(
  datos => datos.idCuentaOrigen !== datos.idCuentaDestino,
  {
    message: 'La cuenta de destino debe ser diferente de la cuenta de origen',
    path: ['idCuentaDestino'],
  },
);

const motivo = z.string().trim().min(5, 'Explica el motivo (mínimo 5 caracteres)').max(1000);

export const accionProcesoSchema = z.discriminatedUnion('accion', [
  z.strictObject({ accion: z.literal('solicitar'), version }),
  z.strictObject({ accion: z.literal('aprobar'), version, idAprobacion: id }),
  z.strictObject({ accion: z.literal('rechazar'), version, idAprobacion: id, motivo }),
  z.strictObject({ accion: z.literal('programar'), version, fecha: cxpDate(false).optional() }),
  z.strictObject({ accion: z.literal('emitir'), version, idCheque: z.string().trim().min(1).optional() }),
  z.strictObject({ accion: z.literal('entregar'), version, receptor: z.string().trim().min(3).max(200).optional() }),
  z.strictObject({ accion: z.literal('cobrar'), version }),
  z.strictObject({ accion: z.literal('reimprimir'), version, motivo }),
  z.strictObject({ accion: z.literal('anular'), version, motivo }),
]);

export type AccionProceso = z.infer<typeof accionProcesoSchema>;
export type NuevaContrasena = z.infer<typeof nuevaContrasenaSchema>;
export type PermisoProceso = 'CREAR' | 'APROBAR' | 'TESORERIA' | 'ANULAR';
export type TipoMedioPagoProceso = 'CHEQUE' | 'TRANSFERENCIA';

export interface FormaPagoProceso {
  id: number;
  nombre: string;
  tipo: TipoMedioPagoProceso;
}

export interface ActorProceso {
  id: number;
  nombre: string;
  roles: number[];
  permisos: PermisoProceso[];
}

export type EtapaProceso =
  | 'EMITIDA'
  | 'EN_REVISION'
  | 'APROBADA'
  | 'PROGRAMADA'
  | 'CHEQUE_EMITIDO'
  | 'ENTREGADO'
  | 'COBRADO'
  | 'RECHAZADA'
  | 'ANULADA';

export interface DocumentoProceso {
  id: number;
  numero: string;
  importe: number;
}

export interface AprobacionProceso {
  id: number;
  regla: number;
  nombre: string;
  nivel: number;
  rol: number;
  usuario?: number;
  decision: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';
}

export interface ChequeProceso {
  id: string;
  numero: string;
  cuenta: string;
  moneda: string;
  proveedor: number;
  importe: number;
  estado: 'PREPARADO' | 'EMITIDO' | 'ENTREGADO' | 'COBRADO' | 'ANULADO';
}

export interface TransferenciaProceso {
  id: string;
  cuentaOrigen: string;
  cuentaDestino: string;
  moneda: string;
  proveedor: number;
  importe: number;
  estado: 'PROGRAMADA' | 'EJECUTADA' | 'ANULADA';
  referencia?: string;
}

export interface EventoProceso {
  fecha: string;
  usuario: number;
  nombre: string;
  accion: string;
  detalle: string;
}

export interface ProcesoPago {
  id: number;
  codigo: string;
  clave: string;
  version: string;
  estado: EtapaProceso;
  proveedorNombre?: string;
  creador: number;
  solicitante?: number;
  proveedor: number;
  sucursal: number;
  moneda: string;
  tipoCambio: number;
  total: number;
  formaPago: number;
  formaPagoNombre: string;
  documentos: DocumentoProceso[];
  aprobaciones: AprobacionProceso[];
  historial: EventoProceso[];
  pago: number;
  lote?: number;
  fechaProgramada?: string;
  cheque?: ChequeProceso;
  transferencia?: TransferenciaProceso;
  aplicaciones: number[];
  reimpresiones: number;
  receptor?: string;
}

export interface ListaProcesos {
  data: ProcesoPago[];
  page: number;
  hasMore: boolean;
}

export interface OpcionesProceso {
  documentos: Array<{ id: number; nombre: string; proveedor: number; sucursal: number; moneda: string; saldo: number }>;
  origenes: Array<{ id: number; nombre: string; moneda: string }>;
  destinos: Array<{ id: number; nombre: string; proveedor: number; moneda: string }>;
  formasPago: FormaPagoProceso[];
  formaCheque?: number;
  formaTransferencia?: number;
  bancosConfigurados: boolean;
}

export const bandejaProcesoSchema = z.enum(['contrasenas', 'autorizaciones', 'pagos', 'cheques']);
export type BandejaProceso = z.infer<typeof bandejaProcesoSchema>;

export const estadosBandeja: Record<BandejaProceso, EtapaProceso[]> = {
  contrasenas: ['EMITIDA', 'EN_REVISION', 'APROBADA', 'PROGRAMADA', 'CHEQUE_EMITIDO', 'ENTREGADO', 'COBRADO', 'RECHAZADA', 'ANULADA'],
  autorizaciones: ['EN_REVISION', 'APROBADA', 'RECHAZADA'],
  pagos: ['APROBADA', 'PROGRAMADA', 'CHEQUE_EMITIDO', 'ENTREGADO', 'COBRADO', 'ANULADA'],
  cheques: ['PROGRAMADA', 'CHEQUE_EMITIDO', 'ENTREGADO', 'COBRADO', 'ANULADA'],
};

export const consultaProcesosSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  bandeja: bandejaProcesoSchema.default('contrasenas'),
  estado: z.string().optional(),
}).refine(
  value => !value.estado || estadosBandeja[value.bandeja].includes(value.estado as EtapaProceso),
  { message: 'El estado no corresponde a esta bandeja', path: ['estado'] },
);

/** Compatibilidad con la ruta histórica /cheques-disponibles. */
export interface OpcionChequeProceso {
  id: string;
  numero: string;
  importe: number;
  moneda: string;
}
