import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import type { ActorProceso, ProcesoPago } from '@erp/contracts';
import { advancePaymentInstrument } from './proceso-bank.repository';

const process = { id: 40, formaPago: 1, moneda: 'GTQ', proveedor: 2 } as ProcesoPago;
const actor: ActorProceso = { id: 3, nombre: 'Ejecutor', roles: [], permisos: ['TESORERIA'] };

function bank(initialState: string | null) {
  let state = initialState;
  const writes: Array<{ sql: string; binds: Record<string, unknown> }> = [];
  const connection = {
    async execute(sql: string, binds: Record<string, unknown>) {
      if (sql.includes('FROM CXC_FORMAS_PAGO')) {
        return { rows: [{ ID_FORMA_PAGO: 1, NOMBRE: 'TRANSFERENCIA' }] };
      }
      if (sql.includes('FROM MB_TRANSFERENCIA_BANCARIA')) {
        assert.match(sql, /FOR UPDATE/);
        assert.doesNotMatch(sql, /FETCH FIRST/);
        assert.equal(binds.paymentId, process.id);
        return { rows: state === null ? [] : [{
          TRANSFERENCIA_ID: 60, OPERACION_ID: 70, CUENTA_ORIGEN_ID: 80,
          CTA_PROVEEDOR_ID: 90, MONTO_ORIGEN: 100, ESTADO: state,
          REFERENCIA_BANCARIA: null,
        }] };
      }
      writes.push({ sql, binds });
      if (sql.includes('UPDATE MB_TRANSFERENCIA_BANCARIA')) state = 'EJECUTADA';
      return { rowsAffected: 1 };
    },
  } as unknown as Connection;
  return { connection, writes };
}

test('transferencia: ejecuta una vez y rechaza repetir antes de volver a escribir', async () => {
  const { connection, writes } = bank('PROGRAMADA');
  const result = await advancePaymentInstrument(connection, process, actor, 'EJECUTAR');
  assert.equal(result.transferencia?.estado, 'EJECUTADA');
  assert.equal(result.transferencia?.id, '60');
  assert.deepEqual(writes.map(call => call.binds), [
    { id: 60 }, { state: 'EJECUTADA', actorId: 3, id: 70 },
  ]);
  await assert.rejects(advancePaymentInstrument(connection, process, actor, 'EJECUTAR'), { status: 409 });
  assert.equal(writes.length, 2);
});

test('transferencia: no escribe si desapareció o ya no está programada al bloquearla', async () => {
  for (const state of [null, 'ANULADA', 'RECHAZADA', 'EJECUTADA']) {
    const { connection, writes } = bank(state);
    await assert.rejects(advancePaymentInstrument(connection, process, actor, 'EJECUTAR'), { status: 409 });
    assert.equal(writes.length, 0);
  }
});

test('transferencia: confirmar conserva la transferencia ejecutada y confirma su operación', async () => {
  const { connection, writes } = bank('EJECUTADA');
  const result = await advancePaymentInstrument(connection, process, actor, 'CONFIRMAR');
  assert.equal(result.transferencia?.estado, 'EJECUTADA');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].binds, { state: 'CONFIRMADA', actorId: 3, id: 70 });
});
