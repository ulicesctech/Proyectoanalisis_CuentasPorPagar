import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { createCxpService } from '../crud.service';
import { cxpAprobacionRepository } from '../../repositories/control/aprobacion.repository';
import { createDocumentoApprovalOperation } from './documento.approval';

type Row = Record<string, string | number | null>;

const documentRow = (): Row => ({
  ID_DOCUMENTO: 1, ID_PROVEEDOR: 7, ID_DEPARTAMENTO: null, CENTRO_COSTO: null, PROYECTO: null,
  MONEDA: 'GTQ', TOTAL_LOCAL: 100, TIPO_REGISTRO: 'SIN_OC', RESULTADO_TRES_VIAS: 'NO_APLICA',
  DIFERENCIA_CANTIDAD: 0, DIFERENCIA_PRECIO: 0, DIFERENCIA_IMPUESTO: 0, DIFERENCIA_TOTAL: 0,
  ESTADO: 'PENDIENTE_APROBACION', CREADO_POR: 10, SOLICITADO_POR: null, MOTIVO_RECHAZO: null,
});

const ruleRow = (cantidad = 1, nivel = 1): Row => ({
  ID_REGLA: nivel, NOMBRE_REGLA: `Nivel ${nivel}`, ID_PROVEEDOR: 7, ID_DEPARTAMENTO: null,
  CENTRO_COSTO: null, PROYECTO: null, MONEDA: null, MONTO_DESDE: 0, MONTO_HASTA: null,
  REQUIERE_SIN_OC: null, REQUIERE_DIFERENCIA: null, NIVEL: nivel, ID_ROL_APROBADOR: 2,
  CANTIDAD_APROBADORES: cantidad,
});

const actors: Record<number, Row> = {
  10: { USU_ID_USUARIO: 10, USU_NOMBRE_COMPLETO: 'Registrador', USU_ID_ROL: 2, USU_ACTIVO: 1, ROL_ACTIVO: 1 },
  20: { USU_ID_USUARIO: 20, USU_NOMBRE_COMPLETO: 'Aprobador uno', USU_ID_ROL: 2, USU_ACTIVO: 1, ROL_ACTIVO: 1 },
  21: { USU_ID_USUARIO: 21, USU_NOMBRE_COMPLETO: 'Aprobador dos', USU_ID_ROL: 2, USU_ACTIVO: 1, ROL_ACTIVO: 1 },
  30: { USU_ID_USUARIO: 30, USU_NOMBRE_COMPLETO: 'Otro rol', USU_ID_ROL: 3, USU_ACTIVO: 1, ROL_ACTIVO: 1 },
  31: { USU_ID_USUARIO: 31, USU_NOMBRE_COMPLETO: 'Usuario inactivo', USU_ID_ROL: 2, USU_ACTIVO: 0, ROL_ACTIVO: 1 },
};

function memory(options: { rules?: Row[]; approvals?: Row[] } = {}) {
  let document = { ...documentRow() };
  let approvals = (options.approvals ?? []).map(item => ({ ...item }));
  const rules = (options.rules ?? [ruleRow()]).map(item => ({ ...item }));
  const writes: string[] = [];
  const sqlCalls: string[] = [];
  const connection = {
    async execute(sql: string, binds: Record<string, unknown> = {}) {
      sqlCalls.push(sql);
      if (sql.includes('FROM CXP_DOCUMENTO WHERE ID_DOCUMENTO = :id')) return { rows: [{ ...document }] };
      if (sql.includes('FROM CXP_REGLA_APROBACION')) return { rows: rules.map(item => ({ ...item })) };
      if (sql.startsWith('SELECT ID_APROBACION')) return { rows: approvals.map(item => ({ ...item })) };
      if (sql.includes('FROM USUARIO U')) {
        const actor = actors[Number(binds.idUsuario)];
        return { rows: actor ? [{ ...actor }] : [] };
      }
      if (sql.startsWith('INSERT INTO CXP_APROBACION')) {
        const row: Row = {
          ID_APROBACION: approvals.length + 1, ID_REGLA: Number(binds.idRegla),
          ID_DOCUMENTO: Number(binds.idDocumento), NIVEL: Number(binds.nivel),
          ID_ROL_APROBADOR: Number(binds.idRolAprobador), ID_USUARIO_APROBADOR: Number(binds.idUsuarioAprobador),
          ESTADO: String(binds.estado), ACCION: String(binds.accion),
          FECHA_DECISION: '2026-10-03T10:00:00.000000', OBSERVACION: binds.observacion == null ? null : String(binds.observacion),
        };
        approvals.push(row);
        writes.push('INSERT_APROBACION');
        return { outBinds: { id: [row.ID_APROBACION] } };
      }
      if (sql.startsWith('UPDATE CXP_DOCUMENTO SET')) {
        for (const match of sql.matchAll(/([A-Z_]+) = :v(\d+)/g)) {
          document[match[1]] = (binds[`v${match[2]}`] as { val: string | number | null }).val;
        }
        writes.push('UPDATE_DOCUMENTO');
        return { rowsAffected: 1 };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  } as unknown as Connection;
  let queue = Promise.resolve();
  const run = (async <T>(operation: (connection: Connection) => Promise<T>): Promise<T> => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const beforeDocument = structuredClone(document);
    const beforeApprovals = structuredClone(approvals);
    const beforeWrites = writes.length;
    try { return await operation(connection); }
    catch (error) {
      document = beforeDocument;
      approvals = beforeApprovals;
      writes.splice(beforeWrites);
      throw error;
    } finally { release(); }
  }) as typeof import('../../repositories/crud.repository').withCxpTransaction;
  return {
    connection, run, writes, sqlCalls,
    get document() { return document; }, get approvals() { return approvals; },
  };
}

function approve(service: ReturnType<typeof createDocumentoApprovalOperation>, actor = 20, rule = 1) {
  return service(1, { idRegla: rule, idUsuarioAprobador: actor, decision: 'APROBAR', observacion: 'Revisado' });
}

test('una aprobación completa cambia el documento a APROBADA en la misma transacción', async () => {
  const db = memory();
  const result = await approve(createDocumentoApprovalOperation(db.run));
  assert.equal(result.estadoDocumento, 'APROBADA');
  assert.equal(db.document.ESTADO, 'APROBADA');
  assert.equal(db.approvals.length, 1);
  assert.deepEqual(db.writes, ['INSERT_APROBACION', 'UPDATE_DOCUMENTO']);
  assert.ok(db.sqlCalls.some(sql => sql.includes('FOR UPDATE')));
});

test('el documento permanece pendiente mientras falten aprobadores exigidos', async () => {
  const db = memory({ rules: [ruleRow(2)] });
  const result = await approve(createDocumentoApprovalOperation(db.run));
  assert.equal(result.estadoDocumento, 'PENDIENTE_APROBACION');
  assert.equal(result.reglas[0].faltantes, 1);
  assert.equal(db.document.ESTADO, 'PENDIENTE_APROBACION');
  assert.deepEqual(db.writes, ['INSERT_APROBACION']);
});

test('un rechazo exige motivo, registra al actor y cambia el documento a RECHAZADA', async () => {
  const db = memory();
  const service = createDocumentoApprovalOperation(db.run);
  await assert.rejects(service(1, {
    idRegla: 1, idUsuarioAprobador: 20, decision: 'RECHAZAR', observacion: '',
  }), { status: 400 });
  assert.deepEqual(db.writes, []);
  const result = await service(1, {
    idRegla: 1, idUsuarioAprobador: 20, decision: 'RECHAZAR', observacion: 'Importe no autorizado',
  });
  assert.equal(result.estadoDocumento, 'RECHAZADA');
  assert.equal(db.document.MOTIVO_RECHAZO, 'Importe no autorizado');
  assert.equal(db.approvals[0].ID_USUARIO_APROBADOR, 20);
  assert.equal(db.approvals[0].ESTADO, 'RECHAZADA');
});

test('rol incorrecto, usuario inactivo y autoaprobación se rechazan sin escrituras', async () => {
  for (const actor of [30, 31, 10]) {
    const db = memory();
    await assert.rejects(approve(createDocumentoApprovalOperation(db.run), actor), { status: 403 });
    assert.deepEqual(db.writes, []);
  }
});

test('sin una regla aplicable el documento permanece pendiente y no registra decisiones', async () => {
  const db = memory({ rules: [] });
  await assert.rejects(approve(createDocumentoApprovalOperation(db.run)), { status: 409 });
  assert.equal(db.document.ESTADO, 'PENDIENTE_APROBACION');
  assert.deepEqual(db.writes, []);
});

test('una decisión repetida del mismo usuario no crea otra aprobación', async () => {
  const db = memory({
    rules: [ruleRow(2)],
    approvals: [{
      ID_APROBACION: 1, ID_REGLA: 1, ID_DOCUMENTO: 1, NIVEL: 1, ID_ROL_APROBADOR: 2,
      ID_USUARIO_APROBADOR: 20, ESTADO: 'APROBADA', ACCION: 'APROBAR',
      FECHA_DECISION: '2026-10-03T09:00:00.000000', OBSERVACION: null,
    }],
  });
  await assert.rejects(approve(createDocumentoApprovalOperation(db.run)), { status: 409 });
  assert.equal(db.approvals.length, 1);
  assert.deepEqual(db.writes, []);
});

test('dos decisiones concurrentes para el último cupo producen una sola aprobación', async () => {
  const db = memory();
  const service = createDocumentoApprovalOperation(db.run);
  const results = await Promise.allSettled([approve(service, 20), approve(service, 21)]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  const rejected = results.find(item => item.status === 'rejected') as PromiseRejectedResult;
  assert.equal(rejected.reason.status, 409);
  assert.equal(db.approvals.length, 1);
  assert.equal(db.document.ESTADO, 'APROBADA');
});

test('el CRUD genérico no crea aprobaciones de documentos', async () => {
  const db = memory();
  await assert.rejects(createCxpService(cxpAprobacionRepository, db.run).create({
    idDocumento: 1, nivel: 1, idRolAprobador: 2, estado: 'APROBADA',
    idUsuarioAprobador: 20, fechaDecision: '2026-10-03T10:00:00',
  }), { status: 409 });
  assert.deepEqual(db.writes, []);
});
