import assert from 'node:assert/strict';
import test from 'node:test';
import type { CxpRecord } from '@erp/contracts';
import { createPaymentWorkflow, eligible } from './workflow';
import type { ProcesoStore, ProcesoTx } from './ports';

test('el proceso no reserva facturas especiales aprobadas antes de emitirlas', () => {
  const document: CxpRecord = {
    idDocumento: 1, idProveedor: 2, idSucursal: 3, moneda: 'GTQ',
    naturaleza: 'D', estado: 'APROBADA', posibleDuplicado: 'N',
    saldoPendiente: 100, tipoDocumento: 'FACTURA_ESPECIAL',
  };
  assert.throws(() => eligible([document]), {
    status: 409, message: 'La factura especial debe emitirse antes de iniciar un proceso de pago',
  });
  assert.equal(eligible([{ ...document, estado: 'PENDIENTE_PAGO' }]).idDocumento, 1);
  assert.equal(eligible([{ ...document, tipoDocumento: 'FACTURA' }]).idDocumento, 1);
});

test('el proceso ordinario no reserva gastos de caja chica', () => {
  const document: CxpRecord = {
    idDocumento: 11, idProveedor: 2, idSucursal: 3, moneda: 'GTQ',
    naturaleza: 'D', estado: 'APROBADA', posibleDuplicado: 'N',
    saldoPendiente: 125, tipoDocumento: 'GASTO_CAJA_CHICA',
  };
  assert.throws(() => eligible([document]), { status: 409 });
  assert.equal(eligible([{ ...document, tipoDocumento: 'FACTURA' }]).idDocumento, 11);
});

test('valida el período con la sucursal persistida del documento y la fecha prevista del pago', async () => {
  const document: CxpRecord = {
    idDocumento: 133, idProveedor: 32, idSucursal: 1, moneda: 'GTQ',
    naturaleza: 'D', estado: 'APROBADA', posibleDuplicado: 'N',
    saldoPendiente: 100, tipoDocumento: 'FACTURA',
  };
  const checked: Array<{ branch: number; date: string }> = [];
  const stop = new Error('fin de la prueba tras comprobar el período');
  const tx = {
    actorExists: async () => {},
    byKey: async () => null,
    row: async () => document,
    openPeriod: async (branch: number, date: string) => {
      checked.push({ branch, date });
      throw stop;
    },
  } as unknown as ProcesoTx;
  const store = {
    transaction: async <T>(fn: (value: ProcesoTx) => Promise<T>) => fn(tx),
    list: async () => ({ data: [], page: 1, hasMore: false }),
    options: async () => ({ documentos: [], origenes: [], destinos: [], formasPago: [], bancosConfigurados: false }),
  } as ProcesoStore;
  const workflow = createPaymentWorkflow(store, () => new Date('2026-10-23T12:00:00Z'));

  await assert.rejects(workflow.create({
    idProveedor: 32, documentos: [133], idCuentaOrigen: 1, idCuentaDestino: 2,
    idFormaPago: 1, fecha: '2026-10-23', clave: 'd2fcde64-787b-44a1-9836-bc4e5340b07a',
  }, { id: 1, nombre: 'Operador', roles: [], permisos: ['CREAR'] }), error => error === stop);
  assert.deepEqual(checked, [{ branch: 1, date: '2026-10-23' }]);
});
