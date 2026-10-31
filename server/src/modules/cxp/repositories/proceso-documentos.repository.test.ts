import assert from 'node:assert/strict';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { listEligibleProcessDocuments } from './proceso-documentos.repository';

test('sugerencias: busca números comerciales sin proveedor, con límite y elegibilidad/reservas en SQL', async () => {
  const calls: {sql: string; binds: any}[] = [];
  const connection = { execute: async (sql: string, binds: unknown) => {
    calls.push({sql,binds}); return {rows:[{ID_DOCUMENTO:77,SERIE:'A',NUMERO_DOCUMENTO:'123',NO_FACTURA_COMPRA:'C-123',ID_PROVEEDOR:8,PROVEEDOR_NOMBRE:'Proveedor real',ID_SUCURSAL:2,MONEDA:'GTQ ',SALDO_PENDIENTE:50}]};
  } } as unknown as Connection;
  const rows=await listEligibleProcessDocuments(connection,'123');
  assert.equal(calls[0].binds.provider.val,null);
  assert.equal(calls[0].binds.search.val,'%123%');
  assert.match(calls[0].sql,/UPPER\(D.NUMERO_DOCUMENTO\) LIKE :search/);
  assert.match(calls[0].sql,/UPPER\(D.NO_FACTURA_COMPRA\) LIKE :search/);
  assert.doesNotMatch(calls[0].sql,/TO_CHAR\(D.ID_DOCUMENTO\).*LIKE/);
  assert.match(calls[0].sql,/FETCH FIRST 20 ROWS ONLY/);
  for (const clause of ["D.NATURALEZA = 'D'","D.POSIBLE_DUPLICADO = 'N'","D.SALDO_PENDIENTE > 0","A.ESTADO = 'PENDIENTE'","P.CODIGO_PAGO LIKE 'CP-%'","D.TIPO_DOCUMENTO <> 'GASTO_CAJA_CHICA'"]) assert.ok(calls[0].sql.includes(clause));
  assert.equal(rows[0].nombre,'A · 123'); assert.equal(rows[0].proveedorNombre,'Proveedor real'); assert.equal(rows[0].sucursal,2); assert.equal(rows[0].moneda,'GTQ');
  await listEligibleProcessDocuments(connection,'123',8); assert.equal(calls[1].binds.provider.val,8);
  assert.match(calls[1].sql,/:provider IS NULL OR D.ID_PROVEEDOR = :provider/);
  await listEligibleProcessDocuments(connection); assert.match(calls[2].sql,/:provider IS NOT NULL OR :search IS NOT NULL/);
});
