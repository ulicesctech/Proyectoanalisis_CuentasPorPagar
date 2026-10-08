/**
 * Pruebas de aceptación del módulo de Facturas Especiales y Tributos (RF-06, RF-14, RF-15, RF-16).
 * Se ejecutan contra Oracle real a través del API HTTP (mismas rutas y middlewares que src/index.ts).
 *
 *   pnpm --filter @erp/server test:fe
 *
 * Requiere la migración 001 aplicada y los datos de prueba de
 * database/oracle/08_tests/fe_00_tablas_comunes_prueba.sql (usuarios 1-3, rol 1, proveedores 1-2, sucursal 1).
 * Cada ejecución usa códigos de regla y una moneda de prueba propios, así que puede repetirse.
 *
 * SOLO PARA UNA BASE LOCAL DE PRUEBAS: crea reglas, facturas, eventos y un aprobador que
 * no se pueden borrar desde la aplicación. Se niega a ejecutarse si la conexión no es local.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import { cxpToday } from '@erp/contracts';
import cxpRoutes from '../src/modules/cxp/routes';
import { cxpErrorHandler } from '../src/modules/cxp/controllers/errorHandler';
import { errorHandler } from '../src/middlewares';
import { closeOraclePool, getConnection, initOraclePool } from '../src/config/database';

// Protección: nunca escribir datos de prueba en una base compartida o en la nube.
const HOST_BD = (process.env.NODE_ORACLEDB_CONNECTIONSTRING ?? '').replace(/^\/\//, '').split(/[:/]/)[0].toLowerCase();
if (!['localhost', '127.0.0.1', '::1'].includes(HOST_BD)) {
  console.error(`[test:fe] Cancelado: la conexión apunta a "${HOST_BD || '(vacía)'}". Estas pruebas solo se ejecutan contra una base local (localhost).`);
  process.exit(1);
}

const ANALISTA = 1;      // registra
const APROBADOR = 2;     // autorizado en CXP_FE_APROBADOR
const NO_AUTORIZADO = 3;
const PROVEEDOR = 1;
const SUCURSAL = 1;

const run = Date.now().toString(36).toUpperCase();
// Moneda exclusiva de esta ejecución: las reglas de otras corridas no aplican aquí.
const MONEDA = `Z${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
const HOY = cxpToday();
const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const AYER = addDays(HOY, -1);

let server: Server;
let base = '';

async function api(method: string, path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = response.headers.get('content-type') ?? '';
  const data = type.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data: data as any, type };
}

function factura(referencia: string, fecha: string, subtotal = 1000) {
  return {
    idProveedor: PROVEEDOR, idSucursal: SUCURSAL, fechaDocumento: fecha, moneda: MONEDA, tipoCambio: 1, subtotal, descuentoTotal: 0,
    referenciaExterna: `${referencia}-${run}`, descripcionOperacion: 'Compra de producto agrícola a productor individual (prueba)',
    proveedorDireccion: 'Aldea El Progreso, Chimaltenango', usuario: ANALISTA,
  };
}

async function hastaAprobada(id: number) {
  assert.equal((await api('POST', `/api/cxp/facturas-especiales/${id}/enviar-revision`, { usuario: ANALISTA })).status, 200);
  assert.equal((await api('POST', `/api/cxp/facturas-especiales/${id}/revisar`, { usuario: NO_AUTORIZADO, observacion: 'Datos verificados' })).status, 200);
  const aprobada = await api('POST', `/api/cxp/facturas-especiales/${id}/aprobar`, { usuario: APROBADOR });
  assert.equal(aprobada.status, 200, JSON.stringify(aprobada.data));
  assert.equal(aprobada.data.factura.etapa, 'APROBADA');
}

before(async () => {
  await initOraclePool();
  const app = express();
  app.use(express.json());
  app.use('/api/cxp', cxpRoutes, cxpErrorHandler);
  app.use(errorHandler);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Aprobador autorizado a través del módulo existente de Parámetros (reutilización).
  const parametro = await api('POST', '/api/cxp/parametros', {
    grupoParametro: 'CXP_FE_APROBADOR', codigo: `USUARIO_${APROBADOR}`, nombre: 'Aprobador de facturas especiales (prueba)',
    valorTexto: '1', valorNumero: APROBADOR, activo: 'S',
  });
  assert.ok([201, 409].includes(parametro.status), JSON.stringify(parametro.data));
});

after(async () => {
  server?.close();
  await closeOraclePool();
});

describe('Reglas tributarias', () => {
  let isr: any;
  let facturaAnterior: any;

  test('PRUEBA 1 · vigencia histórica: 5% → 7% no altera facturas anteriores', async () => {
    // 1. Regla del 5% (valores de prueba; los porcentajes reales se parametrizan en la pantalla de reglas)
    const creada = await api('POST', '/api/cxp/reglas-tributarias', {
      codigoRegla: `ISR-${run}`, tipoTributo: 'RETENCION', codigoTributo: 'ISR', nombreTributo: 'ISR retenido (prueba)',
      porcentaje: 5, moneda: MONEDA, vigenteDesde: addDays(HOY, -30), creadaPor: ANALISTA,
    });
    assert.equal(creada.status, 201, JSON.stringify(creada.data));
    isr = creada.data;
    const iva = await api('POST', '/api/cxp/reglas-tributarias', {
      codigoRegla: `IVA-${run}`, tipoTributo: 'IMPUESTO', codigoTributo: 'IVA', nombreTributo: 'IVA (prueba)',
      porcentaje: 12, moneda: MONEDA, vigenteDesde: addDays(HOY, -30), creadaPor: ANALISTA,
    });
    assert.equal(iva.status, 201, JSON.stringify(iva.data));

    // 2. Factura con esa regla
    const f1 = await api('POST', '/api/cxp/facturas-especiales', factura('P1-A', AYER));
    assert.equal(f1.status, 201, JSON.stringify(f1.data));
    facturaAnterior = f1.data.factura;
    const isr1 = facturaAnterior.tributos.find((t: any) => t.codigoTributo === 'ISR');
    assert.equal(isr1.porcentaje, 5);
    assert.equal(isr1.monto, 50);
    assert.equal(facturaAnterior.impuestoTotal, 120);
    assert.equal(facturaAnterior.totalNeto, 1070);

    // 3. Modificar la regla al 7% para operaciones futuras (nueva versión desde hoy)
    const v2 = await api('POST', `/api/cxp/reglas-tributarias/${isr.idReglaTributaria}/versiones`, {
      porcentaje: 7, vigenteDesde: HOY, motivoCambio: 'Actualización normativa (prueba)', usuario: ANALISTA,
    });
    assert.equal(v2.status, 201, JSON.stringify(v2.data));
    assert.equal(v2.data.versionRegla, 2);

    // 4-5. La factura anterior conserva el 5% y su vínculo con la versión 1
    const consulta = await api('GET', `/api/cxp/facturas-especiales/${facturaAnterior.idDocumento}`);
    const conservado = consulta.data.tributos.find((t: any) => t.codigoTributo === 'ISR');
    assert.equal(conservado.porcentaje, 5);
    assert.equal(conservado.monto, 50);
    assert.equal(conservado.versionRegla, 1);
    assert.equal(consulta.data.retencionTotal, 50);

    // 6. Una factura nueva usa el 7%
    const f2 = await api('POST', '/api/cxp/facturas-especiales', factura('P1-B', HOY));
    assert.equal(f2.status, 201, JSON.stringify(f2.data));
    const isr2 = f2.data.factura.tributos.find((t: any) => t.codigoTributo === 'ISR');
    assert.equal(isr2.porcentaje, 7);
    assert.equal(isr2.monto, 70);
    assert.equal(isr2.versionRegla, 2);

    // Historial de la regla: v1 reemplazada hasta ayer, v2 vigente desde hoy
    const historial = await api('GET', `/api/cxp/reglas-tributarias?codigoRegla=ISR-${run}`);
    assert.deepEqual(historial.data.map((r: any) => [r.versionRegla, r.estado, r.vigenteDesde, r.vigenteHasta]),
      [[2, 'VIGENTE', HOY, null], [1, 'REEMPLAZADA', addDays(HOY, -30), AYER]]);
  });

  test('las vigencias incorrectas y las versiones reemplazadas se rechazan', async () => {
    const pasada = await api('POST', `/api/cxp/reglas-tributarias/${isr.idReglaTributaria}/versiones`, {
      porcentaje: 9, vigenteDesde: AYER, motivoCambio: 'Intento retroactivo', usuario: ANALISTA,
    });
    assert.equal(pasada.status, 400);
    const invertida = await api('POST', '/api/cxp/reglas-tributarias', {
      codigoRegla: `X-${run}`, tipoTributo: 'RETENCION', codigoTributo: 'ISRX', nombreTributo: 'Prueba', porcentaje: 1,
      vigenteDesde: HOY, vigenteHasta: AYER, creadaPor: ANALISTA,
    });
    assert.equal(invertida.status, 400);
    const solapada = await api('POST', '/api/cxp/reglas-tributarias', {
      codigoRegla: `ISR2-${run}`, tipoTributo: 'RETENCION', codigoTributo: 'ISR', nombreTributo: 'Duplicada', porcentaje: 3,
      moneda: MONEDA, vigenteDesde: HOY, creadaPor: ANALISTA,
    });
    assert.equal(solapada.status, 409, 'dos reglas no pueden aplicar al mismo tributo en el mismo periodo');
  });
});

describe('Flujo de factura especial', () => {
  let fe: any;

  test('PRUEBA 2 · no se emite sin aprobación ni dos veces', async () => {
    const creada = await api('POST', '/api/cxp/facturas-especiales', factura('P2', HOY, 2500));
    assert.equal(creada.status, 201, JSON.stringify(creada.data));
    fe = creada.data.factura;
    assert.equal(fe.etapa, 'PREPARACION');

    const sinAprobar = await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/emitir`, { usuario: ANALISTA });
    assert.equal(sinAprobar.status, 409);
    assert.match(sinAprobar.data.error, /aprobada/i);

    assert.equal((await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/enviar-revision`, { usuario: ANALISTA })).status, 200);
    assert.equal((await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/emitir`, { usuario: ANALISTA })).status, 409);
    assert.equal((await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/revisar`, { usuario: NO_AUTORIZADO })).status, 200);

    const noAutorizado = await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/aprobar`, { usuario: NO_AUTORIZADO });
    assert.equal(noAutorizado.status, 403);
    const aprobada = await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/aprobar`, { usuario: APROBADOR, observacion: 'Conforme' });
    assert.equal(aprobada.status, 200, JSON.stringify(aprobada.data));
    assert.equal(aprobada.data.factura.etapa, 'APROBADA');
    assert.equal(aprobada.data.factura.aprobaciones.at(-1).idUsuarioAprobador, APROBADOR);

    const emitida = await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/emitir`, { usuario: ANALISTA });
    assert.equal(emitida.status, 200, JSON.stringify(emitida.data));
    fe = emitida.data.factura;
    assert.equal(fe.etapa, 'EMITIDA');
    assert.equal(fe.estado, 'PENDIENTE_PAGO');
    assert.match(fe.numeroConstancia, /^CFE-\d{4}-\d{6}$/);
    assert.ok(fe.tributos.every((t: any) => t.estado === 'APLICADO' && t.numeroConstancia === fe.numeroConstancia));

    const otraVez = await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/emitir`, { usuario: ANALISTA });
    assert.equal(otraVez.status, 409);
    assert.match(otraVez.data.error, /dos veces/);
  });

  test('una factura emitida no se modifica libremente', async () => {
    const editar = await api('PATCH', `/api/cxp/facturas-especiales/${fe.idDocumento}`, { ...factura('P2', HOY, 1), usuario: ANALISTA });
    assert.equal(editar.status, 409);
    const generico = await api('PATCH', `/api/cxp/documentos/${fe.idDocumento}`, { subtotal: 1 });
    assert.equal(generico.status, 409);
    const borrar = await api('DELETE', `/api/cxp/documentos/${fe.idDocumento}`);
    assert.equal(borrar.status, 409);
    const tributo = await api('DELETE', `/api/cxp/documentos-tributos/${fe.tributos[0].idTributo}`);
    assert.equal(tributo.status, 409);
  });

  test('genera y descarga la constancia PDF numerada y registrada', async () => {
    const pdf = await api('GET', `/api/cxp/facturas-especiales/${fe.idDocumento}/constancia`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.type, 'application/pdf');
    const contenido = (pdf.data as Buffer).toString('latin1');
    assert.ok(contenido.startsWith('%PDF-1.4'));
    for (const texto of [fe.numeroConstancia, `${fe.serie}-${fe.numeroDocumento}`, 'ISR retenido', 'Total de retenciones', fe.hashConstancia]) {
      assert.ok(contenido.includes(texto), `la constancia debe incluir ${texto}`);
    }
    // El archivo registrado en CXP_ARCHIVO coincide con el que se descarga (mismo SHA-256).
    const connection = await getConnection();
    try {
      const archivo = await connection.execute<{ HASH_SHA256: string }>(
        `SELECT HASH_SHA256 FROM CXP_ARCHIVO WHERE ID_DOCUMENTO = :id AND CATEGORIA = 'CONSTANCIA_FE' AND ES_VERSION_ACTUAL = 'S'`,
        { id: fe.idDocumento }, { outFormat: 4002 });
      assert.equal(archivo.rows?.[0]?.HASH_SHA256, createHash('sha256').update(pdf.data).digest('hex'));
    } finally { await connection.close(); }
  });

  test('las constancias concurrentes no duplican números ni emiten dos veces', async () => {
    const a = (await api('POST', '/api/cxp/facturas-especiales', factura('CONC-A', HOY, 300))).data.factura;
    const b = (await api('POST', '/api/cxp/facturas-especiales', factura('CONC-B', HOY, 400))).data.factura;
    await hastaAprobada(a.idDocumento);
    await hastaAprobada(b.idDocumento);
    const intentos = await Promise.all([a, a, b, b].map(item => api('POST', `/api/cxp/facturas-especiales/${item.idDocumento}/emitir`, { usuario: ANALISTA })));
    assert.deepEqual(intentos.map(item => item.status).sort(), [200, 200, 409, 409]);
    const numeros = intentos.filter(item => item.status === 200).map(item => item.data.factura.numeroConstancia);
    assert.equal(new Set(numeros).size, 2);
  });

  test('evita facturas duplicadas del mismo proveedor y referencia', async () => {
    const duplicada = await api('POST', '/api/cxp/facturas-especiales', factura('P2', HOY, 999));
    assert.equal(duplicada.status, 409);
    assert.match(duplicada.data.error, /Ya existe/);
  });

  test('anula conservando historial, constancia y efectos tributarios', async () => {
    const sinMotivo = await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/anular`, { usuario: APROBADOR, motivo: '' });
    assert.equal(sinMotivo.status, 400);
    const anulada = await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/anular`, { usuario: APROBADOR, motivo: 'Operación registrada con proveedor equivocado' });
    assert.equal(anulada.status, 200, JSON.stringify(anulada.data));
    const detalle = anulada.data.factura;
    assert.equal(detalle.etapa, 'ANULADA');
    assert.equal(detalle.anuladoPor, APROBADOR);
    assert.ok(detalle.fechaAnulacion);
    assert.ok(detalle.tributos.every((t: any) => t.estado === 'ANULADO'));
    assert.equal(detalle.numeroConstancia, fe.numeroConstancia, 'la constancia se conserva');
    const movimiento = detalle.historial.find((m: any) => m.tipoEvento === 'FE_ANULACION');
    assert.equal(movimiento.estadoAnterior, 'PENDIENTE_PAGO');
    assert.equal(movimiento.estadoNuevo, 'ANULADA');
    assert.equal(movimiento.usuarioEvento, APROBADOR);
    assert.match(movimiento.detalle, /proveedor equivocado/);
    assert.match(movimiento.detalle, /Tributos marcados ANULADO/);
    // El documento sigue existiendo y la constancia se descarga marcada como anulada.
    assert.equal((await api('GET', `/api/cxp/documentos/${fe.idDocumento}`)).data.estado, 'ANULADA');
    const pdf = await api('GET', `/api/cxp/facturas-especiales/${fe.idDocumento}/constancia`);
    assert.ok((pdf.data as Buffer).toString('latin1').includes('DOCUMENTO ANULADO'));
    assert.equal((await api('POST', `/api/cxp/facturas-especiales/${fe.idDocumento}/anular`, { usuario: APROBADOR, motivo: 'Otra vez' })).status, 409);
  });

  test('el historial registra cada operación con usuario y estados', async () => {
    const detalle = (await api('GET', `/api/cxp/facturas-especiales/${fe.idDocumento}`)).data;
    assert.deepEqual(detalle.historial.map((m: any) => m.tipoEvento),
      ['FE_REGISTRO', 'FE_ENVIO_REVISION', 'FE_REVISION', 'FE_APROBACION', 'FE_EMISION', 'FE_ANULACION']);
    assert.ok(detalle.historial.every((m: any) => m.usuarioEvento > 0 && m.fechaEvento));
    const eventoGenerico = await api('PATCH', `/api/cxp/eventos/${detalle.historial[0].idEvento}`, { asunto: 'alterado' });
    assert.equal(eventoGenerico.status, 409, 'la bitácora no se edita desde el CRUD genérico');
  });

  test('el rechazo exige aprobador autorizado y permite corregir y reabrir', async () => {
    const creada = (await api('POST', '/api/cxp/facturas-especiales', factura('RECH', HOY, 800))).data.factura;
    await api('POST', `/api/cxp/facturas-especiales/${creada.idDocumento}/enviar-revision`, { usuario: ANALISTA });
    await api('POST', `/api/cxp/facturas-especiales/${creada.idDocumento}/revisar`, { usuario: NO_AUTORIZADO });
    assert.equal((await api('POST', `/api/cxp/facturas-especiales/${creada.idDocumento}/rechazar`, { usuario: NO_AUTORIZADO, motivo: 'No procede' })).status, 403);
    const rechazada = await api('POST', `/api/cxp/facturas-especiales/${creada.idDocumento}/rechazar`, { usuario: APROBADOR, motivo: 'Falta respaldo' });
    assert.equal(rechazada.data.factura.etapa, 'RECHAZADA');
    const reabierta = await api('POST', `/api/cxp/facturas-especiales/${creada.idDocumento}/reabrir`, { usuario: ANALISTA });
    assert.equal(reabierta.data.factura.etapa, 'PREPARACION');
    const editada = await api('PATCH', `/api/cxp/facturas-especiales/${creada.idDocumento}`, { ...factura('RECH', HOY, 900) });
    assert.equal(editada.status, 200, JSON.stringify(editada.data));
    assert.equal(editada.data.factura.subtotal, 900);
  });
});

describe('Compatibilidad con el resto del sistema', () => {
  test('los documentos normales siguen funcionando', async () => {
    const creado = await api('POST', '/api/cxp/documentos', {
      idProveedor: PROVEEDOR, idSucursal: SUCURSAL, tipoDocumento: 'FACTURA', serie: 'A', numeroDocumento: `N-${run}`,
      subtotal: 100, impuestoTotal: 12, estado: 'BORRADOR', creadoPor: ANALISTA,
    });
    assert.equal(creado.status, 201, JSON.stringify(creado.data));
    assert.equal(creado.data.totalNeto, 112);
    const editado = await api('PATCH', `/api/cxp/documentos/${creado.data.idDocumento}`, { observaciones: 'Editado en prueba' });
    assert.equal(editado.status, 200, JSON.stringify(editado.data));
    assert.equal((await api('DELETE', `/api/cxp/documentos/${creado.data.idDocumento}`)).status, 204);
    const tipoEspecial = await api('POST', '/api/cxp/documentos', {
      idSucursal: SUCURSAL, tipoDocumento: 'FACTURA_ESPECIAL', subtotal: 1, estado: 'BORRADOR', creadoPor: ANALISTA,
    });
    assert.equal(tipoEspecial.status, 409, 'las facturas especiales solo se registran desde su módulo');
  });

  test('los demás módulos de CXP responden', async () => {
    for (const recurso of ['parametros', 'periodos', 'cuentas-bancarias', 'compromisos', 'documentos', 'documentos-detalle', 'documentos-tributos',
      'lotes-pago', 'pagos', 'aplicaciones', 'reglas-aprobacion', 'aprobaciones', 'conciliaciones-proveedor', 'conciliaciones-pago', 'eventos', 'archivos']) {
      const respuesta = await api('GET', `/api/cxp/${recurso}?limit=5`);
      assert.equal(respuesta.status, 200, `${recurso}: ${JSON.stringify(respuesta.data)}`);
    }
  });
});
