import assert from 'node:assert/strict';
import test from 'node:test';
import type { EstadisticaComprasResult, EstadisticaDocumento } from './estadistica.repository';
import { resumirEstadistica } from './estadistica.service';

let siguiente = 1;
const documento = (idProveedor: number, tipoDocumento: string, periodo: string, totalLocal: number): EstadisticaDocumento => ({
  idDocumento: siguiente++, idProveedor, nombreProveedor: `Proveedor ${idProveedor}`, tipoDocumento, periodo, totalLocal,
});
const base = (documentos: EstadisticaDocumento[], anterior: number): EstadisticaComprasResult & { documentos: EstadisticaDocumento[] } => ({
  fechaInicio: '2026-08-01', fechaFin: '2026-09-30', agrupacion: 'PERIODO', detalle: [],
  totales: { cantidadDocumentos: documentos.length, subtotal: 0, impuestoTotal: 0, retencionTotal: 0, totalNeto: 0, totalLocal: 0 },
  periodoComparable: { fechaInicio: '2026-06-01', fechaFin: '2026-07-31', totalLocal: anterior, disponible: anterior > 0 },
  validacion: { estado: 'VALIDO', errores: [], advertencias: [] }, documentos,
});

test('estadística resume compras por mes, proveedor y tipo sin enviar los documentos', () => {
  const reporte = resumirEstadistica(base([
    documento(1, 'FACTURA', '2026-08', 100.1), documento(2, 'FACTURA', '2026-09', 300.2), documento(1, 'NOTA_DEBITO', '2026-09', 99.7),
  ], 400));
  assert.equal('documentos' in reporte, false);
  assert.deepEqual(reporte.resumen.porMes, [
    { periodo: '2026-08', cantidad: 1, totalLocal: 100.1 }, { periodo: '2026-09', cantidad: 2, totalLocal: 399.9 },
  ]);
  assert.deepEqual(reporte.resumen.porProveedor.map(item => [item.posicion, item.idProveedor, item.totalLocal, item.participacion]),
    [[1, 2, 300.2, 60.04], [2, 1, 199.8, 39.96]]);
  assert.deepEqual(reporte.resumen.porTipoDocumento.map(item => [item.tipoDocumento, item.totalLocal]),
    [['FACTURA', 400.3], ['NOTA_DEBITO', 99.7]]);
  assert.equal(reporte.resumen.variacionTotal, 25);
});

test('sin compras en el período anterior la variación no se calcula', () => {
  assert.equal(resumirEstadistica(base([documento(1, 'FACTURA', '2026-09', 50)], 0)).resumen.variacionTotal, null);
});
