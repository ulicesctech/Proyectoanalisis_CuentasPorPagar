import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularDocumentoComponentes, componenteLineaDatos, componenteTributoDatos, cxpMoneyPercent, prepareCxpRecord,
  type CxpConceptoLinea, type CxpConceptoTributo, type CxpRecord } from '@erp/contracts';
import { collectDocumentoValidationIssues } from '../../server/src/modules/cxp/services/documentos/documento.validation';
import { componentData, componentErrors, componentFormValues, taxFormData } from '../src/modules/cxp/documentos/documentoComponentesForm';

export const exampleLines = (): CxpConceptoLinea[] => [
  { clave: 'teclados', datos: componenteLineaDatos.parse({ descripcion: 'Teclados', cantidad: 2, precioUnitario: 150, descuento: 0 }) },
  { clave: 'mouse', datos: componenteLineaDatos.parse({ descripcion: 'Mouse', cantidad: 3, precioUnitario: 100, descuento: 50 }) },
];
export const exampleTax = (linea: string | null, clave = linea ?? 'general'): CxpConceptoTributo => ({
  clave, linea, calculo: 'PORCENTAJE', base: 'DERIVADA', tratamiento: 'NO_RECUPERABLE', baseRevisadaPara: null,
  datos: componenteTributoDatos.parse({ tipoTributo: 'IMPUESTO', codigoTributo: 'PRUEBA10', nombreTributo: 'Tasa ficticia local 10 %', baseImponible: 0, porcentaje: 10, monto: 0 }),
});
const header = () => prepareCxpRecord('documentos', { idDocumento: 99, idProveedor: 1, idSucursal: 1, tipoDocumento: 'FACTURA',
  origenIngreso: 'FACTURACION_ELECTRONICA', naturaleza: 'D', fechaDocumento: '2026-09-01', uuidFiscal: 'simulado', serie: 'A', numeroDocumento: 'PRUEBA',
  moneda: 'GTQ', tipoCambio: 1, subtotal: 600, descuentoTotal: 50, impuestoTotal: 55, retencionTotal: 0, estado: 'RECIBIDO' });
const oracleRows = (rows: CxpRecord[], ids: string[]) => rows.map((row, index) => ({
  ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, char => '_' + char).toUpperCase(), value])), ...Object.fromEntries(ids.map(key => [key, index + 1])),
})) as Record<string, string | number | null>[];

test('caso de aceptación: 600 − 50 + 55 = 605; una sola fuente supera RF04', () => {
  const document = header(), result = calcularDocumentoComponentes(document, exampleLines(), [exampleTax('teclados'), exampleTax('mouse')]);
  assert.deepEqual(result.issues, []); assert.deepEqual(result.lineas.map(row => [row.datos.subtotal, row.datos.impuesto]), [[300, 30], [250, 25]]);
  assert.equal(result.totales.subtotal, 600); assert.equal(result.totales.descuentoTotal, 50); assert.equal(result.totales.impuestoTotal, 55); assert.equal(result.totales.totalNeto, 605);
  assert.equal(document.totalNeto, 605); assert.ok(result.diferencias.every(row => row.diferencia === 0));
  const lines = oracleRows(result.lineas.map(row => row.datos), ['ID_DETALLE', 'NUMERO_LINEA']);
  const taxes = oracleRows(result.tributos.map((row, index) => ({ ...row.datos, idDetalle: index + 1, generadoPor: 1, estado: 'CALCULADO', fechaAplicacion: '2026-09-01' })), ['ID_TRIBUTO']);
  assert.deepEqual(collectDocumentoValidationIssues(document, lines, taxes), []);
});

test('tributo general se suma una vez, sin prorrateo y sin duplicar el desglose recuperable', () => {
  const result = calcularDocumentoComponentes(header(), exampleLines(), [exampleTax(null)]);
  assert.equal(result.totales.impuestoTotal, 55); assert.deepEqual(result.lineas.map(row => row.datos.impuesto), [0, 0]);
  const lines = oracleRows(result.lineas.map(row => row.datos), ['ID_DETALLE', 'NUMERO_LINEA']);
  const taxes = oracleRows(result.tributos.map(row => ({ ...row.datos, idDetalle: null, generadoPor: 1, estado: 'CALCULADO', fechaAplicacion: '2026-09-01' })), ['ID_TRIBUTO']);
  assert.deepEqual(collectDocumentoValidationIssues(header(), lines, taxes), []);
});

test('cantidad, precio y descuento recalculan bases derivadas; las manuales requieren revisión', () => {
  const lines = exampleLines(), tax = exampleTax('teclados');
  lines[0].datos.cantidad = 3; lines[0].datos.precioUnitario = 100; lines[0].datos.descuento = 50;
  assert.equal(calcularDocumentoComponentes(header(), lines, [tax]).tributos[0].datos.monto, 25);
  tax.base = 'MANUAL'; tax.datos.baseImponible = 300; tax.baseRevisadaPara = 300;
  assert.match(calcularDocumentoComponentes(header(), lines, [tax]).issues[0].mensaje, /Revisa/);
  tax.baseRevisadaPara = 250;
  const result = calcularDocumentoComponentes(header(), lines, [tax]);
  assert.deepEqual(result.issues, []); assert.equal(result.tributos[0].datos.baseImponible, 300); assert.equal(result.tributos[0].datos.monto, 30);
});

test('recuperación total, no recuperable y parcial; las retenciones se separan sin clasificarlas', () => {
  const tax = exampleTax('teclados'); tax.tratamiento = 'RECUPERABLE';
  let row = calcularDocumentoComponentes(header(), exampleLines(), [tax]).tributos[0];
  assert.deepEqual([row.datos.montoRecuperable, row.datos.montoNoRecuperable], [30, 0]);
  tax.tratamiento = 'NO_RECUPERABLE'; row = calcularDocumentoComponentes(header(), exampleLines(), [tax]).tributos[0];
  assert.deepEqual([row.datos.montoRecuperable, row.datos.montoNoRecuperable], [0, 30]);
  tax.tratamiento = 'PARCIAL'; tax.datos.montoRecuperable = 12; tax.datos.montoNoRecuperable = 18;
  assert.deepEqual(calcularDocumentoComponentes(header(), exampleLines(), [tax]).issues, []);
  tax.datos.montoNoRecuperable = 17; assert.ok(calcularDocumentoComponentes(header(), exampleLines(), [tax]).issues.length);
  tax.datos.tipoTributo = 'RETENCION'; tax.tratamiento = 'CONSERVAR';
  const result = calcularDocumentoComponentes(header(), exampleLines(), [tax]);
  assert.equal(result.totales.retencionTotal, 30); assert.equal(result.totales.impuestoTotal, 0); assert.equal(result.lineas[0].datos.retencion, 30);
});

test('conserva importes fijos e históricos; incluidos y percepciones mantienen impedimento RF04', () => {
  const tax = exampleTax('teclados'); tax.calculo = 'FIJO'; tax.baseRevisadaPara = 300; tax.datos.monto = 7.23;
  let result = calcularDocumentoComponentes(header(), exampleLines(), [tax]);
  assert.equal(result.tributos[0].datos.monto, 7.23); assert.equal(result.tributos[0].datos.porcentaje, 0);
  tax.calculo = 'CONSERVAR'; tax.datos.porcentaje = 1.111;
  result = calcularDocumentoComponentes(header(), exampleLines(), [tax]); assert.equal(result.tributos[0].datos.monto, 7.23);
  tax.datos.incluidoPrecio = 'S'; assert.match(calcularDocumentoComponentes(header(), exampleLines(), [tax]).impedimentos[0].mensaje, /incluidos/);
  tax.datos.incluidoPrecio = 'N'; tax.datos.tipoTributo = 'PERCEPCION'; tax.tratamiento = 'CONSERVAR';
  assert.match(calcularDocumentoComponentes(header(), exampleLines(), [tax]).impedimentos[0].mensaje, /percepciones/);
});

test('redondea el porcentaje una vez con precisión decimal; vacíos y negativos no se ocultan', () => {
  assert.equal(cxpMoneyPercent(0.05, 10), 0.01); assert.equal(cxpMoneyPercent(250, 10), 25); assert.equal(cxpMoneyPercent(1.23, 12.345678), 0.15);
  const values = componentFormValues('documentos-detalle');
  assert.equal(values.cantidad, ''); assert.ok(componentErrors(componenteLineaDatos, componentData('documentos-detalle', values)).cantidad);
  values.cantidad = '-1'; assert.ok(componentErrors(componenteLineaDatos, componentData('documentos-detalle', values)).cantidad);
  values.cantidad = '0'; assert.ok(componentErrors(componenteLineaDatos, componentData('documentos-detalle', values)).cantidad);
  const tax = exampleTax('teclados'), form = componentFormValues('documentos-tributos');
  assert.ok(componentErrors(componenteTributoDatos, taxFormData(form, tax, 300)).porcentaje);
  form.porcentaje = '-1'; assert.ok(componentErrors(componenteTributoDatos, taxFormData(form, tax, 300)).porcentaje);
  form.porcentaje = '10'; form.codigoTributo = 'PRUEBA10'; form.nombreTributo = 'Tasa de prueba';
  assert.equal(taxFormData(form, tax, 300).monto, 30);
  const lines = exampleLines(); lines[0].datos.cantidad = -1;
  assert.ok(calcularDocumentoComponentes(header(), lines, []).issues.length);
});
