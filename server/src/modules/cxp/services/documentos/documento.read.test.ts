import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import {
  getDocumentoExpedienteWithConnection, listDocumentosWithConnection,
} from '../../repositories/documentos/documento.repository';
import { listDocumentoPage } from './documento.service';

test('la lista filtra antes de paginar y conserva el saldo almacenado', async () => {
  const calls: { sql: string; binds: Record<string, unknown> }[] = [];
  const connection = {
    async execute(sql: string, binds: Record<string, unknown>) {
      calls.push({ sql, binds });
      if (sql.includes('COUNT(*)')) return { rows: [{ TOTAL: 24 }] };
      return { rows: [{ ID_DOCUMENTO: 9, ID_PROVEEDOR: 2, PROVEEDOR_NOMBRE: 'Proveedor ejemplo',
        ESTADO: 'RECIBIDO', TOTAL_NETO: 100, MONTO_APLICADO: 25, SALDO_PENDIENTE: 60 }] };
    },
  } as unknown as Connection;
  const result = await listDocumentosWithConnection(connection, {
    page: 2, limit: 10, search: 'A-1', estado: 'RECIBIDO', idProveedor: 2, venceHasta: '2026-10-02',
  });
  assert.equal(result.total, 24);
  assert.equal(result.data[0]['saldoPendiente'], 60);
  assert.equal(result.data[0].proveedorNombre, 'Proveedor ejemplo');
  assert.equal(calls[0].binds.offset, 10);
  assert.equal(calls[0].binds.limit, 10);
  assert.equal(calls[1].binds.estado, 'RECIBIDO');
  for (const call of calls) {
    assert.match(call.sql, /ID_PROVEEDOR = :idProveedor/);
    assert.match(call.sql, /ESTADO = :estado/);
    assert.match(call.sql, /FECHA_VENCIMIENTO < TO_DATE\(:venceHasta, 'YYYY-MM-DD'\) \+ 1/);
  }
});

test('el expediente reúne todas las relaciones sin depender de la paginación del CRUD', async () => {
  const calls: string[] = [];
  const connection = {
    async execute(sql: string) {
      calls.push(sql);
      if (sql.includes('FROM CXP_DOCUMENTO WHERE')) return { rows: [{ ID_DOCUMENTO: 9, ID_PROVEEDOR: 2, ESTADO: 'RECIBIDO' }] };
      if (sql.includes('FROM PROVEEDOR')) return { rows: [{ PRO_NOMBRE_ENTIDAD: 'Proveedor ejemplo' }] };
      if (sql.includes('FROM CXP_DOCUMENTO_DETALLE')) return { rows: [{ ID_DETALLE: 1 }, { ID_DETALLE: 2 }] };
      if (sql.includes('FROM CXP_DOCUMENTO_TRIBUTO')) return { rows: [{ ID_TRIBUTO: 3 }] };
      if (sql.includes('FROM CXP_ARCHIVO')) return { rows: [{ ID_ARCHIVO: 5, ID_APLICACION: 4 }] };
      if (sql.includes('FROM CXP_APLICACION A JOIN CXP_PAGO P')) {
        return { rows: [{ ID_APLICACION: 4, CODIGO_PAGO: 'CP-00000002' }] };
      }
      if (sql.includes('FROM CXP_APLICACION WHERE')) {
        return { rows: [{ ID_APLICACION: 4 }, { ID_APLICACION: 6 }] };
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  } as unknown as Connection;
  const result = await getDocumentoExpedienteWithConnection(connection, 9);
  assert.equal(result?.documento.proveedorNombre, 'Proveedor ejemplo');
  assert.equal(result?.lineas.length, 2);
  assert.equal(result?.tributos.length, 1);
  assert.equal(result?.archivos.length, 1);
  assert.equal(result?.aplicaciones.length, 2);
  assert.equal(result?.aplicaciones[0].codigoPagoProceso, 'CP-00000002');
  assert.equal(result?.aplicaciones[1].codigoPagoProceso, null);
  assert.ok(calls.every(sql => !sql.includes('FETCH NEXT')));
  assert.ok(calls.some(sql => sql.includes('ID_APLICACION IN')));
});

test('una fecha inválida se rechaza antes de abrir Oracle', async () => {
  await assert.rejects(listDocumentoPage({ venceHasta: '2026-02-30' }), { status: 400 });
});
