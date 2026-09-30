import oracledb, { type BindParameters, type Connection } from 'oracledb';
import { getConnection } from '../../../config/database';
import { withCxpTransaction } from '../repositories/crud.repository';
import { CxpError } from './errors';

export async function checkNitDuplicado(connection: Connection, nit: string, excludeId?: number): Promise<void> {
  const cleanNit = nit.trim().toUpperCase();
  if (!cleanNit) throw new CxpError('El NIT es obligatorio');
  const binds: BindParameters = { nit: cleanNit };
  let sql = 'SELECT PRO_ID_PROVEEDOR FROM PROVEEDOR WHERE UPPER(TRIM(PRO_NIT)) = :nit';
  if (excludeId) {
    sql += ' AND PRO_ID_PROVEEDOR <> :excludeId';
    binds.excludeId = excludeId;
  }
  const result = await connection.execute<{ PRO_ID_PROVEEDOR: number }>(
    sql,
    binds,
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  if ((result.rows?.length ?? 0) > 0) {
    throw new CxpError('NIT repetido rechazado. El NIT ya se encuentra registrado.', 400);
  }
}

export async function listProveedoresCxp() {
  const connection = await getConnection();
  try {
    const result = await connection.execute<{
      ID_PROVEEDOR: number;
      NIT: string;
      NOMBRE_ENTIDAD: string;
      ACTIVO: number;
      CUENTAS_APROBADAS: number;
      ARCHIVOS_RESPALDO: number;
    }>(
      `SELECT p.PRO_ID_PROVEEDOR AS ID_PROVEEDOR,
              p.PRO_NIT AS NIT,
              p.PRO_NOMBRE_ENTIDAD AS NOMBRE_ENTIDAD,
              p.PRO_ACTIVO AS ACTIVO,
              (SELECT COUNT(*) FROM CXP_CUENTA_BANCARIA cb WHERE cb.ID_PROVEEDOR = p.PRO_ID_PROVEEDOR AND cb.ESTADO = 'ACTIVA' AND cb.ESTADO_APROBACION = 'APROBADA') AS CUENTAS_APROBADAS,
              (SELECT COUNT(*) FROM CXP_ARCHIVO a WHERE a.ID_PROVEEDOR = p.PRO_ID_PROVEEDOR) AS ARCHIVOS_RESPALDO
       FROM PROVEEDOR p
       ORDER BY p.PRO_ID_PROVEEDOR DESC`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return (result.rows ?? []).map(row => ({
      idProveedor: row.ID_PROVEEDOR,
      nit: row.NIT,
      nombreEntidad: row.NOMBRE_ENTIDAD,
      activo: row.ACTIVO === 1,
      cuentasAprobadas: Number(row.CUENTAS_APROBADAS),
      archivosRespaldo: Number(row.ARCHIVOS_RESPALDO),
      datosCompletosCxP: Number(row.CUENTAS_APROBADAS) > 0,
    }));
  } finally {
    await connection.close();
  }
}

export async function createProveedorCxp(data: { nit: string; nombreEntidad: string; activo?: boolean }) {
  const nit = data.nit?.trim();
  const nombreEntidad = data.nombreEntidad?.trim();
  if (!nit) throw new CxpError('El NIT es obligatorio');
  if (!nombreEntidad) throw new CxpError('La razón social o nombre de la entidad es obligatorio');

  return withCxpTransaction(async connection => {
    await checkNitDuplicado(connection, nit);
    const binds: BindParameters = {
      nit,
      nombre: nombreEntidad,
      activo: data.activo === false ? 0 : 1,
      newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
    };
    const result = await connection.execute<{ newId: number[] }>(
      `INSERT INTO PROVEEDOR (PRO_NIT, PRO_NOMBRE_ENTIDAD, PRO_ACTIVO)
       VALUES (:nit, :nombre, :activo)
       RETURNING PRO_ID_PROVEEDOR INTO :newId`,
      binds,
      { autoCommit: false }
    );
    const id = result.outBinds?.newId?.[0];
    return {
      idProveedor: id,
      nit,
      nombreEntidad,
      activo: data.activo !== false,
      mensaje: 'Proveedor registrado correctamente en CxP',
    };
  });
}
