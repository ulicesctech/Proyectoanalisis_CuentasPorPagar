import assert from 'node:assert/strict';
import test from 'node:test';
import oracledb, { type Connection } from 'oracledb';
import { closeOraclePool, getConnection, initOraclePool } from '../../../../config/database';
import { cxpDocumentoRepository, findDocumentoDuplicate } from '../../repositories/documentos/documento.repository';
import { listCxpOptions } from '../../repositories/catalogos.repository';
import {
  findApprovalActor, listActiveDocumentoApprovalRules, listDocumentoApprovalDecisions,
} from '../../repositories/documentos/documentoApproval.repository';
import { findActiveDocumentoCreditCondition } from '../../repositories/documentos/documentoDueDate.repository';
import { createCxpService } from '../crud.service';

type ContextRow = { SCHEMA_NAME: string; SERVICE_NAME: string; DB_NAME: string };
type RelationRow = {
  ID_PROVEEDOR: number | null;
  ID_SUCURSAL: number | null;
  ID_USUARIO: number | null;
  ID_CONDICION: number | null;
};

async function context(connection: Connection): Promise<ContextRow> {
  const result = await connection.execute<ContextRow>(
    `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS SCHEMA_NAME,
            SYS_CONTEXT('USERENV', 'SERVICE_NAME') AS SERVICE_NAME,
            SYS_CONTEXT('USERENV', 'DB_UNIQUE_NAME') AS DB_NAME
       FROM DUAL`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return result.rows![0];
}

test('muestra el contexto Oracle configurado sin escribir', {
  skip: process.env.CXP_ORACLE_CONTEXT !== '1',
}, async () => {
  await initOraclePool();
  const connection = await getConnection();
  try {
    console.log('Oracle context:', await context(connection));
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const duplicate = await findDocumentoDuplicate(connection, {
      idProveedor: 1,
      serie: `READ-${suffix}`,
      numeroDocumento: `READ-${suffix}`,
      tipoDocumento: 'FACTURA',
      estado: 'RECIBIDO',
    });
    assert.equal(duplicate, null);
    const approvalTarget = await connection.execute<{ ID_DOCUMENTO: number | null; ID_USUARIO: number | null }>(
      `SELECT (SELECT MIN(ID_DOCUMENTO) FROM CXP_DOCUMENTO WHERE ESTADO = 'PENDIENTE_APROBACION') AS ID_DOCUMENTO,
              (SELECT MIN(USU_ID_USUARIO) FROM USUARIO WHERE USU_ACTIVO = 1) AS ID_USUARIO
         FROM DUAL`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const target = approvalTarget.rows![0];
    const conditionId = await connection.execute<{ ID_CONDICION: number | null }>(
      `SELECT MIN(ID_CONDICION) AS ID_CONDICION
         FROM CXC_CONDICIONES_CREDITO
        WHERE ESTADO = 'A'`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    if (conditionId.rows?.[0]?.ID_CONDICION) {
      assert.ok(await findActiveDocumentoCreditCondition(connection, conditionId.rows[0].ID_CONDICION));
    }
    const conditionOptions = await listCxpOptions('condiciones-credito', {});
    assert.ok(conditionOptions.length > 0);
    assert.ok(conditionOptions.every(option => /Contado|días de crédito/.test(option.label)));
    const rules = await listActiveDocumentoApprovalRules(connection);
    assert.ok(Array.isArray(rules));
    if (target.ID_DOCUMENTO) {
      assert.ok(Array.isArray(await listDocumentoApprovalDecisions(connection, target.ID_DOCUMENTO)));
    }
    if (target.ID_USUARIO) {
      assert.equal((await findApprovalActor(connection, target.ID_USUARIO))?.idUsuario, target.ID_USUARIO);
    }
  }
  finally { await connection.close(); await closeOraclePool(); }
});

test('alta completa de DTE en Oracle de pruebas queda RECIBIDO', {
  skip: process.env.CXP_ORACLE_TEST_WRITE !== '1',
}, async () => {
  const expectedSchema = process.env.CXP_ORACLE_TEST_SCHEMA;
  const expectedService = process.env.CXP_ORACLE_TEST_SERVICE;
  assert.ok(expectedSchema && expectedService, 'Define CXP_ORACLE_TEST_SCHEMA y CXP_ORACLE_TEST_SERVICE para identificar el Oracle de pruebas');
  await initOraclePool();
  const connection = await getConnection();
  let idDocumento: number | undefined;
  try {
    const target = await context(connection);
    assert.equal(target.SCHEMA_NAME, expectedSchema);
    assert.equal(target.SERVICE_NAME, expectedService);
    const relationResult = await connection.execute<RelationRow>(
      `SELECT (SELECT MIN(PRO_ID_PROVEEDOR) FROM PROVEEDOR) AS ID_PROVEEDOR,
              (SELECT MIN(ID_SUCURSAL) FROM CXC_SUCURSALES) AS ID_SUCURSAL,
              (SELECT MIN(USU_ID_USUARIO) FROM USUARIO) AS ID_USUARIO,
              (SELECT MIN(ID_CONDICION) FROM CXC_CONDICIONES_CREDITO WHERE ESTADO = 'A') AS ID_CONDICION
         FROM DUAL`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const relations = relationResult.rows![0];
    assert.ok(relations.ID_PROVEEDOR && relations.ID_SUCURSAL && relations.ID_USUARIO && relations.ID_CONDICION,
      'El Oracle de pruebas necesita proveedor, sucursal, usuario y condición de pago activa para el alta');
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
    const run = async <T>(operation: (transaction: Connection) => Promise<T>) => operation(connection);
    const created = await createCxpService(cxpDocumentoRepository, run).create({
      idProveedor: relations.ID_PROVEEDOR,
      idSucursal: relations.ID_SUCURSAL,
      idCondicionCredito: relations.ID_CONDICION,
      creadoPor: relations.ID_USUARIO,
      tipoDocumento: 'FACTURA',
      naturaleza: 'D',
      origenIngreso: 'FACTURACION_ELECTRONICA',
      tipoRegistro: 'SIN_OC',
      serie: `IT-${suffix}`.slice(0, 40),
      numeroDocumento: `IT-${suffix}`,
      uuidFiscal: `IT-UUID-${suffix}`,
      hashOrigen: suffix.padStart(64, '0').slice(-64),
      fechaDocumento: today,
      moneda: 'GTQ',
      tipoCambio: 1,
      subtotal: 1,
    });
    idDocumento = Number(created.idDocumento);
    const stored = await cxpDocumentoRepository.bind(connection).findById(idDocumento);
    assert.equal(stored?.estado, 'RECIBIDO');
    console.log('DTE de prueba creado dentro de la transacción:', { idDocumento, estado: stored.estado });
  } finally {
    await connection.rollback();
    await connection.close();
    await closeOraclePool();
  }
  assert.ok(idDocumento);
});
