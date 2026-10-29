import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { CXP_SCHEMAS, documentoComponentesSchema, prepareCxpRecord, type ActorProceso, type CxpDocumentoComponentesContexto, type CxpRecord } from '@erp/contracts';
import { CXP_TABLES } from '../../repositories/definitions';
import { createDocumentoComponentOperations } from './documento.componentes';
import { collectDocumentoValidationIssues } from './documento.validation';
import { createCxpService } from '../crud.service';
import { createCxpRepository } from '../../repositories/crud.repository';

const actor: ActorProceso = { id: 7, nombre: 'Operador simulado', roles: [1], permisos: ['CREAR'] };
const uppercase = (row: CxpRecord, resource: keyof typeof CXP_TABLES) => Object.fromEntries(Object.entries(row)
  .filter(([name]) => CXP_TABLES[resource].columns[name]).map(([name, value]) => [CXP_TABLES[resource].columns[name].column, value]));
function memory(options: { eventFailure?: boolean; reserved?: boolean; state?: string; applied?: number } = {}) {
  const document = prepareCxpRecord('documentos', { ...CXP_SCHEMAS.documentos.create.parse({
    idProveedor: 1, idSucursal: 1, tipoDocumento: 'FACTURA', fechaDocumento: '2026-09-01', creadoPor: 7,
    serie: 'A', numeroDocumento: 'SIMULADO', uuidFiscal: 'simulado', origenIngreso: 'FACTURACION_ELECTRONICA',
  }), idDocumento: 99, estado: options.state ?? 'RECIBIDO', montoAplicado: options.applied ?? 0,
    fechaRecepcion: '2026-09-01T10:00:00', fechaCreacion: '2026-09-01T10:00:00' });
  let tables: Record<string, CxpRecord[]> = { CXP_DOCUMENTO: [uppercase(document, 'documentos')], CXP_DOCUMENTO_DETALLE: [], CXP_DOCUMENTO_TRIBUTO: [], CXP_EVENTO: [] };
  const queries: string[] = [], writes: string[] = [];
  const connection = { async execute(sql: string, binds: Record<string, unknown> = {}) {
    queries.push(sql);
    if (sql.includes("P.CODIGO_PAGO LIKE 'CP-%'")) return { rows: [] };
    if (sql.includes('FROM CXP_APLICACION')) return { rows: options.reserved ? [{ ID_APLICACION: 1 }] : [] };
    if (sql.includes('RESULTADO_JSON FROM CXP_EVENTO')) return { rows: tables.CXP_EVENTO.filter(row => row.ID_DOCUMENTO === binds.id && row.TIPO_EVENTO === binds.tipo).slice(-1) };
    const selected = /FROM (CXP_DOCUMENTO(?:_DETALLE|_TRIBUTO)?) WHERE/.exec(sql);
    if (selected && sql.startsWith('SELECT ')) {
      const key = selected[1] === 'CXP_DOCUMENTO' ? 'ID_DOCUMENTO' : 'ID_DOCUMENTO';
      return { rows: structuredClone(tables[selected[1]].filter(row => row[key] === binds.id)) };
    }
    const insert = /INSERT INTO (\w+) \(([^)]+)\)/.exec(sql);
    if (insert) {
      if (insert[1] === 'CXP_EVENTO' && options.eventFailure) throw new Error('Fallo simulado de bitácora');
      const resource = Object.values(CXP_TABLES).find(item => item.table === insert[1])!;
      const id = Math.max(0, ...tables[insert[1]].map(row => Number(row[resource.idColumn]))) + 1;
      const row: CxpRecord = { [resource.idColumn]: id, FECHA_APLICACION: '2026-09-01', FECHA_GENERACION: '2026-09-01T10:00:00', FECHA_EVENTO: '2026-09-01T10:00:00' };
      insert[2].split(', ').forEach((column, index) => { row[column] = (binds[`v${index}`] as { val: string | number | null }).val; });
      tables[insert[1]].push(row); writes.push(`INSERT ${insert[1]}`); return { outBinds: { newId: [id] } };
    }
    const update = /^UPDATE (\w+) SET/.exec(sql);
    if (update) {
      const definition = Object.values(CXP_TABLES).find(item => item.table === update[1])!;
      const row = tables[update[1]].find(item => item[definition.idColumn] === binds.id)!;
      for (const match of sql.matchAll(/([A-Z_]+) = (?:TO_DATE\(|TO_TIMESTAMP\()?:v(\d+)/g)) row[match[1]] = (binds[`v${match[2]}`] as { val: string | number | null }).val;
      writes.push(`UPDATE ${update[1]}`); return { rowsAffected: 1 };
    }
    const remove = /^DELETE FROM (\w+) WHERE/.exec(sql);
    if (remove) {
      const definition = Object.values(CXP_TABLES).find(item => item.table === remove[1])!;
      tables[remove[1]] = tables[remove[1]].filter(row => row[definition.idColumn] !== binds.id);
      writes.push(`DELETE ${remove[1]}`); return { rowsAffected: 1 };
    }
    throw new Error('SQL inesperado: ' + sql);
  } } as unknown as Connection;
  const run = (async <T>(operation: (c: Connection) => Promise<T>) => {
    const before = structuredClone(tables);
    try { return await operation(connection); } catch (error) { tables = before; throw error; }
  }) as typeof import('../../repositories/crud.repository').withCxpTransaction;
  return { run, operations: createDocumentoComponentOperations(run), get tables() { return tables; }, queries, writes };
}
function acceptance(current: CxpDocumentoComponentesContexto) {
  return documentoComponentesSchema.parse({ version: current.version, adoptarTotales: true,
    lineas: [{ clave: 'a', datos: { descripcion: 'Teclados', cantidad: 2, precioUnitario: 150, descuento: 0 } },
      { clave: 'b', datos: { descripcion: 'Mouse', cantidad: 3, precioUnitario: 100, descuento: 50 } }],
    tributos: ['a', 'b'].map(linea => ({ clave: linea, linea, calculo: 'PORCENTAJE', base: 'DERIVADA', tratamiento: 'NO_RECUPERABLE', baseRevisadaPara: null,
      datos: { tipoTributo: 'IMPUESTO', codigoTributo: 'PRUEBA10', nombreTributo: 'Ficticio 10 %', baseImponible: 0, porcentaje: 10, monto: 999 } })),
  });
}

test('captura atómica deriva impuestos, numera y firma; el servidor ignora un monto porcentual adulterado', async () => {
  const db = memory(), current = await db.operations.read(99);
  const saved = await db.operations.save(99, acceptance(current), actor);
  assert.equal(saved.documento.totalNeto, 605); assert.equal(saved.documento.impuestoTotal, 55);
  assert.deepEqual(db.tables.CXP_DOCUMENTO_DETALLE.map(row => [row.NUMERO_LINEA, row.IMPUESTO]), [[1, 30], [2, 25]]);
  assert.ok(db.tables.CXP_DOCUMENTO_TRIBUTO.every(row => row.GENERADO_POR === 7 && row.ESTADO === 'CALCULADO'));
  assert.equal(db.tables.CXP_EVENTO[0].USUARIO_EVENTO, 7);
  assert.deepEqual(collectDocumentoValidationIssues(saved.documento, db.tables.CXP_DOCUMENTO_DETALLE as never[], db.tables.CXP_DOCUMENTO_TRIBUTO as never[]), []);
  assert.ok(db.queries.filter(sql => /FROM CXP_DOCUMENTO(?:_DETALLE|_TRIBUTO)? WHERE/.test(sql)).every(sql => sql.endsWith('FOR UPDATE')));
});

test('fallo de bitácora revierte líneas, tributos, declaración y todo el agregado', async () => {
  const db = memory({ eventFailure: true }), before = structuredClone(db.tables);
  await assert.rejects(db.operations.save(99, acceptance(await db.operations.read(99)), actor), /bitácora/);
  assert.deepEqual(db.tables, before); assert.ok(db.writes.some(sql => sql.includes('CXP_DOCUMENTO_TRIBUTO')));
});

test('versión antigua, IDs ajenos, autoría ajena y permiso incorrecto no escriben', async () => {
  const db = memory(), first = await db.operations.read(99), input = acceptance(first);
  const saved = await db.operations.save(99, input, actor), before = structuredClone(db.tables);
  await assert.rejects(db.operations.save(99, input, actor), { status: 409 });
  const fresh = { ...saved, adoptarTotales: false, lineas: [{ ...saved.lineas[0], idDetalle: 123456 }] };
  const { documento: _document, editable: _editable, catalogo: _catalog, advertencias: _warnings, ...payload } = fresh;
  await assert.rejects(db.operations.save(99, payload, actor), { status: 409 });
  await assert.rejects(db.operations.save(99, { ...input, tributos: [{ ...input.tributos[0], datos: { ...input.tributos[0].datos, generadoPor: 999 } }] }, actor), { status: 403 });
  await assert.rejects(db.operations.save(99, input, { ...actor, permisos: ['APROBAR'] }), { status: 403 });
  assert.deepEqual(db.tables, before);
});

test('estados posteriores, aplicaciones y reservas bloquean el conjunto', async () => {
  for (const options of [{ state: 'APROBADA' }, { state: 'PAGADA' }, { applied: 1 }, { reserved: true }]) {
    const db = memory(options), before = structuredClone(db.tables);
    await assert.rejects(db.operations.save(99, acceptance(await db.operations.read(99)), actor), { status: 409 });
    assert.deepEqual(db.tables, before); assert.equal(db.writes.length, 0);
  }
});

test('quitar línea exige confirmar sus tributos; se eliminan antes que el padre y no quedan huérfanos', async () => {
  const db = memory(), saved = await db.operations.save(99, acceptance(await db.operations.read(99)), actor);
  const payload = { ...acceptance(saved), lineas: saved.lineas.slice(1), tributos: saved.tributos.slice(1) };
  const before = structuredClone(db.tables);
  await assert.rejects(db.operations.save(99, payload, actor), { status: 409 }); assert.deepEqual(db.tables, before);
  await db.operations.save(99, { ...payload, confirmarEliminaciones: [saved.tributos[0].idTributo!] }, actor);
  assert.equal(db.tables.CXP_DOCUMENTO_DETALLE.length, 1); assert.equal(db.tables.CXP_DOCUMENTO_TRIBUTO.length, 1);
  const deletes = db.writes.filter(sql => sql.startsWith('DELETE'));
  assert.deepEqual(deletes, ['DELETE CXP_DOCUMENTO_TRIBUTO', 'DELETE CXP_DOCUMENTO_DETALLE']);
});

test('guardar conceptos conserva la declaración hasta solicitar adopción explícita y protege la bitácora', async () => {
  const db = memory(), initial = await db.operations.read(99), input = acceptance(initial);
  await db.operations.save(99, { ...input, adoptarTotales: false }, actor);
  assert.equal(db.tables.CXP_DOCUMENTO[0].SUBTOTAL, 0);
  const events = createCxpService(createCxpRepository('eventos'), db.run);
  await assert.rejects(events.create({ tipoEvento: 'CAPTURA_COMPONENTES' }, actor.id), { status: 409 });
  await assert.rejects(events.create({ tipoEvento: ' CAPTURA_COMPONENTES ' }, actor.id), { status: 409 });
});

test('editar con otra sesión conserva generador y recuperación parcial; firma la modificación en bitácora', async () => {
  const db = memory(), first = await db.operations.save(99, acceptance(await db.operations.read(99)), actor);
  const payload = { ...acceptance(first), lineas: first.lineas, tributos: first.tributos.map(tax => ({ ...tax, tratamiento: 'PARCIAL',
    datos: { ...tax.datos, montoRecuperable: tax.datos.monto === 30 ? 12 : 10, montoNoRecuperable: tax.datos.monto === 30 ? 18 : 15 } })) };
  await db.operations.save(99, payload, { ...actor, id: 8 });
  assert.ok(db.tables.CXP_DOCUMENTO_TRIBUTO.every(row => row.GENERADO_POR === 7));
  assert.equal(db.tables.CXP_DOCUMENTO_TRIBUTO[0].MONTO_RECUPERABLE, 12);
  assert.equal(db.tables.CXP_EVENTO.at(-1)!.USUARIO_EVENTO, 8);
});

test('un guardado sin cambios también consume la versión y rechaza repetir la solicitud', async () => {
  const db = memory(), saved = await db.operations.save(99, acceptance(await db.operations.read(99)), actor);
  const payload = { version: saved.version, lineas: saved.lineas, tributos: saved.tributos, adoptarTotales: false, confirmarEliminaciones: [] };
  const next = await db.operations.save(99, payload, actor);
  assert.notEqual(next.version, saved.version); assert.equal(next.documento.totalNeto, 605);
  await assert.rejects(db.operations.save(99, payload, actor), { status: 409 });
  assert.equal(db.tables.CXP_EVENTO.length, 2);
});
