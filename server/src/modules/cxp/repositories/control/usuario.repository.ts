import oracledb, { type Connection } from 'oracledb';
import { getConnection } from '../../../../config/database';

/** Usuario activo con su rol real; los permisos se derivan del nombre en identidad.ts. */
export type UsuarioOperativoRow = {
  idUsuario: number;
  nombre: string;
  idRol: number | null;
  rolActivo: boolean;
  nombreRolNormalizado: string | null;
  coincidenciasNombreRol: number;
};

type OracleRow = {
  ID: number; NOMBRE: string | null; ID_ROL: number | null; ROL_ACTIVO: number | null;
  NOMBRE_ROL_NORMALIZADO: string | null; COINCIDENCIAS_NOMBRE_ROL: number | null;
};

const SELECT_OPERATIVOS = `
  SELECT U.USU_ID_USUARIO AS ID, U.USU_NOMBRE_COMPLETO AS NOMBRE,
         U.USU_ID_ROL AS ID_ROL, R.ROL_ACTIVO AS ROL_ACTIVO,
         REGEXP_REPLACE(UPPER(R.ROL_NOMBRE_ROL), '[[:space:]]', '') AS NOMBRE_ROL_NORMALIZADO,
         R.COINCIDENCIAS_NOMBRE_ROL
    FROM USUARIO U
    LEFT JOIN (
      SELECT ROL_ID_ROL, ROL_NOMBRE_ROL, ROL_ACTIVO,
             COUNT(*) OVER (PARTITION BY REGEXP_REPLACE(UPPER(ROL_NOMBRE_ROL), '[[:space:]]', ''))
               AS COINCIDENCIAS_NOMBRE_ROL
        FROM ROL
    ) R ON R.ROL_ID_ROL = U.USU_ID_ROL
   WHERE U.USU_ACTIVO = 1`;

function map(row: OracleRow): UsuarioOperativoRow {
  return {
    idUsuario: Number(row.ID),
    nombre: row.NOMBRE == null ? `Usuario #${row.ID}` : String(row.NOMBRE),
    idRol: row.ID_ROL == null ? null : Number(row.ID_ROL),
    rolActivo: Number(row.ROL_ACTIVO) === 1,
    nombreRolNormalizado: row.NOMBRE_ROL_NORMALIZADO == null ? null : String(row.NOMBRE_ROL_NORMALIZADO),
    coincidenciasNombreRol: Number(row.COINCIDENCIAS_NOMBRE_ROL ?? 0),
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
