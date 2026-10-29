import assert from 'node:assert/strict';
import test from 'node:test';
import { CXP_SCHEMAS, prepareCxpRecord, type CxpRecord } from '@erp/contracts';
import { initialDocumentoRegistroValues } from '../src/modules/cxp/documentos/documentoEstado';
import { documentoFormErrors, documentoInput, documentoNumber, documentoPreview } from '../src/modules/cxp/documentos/documentoCaptura';
import { cxpFormRecord, cxpFormText, initialCxpFormValues } from '../src/modules/cxp/components/cxpFormValues';
import { documentoRegistroPayload } from '../src/modules/cxp/documentos/documentoRegistroPayload';

const complete = () => ({ ...initialDocumentoRegistroValues(7), idProveedor: '1', idSucursal: '1',
  idCondicionCredito: '1', serie: 'A', numeroDocumento: 'REGRESION-1', uuidFiscal: 'UUID-REGRESION',
  fechaDocumento: '2026-09-01', subtotal: '123.45', diferenciaRedondeo: '-0.01' });

test('el estado inicial real de registro contiene textos y obtiene moneda del esquema existente', () => {
  const values = initialDocumentoRegistroValues(7);
  assert.equal(values.moneda, CXP_SCHEMAS.documentos.create.shape.moneda.parse(undefined));
  assert.equal(values.creadoPor, '7'); assert.equal(values.tipoCambio, '1'); assert.equal(values.subtotal, '');
  assert.ok(Object.values(values).every(value => typeof value === 'string'));
  const errors = documentoFormErrors(values, 7, { wizard: true });
  assert.ok(errors.idProveedor); assert.ok(errors.idSucursal); assert.ok(errors.subtotal);
  assert.equal(errors.moneda, undefined); assert.deepEqual(documentoPreview(values, 7), {});
});

test('moneda ausente reproduce el dato causante pero genera validación, no excepción ni GTQ inventada', () => {
  const values = { ...initialDocumentoRegistroValues(7), moneda: undefined };
  assert.equal(documentoInput(values, 7).moneda, '');
  assert.ok(documentoFormErrors(values, 7, { wizard: true }).moneda);
  assert.doesNotThrow(() => documentoPreview(values, 7));
  assert.notEqual(cxpFormText(undefined), 'undefined');
});

test('opcionales ausentes o nulos se omiten; obligatorios ausentes o vacíos siguen siendo inválidos', () => {
  const values = { ...complete(), observaciones: undefined, nitEmisor: null, idDepartamento: null, hashOrigen: undefined };
  const input = documentoInput(values, 7);
  assert.equal(input.nitEmisor, undefined); assert.equal(input.idDepartamento, undefined);
  assert.deepEqual(documentoFormErrors(values, 7, { wizard: true }), {});
  for (const absent of [undefined, null, '', '   ']) {
    const empty = { ...values, moneda: absent, subtotal: absent, tipoCambio: absent, idSucursal: absent };
    const errors = documentoFormErrors(empty, 7, { wizard: true });
    for (const name of ['moneda', 'subtotal', 'tipoCambio', 'idSucursal']) assert.ok(errors[name], name);
    assert.ok(Number.isNaN(documentoInput(empty, 7).subtotal));
    assert.ok(Number.isNaN(documentoNumber(absent)));
  }
  assert.equal(documentoNumber(0), 0); assert.equal(documentoNumber('-0.01'), -0.01);
});

test('editar convierte escalares API a controles sin completar datos ausentes ni sustituir ceros', () => {
  const row: CxpRecord = { ...CXP_SCHEMAS.documentos.create.parse(documentoInput(complete(), 7)), idDocumento: 99, creadoPor: 4,
    fechaRecepcion: '2026-09-01T10:00:00', nitEmisor: null, observaciones: undefined, idDepartamento: null };
  delete row.hashOrigen;
  const values = initialCxpFormValues('documentos', row);
  assert.equal(values.creadoPor, '4'); assert.equal(values.subtotal, '123.45');
  assert.equal(values.nitEmisor, ''); assert.equal(values.observaciones, ''); assert.equal(values.hashOrigen, '');
  assert.deepEqual(documentoFormErrors(values, 7), {});
  assert.doesNotThrow(() => documentoFormErrors(row, 7));
  for (const supplied of [null, '', 0]) {
    const initial = initialCxpFormValues('documentos', null, { tipoCambio: supplied });
    assert.equal(initial.tipoCambio, supplied == null ? '' : String(supplied));
    assert.ok(documentoFormErrors(initial, 7).tipoCambio);
  }
  assert.equal(initialCxpFormValues('documentos', null, { moneda: 'USD' }).tipoCambio, '');
});

test('una colección de líneas nuevas usa su contrato; cantidades vacías no se convierten en cero', () => {
  const rows: CxpRecord[] = [{}, { idDocumento: 99, codigoArticulo: null, descripcion: undefined, cantidad: undefined }];
  const forms = rows.map(row => initialCxpFormValues('documentos-detalle', null, row));
  for (const values of forms) {
    assert.equal(values.descripcion, ''); assert.equal(values.cantidad, ''); assert.equal(values.precioUnitario, '');
    assert.ok(Object.values(values).every(value => typeof value === 'string' && value !== 'undefined'));
    const input = cxpFormRecord('documentos-detalle', values);
    assert.equal(input.cantidad, null); assert.equal(input.precioUnitario, null);
    assert.equal(CXP_SCHEMAS['documentos-detalle'].create.shape.cantidad.safeParse(input.cantidad).success, false);
    assert.equal(CXP_SCHEMAS['documentos-detalle'].create.shape.descripcion.safeParse(input.descripcion).success, false);
  }
});

test('completar el estado real produce el payload esperado con precisión y autoría de sesión', () => {
  const input = documentoInput({ ...complete(), observaciones: null, idProveedor: 1, tipoCambio: 1 }, 7);
  const parsed = CXP_SCHEMAS.documentos.create.parse(input) as CxpRecord;
  const payload = JSON.parse(JSON.stringify(documentoRegistroPayload(input, parsed)));
  assert.equal(payload.idProveedor, 1); assert.equal(payload.moneda, 'GTQ'); assert.equal(payload.tipoCambio, 1);
  assert.equal(payload.subtotal, 123.45); assert.equal(payload.diferenciaRedondeo, -0.01);
  for (const name of ['creadoPor', 'modificadoPor', 'observaciones']) assert.equal(Object.hasOwn(payload, name), false);
  assert.equal(prepareCxpRecord('documentos', parsed).totalLocal, 123.44);
});
