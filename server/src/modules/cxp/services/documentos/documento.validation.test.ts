import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { cxpDocumentoRepository, findDocumentoDuplicate } from '../../repositories/documentos/documento.repository';
import { createCxpService } from '../crud.service';
import { createDocumentoValidationOperation } from './documento.service';
import { assertCxpDocumentoCalendarDates } from './documento.policy';
import type { DteStorage } from './dte.storage';

type Row = Record<string, string | number | null>;
const dteContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const dteUri = 'cxp-dte://00000000-0000-4000-8000-000000000001.pdf';
const dteRow = (idDocumento = 1): Row => ({
  ID_ARCHIVO: 9, ID_DOCUMENTO: idDocumento, CATEGORIA: 'DTE', NOMBRE_ARCHIVO: 'dte.pdf',
  TIPO_MIME: 'application/pdf', TAMANO_BYTES: dteContent.length,
  HASH_SHA256: createHash('sha256').update(dteContent).digest('hex'),
  URI_ALMACENAMIENTO: dteUri, VERSION_ARCHIVO: 1, ES_VERSION_ACTUAL: 'S',
  FECHA_CARGA: '2026-09-01T10:00:00',
});

const baseDocument = (): Row => ({
  ID_DOCUMENTO: 1, ID_PROVEEDOR: 2, ID_SUCURSAL: 3, TIPO_DOCUMENTO: 'FACTURA',
  ID_CONDICION_CREDITO: 41, NATURALEZA: 'D',
  ORIGEN_INGRESO: 'FACTURACION_ELECTRONICA', TIPO_REGISTRO: 'SIN_OC',
  SERIE: 'A', NUMERO_DOCUMENTO: '1', UUID_FISCAL: 'uuid-1', HASH_ORIGEN: 'hash-1',
  FECHA_DOCUMENTO: '2026-09-01', FECHA_VENCIMIENTO: '2026-09-01', DIAS_CREDITO: 0, MONEDA: 'GTQ', TIPO_CAMBIO: 1,
  SUBTOTAL: 100, DESCUENTO_TOTAL: 0, IMPUESTO_TOTAL: 0, RETENCION_TOTAL: 0,
  RECARGO_TOTAL: 0, GASTO_ADICIONAL_TOTAL: 0, DIFERENCIA_REDONDEO: 0,
  TOTAL_BRUTO: 100, TOTAL_NETO: 100, TOTAL_LOCAL: 100,
  MONTO_APLICADO: 0, SALDO_PENDIENTE: 100, ESTADO: 'RECIBIDO',
});

const baseLine = (): Row => ({
  ID_DETALLE: 10, ID_DOCUMENTO: 1, NUMERO_LINEA: 1, DESCRIPCION: 'Servicio',
  CANTIDAD: 1, UNIDAD_MEDIDA: 'UNIDAD', PRECIO_UNITARIO: 100,
  DESCUENTO: 0, SUBTOTAL: 100, IMPUESTO: 0, RETENCION: 0, TOTAL_LINEA: 100,
});

const taxTribute = (): Row => ({
  ID_TRIBUTO: 20, ID_DOCUMENTO: 1, ID_DETALLE: 10, TIPO_TRIBUTO: 'IMPUESTO',
  CODIGO_TRIBUTO: 'IVA', NOMBRE_TRIBUTO: 'IVA', BASE_IMPONIBLE: 100,
  PORCENTAJE: 10, MONTO: 10, MONTO_RECUPERABLE: 0, MONTO_NO_RECUPERABLE: 0,
  INCLUIDO_PRECIO: 'N', FECHA_APLICACION: '2026-09-01', GENERADO_POR: 4,
  ESTADO: 'CALCULADO',
});

function memory(options: { rows?: Row[]; lines?: Row[]; tributes?: Row[]; conditions?: Row[];
  files?: Row[]; fileContent?: Buffer | null; uniqueError?: string; updateError?: boolean } = {}) {
  let rows = (options.rows ?? []).map(row => ({ ...row }));
  const writes: string[] = [];
  const queries: string[] = [];
  const connection = {
    async execute(sql: string, binds: Record<string, unknown> = {}) {
      if (sql.includes('FROM CXC_CONDICIONES_CREDITO')) {
        const conditions = options.conditions ?? [{ ID_CONDICION: 41, DIAS_CREDITO: 0, ESTADO: 'A' }];
        const found = conditions.find(item => item.ID_CONDICION === binds.idCondicionCredito && item.ESTADO === 'A');
        return { rows: found ? [{ ID_CONDICION: found.ID_CONDICION, DIAS_CREDITO: found.DIAS_CREDITO }] : [] };
      }
      if (sql.startsWith('SELECT ID_DOCUMENTO FROM CXP_DOCUMENTO WHERE')) {
        const placeholders = [...sql.matchAll(/:([A-Za-z][A-Za-z0-9_$#]*)/g)].map(match => match[1]);
        assert.deepEqual([...new Set(placeholders)].sort(), Object.keys(binds).sort(), 'los placeholders deben coincidir con los binds enviados');
        assert.ok(placeholders.every(name => !['NUMBER', 'TYPE'].includes(name.toUpperCase())), 'el bind no puede usar una palabra reservada de Oracle');
        queries.push(sql);
        const match = rows.find(row => {
          if (binds.excluded === row.ID_DOCUMENTO) return false;
          if (sql.includes('UUID_FISCAL =')) return row.UUID_FISCAL === binds.value;
          if (sql.includes('HASH_ORIGEN =')) return row.HASH_ORIGEN === binds.value;
          return row.ESTADO !== 'ANULADA' && row.ID_PROVEEDOR === binds.idProveedorDuplicado &&
            row.TIPO_DOCUMENTO === binds.tipoDocumentoDuplicado && row.SERIE === binds.serieDuplicada &&
            row.NUMERO_DOCUMENTO === binds.numeroDocumentoDuplicado;
        });
        return { rows: match ? [{ ID_DOCUMENTO: match.ID_DOCUMENTO }] : [] };
      }
      if (sql.includes('FROM CXP_DOCUMENTO_DETALLE')) return { rows: options.lines ?? [] };
      if (sql.includes('FROM CXP_DOCUMENTO_TRIBUTO')) return { rows: options.tributes ?? [] };
      if (sql.includes('FROM CXP_ARCHIVO')) return {
        rows: (options.files ?? [dteRow()]).filter(row => row.ID_DOCUMENTO === binds.idDocumento),
      };
      if (sql.includes('FROM CXP_DOCUMENTO WHERE ID_DOCUMENTO = :id')) {
        const row = rows.find(item => item.ID_DOCUMENTO === binds.id);
        return { rows: row ? [{ ...row }] : [] };
      }
      if (sql.startsWith('INSERT INTO CXP_DOCUMENTO')) {
        if (options.uniqueError) {
          throw Object.assign(new Error(`ORA-00001: unique constraint (PROYECTOANALISIS.${options.uniqueError}) violated`), { errorNum: 1 });
        }
        const columns = sql.match(/INSERT INTO CXP_DOCUMENTO \(([^)]+)\)/)![1].split(', ');
        const row: Row = { ID_DOCUMENTO: rows.length + 1 };
        columns.forEach((column, index) => { row[column] = (binds[`v${index}`] as { val: string | number | null }).val; });
        rows.push(row);
        writes.push('INSERT');
        return { outBinds: { newId: [row.ID_DOCUMENTO] } };
      }
      if (sql.startsWith('UPDATE CXP_DOCUMENTO SET')) {
        if (options.updateError) throw new Error('Fallo durante UPDATE');
        const row = rows.find(item => item.ID_DOCUMENTO === binds.id)!;
        for (const match of sql.matchAll(/([A-Z_]+) = :v(\d+)/g)) row[match[1]] = (binds[`v${match[2]}`] as { val: string | number | null }).val;
        writes.push('UPDATE');
        return { rowsAffected: 1 };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  } as unknown as Connection;
  const run = (async <T>(operation: (connection: Connection) => Promise<T>): Promise<T> => {
    const before = structuredClone(rows);
    try { return await operation(connection); }
    catch (error) { rows = before; throw error; }
  }) as typeof import('../../repositories/crud.repository').withCxpTransaction;
  const storage: DteStorage = {
    async save() { throw new Error('No se espera una carga'); },
    async read(uri) {
      if (uri !== dteUri || options.fileContent === null) throw new Error('Archivo no disponible');
      return options.fileContent ?? dteContent;
    },
    async exists(uri) { return uri === dteUri && options.fileContent !== null; },
    async remove() { throw new Error('No se espera una eliminación'); },
  };
  return { connection, run, storage, writes, queries, get rows() { return rows; } };
}

const registration = {
  idProveedor: 2, idSucursal: 3, idCondicionCredito: 41, tipoDocumento: 'FACTURA',
  origenIngreso: 'FACTURACION_ELECTRONICA', serie: 'A', numeroDocumento: '1',
  uuidFiscal: 'uuid-1', hashOrigen: 'hash-1', fechaDocumento: '2026-09-01',
  subtotal: 100, creadoPor: 4,
};

test('el CRUD rechaza duplicados exactos por UUID, hash y combinación sin insertar', async () => {
  for (const change of [{}, { uuidFiscal: 'nuevo' }, { uuidFiscal: 'nuevo', hashOrigen: 'nuevo' }]) {
    const db = memory({ rows: [baseDocument()] });
    const service = createCxpService(cxpDocumentoRepository, db.run);
    await assert.rejects(service.create({ ...registration, ...change }), { status: 409 });
    assert.deepEqual(db.writes, []);
  }
});

test('dos documentos activos con la misma combinación se rechazan sin insertar', async () => {
  const db = memory({ rows: [baseDocument()] });
  await assert.rejects(
    createCxpService(cxpDocumentoRepository, db.run).create({ ...registration, uuidFiscal: 'uuid-2', hashOrigen: 'hash-2' }),
    (error: { status: number; details: { campo: string }[]; message: string }) =>
      error.status === 409 && error.details[0]?.campo === 'numeroDocumento' && error.message.includes('no anulado'),
  );
  assert.deepEqual(db.writes, []);
});

test('la consulta de duplicado usa binds Oracle válidos y exactamente alineados con el SQL', async () => {
  let executed = false;
  const connection = {
    async execute(sql: string, binds: Record<string, unknown>) {
      executed = true;
      const placeholders = [...sql.matchAll(/:([A-Za-z][A-Za-z0-9_$#]*)/g)].map(match => match[1]);
      assert.deepEqual([...new Set(placeholders)].sort(), Object.keys(binds).sort());
      assert.ok(!placeholders.some(name => ['NUMBER', 'TYPE'].includes(name.toUpperCase())));
      assert.match(sql, /NUMERO_DOCUMENTO = :numeroDocumentoDuplicado/);
      assert.deepEqual(binds, {
        idProveedorDuplicado: 2,
        serieDuplicada: 'A',
        numeroDocumentoDuplicado: '1',
        tipoDocumentoDuplicado: 'FACTURA',
      });
      return { rows: [] };
    },
  } as unknown as Connection;
  await findDocumentoDuplicate(connection, {
    idProveedor: 2, serie: 'A', numeroDocumento: '1', tipoDocumento: 'FACTURA', estado: 'RECIBIDO',
  });
  assert.equal(executed, true);
});

test('un documento ANULADA no impide reutilizar la combinación con UUID y hash nuevos', async () => {
  const db = memory({ rows: [{ ...baseDocument(), ESTADO: 'ANULADA' }] });
  const created = await createCxpService(cxpDocumentoRepository, db.run).create({
    ...registration, uuidFiscal: 'uuid-2', hashOrigen: 'hash-2',
  });
  assert.equal(created.estado, 'RECIBIDO');
  assert.deepEqual(db.writes, ['INSERT']);
  assert.ok(db.queries.some(sql => sql.includes("ESTADO <> 'ANULADA'")));
});

test('UUID y hash siguen siendo globales aunque el documento existente esté ANULADA', async () => {
  for (const change of [
    { hashOrigen: 'hash-2' },
    { uuidFiscal: 'uuid-2' },
  ]) {
    const db = memory({ rows: [{ ...baseDocument(), ESTADO: 'ANULADA' }] });
    await assert.rejects(
      createCxpService(cxpDocumentoRepository, db.run).create({ ...registration, ...change }),
      (error: { status: number; details: { campo: string }[] }) =>
        error.status === 409 && error.details[0]?.campo === (change.uuidFiscal ? 'hashOrigen' : 'uuidFiscal'),
    );
    assert.deepEqual(db.writes, []);
  }
});

test('una combinación incompleta no se presenta como coincidencia exacta de cuatro campos', async () => {
  for (const missing of [{ idProveedor: null }, { serie: null }, { numeroDocumento: null }, { tipoDocumento: null }]) {
    const db = memory({ rows: [{ ...baseDocument(), UUID_FISCAL: 'uuid-old', HASH_ORIGEN: 'hash-old' }] });
    const duplicate = await findDocumentoDuplicate(db.connection, {
      ...registration, estado: 'RECIBIDO', uuidFiscal: 'uuid-2', hashOrigen: 'hash-2', ...missing,
    });
    assert.equal(duplicate, null);
    assert.ok(db.queries.every(sql => !sql.includes('NUMERO_DOCUMENTO = :numeroDocumentoDuplicado')));
    assert.deepEqual(db.writes, []);
  }
});

test('un documento entrante ANULADA omite la combinación, pero conserva las claves globales', async () => {
  const db = memory({ rows: [baseDocument()] });
  const input = { ...registration, estado: 'ANULADA', uuidFiscal: 'uuid-2', hashOrigen: 'hash-2' };
  assert.equal(await findDocumentoDuplicate(db.connection, input), null);
  assert.ok(db.queries.every(sql => !sql.includes('NUMERO_DOCUMENTO = :numeroDocumentoDuplicado')));
  assert.deepEqual(await findDocumentoDuplicate(db.connection, { ...input, uuidFiscal: 'uuid-1' }), {
    campo: 'uuidFiscal', idDocumento: 1,
  });
});

test('ORA-00001 identifica UUID, hash e índice condicional cuando Oracle informa la clave', async () => {
  for (const [key, field] of [
    ['UK_CXP_DOC_UUID', 'uuidFiscal'],
    ['UK_CXP_DOC_HASH', 'hashOrigen'],
    ['UX_CXP_DOC_DUPLICADO', 'numeroDocumento'],
  ]) {
    const db = memory({ uniqueError: key });
    await assert.rejects(
      createCxpService(cxpDocumentoRepository, db.run).create(registration),
      (error: { status: number; details: { campo: string }[] }) => error.status === 409 && error.details[0]?.campo === field,
    );
    assert.deepEqual(db.writes, []);
  }
});

test('ORA-00001 del índice condicional con clave incompleta evita afirmar una combinación completa', async () => {
  const db = memory({ uniqueError: 'UX_CXP_DOC_DUPLICADO' });
  await assert.rejects(
    createCxpService(cxpDocumentoRepository, db.run).create({ ...registration, idProveedor: null }),
    (error: { status: number; details: { campo: string }[]; message: string }) =>
      error.status === 409 && error.details[0]?.campo === 'documento' && error.message.includes('incompleta'),
  );
  assert.deepEqual(db.writes, []);
});

test('ORA-00001 sin clave reconocible mantiene un conflicto genérico', async () => {
  const db = memory({ uniqueError: 'OTRA_CLAVE' });
  await assert.rejects(createCxpService(cxpDocumentoRepository, db.run).create(registration), {
    status: 409, details: [],
  });
  assert.deepEqual(db.writes, []);
});

test('un registro inicial válido entra como RECIBIDO', async () => {
  const db = memory();
  const result = await createCxpService(cxpDocumentoRepository, db.run).create(registration);
  assert.equal(result.estado, 'RECIBIDO');
  assert.equal(result.totalNeto, 100);
  assert.equal(result.diasCredito, 0);
  assert.equal(result.fechaVencimiento, '2026-09-01');
  assert.deepEqual(db.writes, ['INSERT']);
});

test('un documento débito admite vencimiento igual a su fecha', async () => {
  const db = memory();
  const result = await createCxpService(cxpDocumentoRepository, db.run).create({
    ...registration, naturaleza: 'D', fechaDocumento: '2020-01-15', fechaVencimiento: '2020-01-15',
  });
  assert.equal(result.estado, 'RECIBIDO');
  assert.deepEqual(db.writes, ['INSERT']);
});

test('un documento débito vencido es válido cuando sus fechas históricas son coherentes', async () => {
  const db = memory({ conditions: [{ ID_CONDICION: 42, DIAS_CREDITO: 31, ESTADO: 'A' }] });
  const result = await createCxpService(cxpDocumentoRepository, db.run).create({
    ...registration, idCondicionCredito: 42, naturaleza: 'D', fechaDocumento: '2020-01-15', fechaVencimiento: '2020-02-15',
  });
  assert.equal(result.fechaVencimiento, '2020-02-15');
  assert.equal(result.diasCredito, 31);
  assert.deepEqual(db.writes, ['INSERT']);
});

test('el servidor rechaza vencimiento anterior al documento débito sin insertar', async () => {
  const db = memory();
  await assert.rejects(createCxpService(cxpDocumentoRepository, db.run).create({
    ...registration, naturaleza: 'D', fechaDocumento: '2020-02-15', fechaVencimiento: '2020-02-14',
  }), (error: { status: number; details: { campo: string }[] }) =>
    [400, 422].includes(error.status) && error.details.some(issue => issue.campo === 'fechaVencimiento'));
  assert.deepEqual(db.writes, []);
});

test('una condición de crédito activa calcula días calendario sin sumar días de gracia y conserva la fotografía', async () => {
  const db = memory({ conditions: [{ ID_CONDICION: 43, DIAS_CREDITO: 45, DIAS_GRACIA: 30, ESTADO: 'A' }] });
  const result = await createCxpService(cxpDocumentoRepository, db.run).create({
    ...registration, idCondicionCredito: 43, fechaDocumento: '2026-01-20',
  });
  assert.equal(result.idCondicionCredito, 43);
  assert.equal(result.diasCredito, 45);
  assert.equal(result.fechaVencimiento, '2026-03-06');
  assert.deepEqual(db.writes, ['INSERT']);
});

test('una condición ausente o inactiva impide el alta sin escrituras', async () => {
  const withoutCondition = memory();
  const { idCondicionCredito: _omitted, ...withoutConditionInput } = registration;
  await assert.rejects(createCxpService(cxpDocumentoRepository, withoutCondition.run).create(withoutConditionInput),
    (error: { status: number; details: { campo: string }[] }) =>
      error.status === 422 && error.details.some(issue => issue.campo === 'idCondicionCredito'));
  assert.deepEqual(withoutCondition.writes, []);

  for (const conditions of [[], [{ ID_CONDICION: 43, DIAS_CREDITO: 30, ESTADO: 'I' }]]) {
    const db = memory({ conditions });
    await assert.rejects(createCxpService(cxpDocumentoRepository, db.run).create({
      ...registration, idCondicionCredito: 43,
    }), (error: { status: number; details: { campo: string }[] }) =>
      error.status === 422 && error.details.some(issue => issue.campo === 'idCondicionCredito'));
    assert.deepEqual(db.writes, []);
  }
});

test('la API no acepta días o vencimiento distintos de la condición vigente', async () => {
  const db = memory({ conditions: [{ ID_CONDICION: 43, DIAS_CREDITO: 30, ESTADO: 'A' }] });
  await assert.rejects(createCxpService(cxpDocumentoRepository, db.run).create({
    ...registration, idCondicionCredito: 43, fechaDocumento: '2026-01-15', diasCredito: 15, fechaVencimiento: '2026-01-30',
  }), (error: { status: number; details: { campo: string }[] }) =>
    error.status === 422 && error.details.some(issue => ['diasCredito', 'fechaVencimiento'].includes(issue.campo)));
  assert.deepEqual(db.writes, []);
});

test('el servidor rechaza la fecha futura de un DTE RECIBIDO sin insertar', async () => {
  const db = memory();
  await assert.rejects(createCxpService(cxpDocumentoRepository, db.run).create({
    ...registration, naturaleza: 'D', fechaDocumento: '2999-01-01', fechaVencimiento: '2999-01-01',
  }), (error: { status: number; details: { campo: string }[] }) =>
    error.status === 400 && error.details.some(issue => issue.campo === 'fechaDocumento'));
  assert.deepEqual(db.writes, []);
});

test('el servidor rechaza fechas de calendario inexistentes antes de abrir una transacción', async () => {
  for (const change of [
    { fechaDocumento: '2026-02-30' },
    { fechaDocumento: '2020-01-15', fechaVencimiento: '2026-13-01' },
  ]) {
    const db = memory();
    await assert.rejects(createCxpService(cxpDocumentoRepository, db.run).create({
      ...registration, naturaleza: 'D', ...change,
    }), (error: { issues?: { path: PropertyKey[] }[] }) =>
      Boolean(error.issues?.some(issue => ['fechaDocumento', 'fechaVencimiento'].includes(String(issue.path[0])))));
    assert.deepEqual(db.writes, []);
  }
});

test('el límite de hoy usa America/Guatemala sin cambiar el día por UTC', () => {
  const input = { ...registration, naturaleza: 'D', estado: 'RECIBIDO', fechaDocumento: '2026-10-03', fechaVencimiento: '2026-10-03' };
  assert.throws(() => assertCxpDocumentoCalendarDates(input, new Date('2026-10-03T05:30:00Z')),
    (error: { details: { campo: string }[] }) => error.details.some(issue => issue.campo === 'fechaDocumento'));
  assert.doesNotThrow(() => assertCxpDocumentoCalendarDates(input, new Date('2026-10-03T06:30:00Z')));
});

test('el alta de DTE no admite un estado posterior o de borrador', async () => {
  const db = memory();
  await assert.rejects(createCxpService(cxpDocumentoRepository, db.run).create({ ...registration, estado: 'BORRADOR' }), { status: 409 });
  assert.deepEqual(db.writes, []);
});

test('RF04 conserva RECIBIDO ante diferencia de importes y detalle incompleto', async () => {
  for (const lines of [[{ ...baseLine(), TOTAL_LINEA: 90 }], [{ ...baseLine(), DESCRIPCION: null }]]) {
    const db = memory({ rows: [baseDocument()], lines });
    await assert.rejects(createDocumentoValidationOperation(db.run, db.storage)(1), (error: { status: number; details: unknown[] }) =>
      error.status === 422 && error.details.length > 0);
    assert.equal(db.rows[0].ESTADO, 'RECIBIDO');
    assert.deepEqual(db.writes, []);
  }
});

test('RF04 rechaza un encabezado con subtotal distinto de sus líneas', async () => {
  const document = { ...baseDocument(), SUBTOTAL: 101, TOTAL_BRUTO: 101, TOTAL_NETO: 101, TOTAL_LOCAL: 101, SALDO_PENDIENTE: 101 };
  const db = memory({ rows: [document], lines: [baseLine()] });
  await assert.rejects(createDocumentoValidationOperation(db.run, db.storage)(1), (error: { status: number; details: { campo: string }[] }) =>
    error.status === 422 && error.details.some(issue => issue.campo === 'subtotal'));
  assert.equal(db.rows[0].ESTADO, 'RECIBIDO');
  assert.deepEqual(db.writes, []);
});

test('RF04 no aplica la tolerancia bancaria de 0,01 a TOTAL_LOCAL del DTE', async () => {
  const db = memory({ rows: [{ ...baseDocument(), TOTAL_LOCAL: 100.01 }], lines: [baseLine()] });
  await assert.rejects(createDocumentoValidationOperation(db.run, db.storage)(1), (error: { status: number; details: { campo: string }[] }) =>
    error.status === 422 && error.details.some(issue => issue.campo === 'totalLocal'));
  assert.equal(db.rows[0].ESTADO, 'RECIBIDO');
  assert.deepEqual(db.writes, []);
});

test('RF04 valida líneas y tributos, y avanza a PENDIENTE_APROBACION', async () => {
  const db = memory({ rows: [baseDocument()], lines: [baseLine()] });
  const result = await createDocumentoValidationOperation(db.run, db.storage)(1);
  assert.equal(result.estado, 'PENDIENTE_APROBACION');
  assert.deepEqual(db.writes, ['UPDATE']);
});

test('RF04 exige contenido DTE del mismo documento e íntegro antes de avanzar', async () => {
  for (const options of [
    { files: [] },
    { files: [dteRow(2)] },
    { files: [dteRow()], fileContent: null },
    { files: [dteRow()], fileContent: Buffer.from('alterado') },
  ]) {
    const db = memory({ rows: [baseDocument()], lines: [baseLine()], ...options });
    await assert.rejects(createDocumentoValidationOperation(db.run, db.storage)(1),
      (error: { status: number; details: { campo: string }[] }) =>
        error.status === 422 && error.details.some(issue => issue.campo === 'archivos'));
    assert.equal(db.rows[0].ESTADO, 'RECIBIDO');
    assert.deepEqual(db.writes, []);
  }
});

test('RF04 concilia el impuesto del encabezado, línea y CXP_DOCUMENTO_TRIBUTO', async () => {
  const document = { ...baseDocument(), IMPUESTO_TOTAL: 10, TOTAL_BRUTO: 110, TOTAL_NETO: 110, TOTAL_LOCAL: 110, SALDO_PENDIENTE: 110 };
  const line = { ...baseLine(), IMPUESTO: 10, TOTAL_LINEA: 110 };
  const valid = memory({ rows: [document], lines: [line], tributes: [taxTribute()] });
  assert.equal((await createDocumentoValidationOperation(valid.run, valid.storage)(1)).estado, 'PENDIENTE_APROBACION');

  const inconsistent = memory({ rows: [document], lines: [line], tributes: [{ ...taxTribute(), MONTO: 9 }] });
  await assert.rejects(createDocumentoValidationOperation(inconsistent.run, inconsistent.storage)(1), (error: { status: number; details: { campo: string }[] }) =>
    error.status === 422 && error.details.some(issue => issue.campo === 'impuestoTotal'));
  assert.equal(inconsistent.rows[0].ESTADO, 'RECIBIDO');

  const included = memory({ rows: [document], lines: [line], tributes: [{ ...taxTribute(), INCLUIDO_PRECIO: 'S' }] });
  await assert.rejects(createDocumentoValidationOperation(included.run, included.storage)(1), (error: { status: number; details: { campo: string }[] }) =>
    error.status === 422 && error.details.some(issue => issue.campo.endsWith('INCLUIDO_PRECIO')));
  assert.equal(included.rows[0].ESTADO, 'RECIBIDO');
});

test('un fallo en UPDATE revierte la transición completa', async () => {
  const db = memory({ rows: [baseDocument()], lines: [baseLine()], updateError: true });
  await assert.rejects(createDocumentoValidationOperation(db.run, db.storage)(1), /Fallo durante UPDATE/);
  assert.equal(db.rows[0].ESTADO, 'RECIBIDO');
  assert.deepEqual(db.writes, []);
});

test('el PATCH común no puede saltar de RECIBIDO a PENDIENTE_APROBACION', async () => {
  const db = memory({ rows: [baseDocument()] });
  await assert.rejects(createCxpService(cxpDocumentoRepository, db.run).update(1, { estado: 'PENDIENTE_APROBACION' }), { status: 409 });
  assert.deepEqual(db.writes, []);
});
