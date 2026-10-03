import type { CxpRecord, CxpResource } from './types';

interface CxpWorkflow {
  /** Estados con los que se puede registrar un registro nuevo. */
  initial: string[];
  /** Cambios de estado manuales permitidos (vía PATCH). */
  transitions: Record<string, string[]>;
  /** Estados en los que aún se pueden modificar importes y componentes. */
  editable: string[];
  /** Estados a los que solo se llega con las aprobaciones requeridas completas. */
  requiresApproval: string[];
  /** Campos que fijan lo aprobado (importes, vínculos); solo se modifican en estados editables. */
  lockedFields: string[];
}

export const CXP_WORKFLOWS: Partial<Record<CxpResource, CxpWorkflow>> = {
  documentos: {
    initial: ['RECIBIDO', 'PENDIENTE_CLASIFICACION', 'BORRADOR', 'PENDIENTE_REVISION'],
    transitions: {
      RECIBIDO: ['PENDIENTE_CLASIFICACION', 'BORRADOR', 'PENDIENTE_REVISION', 'DUPLICADO', 'RECHAZADA', 'ANULADA'],
      PENDIENTE_CLASIFICACION: ['BORRADOR', 'PENDIENTE_REVISION', 'RECHAZADA', 'ANULADA'],
      BORRADOR: ['PENDIENTE_REVISION', 'EN_VALIDACION', 'PENDIENTE_APROBACION', 'ANULADA'],
      PENDIENTE_REVISION: ['BORRADOR', 'EN_VALIDACION', 'CON_DIFERENCIAS', 'PENDIENTE_APROBACION', 'RECHAZADA'],
      EN_VALIDACION: ['BORRADOR', 'CON_DIFERENCIAS', 'DUPLICADO', 'PENDIENTE_APROBACION', 'RECHAZADA'],
      CON_DIFERENCIAS: ['EN_VALIDACION', 'PENDIENTE_APROBACION', 'EN_DISPUTA', 'BLOQUEADA', 'RECHAZADA'],
      DUPLICADO: ['EN_VALIDACION', 'ANULADA'],
      PENDIENTE_APROBACION: ['BORRADOR', 'APROBADA', 'RECHAZADA'],
      APROBADA: ['CONTABILIZADA', 'PENDIENTE_PAGO', 'BLOQUEADA', 'EN_DISPUTA', 'ANULADA'],
      RECHAZADA: ['BORRADOR', 'ANULADA'],
      CONTABILIZADA: ['PENDIENTE_PAGO', 'BLOQUEADA', 'EN_DISPUTA', 'ANULADA'],
      PENDIENTE_PAGO: ['PROGRAMADA_PAGO', 'VENCIDA', 'BLOQUEADA', 'EN_DISPUTA', 'ANULADA'],
      PROGRAMADA_PAGO: ['PENDIENTE_PAGO', 'PARCIALMENTE_PAGADA', 'VENCIDA', 'BLOQUEADA'],
      PARCIALMENTE_PAGADA: ['PROGRAMADA_PAGO', 'VENCIDA', 'BLOQUEADA', 'EN_DISPUTA'],
      VENCIDA: ['PENDIENTE_PAGO', 'PARCIALMENTE_PAGADA', 'PROGRAMADA_PAGO', 'BLOQUEADA', 'EN_DISPUTA', 'ANULADA'],
      BLOQUEADA: ['EN_VALIDACION', 'PENDIENTE_APROBACION', 'PENDIENTE_PAGO', 'PARCIALMENTE_PAGADA', 'EN_DISPUTA', 'ANULADA'],
      EN_DISPUTA: ['CON_DIFERENCIAS', 'PENDIENTE_PAGO', 'PARCIALMENTE_PAGADA', 'BLOQUEADA', 'RECHAZADA', 'ANULADA'],
      PARCIALMENTE_APLICADA: [],
      PAGADA: ['CERRADA'],
      APLICADA: ['CERRADA'],
      ANULADA: [],
      CERRADA: [],
    },
    editable: ['RECIBIDO', 'PENDIENTE_CLASIFICACION', 'BORRADOR', 'PENDIENTE_REVISION', 'EN_VALIDACION', 'CON_DIFERENCIAS', 'RECHAZADA'],
    requiresApproval: ['APROBADA'],
    lockedFields: [
      'subtotal', 'descuentoTotal', 'impuestoTotal', 'retencionTotal', 'recargoTotal', 'gastoAdicionalTotal',
      'diferenciaRedondeo', 'tipoCambio', 'capitalCuota', 'interesCuota', 'comisionCuota',
    ],
  },
  pagos: {
    initial: ['BORRADOR', 'PROGRAMADO', 'PENDIENTE_APROBACION'],
    transitions: {
      BORRADOR: ['PROGRAMADO', 'PENDIENTE_APROBACION', 'ANULADO'],
      PROGRAMADO: ['BORRADOR', 'PENDIENTE_APROBACION', 'ANULADO'],
      PENDIENTE_APROBACION: ['BORRADOR', 'APROBADO', 'RECHAZADO'],
      APROBADO: ['ENVIADO', 'EN_PROCESO', 'EJECUTADO', 'ANULADO'],
      ENVIADO: ['EN_PROCESO', 'EJECUTADO', 'RECHAZADO', 'DEVUELTO'],
      EN_PROCESO: ['EJECUTADO', 'RECHAZADO', 'DEVUELTO'],
      EJECUTADO: ['CONFIRMADO', 'CONCILIADO', 'DEVUELTO'],
      CONFIRMADO: ['CONCILIADO', 'DEVUELTO'],
      PARCIALMENTE_APLICADO: ['CONCILIADO'],
      APLICADO: ['CONCILIADO'],
      CONCILIADO: [],
      RECHAZADO: ['BORRADOR', 'ANULADO'],
      DEVUELTO: ['BORRADOR', 'ANULADO'],
      ANULADO: [],
    },
    editable: ['BORRADOR', 'PROGRAMADO', 'RECHAZADO'],
    requiresApproval: ['APROBADO'],
    lockedFields: ['montoObligacion', 'montoDescuento', 'montoRetencion', 'montoComision', 'tipoCambio'],
  },
  'lotes-pago': {
    initial: ['BORRADOR', 'PENDIENTE_APROBACION'],
    transitions: {
      BORRADOR: ['PENDIENTE_APROBACION', 'ANULADO'],
      PENDIENTE_APROBACION: ['BORRADOR', 'APROBADO', 'RECHAZADO'],
      APROBADO: ['ENVIADO', 'ANULADO'],
      ENVIADO: ['EN_PROCESO', 'EJECUTADO', 'PARCIAL', 'RECHAZADO'],
      EN_PROCESO: ['EJECUTADO', 'PARCIAL', 'RECHAZADO'],
      PARCIAL: ['EJECUTADO'],
      EJECUTADO: [],
      RECHAZADO: ['BORRADOR', 'ANULADO'],
      ANULADO: [],
    },
    editable: ['BORRADOR', 'RECHAZADO'],
    requiresApproval: ['APROBADO'],
    lockedFields: ['montoTotal', 'cantidadPagos'],
  },
  aprobaciones: {
    initial: ['PENDIENTE'],
    transitions: {
      PENDIENTE: ['APROBADA', 'RECHAZADA', 'DELEGADA', 'CANCELADA'],
      APROBADA: [],
      RECHAZADA: [],
      DELEGADA: [],
      CANCELADA: [],
    },
    editable: ['PENDIENTE'],
    requiresApproval: [],
    lockedFields: ['idRegla', 'idDocumento', 'idPago', 'idLote', 'idCuentaBancaria', 'idCompromiso', 'idPeriodo', 'nivel', 'idRolAprobador', 'idUsuarioAprobador'],
  },
};

/** Estados del documento que admiten aplicaciones de pago o crédito. */
export const CXP_PAYABLE_DOCUMENT_STATES = ['APROBADA', 'CONTABILIZADA', 'PENDIENTE_PAGO', 'PROGRAMADA_PAGO', 'PARCIALMENTE_PAGADA', 'VENCIDA'];
/** Estados de una nota de crédito que puede usarse como origen de una aplicación. */
export const CXP_AVAILABLE_CREDIT_STATES = ['APROBADA', 'CONTABILIZADA', 'PARCIALMENTE_APLICADA'];

/** Estados a los que se puede pasar desde el estado actual (incluye el actual). */
export function cxpAllowedStates(resource: CxpResource, current?: string | null): string[] | null {
  const workflow = CXP_WORKFLOWS[resource];
  if (!workflow) return null;
  if (!current) return workflow.initial;
  return [current, ...(workflow.transitions[current] ?? [])];
}

/**
 * Coherencia entre el estado declarado y los saldos. Los estados de pago/aplicación
 * normalmente los asigna el servicio de aplicaciones; si se eligen a mano deben
 * reflejar el saldo real.
 */
export function cxpBalanceStateIssue(resource: CxpResource, record: CxpRecord): string | null {
  const applied = Number(record.montoAplicado ?? 0);
  const estado = String(record.estado);
  if (resource === 'documentos') {
    const pending = Number(record.saldoPendiente ?? 0);
    if (estado === 'PENDIENTE_PAGO' && applied > 0) return 'El documento ya tiene pagos aplicados; su estado debe ser PARCIALMENTE PAGADA';
    if (estado === 'PARCIALMENTE_PAGADA' && (applied <= 0 || pending <= 0)) return 'Solo un documento con pagos aplicados y saldo pendiente puede quedar parcialmente pagado';
  }
  if (resource === 'pagos' && ['DEVUELTO', 'ANULADO'].includes(estado) && applied > 0) {
    return 'Revierte las aplicaciones antes de devolver o anular este pago';
  }
  return null;
}
