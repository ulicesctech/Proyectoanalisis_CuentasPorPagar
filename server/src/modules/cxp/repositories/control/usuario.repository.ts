import oracledb, { type Connection } from 'oracledb';
import { getConnection } from '../../../../config/database';

/**
 * Usuario activo que puede operar en CXP. Solo lectura de USUARIO.
 * Los roles no se usan por ahora: basta con que el usuario exista y esté activo.
 */
export type UsuarioOperativoRow = {
  idUsuario: number;
  nombre: string;
};

type OracleRow = { ID: number; NOMBRE: string | null };

const SELECT_OPERATIVOS = `
  SELECT U.USU_ID_USUARIO AS ID, U.USU_NOMBRE_COMPLETO AS NOMBRE
    FROM USUARIO U
   WHERE U.USU_ACTIVO = 1`;

function map(row: OracleRow): UsuarioOperativoRow {
  return {
    idUsuario: Number(row.ID),
    nombre: row.NOMBRE == null ? `Usuario #${row.ID}` : String(row.NOMBRE),
  };
}

export async function findUsuarioOperativoWithConnection(connection: Connection, idUsuario: number): Promise<UsuarioOperativoRow | null> {
  const result = await connection.execute<OracleRow>(
    `${SELECT_OPERATIVOS} AND U.USU_ID_USUARIO = :idUsuario`,
    { idUsuario }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return result.rows?.[0] ? map(result.rows[0]) : null;
}

export async function findUsuarioOperativo(idUsuario: number): Promise<UsuarioOperativoRow | null> {
  const connection = await getConnection();
  try { return await findUsuarioOperativoWithConnection(connection, idUsuario); }
  finally { await connection.close(); }
}

export async function listUsuariosOperativos(): Promise<UsuarioOperativoRow[]> {
  const connection = await getConnection();
  try {
    const result = await connection.execute<OracleRow>(
      `${SELECT_OPERATIVOS} ORDER BY U.USU_ID_USUARIO`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return (result.rows ?? []).map(map);
  } finally { await connection.close(); }
}
