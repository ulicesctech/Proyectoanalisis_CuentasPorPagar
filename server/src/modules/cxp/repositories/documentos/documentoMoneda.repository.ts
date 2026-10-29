import oracledb, { type Connection } from 'oracledb';
import { CXP_DOCUMENTO_MONEDA_LOCAL, type CxpDocumentoMonedas } from '@erp/contracts';
import { getConnection } from '../../../../config/database';
import { CxpError } from '../../services/errors';

export async function readDocumentoMonedas(connection: Connection): Promise<CxpDocumentoMonedas> {
  const result = await connection.execute<{ CODIGO: string; NOMBRE: string | null }>(
    `SELECT CODIGO, NOMBRE FROM MONEDA WHERE ESTADO = 'A' ORDER BY CODIGO`, {},
    { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return { monedaLocal: CXP_DOCUMENTO_MONEDA_LOCAL, fuenteTasas: null,
    monedas: (result.rows ?? []).map(row => ({ codigo: row.CODIGO, nombre: row.NOMBRE || row.CODIGO })) };
}
export async function documentoMonedas() {
  const connection = await getConnection();
  try { return await readDocumentoMonedas(connection); }
  finally { await connection.close(); }
}
export async function assertDocumentoMoneda(connection: Connection, currency: unknown) {
  const result = await connection.execute(
    `SELECT 1 AS PRESENTE FROM MONEDA WHERE CODIGO = :currency AND ESTADO = 'A'`, { currency: String(currency) },
    { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (!result.rows?.length) throw new CxpError('La moneda no está disponible', 422, [
    { campo: 'moneda', mensaje: 'Selecciona una moneda activa del catálogo.' },
  ]);
}
