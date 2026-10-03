import oracledb, { type BindParameters } from 'oracledb';
import { getConnection } from '../../../../config/database';
import { CXP_TABLES } from '../definitions';
import { createCxpRepository, mapRow, options, selection } from '../crud.repository';
import type { Connection } from 'oracledb';
import type { CxpRecord, CxpResource } from '@erp/contracts';

export const cxpDocumentoRepository = createCxpRepository('documentos');

export type DocumentoDuplicate = { campo: 'uuidFiscal' | 'hashOrigen' | 'numeroDocumento'; idDocumento: number };

export async function findDocumentoDuplicate(connection: Connection, input: CxpRecord, excludeId?: number): Promise<DocumentoDuplicate | null> {
  const probes: { campo: DocumentoDuplicate['campo']; where: string; binds: Record<string, string | number> }[] = [];
  if (input.uuidFiscal) probes.push({ campo: 'uuidFiscal', where: 'UUID_FISCAL = :value', binds: { value: String(input.uuidFiscal) } });
  if (input.hashOrigen) probes.push({ campo: 'hashOrigen', where: 'HASH_ORIGEN = :value', binds: { value: String(input.hashOrigen) } });
  // El índice UX_CXP_DOC_DUPLICADO solo contiene documentos no anulados.
  // Una clave incompleta no se presenta como coincidencia exacta de cuatro campos.
  if (input.estado !== 'ANULADA' && input.idProveedor != null && input.tipoDocumento && input.serie && input.numeroDocumento) {
    probes.push({
      campo: 'numeroDocumento',
      where: "ESTADO <> 'ANULADA' AND ID_PROVEEDOR = :idProveedorDuplicado AND SERIE = :serieDuplicada AND NUMERO_DOCUMENTO = :numeroDocumentoDuplicado AND TIPO_DOCUMENTO = :tipoDocumentoDuplicado",
      binds: {
        idProveedorDuplicado: Number(input.idProveedor),
        serieDuplicada: String(input.serie),
        numeroDocumentoDuplicado: String(input.numeroDocumento),
        tipoDocumentoDuplicado: String(input.tipoDocumento),
      },
    });
  }
  for (const probe of probes) {
    const result = await connection.execute<{ ID_DOCUMENTO: number }>(
      `SELECT ID_DOCUMENTO FROM CXP_DOCUMENTO WHERE ${probe.where}${excludeId ? ' AND ID_DOCUMENTO <> :excluded' : ''} FETCH FIRST 1 ROW ONLY`,
      excludeId ? { ...probe.binds, excluded: excludeId } : probe.binds,
    );
    if (result.rows?.[0]) return { campo: probe.campo, idDocumento: result.rows[0].ID_DOCUMENTO };
  }
  return null;
}

export async function getDocumentoComponents(connection: Connection, idDocumento: number) {
  const details = await connection.execute<Record<string, string | number | null>>(
    `SELECT ID_DETALLE, ID_DOCUMENTO, NUMERO_LINEA, DESCRIPCION, CANTIDAD, UNIDAD_MEDIDA,
            PRECIO_UNITARIO, DESCUENTO, SUBTOTAL, IMPUESTO, RETENCION, TOTAL_LINEA
       FROM CXP_DOCUMENTO_DETALLE WHERE ID_DOCUMENTO = :id ORDER BY NUMERO_LINEA`, { id: idDocumento },
  );
  const tributes = await connection.execute<Record<string, string | number | null>>(
    `SELECT ID_TRIBUTO, ID_DOCUMENTO, ID_DETALLE, TIPO_TRIBUTO, CODIGO_TRIBUTO, NOMBRE_TRIBUTO,
            BASE_IMPONIBLE, PORCENTAJE, MONTO, MONTO_RECUPERABLE, MONTO_NO_RECUPERABLE,
            INCLUIDO_PRECIO, TO_CHAR(FECHA_APLICACION, 'YYYY-MM-DD') AS FECHA_APLICACION,
            GENERADO_POR, ESTADO
       FROM CXP_DOCUMENTO_TRIBUTO WHERE ID_DOCUMENTO = :id`, { id: idDocumento },
  );
  return { details: details.rows ?? [], tributes: tributes.rows ?? [] };
}

type DocumentoListFilters = {
  page: number;
  limit: number;
  search?: string;
  estado?: string;
  idProveedor?: number;
  venceHasta?: string;
};

type OracleRow = Record<string, string | number | null>;

export async function listDocumentosWithConnection(connection: Connection, filters: DocumentoListFilters) {
  const clauses: string[] = [];
  const binds: BindParameters = {};
  if (filters.search) {
    clauses.push(`(TO_CHAR(ID_DOCUMENTO) LIKE :search OR UPPER(SERIE) LIKE UPPER(:search)
      OR UPPER(NUMERO_DOCUMENTO) LIKE UPPER(:search) OR UPPER(UUID_FISCAL) LIKE UPPER(:search))`);
    binds.search = `%${filters.search}%`;
  }
  if (filters.estado) { clauses.push('ESTADO = :estado'); binds.estado = filters.estado; }
  if (filters.idProveedor) { clauses.push('ID_PROVEEDOR = :idProveedor'); binds.idProveedor = filters.idProveedor; }
  if (filters.venceHasta) { clauses.push("FECHA_VENCIMIENTO < TO_DATE(:venceHasta, 'YYYY-MM-DD') + 1"); binds.venceHasta = filters.venceHasta; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await connection.execute<OracleRow>(
    `SELECT D.*, P.PRO_NOMBRE_ENTIDAD AS PROVEEDOR_NOMBRE
       FROM (SELECT ${selection('documentos')} FROM CXP_DOCUMENTO ${where}
             ORDER BY ID_DOCUMENTO DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY) D
       LEFT JOIN PROVEEDOR P ON P.PRO_ID_PROVEEDOR = D.ID_PROVEEDOR
       ORDER BY D.ID_DOCUMENTO DESC`,
    { ...binds, offset: (filters.page - 1) * filters.limit, limit: filters.limit }, options('documentos'),
  );
  const count = await connection.execute<{ TOTAL: number }>(
    `SELECT COUNT(*) AS TOTAL FROM CXP_DOCUMENTO ${where}`, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return {
    data: (rows.rows ?? []).map(row => {
      const documento = mapRow('documentos', row);
      documento.proveedorNombre = row.PROVEEDOR_NOMBRE ?? null;
      return documento;
    }),
    total: count.rows?.[0]?.TOTAL ?? 0,
  };
}

export async function listDocumentos(filters: DocumentoListFilters) {
  const connection = await getConnection();
  try { return await listDocumentosWithConnection(connection, filters); }
  finally { await connection.close(); }
}

async function documentRows(connection: Connection, resource: CxpResource, where: string, id: number, order: string) {
  const table = CXP_TABLES[resource];
  const result = await connection.execute<OracleRow>(
    `SELECT ${selection(resource)} FROM ${table.table} WHERE ${where} ORDER BY ${order}`,
    { id }, options(resource),
  );
  return (result.rows ?? []).map(row => mapRow(resource, row));
}

export async function getDocumentoExpedienteWithConnection(connection: Connection, id: number) {
  const documento = await cxpDocumentoRepository.bind(connection).findById(id);
  if (!documento) return null;
  const provider = documento.idProveedor == null ? null : await connection.execute<{ PRO_NOMBRE_ENTIDAD: string | null }>(
    'SELECT PRO_NOMBRE_ENTIDAD FROM PROVEEDOR WHERE PRO_ID_PROVEEDOR = :id',
    { id: documento.idProveedor }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const lineas = await documentRows(connection, 'documentos-detalle', 'ID_DOCUMENTO = :id', id, 'NUMERO_LINEA');
  const tributos = await documentRows(connection, 'documentos-tributos', 'ID_DOCUMENTO = :id', id, 'ID_TRIBUTO');
  const aplicaciones = await documentRows(connection, 'aplicaciones',
    'ID_DOCUMENTO_DESTINO = :id OR ID_DOCUMENTO_ORIGEN = :id', id, 'ID_APLICACION');
  const archivos = await documentRows(connection, 'archivos',
    `ID_DOCUMENTO = :id OR ID_APLICACION IN
      (SELECT ID_APLICACION FROM CXP_APLICACION WHERE ID_DOCUMENTO_DESTINO = :id OR ID_DOCUMENTO_ORIGEN = :id)`,
    id, 'ID_ARCHIVO');
  return {
    documento: { ...documento, proveedorNombre: provider?.rows?.[0]?.PRO_NOMBRE_ENTIDAD ?? null },
    lineas, tributos, archivos, aplicaciones,
  };
}

export async function getDocumentoExpediente(id: number) {
  const connection = await getConnection();
  try { return await getDocumentoExpedienteWithConnection(connection, id); }
  finally { await connection.close(); }
}
