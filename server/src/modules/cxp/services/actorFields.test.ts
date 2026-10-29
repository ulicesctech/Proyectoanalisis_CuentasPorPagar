import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { applyCxpActorFields, cxpActorFieldNames, getCxpEntity, type CxpRecord } from '@erp/contracts';
import { createCxpService } from './crud.service';
import { actorForField, withActorField } from './actorFields';
import { cxpReglaAprobacionRepository } from '../repositories/control/reglaAprobacion.repository';
import { cxpEventoRepository } from '../repositories/control/evento.repository';
import { cxpAprobacionRepository } from '../repositories/control/aprobacion.repository';

test('alta: los campos de autoría se rellenan con el actor', () => {
  const { record, issues } = applyCxpActorFields('compromisos', 7, { nombreCompromiso: 'X' });
  assert.deepEqual(issues, []);
  assert.equal(record.creadoPor, 7);
  assert.equal(record.modificadoPor, undefined, 'modificadoPor solo se registra al modificar');
});

test('alta: el mismo usuario que el actor se acepta y otro se rechaza', () => {
  assert.deepEqual(applyCxpActorFields('compromisos', 7, { creadoPor: 7 }).issues, []);
  assert.deepEqual(applyCxpActorFields('compromisos', 7, { creadoPor: '7' }).issues, []);
  const { issues } = applyCxpActorFields('compromisos', 7, { creadoPor: 3 });
  assert.deepEqual(issues.map(issue => issue.campo), ['creadoPor']);
});

test('modificación: registra modificadoPor y no permite reescribir creadoPor', () => {
  const current = { creadoPor: 3, modificadoPor: null };
  const ok = applyCxpActorFields('compromisos', 7, { nombreCompromiso: 'Y' }, current);
  assert.equal(ok.record.modificadoPor, 7);
  assert.equal(Object.hasOwn(ok.record, 'creadoPor'), false);
  assert.deepEqual(applyCxpActorFields('compromisos', 7, { creadoPor: 3 }, current).issues, [], 'el valor vigente se acepta');
  assert.deepEqual(applyCxpActorFields('compromisos', 7, { creadoPor: 7 }, current).issues.map(issue => issue.campo), ['creadoPor']);
});

test('transición: el actor se registra solo al llegar al estado', () => {
  const current = { estado: 'ABIERTO', cerradoPor: null };
  assert.equal(applyCxpActorFields('periodos', 5, { estado: 'CERRADO' }, current).record.cerradoPor, 5);
  const sinCambio = applyCxpActorFields('periodos', 5, { descripcion: 'x' }, current);
  assert.equal(Object.hasOwn(sinCambio.record, 'cerradoPor'), false);
  assert.deepEqual(applyCxpActorFields('periodos', 5, { cerradoPor: 9 }, current).issues.map(issue => issue.campo), ['cerradoPor'],
    'no se puede indicar quién cerró si no se está cerrando');
  assert.deepEqual(applyCxpActorFields('periodos', 5, { estado: 'CERRADO', cerradoPor: 9 }, current).issues.map(issue => issue.campo), ['cerradoPor']);
});

test('transición: revertir una aplicación registra revertidoPor y conserva aplicadoPor', () => {
  const current = { estado: 'APLICADA', aplicadoPor: 3, revertidoPor: null };
  const { record, issues } = applyCxpActorFields('aplicaciones', 8, { estado: 'REVERTIDA', motivoReverso: 'm' }, current);
  assert.deepEqual(issues, []);
  assert.equal(record.revertidoPor, 8);
  assert.equal(Object.hasOwn(record, 'aplicadoPor'), false);
});

test('los usuarios elegidos como dato no se tocan', () => {
  for (const [resource, field] of [['documentos', 'solicitadoPor'], ['documentos', 'responsablePor'], ['compromisos', 'responsablePor'], ['eventos', 'usuarioAsignado']] as const) {
    assert.equal(cxpActorFieldNames(resource).includes(field), false, `${resource}.${field}`);
    const { record, issues } = applyCxpActorFields(resource, 7, { [field]: 99 });
    assert.deepEqual(issues, []);
    assert.equal(record[field], 99);
  }
});

test('todos los campos de autoría existen en los metadatos y son de solo lectura', () => {
  for (const resource of ['parametros', 'periodos', 'cuentas-bancarias', 'compromisos', 'documentos', 'documentos-tributos', 'lotes-pago',
    'pagos', 'aplicaciones', 'reglas-aprobacion', 'aprobaciones', 'conciliaciones-proveedor', 'conciliaciones-pago', 'eventos', 'archivos'] as const) {
    for (const name of cxpActorFieldNames(resource)) {
      const field = getCxpEntity(resource)!.fields.find(item => item.name === name);
      assert.ok(field, `${resource}.${name} no existe`);
      assert.equal(field.lookup, 'usuarios', `${resource}.${name}`);
      assert.equal(field.readOnly, true, `${resource}.${name}`);
    }
  }
});

test('operaciones especiales: vacío o igual al actor se acepta; otro usuario es 403', () => {
  assert.equal(actorForField(undefined, 4, 'usuario'), 4);
  assert.equal(actorForField('', 4, 'usuario'), 4);
  assert.equal(actorForField('4', 4, 'usuario'), 4);
  assert.throws(() => actorForField(5, 4, 'usuario'), { status: 403 });
  assert.deepEqual(withActorField({ motivo: 'x' }, 'usuario', 4), { motivo: 'x', usuario: 4 });
  assert.throws(() => withActorField({ usuario: 2 }, 'usuario', 4), { status: 403 });
});

function captureRun(rows: Record<string, CxpRecord> = {}) {
  const inserts: Array<Record<string, unknown>> = [];
  let executed = 0;
  const connection = {
    async execute(sql: string, binds: Record<string, { val?: unknown }> = {}) {
      executed += 1;
      const insert = sql.match(/INSERT INTO (\w+) \(([^)]+)\)/);
      if (insert) {
        const columns = insert[2].split(',').map(column => column.trim());
        inserts.push(Object.fromEntries(columns.map((column, index) => [column, binds[`v${index}`]?.val])));
        return { outBinds: { newId: [5] } };
      }
      const select = sql.match(/FROM (CXP_\w+) WHERE \w+ = :id/);
      if (select) return { rows: rows[select[1]] ? [rows[select[1]]] : [{}] };
      return { rows: [] };
    },
  } as unknown as Connection;
  const run = async <T>(operation: (value: Connection) => Promise<T>) => operation(connection);
  return { run, inserts, executed: () => executed };
}

test('CRUD: el alta guarda al actor como autor aunque el cuerpo no lo traiga', async () => {
  const db = captureRun();
  await createCxpService(cxpReglaAprobacionRepository, db.run).create({
    tipoEntidad: 'PAGO', nombreRegla: 'Pagos', nivel: 1, idRolAprobador: 2, vigenteDesde: '2026-10-01',
  }, 11);
  assert.equal(db.inserts[0].CREADA_POR, 11);
});

test('CRUD: un autor distinto del actor se rechaza sin tocar Oracle', async () => {
  const db = captureRun();
  await assert.rejects(createCxpService(cxpReglaAprobacionRepository, db.run).create({
    tipoEntidad: 'PAGO', nombreRegla: 'Pagos', nivel: 1, idRolAprobador: 2, creadaPor: 3,
  }, 11), { status: 403 });
  assert.equal(db.executed(), 0);
});

test('CRUD: la bitácora manual queda firmada por el actor y no por otro usuario', async () => {
  const forged = captureRun();
  await assert.rejects(createCxpService(cxpEventoRepository, forged.run).create({
    tipoEvento: 'NOTA', asunto: 'Nota', usuarioEvento: 2, idProveedor: 1,
  }, 11), { status: 403 });
  assert.equal(forged.executed(), 0);
});

test('CRUD: decidir una aprobación registra al actor como aprobador', async () => {
  const db = captureRun({
    CXP_APROBACION: { ID_APROBACION: 3, ID_CUENTA_BANCARIA: 4, NIVEL: 1, ID_ROL_APROBADOR: 2, ESTADO: 'PENDIENTE' },
  });
  await assert.rejects(createCxpService(cxpAprobacionRepository, db.run).update(3, {
    estado: 'APROBADA', idUsuarioAprobador: 6, fechaDecision: '2026-10-01T10:00:00',
  }, 11), { status: 403 });
});
