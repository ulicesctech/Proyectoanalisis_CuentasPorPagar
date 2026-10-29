import type { RequestHandler, Response } from 'express';
import type { ActorProceso } from '@erp/contracts';
import { config, type CxpAuthMode } from '../../../config';
import {
  findUsuarioOperativo, listUsuariosOperativos, type UsuarioOperativoRow,
} from '../repositories/control/usuario.repository';
import { CxpError } from './errors';

/*
 * Identidad única del módulo CXP.
 *
 * Modo provisional: el usuario se declara con X-CXP-Actor-Id. Se valida que exista
 * y que esté activo, pero NO se comprueba que la persona sea
 * quien dice ser. La autoría de la bitácora no es prueba hasta que exista inicio
 * de sesión. Los roles no se usan por ahora: `roles` queda vacío (el contrato
 * ActorProceso lo conserva) y ninguna operación depende de él.
 *
 * Mientras no exista una matriz de permisos por rol, todo usuario operativo recibe
 * los mismos permisos; la segregación de funciones la aplica cada flujo.
 */
const PERMISOS_PROVISIONALES: ActorProceso['permisos'] = ['CREAR', 'APROBAR', 'TESORERIA', 'ANULAR'];

export const ACTOR_HEADER = 'X-CXP-Actor-Id';

export function actorDesdeUsuario(usuario: UsuarioOperativoRow): ActorProceso {
  return {
    id: usuario.idUsuario,
    nombre: usuario.nombre,
    roles: [],
    permisos: [...PERMISOS_PROVISIONALES],
  };
}

/** Actor resuelto para la petición, o null si no se envió identidad. */
export function cxpActor(res: Response): ActorProceso | null {
  return (res.locals.cxpActor as ActorProceso | undefined) ?? null;
}

/** El listado de usuarios para elegir "Operando como" solo existe en el modo provisional. */
export function listadoUsuariosDisponible(mode: CxpAuthMode = config.cxpAuthMode): boolean {
  return mode === 'provisional';
}

/**
 * Resuelve el actor en todo /api/cxp. Sin encabezado, el actor queda en null y cada
 * ruta decide si lo exige. Un encabezado inválido o de un usuario no operativo es 401.
 */
export function createResolverActor(
  find: (id: number) => Promise<UsuarioOperativoRow | null> = findUsuarioOperativo,
): RequestHandler {
  return async (req, res, next) => {
    try {
      res.locals.cxpActor = null;
      const raw = req.header(ACTOR_HEADER);
      if (raw === undefined || raw === '') return next();
      const id = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) {
        throw new CxpError('El usuario operativo indicado no es válido', 401);
      }
      const usuario = await find(id);
      if (!usuario) throw new CxpError('El usuario seleccionado no existe o está inactivo', 401);
      res.locals.cxpActor = actorDesdeUsuario(usuario);
      res.setHeader('Cache-Control', 'no-store');
      next();
    } catch (error) { next(error); }
  };
}

export const resolverActor = createResolverActor();

/** Exige un actor resuelto por resolverActor. */
export const exigirActor: RequestHandler = (_req, res, next) => {
  if (!cxpActor(res)) return next(new CxpError('Selecciona el usuario con el que estás operando', 401));
  next();
};

/** Oculta los listados de usuarios fuera del modo provisional. */
export function createExigirListadoUsuarios(mode: () => CxpAuthMode = () => config.cxpAuthMode): RequestHandler {
  return (_req, _res, next) => {
    if (!listadoUsuariosDisponible(mode())) return next(new CxpError('Recurso no disponible', 404));
    next();
  };
}

export const exigirListadoUsuarios = createExigirListadoUsuarios();

export async function listarUsuariosOperativos() {
  return (await listUsuariosOperativos()).map(actorDesdeUsuario);
}
