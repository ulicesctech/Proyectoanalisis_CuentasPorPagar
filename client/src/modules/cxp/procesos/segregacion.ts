import type { ActorProceso, AprobacionProceso, ProcesoPago } from '@erp/contracts';

// Refleja en pantalla la segregación que aplica el servidor (workflow.ts):
// solo oculta acciones; la decisión final siempre la toma el servidor.
// Además de la capacidad APROBAR, la posición exige el rol de su regla.

type Actor = Pick<ActorProceso, 'id' | 'roles'> | null;

/** Último usuario que registró la acción en el historial del proceso. */
function ultimoUsuario(proceso: ProcesoPago, accion: 'PROGRAMAR' | 'ENTREGAR'): number | undefined {
  return [...proceso.historial].reverse().find(evento => evento.accion === accion)?.usuario;
}

/** Motivo por el que el usuario no puede decidir la aprobación, o null si puede. */
export function impedimentoAprobacion(proceso: ProcesoPago, aprobacion: AprobacionProceso, actor: Actor): string | null {
  if (!actor) return 'Selecciona el usuario operativo.';
  if (!actor.roles.length) return 'El usuario operativo necesita un rol activo.';
  if (!actor.roles.includes(aprobacion.rol)) return 'Tu rol no coincide con el requerido por esta aprobación.';
  const yaDecidio = proceso.aprobaciones.some(item =>
    item.id !== aprobacion.id &&
    ['APROBADA', 'RECHAZADA'].includes(item.decision) &&
    Number(item.usuario) === actor.id);
  return yaDecidio ? 'Ya registraste una decisión en este proceso; debe resolverla otra persona.' : null;
}

/** Quien programó el pago no puede ejecutarlo. */
export function impedimentoEntrega(proceso: ProcesoPago, actor: Actor): string | null {
  if (!actor) return 'Selecciona el usuario operativo.';
  return ultimoUsuario(proceso, 'PROGRAMAR') === actor.id
    ? 'Programaste este pago; otra persona de tesorería debe ejecutarlo.'
    : null;
}

/** Quien programó o ejecutó el pago no puede confirmarlo. */
export function impedimentoCobro(proceso: ProcesoPago, actor: Actor): string | null {
  if (!actor) return 'Selecciona el usuario operativo.';
  if (ultimoUsuario(proceso, 'PROGRAMAR') === actor.id) return 'Programaste este pago; otra persona de tesorería debe confirmarlo.';
  if (ultimoUsuario(proceso, 'ENTREGAR') === actor.id) return 'Ejecutaste este pago; otra persona de tesorería debe confirmarlo.';
  return null;
}
