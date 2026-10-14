import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { consultarAntiguedad } from './antiguedad/antiguedad.repository';
import { generarExcelAntiguedad } from './antiguedad/antiguedad.excel';
import { generarPdfAntiguedad } from './antiguedad/antiguedad.pdf';
import { consultarRetenciones } from './retenciones/retenciones.repository';
import { consultarAsisteCompras } from './asiste-compras/asiste-compras.repository';
import { consultarLibroCompras } from './libro-compras/libro-compras.repository';
import { obtenerAntiguedad } from './antiguedad/antiguedad.service';
import { obtenerEstadisticaCompras } from './estadistica/estadistica.service';

function fakeConnection(rows: Record<string, unknown>[][]) {
  const sql: string[] = [];
  const binds: Record<string, unknown>[] = [];
  let closed = false;
  const connection = {
    async execute(statement: string, params: Record<string, unknown>) {
      sql.push(statement);
      binds.push(params);
      return { rows: rows[sql.length - 1] ?? [] };
    },
    async close() { closed = true; },
  } as unknown as Connection;
  const factory = async () => connection;
  return { sql, binds, factory, get closed() { return closed; } };
}

test('antigüedad usa aplicaciones vigentes al corte y conserva saldos históricos aunque hoy estén pagados', async () => {
  const db = fakeConnection([[{
    ID_DOCUMENTO: 1, ID_PROVEEDOR: 7, NUMERO_DOCUMENTO: 'F-1', TIPO_DOCUMENTO: 'FACTURA',
    FECHA_DOCUMENTO: '2026-09-01', FECHA_VENCIMIENTO: '2026-09-16',
    MONEDA: 'GTQ', TOTAL_NETO: 100, SALDO_HISTORICO: 40, DIAS_ANTIGUEDAD: 14,
    RANGO_ANTIGUEDAD: '1-30', CENTRO_COSTO: null,
  }]]);
  const result = await consultarAntiguedad({ fechaCorte: '2026-09-30' }, db.factory);
  assert.equal(result.totales.saldoTotal, 40);
  assert.equal(result.detalle.length, 1);
  assert.ok(db.sql[0].includes("a.ESTADO = 'REVERTIDA' AND a.FECHA_REVERSO >="));
  assert.ok(!db.sql[0].includes('d.SALDO_PENDIENTE'));
  assert.ok(db.closed);
  assert.equal((await generarExcelAntiguedad(result)).subarray(0, 2).toString(), 'PK');
  assert.equal((await generarPdfAntiguedad(result)).subarray(0, 4).toString(), '%PDF');
});

test('RF21 limita el detalle a retenciones no anuladas de documentos vigentes', async () => {
  const db = fakeConnection([[]]);
  const result = await consultarRetenciones({ fechaInicio: '2026-09-01', fechaFin: '2026-09-30' }, db.factory);
  assert.equal(result.totales.cantidad, 0);
  assert.match(db.sql[0], /t\.TIPO_TRIBUTO = 'RETENCION'/);
  assert.match(db.sql[0], /t\.ESTADO <> 'ANULADO'/);
  assert.match(db.sql[0], /d\.ESTADO <> 'ANULADA'/);
});

test('RF20 asocia tributos por documento con una sola consulta de tributos', async () => {
  const db = fakeConnection([
    [{ ID_PERIODO: 3, ID_SUCURSAL: 4, ESTADO: 'ABIERTO', FECHA_INICIO: '2026-09-01', FECHA_FIN: '2026-09-30' }],
    [{ ID_DOCUMENTO: 1, ID_PROVEEDOR: 7, TIPO_DOCUMENTO: 'FACTURA', NUMERO_DOCUMENTO: 'F-1',
      FECHA_DOCUMENTO: '2026-09-01', MONEDA: 'GTQ', TIPO_CAMBIO: 1,
      SUBTOTAL: 100, IMPUESTO_TOTAL: 12, RETENCION_TOTAL: 0, TOTAL_NETO: 112,
      TOTAL_LOCAL: 112, ESTADO: 'APROBADA', CENTRO_COSTO: null }],
    [{ ID_DOCUMENTO: 1, TIPO_TRIBUTO: 'IMPUESTO', CODIGO_TRIBUTO: 'IVA', NOMBRE_TRIBUTO: 'IVA',
      BASE_IMPONIBLE: 100, PORCENTAJE: 12, MONTO: 12, NUMERO_CONSTANCIA: null,
      PERIODO_FISCAL: null, FECHA_APLICACION: null, ESTADO: 'CALCULADO' }],
  ]);
  const result = await consultarAsisteCompras({ fechaInicio: '2026-09-01', fechaFin: '2026-09-30' }, db.factory);
  assert.equal(result.documentos[0].tributos.length, 1);
  assert.equal(db.binds[1].idSucursal, 4);
  assert.equal(db.sql.filter(query => query.includes('FROM CXP_DOCUMENTO_TRIBUTO')).length, 1);
  assert.equal(db.sql.length, 3);
});

test('libro de compras suma cada encabezado una vez aunque tenga varios tributos', async () => {
  const db = fakeConnection([
    [],
    [{ ID_DOCUMENTO: 1, ID_PROVEEDOR: 7, TIPO_DOCUMENTO: 'FACTURA', SERIE: 'A',
      NUMERO_DOCUMENTO: '1', UUID_FISCAL: null, NIT_EMISOR: '123', FECHA_DOCUMENTO: '2026-09-01',
      MONEDA: 'GTQ', SUBTOTAL: 100, IMPUESTO_TOTAL: 12, RETENCION_TOTAL: 0,
      TOTAL_NETO: 112, TOTAL_LOCAL: 112, ESTADO: 'APROBADA' }],
    [{ ID_TRIBUTO: 1, ID_DOCUMENTO: 1, TIPO_TRIBUTO: 'IMPUESTO', CODIGO_TRIBUTO: 'IVA',
      NOMBRE_TRIBUTO: 'IVA', BASE_IMPONIBLE: 100, PORCENTAJE: 12, MONTO: 12,
      ESTADO: 'CALCULADO', PERIODO_FISCAL: null },
    { ID_TRIBUTO: 2, ID_DOCUMENTO: 1, TIPO_TRIBUTO: 'RETENCION', CODIGO_TRIBUTO: 'ISR',
      NOMBRE_TRIBUTO: 'ISR', BASE_IMPONIBLE: 100, PORCENTAJE: 5, MONTO: 5,
      ESTADO: 'CALCULADO', PERIODO_FISCAL: null }],
  ]);
  const result = await consultarLibroCompras({ fechaInicio: '2026-09-01', fechaFin: '2026-09-30' }, db.factory);
  assert.equal(result.totales.cantidadDocumentos, 1);
  assert.equal(result.totales.totalNeto, 112);
  assert.equal(result.tributos.length, 2);
  assert.match(db.sql[2], /t\.ESTADO <> 'ANULADO'/);
});

test('RF02 sin persistencia rechaza el filtro y la agrupación en vez de mezclar tipos de documento', async () => {
  await assert.rejects(obtenerAntiguedad({ fechaCorte: '2026-09-30', clasificacion: 'SERVICIOS' }), /RF02/);
  await assert.rejects(obtenerEstadisticaCompras({ fechaInicio: '2026-09-01', fechaFin: '2026-09-30', agrupacion: 'CLASIFICACION' }), /RF02/);
});
