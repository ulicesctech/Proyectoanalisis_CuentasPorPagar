import oracledb, { type Connection } from 'oracledb';
import type { CxpProveedorCoincidencias } from '@erp/contracts';
import { getConnection } from '../../../config/database';
import { CxpError } from './errors';

export async function proveedorIdentidadWithConnection(connection: Connection, query: { nit?: string; id?: string }): Promise<CxpProveedorCoincidencias> {
  const nit = (query.nit ?? '').trim().toUpperCase();
  if (nit.length > 20) throw new CxpError('El NIT admite hasta 20 caracteres', 400);
  const id = query.id ? Number(query.id) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id < 1)) throw new CxpError('Proveedor inválido', 400);
  if (id === null && nit.length < 2) return { proveedores: [], coincidenciasExactas: 0, limitado: false };
  const options = { outFormat: oracledb.OUT_FORMAT_OBJECT };
  const exact = id === null ? await connection.execute<{TOTAL:number}>(
    'SELECT COUNT(*) TOTAL FROM PROVEEDOR WHERE UPPER(TRIM(PRO_NIT))=:nit', {nit}, options) : null;
  const result = await connection.execute<{ID:number;NIT:string|null;NOMBRE:string;ACTIVO:number}>(
    `SELECT PRO_ID_PROVEEDOR ID, PRO_NIT NIT, PRO_NOMBRE_ENTIDAD NOMBRE, PRO_ACTIVO ACTIVO
     FROM PROVEEDOR WHERE ${id !== null ? 'PRO_ID_PROVEEDOR=:id' : 'INSTR(UPPER(TRIM(PRO_NIT)),:nit)>0'}
     ORDER BY ${id !== null ? '' : 'CASE WHEN UPPER(TRIM(PRO_NIT))=:nit THEN 0 ELSE 1 END,'} PRO_ID_PROVEEDOR FETCH FIRST 21 ROWS ONLY`,
    id !== null ? {id} : {nit}, options);
  return { proveedores: (result.rows ?? []).slice(0,20).map(row => ({idProveedor:row.ID,nit:row.NIT?.trim()||null,nombre:row.NOMBRE,activo:row.ACTIVO===1})),
    coincidenciasExactas: Number(exact?.rows?.[0]?.TOTAL ?? 0), limitado: (result.rows?.length ?? 0)>20 };
}
export async function proveedorIdentidad(query: { nit?: string; id?: string }) {
  const connection = await getConnection();
  try { return await proveedorIdentidadWithConnection(connection,query); } finally { await connection.close(); }
}
