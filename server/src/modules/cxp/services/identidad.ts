import type { RequestHandler, Response } from 'express';
import type { ActorProceso, PermisoProceso } from '@erp/contracts';
import { type UsuarioOperativoRow } from '../repositories/control/usuario.repository';
import { CxpError } from './errors';

/*
 * Identidad única del módulo CXP.
 *
 * La sesión autenticada se vincula con un USUARIO operativo. El rol activo se
 * lee de Oracle para aplicar aprobación documental y capacidades de pago.
 */
const PERMISO_POR_ROL: Readonly<Record<string, PermisoProceso>> = {
  OPERADOR_CXP: 'CREAR',
  APROBADOR_CXP: 'APROBAR',
  TESORERIA_CXP: 'TESORERIA',
  SUPERVISOR_CXP: 'ANULAR',
};

export function actorDesdeUsuario(usuario: UsuarioOperativoRow): ActorProceso {
  const nombreRol = usuario.rolActivo ? usuario.nombreRolNormalizado : null;
  const permiso = nombreRol && Object.hasOwn(PERMISO_POR_ROL, nombreRol) ? PERMISO_POR_ROL[nombreRol] : null;
  if (permiso && usuario.coincidenciasNombreRol !== 1) {
    throw new CxpError(`El nombre de rol ${nombreRol} es ambiguo en ROL; revisa duplicados, espacios y mayúsculas.`, 409);
  }
  return {
    id: usuario.idUsuario,
    nombre: usuario.nombre,
    roles: usuario.rolActivo && usuario.idRol != null ? [usuario.idRol] : [],
    permisos: permiso && usuario.idRol != null ? [permiso] : [],
  };
}

/** Actor vinculado a la sesión autenticada, o null si aún no fue resuelto. */
export function cxpActor(res: Response): ActorProceso | null {
  return (res.locals.cxpActor as ActorProceso | undefined) ?? null;
}

/** Exige el actor que fijó el middleware de sesión CXP. */
export const exigirActor: RequestHandler = (_req, res, next) => {
  if (!cxpActor(res)) return next(new CxpError('No hay usuario CXP activo en la sesión', 401));
  next();
};

/** En RF07–RF10 se requiere un rol activo; cada acción exige además su capacidad. */
export const exigirRolProceso: RequestHandler = (_req, res, next) => {
  const actor = cxpActor(res);
  if (!actor) return next(new CxpError('No hay usuario CXP activo en la sesión', 401));
  if (!actor.roles.length) return next(new CxpError('El usuario CXP no tiene un rol activo para procesos de pago', 401));
  next();
};
