import assert from 'node:assert/strict';
import test from 'node:test';
import type { CxpRecord } from '@erp/contracts';
import { eligible } from './workflow';

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
