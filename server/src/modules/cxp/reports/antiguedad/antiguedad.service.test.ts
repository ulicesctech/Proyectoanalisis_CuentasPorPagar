import assert from 'node:assert/strict';
import test from 'node:test';
import type { AntiguedadResult, AntiguedadRow } from './antiguedad.repository';
import { resumirAntiguedad } from './antiguedad.service';

let siguiente = 1;
const fila = (idProveedor: number, saldoHistorico: number, rangoAntiguedad: string, diasAntiguedad = 0, moneda = 'GTQ'): AntiguedadRow => ({
  idDocumento: siguiente++, idProveedor, nombreProveedor: `Proveedor ${idProveedor}`, numeroDocumento: null,
  tipoDocumento: 'FACTURA', fechaDocumento: '2026-08-01', fechaVencimiento: '2026-09-01', moneda,
  totalNeto: saldoHistorico, saldoHistorico, diasAntiguedad, rangoAntiguedad, centroCosto: null,
});
const base = (detalle: AntiguedadRow[]): AntiguedadResult => ({
  fechaCorte: '2026-09-30', detalle,
  totales: { cantidadDocumentos: detalle.length, saldoTotal: detalle.reduce((total, row) => total + row.saldoHistorico, 0) },
});

test('antigüedad separa deuda vencida y no vencida sin errores de redondeo', () => {
  const reporte = resumirAntiguedad(base([
    fila(1, 100.1, '1-30', 10), fila(1, 200.2, 'NO VENCIDO'), fila(2, 0.3, 'SIN VENCIMIENTO'), fila(2, 50, 'MAS DE 120', 150),
  ]));
  assert.deepEqual(reporte.resumenPorMoneda, [{
    moneda: 'GTQ', cantidadDocumentos: 4, saldoTotal: 350.6, saldoVencido: 150.1, saldoNoVencido: 200.5,
  }]);
  assert.deepEqual(reporte.resumenPorRango.map(item => [item.rango, item.saldo]),
    [['NO VENCIDO', 200.2], ['SIN VENCIMIENTO', 0.3], ['1-30', 100.1], ['MAS DE 120', 50]]);
});

test('el ranking ordena proveedores por saldo dentro de cada moneda', () => {
  const reporte = resumirAntiguedad(base([
    fila(1, 100, '1-30', 5), fila(2, 300, 'NO VENCIDO'), fila(1, 50, '31-60', 40), fila(3, 999, '1-30', 3, 'USD'),
  ]));
  assert.deepEqual(reporte.rankingProveedores.map(item => [item.moneda, item.posicion, item.idProveedor, item.saldoTotal, item.participacion]), [
    ['GTQ', 1, 2, 300, 66.67], ['GTQ', 2, 1, 150, 33.33], ['USD', 1, 3, 999, 100],
  ]);
  const proveedor1 = reporte.rankingProveedores.find(item => item.idProveedor === 1)!;
  assert.equal(proveedor1.saldoVencido, 150);
  assert.equal(proveedor1.diasMaximos, 40);
  assert.equal(proveedor1.cantidadDocumentos, 2);
  assert.equal(reporte.resumenPorMoneda.length, 2);
});

test('un corte sin saldos devuelve resúmenes vacíos', () => {
  const reporte = resumirAntiguedad(base([]));
  assert.deepEqual([reporte.resumenPorMoneda, reporte.resumenPorRango, reporte.rankingProveedores], [[], [], []]);
});
