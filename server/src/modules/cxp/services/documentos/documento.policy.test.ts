import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import type { CxpRecord } from '@erp/contracts';
import { applyCxpMovement } from '../application.service';
import { cxpDocumentoService } from './documento.service';
import {
  assertCxpDocumentoCreateState, assertCxpDocumentoCrudChange, assertCxpDocumentoForApplication,
} from './documento.policy';

type Row = Record<string, string | number | null>;

function documentRow(estado = 'APROBADA', saldo = 100, naturaleza = 'D', id = 1): Row {
  return {
    ID_DOCUMENTO: id, ID_PROVEEDOR: 7, NATURALEZA: naturaleza, ESTADO: estado, MONEDA: 'GTQ',
    SUBTOTAL: 100, DESCUENTO_TOTAL: 0, IMPUESTO_TOTAL: 0, RETENCION_TOTAL: 0,
    RECARGO_TOTAL: 0, GASTO_ADICIONAL_TOTAL: 0, DIFERENCIA_REDONDEO: 0,
    TOTAL_BRUTO: 100, TOTAL_NETO: 100, TIPO_CAMBIO: 1,
    MONTO_APLICADO: 100 - saldo, SALDO_PENDIENTE: saldo,
  };
}

function paymentRow(): Row {
  return {
    ID_PAGO: 2, ID_PROVEEDOR: 7, MONEDA: 'GTQ', TIPO_PAGO: 'ORDINARIO', ESTADO: 'CONFIRMADO',
    MONTO_OBLIGACION: 100, MONTO_APLICADO: 0, MONTO_NO_APLICADO: 100,
  };
}

function memoryConnection(initialRows: Record<string, Row>) {
  const rows = new Map(Object.entries(initialRows));
  const writes: string[] = [];
  const connection = {
    async execute(sql: string, binds: Record<string, unknown>) {
      const select = sql.match(/FROM (CXP_\w+) WHERE \w+ = :id/);
      if (select) {
        const row = rows.get(`${select[1]}:${binds.id}`);
        return { rows: row ? [{ ...row }] : [] };
      }
      const update = sql.match(/^UPDATE (CXP_\w+) SET /);
      if (update) {
        const row = rows.get(`${update[1]}:${binds.id}`);
        assert.ok(row, 'La fila para actualizar debe existir');
        for (const match of sql.matchAll(/([A-Z_]+) = :v(\d+)/g)) {
          row[match[1]] = (binds[`v${match[2]}`] as { val: string | number | null }).val;
        }
        writes.push(sql);
        return { rowsAffected: 1 };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  } as unknown as Connection;
  return { connection, rows, writes };
}

const paymentApplication: CxpRecord = {
  idDocumentoDestino: 1, idPago: 2, idDocumentoOrigen: null,
  tipoAplicacion: 'PAGO', montoTotalAplicado: 40, estadoCxc: 'NO_APLICA',
};

test('el CRUD rechaza la creación aprobada antes de abrir una conexión', async () => {
  assertCxpDocumentoCreateState({ estado: 'RECIBIDO' });
  assert.throws(() => assertCxpDocumentoCreateState({ estado: 'APROBADA' }), { status: 409 });
  await assert.rejects(cxpDocumentoService.create({
    idSucursal: 1, tipoDocumento: 'FACTURA', creadoPor: 1, subtotal: 100, estado: 'APROBADA',
  }), { status: 409 });
});

test('el CRUD no convierte un documento recibido en validado o aprobado por PATCH', () => {
  assert.throws(() => assertCxpDocumentoCrudChange({ estado: 'RECIBIDO' }, { estado: 'PENDIENTE_APROBACION' }), { status: 409 });
  assert.throws(() => assertCxpDocumentoCrudChange({ estado: 'PENDIENTE_APROBACION' }, { estado: 'APROBADA' }), { status: 409 });
  assert.throws(() => assertCxpDocumentoCrudChange({ estado: 'APROBADA', subtotal: 100 }, { subtotal: 200 }), { status: 409 });
  assert.throws(() => assertCxpDocumentoCrudChange({ estado: 'RECIBIDO', montoAplicado: 20, subtotal: 100 }, { subtotal: 200 }), { status: 409 });
});

test('los estados previos, finales y bloqueados rechazan la aplicación sin escrituras', async () => {
  for (const estado of [
    'RECIBIDO', 'BORRADOR', 'PENDIENTE_CLASIFICACION', 'PENDIENTE_REVISION',
    'EN_VALIDACION', 'CON_DIFERENCIAS', 'PENDIENTE_APROBACION', 'RECHAZADA',
    'BLOQUEADA', 'EN_DISPUTA', 'DUPLICADO', 'ANULADA', 'PAGADA', 'CERRADA',
  ]) {
    const db = memoryConnection({ 'CXP_DOCUMENTO:1': documentRow(estado), 'CXP_PAGO:2': paymentRow() });
    await assert.rejects(applyCxpMovement(db.connection, paymentApplication), { status: 409 }, estado);
    assert.equal(db.writes.length, 0, estado);
  }
});

test('una factura especial solo admite pagos después de emitirse', async () => {
  const approved = memoryConnection({
    'CXP_DOCUMENTO:1': { ...documentRow('APROBADA'), TIPO_DOCUMENTO: 'FACTURA_ESPECIAL' },
    'CXP_PAGO:2': paymentRow(),
  });
  await assert.rejects(applyCxpMovement(approved.connection, paymentApplication),
    { status: 409, message: 'La factura especial debe emitirse antes de recibir pagos' });
  assert.equal(approved.writes.length, 0);

  const issued = memoryConnection({
    'CXP_DOCUMENTO:1': { ...documentRow('PENDIENTE_PAGO'), TIPO_DOCUMENTO: 'FACTURA_ESPECIAL' },
    'CXP_PAGO:2': paymentRow(),
  });
  await applyCxpMovement(issued.connection, paymentApplication);
  assert.equal(issued.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 60);
  assert.equal(issued.rows.get('CXP_DOCUMENTO:1')?.ESTADO, 'PARCIALMENTE_PAGADA');
});

test('un crédito de origen no aprobado y un destino sin saldo no producen escrituras', async () => {
  const credit = memoryConnection({
    'CXP_DOCUMENTO:1': documentRow(),
    'CXP_DOCUMENTO:3': documentRow('RECIBIDO', 100, 'C', 3),
  });
  await assert.rejects(applyCxpMovement(credit.connection, {
    idDocumentoDestino: 1, idDocumentoOrigen: 3, tipoAplicacion: 'NOTA_CREDITO', montoTotalAplicado: 40,
  }), { status: 409 });
  assert.equal(credit.writes.length, 0);

  const paid = memoryConnection({ 'CXP_DOCUMENTO:1': documentRow('APROBADA', 0), 'CXP_PAGO:2': paymentRow() });
  await assert.rejects(applyCxpMovement(paid.connection, paymentApplication), { status: 409 });
  assert.equal(paid.writes.length, 0);
});

test('una aplicación parcial actualiza documento y pago; la reversión restaura los saldos', async () => {
  const db = memoryConnection({ 'CXP_DOCUMENTO:1': documentRow(), 'CXP_PAGO:2': paymentRow() });
  const applied = await applyCxpMovement(db.connection, paymentApplication);
  assert.equal(applied.saldoAnterior, 100);
  assert.equal(applied.saldoPosterior, 60);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 60);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.ESTADO, 'PARCIALMENTE_PAGADA');
  assert.equal(db.rows.get('CXP_PAGO:2')?.MONTO_NO_APLICADO, 60);

  await applyCxpMovement(db.connection, paymentApplication, true);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 100);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.MONTO_APLICADO, 0);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.ESTADO, 'PENDIENTE_PAGO');
  assert.equal(db.rows.get('CXP_PAGO:2')?.MONTO_NO_APLICADO, 100);
});

test('se rechaza un monto mayor que el saldo sin escrituras', async () => {
  const db = memoryConnection({ 'CXP_DOCUMENTO:1': documentRow(), 'CXP_PAGO:2': paymentRow() });
  await assert.rejects(applyCxpMovement(db.connection, { ...paymentApplication, montoTotalAplicado: 101 }), { status: 400 });
  assert.equal(db.writes.length, 0);
});

test('una aplicación total deja el documento pagado', async () => {
  const db = memoryConnection({ 'CXP_DOCUMENTO:1': documentRow(), 'CXP_PAGO:2': paymentRow() });
  await applyCxpMovement(db.connection, { ...paymentApplication, montoTotalAplicado: 100 });
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 0);
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.ESTADO, 'PAGADA');
  assert.equal(db.rows.get('CXP_PAGO:2')?.MONTO_NO_APLICADO, 0);
  assert.equal(db.rows.get('CXP_PAGO:2')?.ESTADO, 'APLICADO');
});

test('el crédito solo se aplica desde estados aprobados', () => {
  assertCxpDocumentoForApplication({ naturaleza: 'C', estado: 'APROBADA', saldoPendiente: 100 }, 'origen');
  assertCxpDocumentoForApplication({ naturaleza: 'C', estado: 'PARCIALMENTE_APLICADA', saldoPendiente: 40 }, 'origen');
  assert.throws(() => assertCxpDocumentoForApplication({ naturaleza: 'C', estado: 'PENDIENTE_APROBACION', saldoPendiente: 100 }, 'origen'), { status: 409 });
});

test('una nota de crédito aprobada reduce también su saldo disponible', async () => {
  const db = memoryConnection({
    'CXP_DOCUMENTO:1': documentRow(),
    'CXP_DOCUMENTO:3': documentRow('APROBADA', 100, 'C', 3),
  });
  await applyCxpMovement(db.connection, {
    idDocumentoDestino: 1, idDocumentoOrigen: 3, tipoAplicacion: 'NOTA_CREDITO', montoTotalAplicado: 40,
  });
  assert.equal(db.rows.get('CXP_DOCUMENTO:1')?.SALDO_PENDIENTE, 60);
  assert.equal(db.rows.get('CXP_DOCUMENTO:3')?.SALDO_PENDIENTE, 60);
  assert.equal(db.rows.get('CXP_DOCUMENTO:3')?.ESTADO, 'PARCIALMENTE_APLICADA');
});
