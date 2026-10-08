import type { RequestHandler } from 'express';
import oracledb from 'oracledb';
import type { ActorProceso } from '@erp/contracts';

import { getConnection } from '../../../../config/database';
import { CxpError } from '../errors';

type UsuarioProcesoRow = {
  ID: number;
  NOMBRE: string;
  ROL: number;
  ROL_NOMBRE: string;
};

async function buscarUsuario(
  id: number,
): Promise<UsuarioProcesoRow | null> {
  const connection = await getConnection();

  try {
    const result = await connection.execute<UsuarioProcesoRow>(
      `SELECT
          u.USU_ID_USUARIO AS ID,
          u.USU_NOMBRE_COMPLETO AS NOMBRE,
          u.USU_ID_ROL AS ROL,
          r.ROL_NOMBRE_ROL AS ROL_NOMBRE
       FROM USUARIO u
       JOIN ROL r
         ON r.ROL_ID_ROL = u.USU_ID_ROL
       WHERE u.USU_ID_USUARIO = :id
         AND u.USU_ACTIVO = 1
         AND r.ROL_ACTIVO = 1`,
      { id },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      },
    );

    return result.rows?.[0] ?? null;
  } finally {
    await connection.close();
  }
}

function actorDesdeUsuario(
  row: UsuarioProcesoRow,
): ActorProceso {
  /*
   * El ERP general todavía no posee una matriz central
   * de permisos por módulo.
   *
   * Para esta integración:
   * - El usuario y su rol vienen directamente de Oracle.
   * - RF10 valida el rol contra CXP_APROBACION.
   * - El workflow mantiene segregación de funciones por usuario.
   *
   * Cuando exista autenticación/autorización global,
   * los permisos deberán provenir de esa capa.
   */
  return {
    id: Number(row.ID),
    nombre: row.NOMBRE,
    roles: [Number(row.ROL)],
    permisos: [
      'CREAR',
      'APROBAR',
      'TESORERIA',
      'ANULAR',
    ],
  };
}

export const listProcessActors: RequestHandler = async (
  _req,
  res,
  next,
) => {
  let connection: oracledb.Connection | undefined;

  try {
    connection = await getConnection();

    const result = await connection.execute<UsuarioProcesoRow>(
      `SELECT
          u.USU_ID_USUARIO AS ID,
          u.USU_NOMBRE_COMPLETO AS NOMBRE,
          u.USU_ID_ROL AS ROL,
          r.ROL_NOMBRE_ROL AS ROL_NOMBRE
       FROM USUARIO u
       JOIN ROL r
         ON r.ROL_ID_ROL = u.USU_ID_ROL
       WHERE u.USU_ACTIVO = 1
         AND r.ROL_ACTIVO = 1
       ORDER BY u.USU_NOMBRE_COMPLETO`,
      {},
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      },
    );

    res.json(
      (result.rows ?? []).map(row => ({
        ...actorDesdeUsuario(row),
        rolNombre: row.ROL_NOMBRE,
      })),
    );
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
};

export const requireProcessActor: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const raw = req.header('X-CXP-Actor-Id');
    const id = Number(raw);

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new CxpError(
        'Selecciona el usuario con el que estás operando',
        401,
      );
    }

    const usuario = await buscarUsuario(id);

    if (!usuario) {
      throw new CxpError(
        'El usuario seleccionado no existe o está inactivo',
        401,
      );
    }

    res.locals.processActor = actorDesdeUsuario(usuario);
    res.setHeader('Cache-Control', 'no-store');

    next();
  } catch (error) {
    next(error);
  }
};