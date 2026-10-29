import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import test from 'node:test';
import oracledb from 'oracledb';
import type { CxpRecord } from '@erp/contracts';
import type { ProcesoStore, ProcesoTx } from '../services/procesos/ports';
import { config } from '../../../config';
import { closeOraclePool, getConnection, initOraclePool } from '../../../config/database';
import { createPaymentWorkflow } from '../services/procesos/workflow';
import { actorDesdeUsuario } from '../services/identidad';
import { findUsuarioOperativoWithConnection } from './control/usuario.repository';
import { createCxpRepository } from './crud.repository';
import { procesoStore } from './proceso.repository';

// Opt-in: CXP_ORACLE_PAYMENT_TEST=1, CXP_ORACLE_PAYMENT_REFERENCE=<código>,
// CXP_ORACLE_PAYMENT_ACTOR_ID=<ejecutor operativo>. Solo Oracle local.
// El proceso de referencia se lee; todas las escrituras usan copias sin COMMIT.
test('Oracle local: transferencia y aplicaciones atómicas, con rollback de copias aisladas', {
  skip: process.env.CXP_ORACLE_PAYMENT_TEST !== '1',
}, async t => {
  const target = /^(?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/([A-Za-z0-9_.-]+)$/i
    .exec(config.oracleConnection.connectString);
  assert.ok(target, 'Las pruebas de pagos solo admiten Easy Connect a loopback');
  const addresses = await lookup(target[1].replace(/^\[|\]$/g, ''), { all: true });
  assert.ok(addresses.length && addresses.every(row => ['127.0.0.1', '::1'].includes(row.address)));
  const referenceCode = process.env.CXP_ORACLE_PAYMENT_REFERENCE;
  const executorId = Number(process.env.CXP_ORACLE_PAYMENT_ACTOR_ID);
  assert.ok(referenceCode && Number.isSafeInteger(executorId) && executorId > 0,
    'Indica el proceso de referencia de solo lectura y el usuario operativo ejecutor');

  await initOraclePool();
  const inspector = await getConnection();
  const query = async (sql: string, binds: Record<string, string | number> = {}) =>
    (await inspector.execute<Record<string, unknown>>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows!;
  try {
    const context = (await query(`SELECT SYS_CONTEXT('USERENV','SERVER_HOST') HOST,
      SYS_CONTEXT('USERENV','SERVICE_NAME') SERVICE_NAME FROM DUAL`))[0];
    assert.equal(String(context.SERVICE_NAME).toLowerCase(), target[2].toLowerCase());
    assert.ok(process.env.COMPUTERNAME, 'Confirma el equipo local antes de escribir');
    assert.equal(String(context.HOST).toLowerCase(), process.env.COMPUTERNAME.toLowerCase());

    const references = await query('SELECT ID_PAGO FROM CXP_PAGO WHERE CODIGO_PAGO = :code', { code: referenceCode });
    assert.equal(references.length, 1);
    const referenceId = Number(references[0].ID_PAGO);
    const payment = (await createCxpRepository('pagos').bind(inspector).findById(referenceId))!;
    const applicationRows = await query(`SELECT ID_APLICACION FROM CXP_APLICACION
      WHERE ID_PAGO = :id AND TIPO_APLICACION = 'PAGO' AND ESTADO = 'PENDIENTE'
      ORDER BY ID_APLICACION`, { id: referenceId });
    assert.ok(applicationRows.length, 'Se requiere una reserva pendiente como plantilla');
    const application = (await createCxpRepository('aplicaciones').bind(inspector)
      .findById(Number(applicationRows[0].ID_APLICACION)))!;
    const document = (await createCxpRepository('documentos').bind(inspector)
      .findById(Number(application.idDocumentoDestino)))!;
    const user = await findUsuarioOperativoWithConnection(inspector, executorId);
    assert.ok(user);
    const executor = actorDesdeUsuario(user);
    assert.ok(executor.permisos.includes('TESORERIA'));
    assert.notEqual(executor.id, payment.programadoPor);
    assert.equal(payment.estado, 'ENVIADO');
    assert.equal(payment.moneda, 'GTQ');

    const referenceSnapshot = async () => JSON.stringify({
      payment: await query('SELECT * FROM CXP_PAGO WHERE ID_PAGO = :id', { id: referenceId }),
      applications: await query('SELECT * FROM CXP_APLICACION WHERE ID_PAGO = :id ORDER BY ID_APLICACION', { id: referenceId }),
      document: await query('SELECT * FROM CXP_DOCUMENTO WHERE ID_DOCUMENTO = :id', { id: Number(document.idDocumento) }),
      transfer: await query('SELECT * FROM MB_TRANSFERENCIA_BANCARIA WHERE PAGO_ID = :id ORDER BY TRANSFERENCIA_ID', { id: referenceId }),
      operations: await query(`SELECT OPERACION_ID, ESTADO, MODIFICADO_POR, MODIFICADO_EN
        FROM MB_OPERACION_BANCARIA WHERE MODULO_ORIGEN = 'CXP' AND DOCUMENTO_ORIGEN_ID = :id
        ORDER BY OPERACION_ID`, { id: referenceId }),
      events: await query(`SELECT ID_EVENTO, TIPO_EVENTO, USUARIO_EVENTO, FECHA_EVENTO
        FROM CXP_EVENTO WHERE ID_PAGO = :id ORDER BY ID_EVENTO`, { id: referenceId }),
    });
    const original = await referenceSnapshot();
    const without = (record: CxpRecord, ...keys: string[]): CxpRecord =>
      Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));

    async function exercise(failure: 'after-bank' | 'after-apply' | null) {
      const rollback = new Error(failure ?? 'rollback obligatorio de la prueba satisfactoria');
      let fixturePayment = 0;
      let fixtureDocument = 0;
      let fixtureApplication = 0;
      let reachedExecution = false;
      await assert.rejects(procesoStore.transaction(async tx => {
        const uuid = randomUUID();
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date());
        const amount = Number(document.saldoPendiente);
        assert.ok(amount > 0);
        fixtureDocument = await tx.create('documentos', {
          ...without(document, 'idDocumento', 'fechaCreacion', 'fechaModificacion'),
          serie: 'IT-ORA2014', numeroDocumento: uuid, uuidFiscal: uuid,
          hashOrigen: uuid, montoAplicado: 0, saldoPendiente: amount,
          observaciones: 'COPIA AISLADA ORA-02014; siempre ROLLBACK',
        });
        fixturePayment = await tx.create('pagos', {
          ...without(payment, 'idPago', 'fechaCreacion', 'fechaModificacion'),
          codigoPago: `CP-IT-${uuid}`, claveIdempotencia: uuid, idLote: null,
          estado: 'PROGRAMADO', fechaProgramada: today, fechaPago: null, fechaEfectiva: null,
          fechaModificacion: new Date().toISOString().replace('Z', ''),
          ejecutadoPor: null, conciliadoPor: null, numeroCheque: null, numeroTransferencia: null,
          montoObligacion: amount, montoTransferido: amount, montoAplicado: 0, montoNoAplicado: amount,
          concepto: 'COPIA AISLADA ORA-02014; siempre ROLLBACK',
        });
        fixtureApplication = await tx.create('aplicaciones', {
          ...without(application, 'idAplicacion', 'fechaCreacion'),
          idPago: fixturePayment, idDocumentoDestino: fixtureDocument,
          estado: 'PENDIENTE', montoPrincipal: amount, montoTotalAplicado: amount,
          saldoAnterior: amount, saldoPosterior: amount,
        });
        const scopedStore = (boundary: ProcesoTx): ProcesoStore => ({
          ...procesoStore, transaction: operation => operation(boundary),
        });
        const workflow = createPaymentWorkflow(scopedStore(tx));
        const scheduled = await tx.get(fixturePayment);
        const issued = await workflow.act(fixturePayment, { accion: 'emitir', version: scheduled.version }, executor);
        assert.equal(issued.estado, 'CHEQUE_EMITIDO');
        assert.equal(issued.transferencia?.estado, 'PROGRAMADA');

        if (failure) {
          const boundary: ProcesoTx = {
            ...tx,
            async apply(process, actor, stamp) {
              // Fallar después de que Bancos y el pago ya cambiaron, con y sin
              // haber consumido también la reserva y actualizado el documento.
              const advanced = await tx.get(process.id);
              assert.equal(advanced.transferencia?.estado, 'EJECUTADA');
              if (failure === 'after-apply') {
                await tx.apply(process, actor, stamp);
                assert.equal((await tx.row('documentos', fixtureDocument)).saldoPendiente, 0);
                assert.equal((await tx.row('aplicaciones', fixtureApplication)).estado, 'APLICADA');
              }
              reachedExecution = true;
              throw rollback;
            },
          };
          await createPaymentWorkflow(scopedStore(boundary))
            .act(fixturePayment, { accion: 'entregar', version: issued.version }, executor);
          assert.fail('La inyección debía fallar y salir por withCxpTransaction.rollback');
        }

        const executed = await workflow.act(fixturePayment, { accion: 'entregar', version: issued.version }, executor);
        reachedExecution = true;
        assert.equal(executed.estado, 'ENTREGADO');
        assert.equal(executed.transferencia?.estado, 'EJECUTADA');
        assert.deepEqual(executed.aplicaciones, [fixtureApplication]);
        assert.equal((await tx.row('documentos', fixtureDocument)).saldoPendiente, 0);
        assert.equal((await tx.row('pagos', fixturePayment)).montoAplicado, amount);
        for (const version of [issued.version, executed.version]) {
          await assert.rejects(workflow.act(fixturePayment, { accion: 'entregar', version }, executor), { status: 409 });
        }
        await assert.rejects(tx.bankAdvance(executed, executor, 'EJECUTAR'), { status: 409 });
        await assert.rejects(tx.apply(executed, executor, new Date().toISOString()), /No hay aplicaciones pendientes/);
        assert.equal((await tx.row('documentos', fixtureDocument)).montoAplicado, amount);
        assert.equal((await tx.row('pagos', fixturePayment)).montoAplicado, amount);
        throw rollback;
      }), error => error === rollback);
      assert.ok(reachedExecution, 'La prueba debe alcanzar el punto de ejecución esperado');
      assert.equal((await query('SELECT ID_PAGO FROM CXP_PAGO WHERE ID_PAGO = :id', { id: fixturePayment })).length, 0);
      assert.equal((await query('SELECT ID_DOCUMENTO FROM CXP_DOCUMENTO WHERE ID_DOCUMENTO = :id', { id: fixtureDocument })).length, 0);
      assert.equal((await query('SELECT ID_APLICACION FROM CXP_APLICACION WHERE ID_APLICACION = :id', { id: fixtureApplication })).length, 0);
      assert.equal((await query('SELECT TRANSFERENCIA_ID FROM MB_TRANSFERENCIA_BANCARIA WHERE PAGO_ID = :id', { id: fixturePayment })).length, 0);
      assert.equal((await query(`SELECT OPERACION_ID FROM MB_OPERACION_BANCARIA
        WHERE MODULO_ORIGEN = 'CXP' AND DOCUMENTO_ORIGEN_ID = :id`, { id: fixturePayment })).length, 0);
      assert.equal((await query('SELECT ID_EVENTO FROM CXP_EVENTO WHERE ID_PAGO = :id', { id: fixturePayment })).length, 0);
      assert.equal(await referenceSnapshot(), original, 'El proceso de referencia debe permanecer intacto');
    }

    await t.test('fallo después de Bancos revierte pago, transferencia, operación y eventos', () => exercise('after-bank'));
    await t.test('fallo después de aplicar revierte también saldos y consumo de reserva', () => exercise('after-apply'));
    await t.test('ejecuta la copia una sola vez y rechaza repetir o consumir otra vez la reserva', () => exercise(null));
  } finally {
    await inspector.rollback();
    await inspector.close();
    await closeOraclePool();
  }
});
