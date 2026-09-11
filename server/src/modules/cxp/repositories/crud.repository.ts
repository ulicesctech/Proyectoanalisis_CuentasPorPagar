import oracledb, { type Connection, type BindParameters, type ExecuteOptions } from 'oracledb';
import { getConnection } from '../../../config/database';
import { getCxpEntity, type CxpRecord, type CxpResource, type CxpValue } from '@erp/contracts';
import { CXP_TABLES } from './definitions';

type OracleRow = Record<string, string | number | null>;

function selection(resource: CxpResource): string {
  return Object.values(CXP_TABLES[resource].columns).map(({ column, type }) => {
    if (type === 'DATE') return `TO_CHAR(${column}, 'YYYY-MM-DD') AS ${column}`;
    if (type === 'TIMESTAMP') return `TO_CHAR(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.FF6') AS ${column}`;
    return column;
  }).join(', ');
}

function options(resource: CxpResource): ExecuteOptions {
  const fetchInfo: Record<string, { type: typeof oracledb.STRING }> = {};
  for (const { column, type } of Object.values(CXP_TABLES[resource].columns)) {
    if (type === 'CLOB') fetchInfo[column] = { type: oracledb.STRING };
  }
  return { outFormat: oracledb.OUT_FORMAT_OBJECT, fetchInfo };
}

function mapRow(resource: CxpResource, row: OracleRow): CxpRecord {
  return Object.fromEntries(Object.entries(CXP_TABLES[resource].columns).map(([name, { column, type }]) => {
    const value = row[column] ?? null;
    return [name, type === 'CHAR' && typeof value === 'string' ? value.trim() : value];
  }));
}

function parameter(type: string, value: CxpValue): oracledb.BindParameter {
  return { val: value, type: type === 'NUMBER' ? oracledb.NUMBER : type === 'CLOB' ? oracledb.CLOB : oracledb.STRING };
}

function valueExpression(type: string, bind: string): string {
  if (type === 'DATE') return `TO_DATE(:${bind}, 'YYYY-MM-DD')`;
  if (type === 'TIMESTAMP') return `TO_TIMESTAMP(:${bind}, 'YYYY-MM-DD"T"HH24:MI:SS.FF6')`;
  return `:${bind}`;
}

function normalized(type: string, value: CxpValue): CxpValue {
  if (type !== 'TIMESTAMP' || value === null) return value;
  let text = String(value);
  if (text.length === 16) text += ':00';
  const [time, fraction = ''] = text.split('.');
  return `${time}.${fraction.padEnd(6, '0')}`;
}

/** Los identificadores SQL provienen exclusivamente de las definiciones del módulo. */
export function createCxpRepository(resource: CxpResource) {
  const definition = CXP_TABLES[resource];
  const entity = getCxpEntity(resource)!;

  const bind = (connection: Connection) => ({
    async findById(id: number, lock = false): Promise<CxpRecord | null> {
      const result = await connection.execute<OracleRow>(
        `SELECT ${selection(resource)} FROM ${definition.table} WHERE ${definition.idColumn} = :id${lock ? ' FOR UPDATE' : ''}`,
        { id }, options(resource),
      );
      return result.rows?.[0] ? mapRow(resource, result.rows[0]) : null;
    },

    async create(input: CxpRecord): Promise<number> {
      const names = Object.keys(input).filter(name => definition.columns[name] && name !== entity.idField && input[name] !== undefined);
      const binds: BindParameters = { newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } };
      names.forEach((name, index) => {
        const type = definition.columns[name].type;
        binds[`v${index}`] = parameter(type, normalized(type, input[name]));
      });
      const result = await connection.execute<{ newId: number[] }>(
        `INSERT INTO ${definition.table} (${names.map(name => definition.columns[name].column).join(', ')})
         VALUES (${names.map((name, index) => valueExpression(definition.columns[name].type, `v${index}`)).join(', ')})
         RETURNING ${definition.idColumn} INTO :newId`, binds,
      );
      return result.outBinds!.newId[0];
    },

    async update(id: number, input: CxpRecord): Promise<void> {
      const names = Object.keys(input).filter(name => definition.columns[name] && name !== entity.idField && input[name] !== undefined && name !== 'fechaModificacion');
      const binds: BindParameters = { id };
      const assignments = names.map((name, index) => {
        const { column, type } = definition.columns[name];
        binds[`v${index}`] = parameter(type, normalized(type, input[name]));
        return `${column} = ${valueExpression(type, `v${index}`)}`;
      });
      if (definition.columns.fechaModificacion) assignments.push('FECHA_MODIFICACION = SYSTIMESTAMP');
      if (!assignments.length) return;
      await connection.execute(`UPDATE ${definition.table} SET ${assignments.join(', ')} WHERE ${definition.idColumn} = :id`, binds);
    },

    async remove(id: number): Promise<void> {
      await connection.execute(`DELETE FROM ${definition.table} WHERE ${definition.idColumn} = :id`, { id });
    },
  });

  return {
    resource,
    bind,
    async findAll(params: { page: number; limit: number; search?: string; filterField?: string; filterValue?: string }) {
      const connection = await getConnection();
      try {
        const clauses: string[] = [];
        const binds: BindParameters = {};
        if (params.search) {
          const searchable = entity.fields.filter(field => field.type === 'text' && !field.readOnly).map(field => definition.columns[field.name].column);
          const terms = [`TO_CHAR(${definition.idColumn}) LIKE :search`, ...searchable.map(column => `UPPER(${column}) LIKE UPPER(:search)`)];
          clauses.push(`(${terms.join(' OR ')})`);
          binds.search = `%${params.search}%`;
        }
        if (params.filterField && params.filterValue !== undefined) {
          const field = definition.columns[params.filterField];
          if (!field) throw new Error('Filtro sin definición');
          clauses.push(`${field.column} = :filterValue`);
          binds.filterValue = field.type === 'NUMBER' ? Number(params.filterValue) : params.filterValue;
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const rows = await connection.execute<OracleRow>(
          `SELECT ${selection(resource)} FROM ${definition.table} ${where}
           ORDER BY ${definition.idColumn} DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
          { ...binds, offset: (params.page - 1) * params.limit, limit: params.limit }, options(resource),
        );
        const count = await connection.execute<{ TOTAL: number }>(`SELECT COUNT(*) AS TOTAL FROM ${definition.table} ${where}`, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return { data: (rows.rows ?? []).map(row => mapRow(resource, row)), total: count.rows?.[0]?.TOTAL ?? 0 };
      } finally {
        await connection.close();
      }
    },
    async findById(id: number) {
      const connection = await getConnection();
      try { return await bind(connection).findById(id); }
      finally { await connection.close(); }
    },
  };
}

export async function withCxpTransaction<T>(operation: (connection: Connection) => Promise<T>): Promise<T> {
  const connection = await getConnection();
  try {
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export type CxpRepository = ReturnType<typeof createCxpRepository>;
