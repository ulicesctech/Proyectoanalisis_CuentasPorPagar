import type { CxpRecord, CxpResource, CxpValidationIssue } from './types';

/**
 * Campos de AUTORÍA: registran quién hizo algo. Los fija el usuario operativo
 * (actor), nunca el formulario. Servidor y cliente aplican la misma regla.
 *
 * Los usuarios elegidos como DATO (solicitadoPor, responsablePor, usuarioAsignado)
 * no se incluyen: siguen viniendo del formulario.
 */
export interface CxpActorTransition {
  campo: string;
  /** Campo cuyo cambio activa el registro del actor (normalmente `estado`). */
  field: string;
  /** Valores que, al alcanzarse, registran al actor en `campo`. */
  values: readonly string[];
}

export interface CxpActorFieldRules {
  /** Se fijan con el actor al crear y ya no cambian. */
  onCreate?: readonly string[];
  /** Se fijan con el actor en cada modificación. */
  onUpdate?: readonly string[];
  /** Se fijan con el actor cuando el registro llega a ciertos valores. */
  onTransition?: readonly CxpActorTransition[];
}

const estado = (campo: string, ...values: string[]): CxpActorTransition => ({ campo, field: 'estado', values });

export const CXP_ACTOR_FIELDS: Partial<Record<CxpResource, CxpActorFieldRules>> = {
  parametros: { onCreate: ['modificadoPor'], onUpdate: ['modificadoPor'] },
  periodos: { onTransition: [estado('cerradoPor', 'CERRADO'), estado('reabiertoPor', 'REABIERTO')] },
  'cuentas-bancarias': {
    onCreate: ['creadoPor'], onUpdate: ['modificadoPor'],
    onTransition: [{ campo: 'verificadoPor', field: 'estadoAprobacion', values: ['APROBADA'] }],
  },
  compromisos: { onCreate: ['creadoPor'], onUpdate: ['modificadoPor'] },
  documentos: { onCreate: ['creadoPor'], onUpdate: ['modificadoPor'], onTransition: [estado('anuladoPor', 'ANULADA')] },
  'documentos-tributos': { onCreate: ['generadoPor'] },
  'lotes-pago': { onCreate: ['creadoPor'], onTransition: [estado('enviadoPor', 'ENVIADO')] },
  // programadoPor/ejecutadoPor/conciliadoPor de un pago ya los fija el flujo RF07–RF10.
  pagos: { onCreate: ['programadoPor'] },
  aplicaciones: { onCreate: ['aplicadoPor'], onTransition: [estado('aplicadoPor', 'APLICADA'), estado('revertidoPor', 'REVERTIDA')] },
  'reglas-aprobacion': { onCreate: ['creadaPor'] },
  aprobaciones: { onTransition: [estado('idUsuarioAprobador', 'APROBADA', 'RECHAZADA'), estado('delegadoPor', 'DELEGADA')] },
  'conciliaciones-proveedor': { onCreate: ['elaboradaPor'], onTransition: [estado('cerradaPor', 'CERRADA')] },
  'conciliaciones-pago': { onTransition: [estado('conciliadoPor', 'CONCILIADO_AUTOMATICO', 'CONCILIADO_MANUAL')] },
  eventos: { onCreate: ['usuarioEvento'] },
  archivos: { onCreate: ['cargadoPor'] },
};

/** Nombres de todos los campos de autoría de un recurso. */
export function cxpActorFieldNames(resource: CxpResource): string[] {
  const rules = CXP_ACTOR_FIELDS[resource];
  if (!rules) return [];
  return [...new Set([...(rules.onCreate ?? []), ...(rules.onUpdate ?? []), ...(rules.onTransition ?? []).map(item => item.campo)])];
}

export function isCxpActorField(resource: CxpResource, field: string): boolean {
  return cxpActorFieldNames(resource).includes(field);
}

const supplied = (value: unknown) => value !== undefined && value !== null && value !== '';
const sameUser = (a: unknown, b: unknown) => supplied(a) && supplied(b) && Number(a) === Number(b);

/**
 * Aplica la autoría del actor sobre lo que se va a guardar.
 * - `input`: cuerpo de un alta o PATCH ya validado por su esquema.
 * - `current`: fila actual (solo en PATCH).
 * Devuelve el registro con los campos de autoría resueltos y, si el cuerpo traía otro
 * usuario, la lista de campos en conflicto. Un valor igual al del actor se acepta.
 */
export function applyCxpActorFields(
  resource: CxpResource,
  actorId: number,
  input: CxpRecord,
  current?: CxpRecord | null,
): { record: CxpRecord; issues: CxpValidationIssue[] } {
  const rules = CXP_ACTOR_FIELDS[resource];
  const record: CxpRecord = { ...input };
  const issues: CxpValidationIssue[] = [];
  if (!rules) return { record, issues };
  const creating = !current;
  const next = { ...(current ?? {}), ...input };
  const stamped = new Set<string>(creating ? rules.onCreate ?? [] : rules.onUpdate ?? []);
  for (const transition of rules.onTransition ?? []) {
    const reached = transition.values.includes(String(next[transition.field]));
    const changed = creating || String(current![transition.field]) !== String(next[transition.field]);
    if (reached && changed) stamped.add(transition.campo);
  }
  for (const campo of cxpActorFieldNames(resource)) {
    const value = input[campo];
    if (stamped.has(campo)) {
      if (supplied(value) && !sameUser(value, actorId)) {
        issues.push({ campo, mensaje: 'Lo registra el usuario operativo; no puede indicarse otro usuario' });
      }
      record[campo] = actorId;
      continue;
    }
    // No corresponde registrarlo ahora: se conserva el valor actual (o vacío al crear).
    const unchanged = creating ? null : current![campo] ?? null;
    if (Object.hasOwn(input, campo)) {
      if (supplied(value) && !sameUser(value, unchanged)) {
        issues.push({ campo, mensaje: 'Este campo lo registra el sistema al realizar la acción' });
      }
      delete record[campo];
    }
  }
  return { record, issues };
}
