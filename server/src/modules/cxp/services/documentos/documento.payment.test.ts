import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import type { withCxpTransaction } from '../../repositories/crud.repository';
import { cxpPagoRepository } from '../../repositories/pagos/pago.repository';
import { createCxpService } from '../crud.service';
import { createDocumentoPaymentOperations, listDocumentoEligiblePaymentsWithConnection } from './documento.payment';

type Row = Record<string, string | number | null>;

function fakeDatabase(paymentAvailable = 420) {
  const rows = new Map<string, Row>([
    ['CXP_DOCUMENTO:1', {
      ID_DOCUMENTO: 1, ID_PROVEEDOR: 7, NATURALEZA: 'D', ESTADO: 'APROBADA', MONEDA: 'GTQ',
      SUBTOTAL: 420, DESCUENTO_TOTAL: 0, IMPUESTO_TOTAL: 0, RETENCION_TOTAL: 0,
      RECARGO_TOTAL: 0, GASTO_ADICIONAL_TOTAL: 0, DIFERENCIA_REDONDEO: 0,
      TOTAL_BRUTO: 420, TOTAL_NETO: 420, TIPO_CAMBIO: 1, MONTO_APLICADO: 0, SALDO_PENDIENTE: 420,
    }],
    ['CXP_PAGO:2', {
      ID_PAGO: 2, ID_PROVEEDOR: 7, TIPO_PAGO: 'ORDINARIO', CODIGO_PAGO: 'P-2',
      MONEDA: 'GTQ', ESTADO: 'CONFIRMADO', MONTO_OBLIGACION: paymentAvailable,
      MONTO_APLICADO: 0, MONTO_NO_APLICADO: paymentAvailable,
    }],
  ]);
  const writes: string[] = [];
  let failInsert = false;
  let failEvent = false;
  let pendingReservation = false;
  const connection = {
    async execute(sql: string, binds: Record<string, any>) {
      if (sql.includes('FROM USUARIO')) return { rows: binds.id === 9 ? [{ PRESENTE: 1 }] : [] };
      if (sql.includes('FROM CXP_APLICACION A JOIN CXP_PAGO P')) {
        assert.match(sql, /A\.ESTADO = 'PENDIENTE'/);
        assert.match(sql, /P\.ESTADO NOT IN/);
        return { rows: pendingReservation ? [{ PRESENTE: 1 }] : [] };
      }
      if (sql.includes('FROM DUAL')) return { rows: [{ FECHA: '2026-10-05T12:00:00.000000' }] };
      if (sql.includes('FROM CXP_PAGO') && sql.includes('FETCH FIRST 50')) {
        const payment = rows.get('CXP_PAGO:2')!;
        return { rows: payment.ID_PROVEEDOR === binds.idProveedor && payment.MONEDA === binds.moneda &&
          Number(payment.MONTO_NO_APLICADO) > 0 && payment.TIPO_PAGO === 'ORDINARIO' && !String(payment.CODIGO_PAGO).startsWith('CP-') &&
          ['EJECUTADO', 'CONFIRMADO', 'PARCIALMENTE_APLICADO', 'APLICADO', 'CONCILIADO'].includes(String(payment.ESTADO))
          ? [{ ...payment }] : [] };
      }
      const selected = sql.match(/FROM (CXP_\w+) WHERE \w+ = :id/);
      if (selected) {
        const row = rows.get(`${selected[1]}:${binds.id}`);
        return { rows: row ? [{ ...row }] : [] };
      }
      const updated = sql.match(/^UPDATE (CXP_\w+) SET /);
      if (updated) {
        const row = rows.get(`${updated[1]}:${binds.id}`);
        assert.ok(row);
        for (const match of sql.matchAll(/([A-Z_]+) = (?:TO_TIMESTAMP\()?:v(\d+)/g)) {
          row[match[1]] = binds[`v${match[2]}`].val;
        }
        writes.push(sql);
        return { rowsAffected: 1 };
      }
      if (sql.startsWith('INSERT INTO CXP_APLICACION')) {
        if (failInsert) throw new Error('Fallo de inserción');
        const columns = sql.match(/INSERT INTO CXP_APLICACION \(([^)]+)\)/)![1].split(', ');
        const row: Row = { ID_APLICACION: 3 };
        columns.forEach((column, index) => { row[column] = binds[`v${index}`].val; });
        rows.set('CXP_APLICACION:3', row);
        writes.push(sql);
        return { outBinds: { newId: [3] } };
      }
      if (sql.startsWith('INSERT INTO CXP_EVENTO')) {
        if (failEvent) throw new Error('Fallo de bitácora');
        writes.push(sql);
        return { outBinds: { newId: [4] } };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  } as unknown as Connection;
  const run = (async <T>(operation: (connection: Connection) => Promise<T>) => {
    const snapshot = new Map([...rows].map(([key, value]) => [key, { ...value }]));
    const writeCount = writes.length;
    try { return await operation(connection); }
    catch (error) {
      rows.clear();
      for (const [key, value] of snapshot) rows.set(key, value);
      writes.splice(writeCount);
      throw error;
    }
  }) as typeof withCxpTransaction;
  return { rows, writes, connection, run, setFailInsert: () => { failInsert = true; },
    setFailEvent: () => { failEvent = true; },
    setPendingReservation: (value: boolean) => { pendingReservation = value; } };
}

const request = (monto: number) => ({ idPago: 2, monto, aplicadoPor: 9 });

test('el expediente respeta cualquier reserva PAGO pendiente y los pagos del proceso RF07/RF10', async () => {
  const db = fakeDatabase();
  const operation = createDocumentoPaymentOperations(db.run);
  db.setPendingReservation(true);
  await assert.rejects(operation.apply(1, request(200)), { status: 409 });
  db.setPendingReservation(false);
  db.rows.get('CXP_PAGO:2')!.CODIGO_PAGO = 'CP-2';
  assert.equal((await listDocumentoEligiblePaymentsWithConnection(db.connection, 1)).length, 0);
  await assert.rejects(operation.apply(1, request(200)), { status: 409 });
  assert.equal(db.writes.length, 0);
});

test('el expediente no revierte una aplicación durante una reserva ni la de un pago CP', async () => {
  const db = fakeDatabase();
  const operation = createDocumentoPaymentOperations(db.run);
  await operation.apply(1, request(200));
  const reversal = { revertidoPor: 9, motivoReverso: 'Corrección' };
  db.setPendingReservation(true);
  await assert.rejects(operation.reverse(1, 3, reversal), { status: 409 });
  db.setPendingReservation(false);
  db.rows.get('CXP_PAGO:2')!.CODIGO_PAGO = 'CP-2';
  await assert.rejects(operation.reverse(1, 3, reversal), { status: 409 });
  assert.equal(db.rows.get('CXP_APLICACION:3')?.ESTADO, 'APLICADA');
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 220);
});

test('Q200 aplicados a Q420 dejan Q220 y registran la aplicación', async () => {
  const db = fakeDatabase();
  const payments = await listDocumentoEligiblePaymentsWithConnection(db.connection, 1);
  assert.equal(payments.length, 1);
  const applied = await createDocumentoPaymentOperations(db.run).apply(1, request(200));
  assert.equal(applied.saldoAnterior, 420);
  assert.equal(applied.saldoPosterior, 220);
  assert.equal(applied.montoPrincipal, 200);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 220);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.ESTADO, 'PARCIALMENTE_PAGADA');
  assert.equal(db.rows.get('CXP_PAGO:2')?.MONTO_NO_APLICADO, 220);
  assert.equal(db.rows.get('CXP_APLICACION:3')?.ESTADO, 'APLICADA');
  assert.equal(db.writes.filter(sql => sql.startsWith('INSERT INTO CXP_EVENTO')).length, 1);
});

test('una falla de bitácora revierte la aplicación y los saldos', async () => {
  const db = fakeDatabase();
  db.setFailEvent();
  await assert.rejects(createDocumentoPaymentOperations(db.run).apply(1, request(200)), /Fallo de bitácora/);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 420);
  assert.equal(db.rows.get('CXP_PAGO:2')?.MONTO_NO_APLICADO, 420);
  assert.equal(db.rows.has('CXP_APLICACION:3'), false);
  assert.equal(db.writes.length, 0);
});

test('una segunda aplicación no puede pagar más que el saldo restante', async () => {
  const db = fakeDatabase();
  const operation = createDocumentoPaymentOperations(db.run);
  await operation.apply(1, request(200));
  await assert.rejects(operation.apply(1, request(221)), { status: 400 });
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 220);
  assert.equal(db.rows.get('CXP_PAGO:2')?.MONTO_NO_APLICADO, 220);
  assert.equal(db.rows.get('CXP_APLICACION:3')?.MONTO_TOTAL_APLICADO, 200);
});

test('la aplicación total deja saldo cero y pago aplicado', async () => {
  const db = fakeDatabase();
  await createDocumentoPaymentOperations(db.run).apply(1, request(420));
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 0);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.ESTADO, 'PAGADA');
  assert.equal(db.rows.get('CXP_PAGO:2')?.ESTADO, 'APLICADO');
});

test('el exceso, actor inexistente y pago equivocado no escriben', async () => {
  const db = fakeDatabase(300);
  const operation = createDocumentoPaymentOperations(db.run);
  await assert.rejects(operation.apply(1, request(421)), { status: 400 });
  await assert.rejects(operation.apply(1, request(301)), { status: 400 });
  await assert.rejects(operation.apply(1, { ...request(200), aplicadoPor: 99 }), { status: 400 });
  db.rows.get('CXP_PAGO:2')!.ID_PROVEEDOR = 8;
  await assert.rejects(operation.apply(1, request(200)), { status: 400 });
  db.rows.get('CXP_PAGO:2')!.ID_PROVEEDOR = 7;
  db.rows.get('CXP_PAGO:2')!.ESTADO = 'BORRADOR';
  assert.equal((await listDocumentoEligiblePaymentsWithConnection(db.connection, 1)).length, 0);
  await assert.rejects(operation.apply(1, request(200)), { status: 400 });
  db.rows.get('CXP_PAGO:2')!.ESTADO = 'CONFIRMADO';
  db.rows.get('CXP_PAGO:2')!.TIPO_PAGO = 'ANTICIPO';
  await assert.rejects(operation.apply(1, request(200)), { status: 409 });
  assert.equal(db.writes.length, 0);
});

test('una inserción fallida revierte documento y pago', async () => {
  const db = fakeDatabase();
  db.setFailInsert();
  await assert.rejects(createDocumentoPaymentOperations(db.run).apply(1, request(200)), /Fallo de inserción/);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 420);
  assert.equal(db.rows.get('CXP_PAGO:2')?.MONTO_NO_APLICADO, 420);
  assert.equal(db.rows.has('CXP_APLICACION:3'), false);
});

test('la reversión restaura saldos y conserva motivo; no admite repetición ni otro documento', async () => {
  const db = fakeDatabase();
  const operation = createDocumentoPaymentOperations(db.run);
  await operation.apply(1, request(200));
  await assert.rejects(operation.reverse(4, 3, { revertidoPor: 9, motivoReverso: 'Error' }), { status: 404 });
  const reversed = await operation.reverse(1, 3, { revertidoPor: 9, motivoReverso: 'Pago equivocado' });
  assert.equal(reversed.estado, 'REVERTIDA');
  assert.equal(reversed.motivoReverso, 'Pago equivocado');
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 420);
  assert.equal(db.rows.get('CXP_PAGO:2')?.MONTO_NO_APLICADO, 420);
  await assert.rejects(operation.reverse(1, 3, { revertidoPor: 9, motivoReverso: 'Otra vez' }), { status: 409 });
  assert.equal(db.writes.filter(sql => sql.startsWith('INSERT INTO CXP_EVENTO')).length, 2);
});

test('una falla de bitácora revierte también el intento de reversión', async () => {
  const db = fakeDatabase();
  const operation = createDocumentoPaymentOperations(db.run);
  await operation.apply(1, request(200));
  db.setFailEvent();
  await assert.rejects(operation.reverse(1, 3, { revertidoPor: 9, motivoReverso: 'Error' }), /Fallo de bitácora/);
  assert.equal(db.rows.get('CXP_APLICACION:3')?.ESTADO, 'APLICADA');
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 220);
  assert.equal(db.rows.get('CXP_PAGO:2')?.MONTO_NO_APLICADO, 220);
  assert.equal(db.writes.filter(sql => sql.startsWith('INSERT INTO CXP_EVENTO')).length, 1);
});

test('el CRUD de pagos no puede crear un pago confirmado ni promover un borrador', async () => {
  const db = fakeDatabase();
  const service = createCxpService(cxpPagoRepository, db.run);
  await assert.rejects(service.create({
    idProveedor: 7, idSucursal: 1, idFormaPago: 1, idCuentaOrigen: 1, idCuentaDestino: 2,
    codigoPago: 'P-3', fechaProgramada: '2026-10-05', montoObligacion: 420,
    concepto: 'Pago de factura', claveIdempotencia: 'P-3', programadoPor: 9,
    estado: 'CONFIRMADO', ejecutadoPor: 10, fechaPago: '2026-10-05T12:00:00',
  }), { status: 409 });
  db.rows.get('CXP_PAGO:2')!.ESTADO = 'BORRADOR';
  await assert.rejects(service.update(2, { estado: 'CONFIRMADO' }), { status: 409 });
  await assert.rejects(service.create({
    idProveedor: 7, idSucursal: 1, idFormaPago: 1, idCuentaOrigen: 1, idCuentaDestino: 2,
    codigoPago: 'CP-00000003', fechaProgramada: '2026-10-05', montoObligacion: 420,
    concepto: 'Pago ordinario', claveIdempotencia: 'P-3', programadoPor: 9,
  }), { status: 409 });
  await assert.rejects(service.update(2, { codigoPago: 'CP-00000002' }), { status: 409 });
  assert.equal(db.writes.length, 0);
});
