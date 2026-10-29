import type { Response } from 'express';
import { applyCxpActorFields, type CxpRecord, type CxpResource } from '@erp/contracts';
import { CxpError } from './errors';
import { cxpActor } from './identidad';

const MISMATCH = 'El usuario indicado no coincide con el usuario autenticado';

/** Id del usuario operativo vinculado a la sesión de la petición. */
export function requireActorId(res: Response): number {
  const actor = cxpActor(res);
  if (!actor) throw new CxpError('No hay usuario CXP activo en la sesión', 401);
  return actor.id;
}

/** Aplica la autoría del actor (ver CXP_ACTOR_FIELDS) o rechaza con 403 si el cuerpo trae otro usuario. */
export function resolveActorFields(resource: CxpResource, actorId: number, input: CxpRecord, current?: CxpRecord | null): CxpRecord {
  const { record, issues } = applyCxpActorFields(resource, actorId, input, current);
  if (issues.length) throw new CxpError(MISMATCH, 403, issues);
  return record;
}

/**
 * Para operaciones con un campo de usuario propio (p. ej. `usuario`, `aplicadoPor`):
 * acepta que venga vacío o igual al actor y devuelve siempre el actor.
 */
export function actorForField(value: unknown, actorId: number, campo: string): number {
  if (value !== undefined && value !== null && value !== '' && Number(value) !== actorId) {
    throw new CxpError(MISMATCH, 403, [{ campo, mensaje: 'Debe ser el usuario autenticado' }]);
  }
  return actorId;
}

/** Copia del cuerpo con `campo` fijado al actor (o 403 si traía otro usuario). */
export function withActorField(raw: unknown, campo: string, actorId: number): Record<string, unknown> {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
  body[campo] = actorForField(body[campo], actorId, campo);
  return body;
}
