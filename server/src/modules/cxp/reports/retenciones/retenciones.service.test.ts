import assert from 'node:assert/strict';
import test from 'node:test';
import type { RetencionesResult, RetencionRow } from './retenciones.repository';
import { resumirRetenciones } from './retenciones.service';

let siguiente = 1;
const fila = (idProveedor: number, codigoTributo: string, monto: number, fechaAplicacion: string,
  numeroConstancia: string | null = null, moneda = 'GTQ'): RetencionRow => ({
  idTributo: siguiente++, idDocumento: siguiente, idProveedor, nombreProveedor: `Proveedor ${idProveedor}`,
  idSucursal: 1, tipoDocumento: 'FACTURA', numeroDocumento: null, fechaDocumento: fechaAplicacion, moneda,
  tipoTributo: 'RETENCION', codigoTributo, nombreTributo: codigoTributo === 'IVA' ? 'Retención IVA' : 'Retención ISR',
  baseImponible: monto * 10, porcentaje: 10, monto, montoRecuperable: 0, montoNoRecuperable: 0,
  numeroConstancia, periodoFiscal: null, fechaAplicacion, estado: 'CALCULADO',
});
const base = (detalle: RetencionRow[]): RetencionesResult => ({
  fechaInicio: '2026-08-01', fechaFin: '2026-09-30', detalle, resumenPorTributo: [],
  totales: { cantidad: detalle.length, baseImponible: 0, monto: 0, montoRecuperable: 0, montoNoRecuperable: 0 },
});

test('retenciones agrupa la tendencia por mes de aplicación, moneda y tributo', () => {
  const reporte = resumirRetenciones(base([
    fila(1, 'IVA', 10.1, '2026-08-05'), fila(2, 'IVA', 20.2, '2026-08-20'),
    fila(1, 'ISR', 5, '2026-09-01'), fila(1, 'IVA', 1, '2026-09-02', null, 'USD'),
  ]));
  assert.deepEqual(reporte.resumenPorMes.map(item => [item.periodo, item.moneda, item.codigoTributo, item.cantidad, item.monto]), [
    ['2026-08', 'GTQ', 'IVA', 2, 30.3], ['2026-09', 'GTQ', 'ISR', 1, 5], ['2026-09', 'USD', 'IVA', 1, 1],
  ]);
});

test('retenciones por proveedor separa tributos, cuenta constancias y ordena por monto', () => {
  const reporte = resumirRetenciones(base([
    fila(1, 'IVA', 10, '2026-08-05', 'C-1'), fila(1, 'ISR', 5, '2026-08-06'), fila(2, 'IVA', 40, '2026-08-07', 'C-2'),
  ]));
  assert.deepEqual(reporte.resumenPorProveedor.map(item => [item.idProveedor, item.monto, item.cantidad, item.conConstancia]),
    [[2, 40, 1, 1], [1, 15, 2, 1]]);
  assert.deepEqual(reporte.resumenPorProveedor[1].porTributo.map(item => [item.codigoTributo, item.monto]),
    [['ISR', 5], ['IVA', 10]]);
});
