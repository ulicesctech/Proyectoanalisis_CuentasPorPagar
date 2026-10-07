import { Ban, CheckCircle2, ClipboardCheck, RotateCcw, Send, Stamp, Undo2, XCircle, type LucideIcon } from 'lucide-react';
import type { CxpAccionFacturaEspecial } from '@erp/contracts';
import type { AccionFlujo } from '../api';

export type VarianteBoton = 'primary' | 'success' | 'danger' | 'secondary';

export interface AccionConfig {
  /** Acción equivalente en el detalle que devuelve el servidor (`factura.acciones`). */
  clave: Exclude<CxpAccionFacturaEspecial, 'editar' | 'constancia'>;
  /** Texto del botón en el detalle, la bandeja y el diálogo de confirmación. */
  label: string;
  icon: LucideIcon;
  /**
   * Color según FRONTEND_GUIDELINES: azul = avanzar el flujo, verde = aprobar/emitir,
   * rojo = rechazar/anular, blanco con borde = acción neutra.
   */
  variante: VarianteBoton;
  titulo: string;
  descripcion: string;
  texto?: 'motivo' | 'observacion';
}

/** Única definición de las acciones del flujo: así cada acción se ve igual en todas las pantallas. */
export const ACCIONES: Record<AccionFlujo, AccionConfig> = {
  'enviar-revision': {
    clave: 'enviarRevision', label: 'Enviar a revisión', icon: Send, variante: 'primary', texto: 'observacion',
    titulo: 'Enviar a revisión', descripcion: 'Los tributos se recalculan con las reglas vigentes y la factura ya no podrá editarse mientras esté en revisión.',
  },
  revisar: {
    clave: 'revisar', label: 'Marcar revisada', icon: ClipboardCheck, variante: 'primary', texto: 'observacion',
    titulo: 'Marcar como revisada', descripcion: 'Confirma que los datos del proveedor, montos y tributos son correctos. La factura pasará a aprobación.',
  },
  devolver: {
    clave: 'devolver', label: 'Devolver', icon: Undo2, variante: 'secondary', texto: 'motivo',
    titulo: 'Devolver a preparación', descripcion: 'La factura regresa a preparación para que se corrijan sus datos.',
  },
  aprobar: {
    clave: 'aprobar', label: 'Aprobar', icon: CheckCircle2, variante: 'success', texto: 'observacion',
    titulo: 'Aprobar factura especial', descripcion: 'Solo los usuarios autorizados pueden aprobar, y no quien registró la factura. La decisión queda registrada con tu usuario.',
  },
  rechazar: {
    clave: 'rechazar', label: 'Rechazar', icon: XCircle, variante: 'danger', texto: 'motivo',
    titulo: 'Rechazar factura especial', descripcion: 'La factura quedará rechazada con el motivo indicado. Podrá reabrirse para corregirla.',
  },
  reabrir: {
    clave: 'reabrir', label: 'Reabrir', icon: RotateCcw, variante: 'primary', texto: 'observacion',
    titulo: 'Reabrir para corrección', descripcion: 'La factura vuelve a preparación y requerirá una nueva revisión y aprobación.',
  },
  emitir: {
    clave: 'emitir', label: 'Emitir factura', icon: Stamp, variante: 'success',
    titulo: 'Emitir factura especial', descripcion: 'Se asignará un número de constancia único, los tributos quedarán aplicados y la factura pasará a pendiente de pago. Una factura solo puede emitirse una vez.',
  },
  anular: {
    clave: 'anular', label: 'Anular', icon: Ban, variante: 'danger', texto: 'motivo',
    titulo: 'Anular factura especial', descripcion: 'El documento, sus tributos y la constancia se conservan marcados como anulados. Esta operación no se puede deshacer.',
  },
};

/** Orden en que se muestran los botones: primero avanzar, luego neutras y al final las destructivas. */
export const ORDEN_ACCIONES: AccionFlujo[] = ['enviar-revision', 'revisar', 'aprobar', 'emitir', 'reabrir', 'devolver', 'rechazar', 'anular'];
