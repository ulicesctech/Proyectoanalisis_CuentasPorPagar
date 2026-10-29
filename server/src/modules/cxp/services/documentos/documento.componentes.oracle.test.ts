import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import type { Connection } from 'oracledb';
import { documentoComponentesSchema } from '@erp/contracts';
import { config } from '../../../../config';
import { closeOraclePool, getConnection, initOraclePool } from '../../../../config/database';
import { createCxpRepository, type withCxpTransaction } from '../../repositories/crud.repository';
import { cxpDocumentoRepository } from '../../repositories/documentos/documento.repository';
import { createCxpService } from '../crud.service';
import { createDocumentoComponentOperations } from './documento.componentes';
import { createDocumentoValidationOperation } from './documento.service';
import { findUsuarioOperativoWithConnection } from '../../repositories/control/usuario.repository';
import { actorDesdeUsuario } from '../identidad';
import type { DteStorage } from './dte.storage';

test('Oracle local: conceptos, versión antigua, fallo con rollback y RF04 completo en documento propio', {
  skip: process.env.CXP_COMPONENTES_ORACLE !== '1', timeout: 60000,
}, async t => {
  assert.match(config.oracleConnection.connectString, /^(?:\/\/)?(?:localhost|127\.0\.0\.1):1521\/[a-z0-9_.-]+$/i,
    'Se rechaza toda instancia que no sea loopback explícito');
  await initOraclePool();
  const c = await getConnection(); let id: number | undefined;
  try {
    const host = await c.execute<{ HOST: string }>("SELECT SYS_CONTEXT('USERENV','SERVER_HOST') AS HOST FROM DUAL");
    assert.equal(host.rows![0].HOST.toLowerCase(), process.env.COMPUTERNAME!.toLowerCase());
    t.diagnostic('Destino efectivo loopback y host Oracle coincidente con este equipo. Sin DDL ni COMMIT.');
    const relations = await c.execute<{ PROVIDER: number; BRANCH: number; CREDIT: number; ACTOR: number }>(`SELECT
      (SELECT MIN(PRO_ID_PROVEEDOR) FROM PROVEEDOR) AS PROVIDER,
      (SELECT MIN(ID_SUCURSAL) FROM CXC_SUCURSALES) AS BRANCH,
      (SELECT MIN(ID_CONDICION) FROM CXC_CONDICIONES_CREDITO WHERE ESTADO='A') AS CREDIT,
      (SELECT MIN(U.USU_ID_USUARIO) FROM USUARIO U JOIN ROL R ON R.ROL_ID_ROL=U.USU_ID_ROL
        WHERE U.USU_ACTIVO=1 AND R.ROL_ACTIVO=1 AND TRIM(UPPER(R.ROL_NOMBRE_ROL))='OPERADOR_CXP') AS ACTOR FROM DUAL`);
    const ids = relations.rows![0]; for (const value of Object.values(ids)) assert.ok(value);
    const user = await findUsuarioOperativoWithConnection(c, ids.ACTOR); assert.ok(user);
    const actor = actorDesdeUsuario(user);
    let failEvent = false;
    const proxy = new Proxy(c, { get(target, property) {
      if (property === 'execute') return async (...args: Parameters<Connection['execute']>) => {
        if (failEvent && String(args[0]).startsWith('INSERT INTO CXP_EVENTO')) throw new Error('Fallo inyectado después del DML real');
        return (target.execute as Function).apply(target, args);
      };
      const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
    } });
    const run = (async <T>(operation: (connection: Connection) => Promise<T>) => {
      await c.execute('SAVEPOINT CXP_COMPONENT_CASE');
      try { return await operation(proxy); } catch (error) { await c.execute('ROLLBACK TO CXP_COMPONENT_CASE'); throw error; }
    }) as typeof withCxpTransaction;
    const suffix = randomUUID();
    const created = await createCxpService(cxpDocumentoRepository, run).create({
      idProveedor: ids.PROVIDER, idSucursal: ids.BRANCH, idCondicionCredito: ids.CREDIT,
      tipoDocumento: 'FACTURA', origenIngreso: 'FACTURACION_ELECTRONICA', fechaDocumento: '2026-09-01',
      serie: 'COMP-PRUEBA', numeroDocumento: suffix, uuidFiscal: suffix, subtotal: 0,
    }, actor.id);
    id = Number(created.idDocumento);
    const operations = createDocumentoComponentOperations(run), initial = await operations.read(id);
    const payload = documentoComponentesSchema.parse({ version: initial.version, adoptarTotales: true,
      lineas: [{ clave: 'a', datos: { descripcion: 'Teclados - prueba local', cantidad: 2, precioUnitario: 150, descuento: 0 } },
        { clave: 'b', datos: { descripcion: 'Mouse - prueba local', cantidad: 3, precioUnitario: 100, descuento: 50 } }],
      tributos: ['a', 'b'].map(linea => ({ clave: linea, linea, calculo: 'PORCENTAJE', base: 'DERIVADA', tratamiento: 'NO_RECUPERABLE', baseRevisadaPara: null,
        datos: { tipoTributo: 'IMPUESTO', codigoTributo: 'PRUEBA10', nombreTributo: 'Tasa ficticia local 10 %', baseImponible: 0, porcentaje: 10, monto: 0 } })),
    });
    failEvent = true;
    await assert.rejects(operations.save(id, payload, actor), /Fallo inyectado/); failEvent = false;
    const rolled = await operations.read(id); assert.equal(rolled.lineas.length, 0); assert.equal(rolled.tributos.length, 0); assert.equal(rolled.documento.totalNeto, 0);
    const saved = await operations.save(id, payload, actor);
    assert.equal(saved.documento.totalNeto, 605); assert.equal(saved.documento.impuestoTotal, 55);
    assert.deepEqual(saved.lineas.map(line => line.numeroLinea), [1, 2]);
    await assert.rejects(operations.save(id, payload, actor), { status: 409 });
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
    const uri = `cxp-dte://${randomUUID()}.pdf`;
    await createCxpRepository('archivos').bind(c).create({ idDocumento: id, categoria: 'DTE', nombreArchivo: 'PRUEBA-LOCAL-FICTICIA.pdf',
      tipoMime: 'application/pdf', tamanoBytes: pdf.length, hashSha256: createHash('sha256').update(pdf).digest('hex'), uriAlmacenamiento: uri,
      versionArchivo: 1, esVersionActual: 'S', cargadoPor: actor.id });
    const storage: DteStorage = { async read(value) { assert.equal(value, uri); return pdf; }, async exists() { return true; },
      async save() { throw new Error('No se escribe archivo físico'); }, async remove() { throw new Error('No se elimina archivo'); } };
    const validated = await createDocumentoValidationOperation(run, storage)(id, actor.id);
    assert.equal(validated.estado, 'PENDIENTE_APROBACION');
    await assert.rejects(operations.save(id, { ...payload, version: (await operations.read(id)).version }, actor), { status: 409 });
    t.diagnostic(`Documento propio #${id}: neto 605, RF04 completo, DTE y tasa ficticios; todo revertido al terminar.`);
  } finally {
    try {
      await c.rollback();
      if (id) {
        const result = await c.execute<{ TOTAL: number }>(`SELECT
          (SELECT COUNT(*) FROM CXP_DOCUMENTO WHERE ID_DOCUMENTO = :id)
          + (SELECT COUNT(*) FROM CXP_DOCUMENTO_DETALLE WHERE ID_DOCUMENTO = :id)
          + (SELECT COUNT(*) FROM CXP_DOCUMENTO_TRIBUTO WHERE ID_DOCUMENTO = :id)
          + (SELECT COUNT(*) FROM CXP_EVENTO WHERE ID_DOCUMENTO = :id)
          + (SELECT COUNT(*) FROM CXP_ARCHIVO WHERE ID_DOCUMENTO = :id) AS TOTAL FROM DUAL`, { id });
        assert.equal(result.rows![0].TOTAL, 0); t.diagnostic('Rollback final comprobado: cero filas de prueba restantes.');
      }
    } finally { await c.close(); await closeOraclePool(); }
  }
});
