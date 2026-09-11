import oracledb, { type BindParameters, type Connection } from 'oracledb';
import type { CxpOption } from '@erp/contracts';
import { getConnection } from '../../../config/database';
import { CXP_CATALOGS } from './definitions';
import { CxpError } from '../services/errors';

const columnsCache = new Map<string, { expires: number; columns: string[] }>();

async function labelColumns(connection: Connection, catalog: string): Promise<string[]> {
  const definition = CXP_CATALOGS[catalog];
  const cached = columnsCache.get(definition.table);
  if (cached && cached.expires > Date.now()) return cached.columns;
  const result = await connection.execute<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS
     WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AND TABLE_NAME = :tableName
       AND DATA_TYPE IN ('VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR', 'NUMBER')`,
    { tableName: definition.table }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const available = new Set((result.rows ?? []).map(row => row.COLUMN_NAME));
  const columns = definition.labelCandidates.filter(column => available.has(column) && column !== definition.key);
  columnsCache.set(definition.table, { columns, expires: Date.now() + 60000 });
  return columns;
}

// Filtros explícitos para relaciones dependientes. Ningún identificador llega del cliente.
const filters: Record<string, Record<string, { column: string; numeric: boolean }>> = {
  'cuentas-bancarias': { idProveedor: { column: 'ID_PROVEEDOR', numeric: true }, tipoTitular: { column: 'TIPO_TITULAR', numeric: false } },
  documentos: { idProveedor: { column: 'ID_PROVEEDOR', numeric: true }, naturaleza: { column: 'NATURALEZA', numeric: false } },
  'documentos-detalle': { idDocumento: { column: 'ID_DOCUMENTO', numeric: true } },
  pagos: { idProveedor: { column: 'ID_PROVEEDOR', numeric: true } },
};

export async function listCxpOptions(catalog: string, query: { search?: string; selected?: string; filterField?: string; filterValue?: string }): Promise<CxpOption[]> {
  if (!Object.hasOwn(CXP_CATALOGS, catalog)) throw new CxpError('Catálogo no encontrado', 404);
  const definition = CXP_CATALOGS[catalog];
  const connection = await getConnection();
  try {
    const descriptiveColumns = await labelColumns(connection, catalog);
    const key = definition.numeric ? `TO_CHAR(${definition.key})` : definition.key;
    const label = `'${definition.label.replace(/'/g, "''")} #' || ${key}` + descriptiveColumns.map(column => ` || CASE WHEN ${column} IS NOT NULL THEN ' · ' || ${column} END`).join('');
    const binds: BindParameters = {};
    const clauses: string[] = [];
    if (query.search) {
      clauses.push(`UPPER(${label}) LIKE UPPER(:search)`);
      binds.search = `%${query.search.slice(0, 150)}%`;
    }
    if (query.filterField && query.filterValue !== undefined && query.filterValue !== '') {
      const filter = filters[catalog]?.[query.filterField];
      if (!filter) throw new CxpError('Filtro de catálogo inválido');
      const value = filter.numeric ? Number(query.filterValue) : query.filterValue;
      if (filter.numeric && (!Number.isSafeInteger(value) || Number(value) <= 0)) throw new CxpError('Identificador de filtro inválido');
      clauses.push(`${filter.column} = :filterValue`);
      binds.filterValue = value;
    }
    let where = clauses.length ? clauses.join(' AND ') : '1 = 1';
    let order = definition.key;
    if (query.selected !== undefined && query.selected !== '') {
      const selected = definition.numeric ? Number(query.selected) : query.selected;
      if (definition.numeric && (!Number.isSafeInteger(selected) || Number(selected) <= 0)) throw new CxpError('Identificador seleccionado inválido');
      binds.selected = selected;
      where = `(${where}) OR ${definition.key} = :selected`;
      order = `CASE WHEN ${definition.key} = :selected THEN 0 ELSE 1 END, ${definition.key}`;
    }
    const result = await connection.execute<{ ID: string | number; LABEL: string }>(
      `SELECT ${definition.key} AS ID, ${label} AS LABEL FROM ${definition.table}
       WHERE ${where} ORDER BY ${order} FETCH FIRST 50 ROWS ONLY`, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return (result.rows ?? []).map(row => ({ id: row.ID, label: row.LABEL }));
  } finally {
    await connection.close();
  }
}
