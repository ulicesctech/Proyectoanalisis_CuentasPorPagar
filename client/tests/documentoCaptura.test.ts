import assert from 'node:assert/strict';
import test from 'node:test';
import { CXP_DOCUMENTO_MONEDA_LOCAL, type CxpDocumentoMonedas } from '@erp/contracts';
import { cambioDocumento, documentoClearlyInvalid, documentoFormErrors, documentoInput, documentoPreview } from '../src/modules/cxp/documentos/documentoCaptura';
import { documentoRegistroPayload } from '../src/modules/cxp/documentos/documentoRegistroPayload';

// Catálogo simulado: no agrega monedas ni cotizaciones a Oracle.
const monedas: CxpDocumentoMonedas = { monedaLocal: CXP_DOCUMENTO_MONEDA_LOCAL, fuenteTasas: null,
  monedas: [{ codigo: 'GTQ', nombre: 'Quetzal' }, { codigo: 'USD', nombre: 'Dólar de prueba' }] };
const base = () => ({ idProveedor: '1', idSucursal: '1', idCondicionCredito: '1', creadoPor: '7',
  tipoDocumento: 'FACTURA', naturaleza: 'D', tipoRegistro: 'SIN_OC', origenIngreso: 'FACTURACION_ELECTRONICA',
  serie: 'A', numeroDocumento: '1', uuidFiscal: 'uuid-prueba', fechaDocumento: '2026-09-01',
  moneda: 'GTQ', tipoCambio: '1', fuenteTipoCambio: '', fechaTipoCambio: '',
  subtotal: '100', descuentoTotal: '10', impuestoTotal: '12', retencionTotal: '5',
  recargoTotal: '2', gastoAdicionalTotal: '3', diferenciaRedondeo: '-0.01' });
const errors = (values: Record<string, string>) => documentoFormErrors(values, 7, { wizard: true, monedas });

test('usa la fórmula decimal existente, incluidos descuentos, retenciones y redondeo con signo', () => {
  assert.deepEqual(errors(base()), {});
  assert.deepEqual(documentoPreview(base(), 7), { totalBruto: 106.99, totalNeto: 101.99, totalLocal: 101.99, saldoPendiente: 101.99 });
  assert.equal(errors({ ...base(), diferenciaRedondeo: '0.01' }).diferenciaRedondeo, undefined);
  assert.equal(documentoClearlyInvalid('diferenciaRedondeo', '-0.01'), false);
});

test('al cambiar moneda exige tasa extranjera; no conserva silenciosamente el 1 local', () => {
  const foreign = cambioDocumento(base(), 'moneda', 'USD', monedas.monedaLocal);
  assert.equal(foreign.tipoCambio, '');
  assert.ok(errors(foreign).tipoCambio);
  assert.equal(documentoPreview(foreign, 7).totalLocal, undefined);
  const valid = cambioDocumento(foreign, 'tipoCambio', '7.5', monedas.monedaLocal);
  assert.deepEqual(errors(valid), {});
  assert.equal(documentoPreview(valid, 7).totalLocal, 764.93);
  const local = cambioDocumento(valid, 'moneda', 'GTQ', monedas.monedaLocal);
  assert.equal(local.tipoCambio, '1');
  assert.equal(local.subtotal, '100');
});

test('vacío, cero, negativo y precisión inválida se distinguen de una tasa válida', () => {
  for (const tipoCambio of ['', '0', '-1', '.', '-', '1.123456789']) {
    assert.ok(errors({ ...base(), moneda: 'USD', tipoCambio }).tipoCambio, tipoCambio);
  }
  assert.equal(errors({ ...base(), moneda: 'USD', tipoCambio: '7.12345678' }).tipoCambio, undefined);
  assert.ok(errors({ ...base(), tipoCambio: '2' }).tipoCambio);
});

test('importes temporales no se convierten en cero y se corrigen las dependencias', () => {
  assert.ok(Number.isNaN(documentoInput({ ...base(), subtotal: '' }, 7).subtotal));
  assert.ok(errors({ ...base(), subtotal: '' }).subtotal);
  assert.equal(documentoClearlyInvalid('subtotal', '-'), false);
  assert.equal(documentoClearlyInvalid('subtotal', '-1'), true);
  assert.ok(errors({ ...base(), subtotal: '-1' }).subtotal);
  assert.ok(errors({ ...base(), descuentoTotal: '200' }).descuentoTotal);
  assert.ok(errors({ ...base(), retencionTotal: '200' }).retencionTotal);
  assert.deepEqual(errors(base()), {});
});

test('fecha nueva conserva tasa manual pero exige confirmación para esa fecha', () => {
  const foreign = cambioDocumento({ ...base(), moneda: 'USD' }, 'tipoCambio', '7.5', monedas.monedaLocal);
  const changed = cambioDocumento(foreign, 'fechaDocumento', '2026-09-02', monedas.monedaLocal);
  assert.equal(changed.tipoCambio, '7.5');
  assert.equal(changed.fechaTipoCambio, '2026-09-01');
  assert.ok(errors(changed).tipoCambio);
  const confirmed = cambioDocumento(changed, 'tipoCambio', changed.tipoCambio, monedas.monedaLocal);
  assert.equal(errors(confirmed).tipoCambio, undefined);
  const legacy = cambioDocumento({ ...base(), moneda: 'USD', tipoCambio: '7.5' }, 'fechaDocumento', '2026-09-02', monedas.monedaLocal);
  assert.equal(legacy.fechaTipoCambio, '2026-09-01');
  assert.ok(errors(legacy).tipoCambio);
});

test('el payload omite autoría y permite que el servidor la derive de la sesión', () => {
  const input = documentoInput(base(), 7);
  const payload = documentoRegistroPayload(input, input);
  assert.equal(Object.hasOwn(payload, 'creadoPor'), false);
  assert.equal(Object.hasOwn(payload, 'modificadoPor'), false);
});
