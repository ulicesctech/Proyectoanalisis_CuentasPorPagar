import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Navegador real y API simulada: no conecta al ERP ni escribe en Oracle.
const client = fileURLToPath(new URL('..', import.meta.url));
const browser = process.env.CXP_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { const value = await fn(); if (value) return value; await delay(80); }
  throw new Error(message);
}
function connect(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
}

test('documentos: captura, errores, monedas, conservación entre pasos, registro y edición', {
  skip: !browser, timeout: 120000,
}, async t => {
  const artifacts = path.join(client, 'node_modules/.cache/documentos-browser', String(Date.now()));
  await mkdir(artifacts, { recursive: true });
  const writes = [], dueRequests = [], unexpected = [], runtimeErrors = [];
  let saved;
  const api = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    let body;
    if (req.method !== 'GET') { let text = ''; for await (const bytes of req) text += bytes; body = JSON.parse(text || '{}'); }
    const json = value => res.end(JSON.stringify(value));
    if (url.pathname.endsWith('/contexto-pagos')) return json({reservadoDocumento:0,ordinariosDisponibles:0,motivos:[],procesos:[]});
    if (url.pathname === '/api/cxp/facturas-especiales/configuracion') return json({fechaDocumento:'2026-10-30',moneda:'GTQ',serie:'FESP',puedeRegistrar:true,impedimentos:[],advertencias:[],reglasVigentes:1});
    if (url.pathname === '/api/auth/session') return json({ username: 'operador.simulado', name: 'Operador autenticado',
      mustChangePassword: false, actor: { id: 7, nombre: 'Operador autenticado', roles: [1], permisos: ['CREAR'] }, csrfToken: 'prueba' });
    if (url.pathname === '/api/cxp/documentos/monedas') return json({ monedaLocal: 'GTQ', fuenteTasas: null,
      monedas: [{ codigo: 'GTQ', nombre: 'Quetzal' }, { codigo: 'USD', nombre: 'Dólar simulado' }] });
    if (url.pathname === '/api/cxp/proveedores/identidad') { const id=Number(url.searchParams.get('id')||1); return json({proveedores:[{idProveedor:id,nit:id===1?'123-1':'456-2',nombre:id===1?'Proveedor Alfa':'Proveedor Beta',activo:true}],coincidenciasExactas:1,limitado:false}); }
    if (url.pathname.endsWith('/opciones-tributos')) return json({identificaciones:[],reglas:[]});
    if (url.pathname.startsWith('/api/cxp/catalogos/')) return json([
      { id: 1, label: url.pathname.endsWith('usuarios') ? 'Autor original' : 'Opción de prueba' },
    ]);
    if (url.pathname.endsWith('/calcular-vencimiento')) {
      dueRequests.push(body);
      // La primera respuesta llega después de la segunda: el cliente debe ignorarla.
      if (body.fechaDocumento === '2026-09-01') await delay(800);
      return json({ idCondicionCredito: 1, diasCredito: 0, tipo: 'CONTADO', fechaVencimiento: body.fechaDocumento });
    }
    if (url.pathname === '/api/cxp/documentos' && req.method === 'POST') {
      writes.push({ method: 'POST', body });
      saved = { ...body, idDocumento: 99, creadoPor: 7, modificadoPor: null, naturaleza: 'D',
        fechaRecepcion: '2026-09-03T10:00:00', resultadoTresVias: 'NO_APLICA', prioridad: 'NORMAL',
        estadoContable: 'PENDIENTE', posibleDuplicado: 'N', nitEmisor: null,
        diasCredito: 0, fechaVencimiento: body.fechaDocumento, montoAplicado: 0,
        totalBruto: 99.99, totalNeto: 99.99, totalLocal: 749.93, saldoPendiente: 99.99 };
      return json(saved);
    }
    if (url.pathname === '/api/cxp/documentos') return json({ data: saved ? [saved] : [], meta: { page: 1, limit: 10, total: saved ? 1 : 0, totalPages: 1 } });
    if (url.pathname === '/api/cxp/documentos-detalle') return json({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    if (url.pathname === '/api/cxp/documentos/99/expediente') return json({ documento: { ...saved, proveedorNombre: 'Proveedor simulado', sucursalNombre: 'Sucursal simulada' },
      lineas: [{ idDetalle: 1, idDocumento: 99, descripcion: 'Línea de prueba', cantidad: 1, precioUnitario: 100, totalLinea: 100 }], tributos: [], archivos: [], aplicaciones: [] });
    if (url.pathname === '/api/cxp/documentos/99/aprobacion') return json({ reglas: [], decisiones: [], actor: null });
    if (url.pathname === '/api/cxp/documentos/99/componentes') return json({ documento: saved, version: 'a'.repeat(64), editable: true, catalogo: [], advertencias: [],
      lineas: [{ clave: 'linea-1', idDetalle: 1, numeroLinea: 1, datos: { descripcion: 'Línea de prueba', cantidad: 1, precioUnitario: 100, descuento: 0, unidadMedida: 'UNIDAD', diferenciaCantidad: 0, diferenciaPrecio: 0, resultadoTresVias: 'NO_APLICA' } }],
      tributos: [], adoptarTotales: false, confirmarEliminaciones: [] });
    if (url.pathname === '/api/cxp/documentos/99/archivos') return json([]);
    if (url.pathname === '/api/cxp/documentos/99' && req.method === 'PATCH') {
      writes.push({ method: 'PATCH', body }); saved = { ...saved, ...body }; return json(saved);
    }
    unexpected.push(`${req.method} ${url.pathname}`); res.statusCode = 404; json({ error: 'Ruta no simulada' });
  });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  // Sin --force de prueba: la configuración real debe invalidar los contratos CJS anteriores.
  const dev = spawn(process.execPath, [path.join(client, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: client, windowsHide: true, stdio: 'pipe', env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${api.address().port}/api` },
  });
  let output = ''; dev.stdout.on('data', bytes => { output += bytes; }); dev.stderr.on('data', bytes => { output += bytes; });
  const profile = path.join(artifacts, 'profile');
  const chrome = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, '--window-size=1440,1100', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    await until(async () => { if (dev.exitCode !== null) throw new Error(output); try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; } }, 'Vite no inició');
    const debug = await until(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; } }, 'Chrome no inició CDP');
    const pages = await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl); await once(socket, 'open');
    const send = connect(socket);
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') {
        const error = message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text;
        runtimeErrors.push(error); t.diagnostic(error);
      }
    });
    await send('Runtime.enable');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const input = async (id, value, blur = false) => {
      await evaluate(`(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus();
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
      await delay(60);
      if (blur) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await delay(60);
      }
    };
    const invalid = id => evaluate(`document.getElementById(${JSON.stringify(id)})?.getAttribute('aria-invalid') === 'true'`);
    const value = id => evaluate(`document.getElementById(${JSON.stringify(id)})?.value`);
    const click = async text => { await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(el => el.textContent.trim() === ${JSON.stringify(text)}).click()`); await delay(80); };
    const catalog = async id => {
      await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
      await until(() => evaluate(`!!document.querySelector('#${id}-option-0')`), `No cargó ${id}`);
      await evaluate(`document.querySelector('#${id}-option-0').click()`); await delay(60);
    };
    const capture = async name => {
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(path.join(artifacts, name + '.png'), Buffer.from(image.data, 'base64'));
    };
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/cxp/documentos/nuevo` });
    await until(() => evaluate(`!!document.getElementById('registro-creadoPor')`), 'No abrió el registro').catch(async error => {
      t.diagnostic(await evaluate('location.href + " " + document.body.innerText'));
      t.diagnostic(JSON.stringify(unexpected)); throw error;
    });
    assert.equal(await evaluate(`document.querySelectorAll('[role="dialog"] [aria-invalid="true"]').length`), 0);
    assert.equal(await value('registro-creadoPor'), 'Operador autenticado');
    assert.equal(await evaluate(`document.getElementById('registro-creadoPor').readOnly || document.getElementById('registro-creadoPor').disabled`), true);
    await input('registro-serie', '', true); assert.equal(await invalid('registro-serie'), true);
    await click('Continuar');
    assert.equal(await evaluate('document.activeElement.id'), 'registro-idProveedor');
    await catalog('registro-idProveedor'); await catalog('registro-idSucursal');
    for (const [field, text] of [['serie', 'A'], ['numeroDocumento', 'PRUEBA-99'], ['uuidFiscal', 'UUID-SIMULADO']]) await input('registro-' + field, text, true);
    assert.equal(await invalid('registro-serie'), false);
    await click('Continuar');
    await until(() => evaluate(`!!document.getElementById('registro-subtotal')`), 'No avanzó a importes');
    assert.match(await evaluate(`document.getElementById('registro-moneda').textContent`), /Quetzal \(GTQ\)/);
    assert.equal(await value('registro-tipoCambio'), '1');
    assert.equal(await evaluate(`document.getElementById('registro-tipoCambio').readOnly || document.getElementById('registro-tipoCambio').disabled`), true);
    await input('registro-fechaDocumento', '2026-09-01', true); await catalog('registro-idCondicionCredito');
    await until(() => dueRequests.length > 0, 'No calculó vencimiento');
    await input('registro-fechaDocumento', '2026-09-02', true);
    await until(() => dueRequests.some(row => row.fechaDocumento === '2026-09-02'), 'No recalculó fecha');
    await delay(900);
    assert.match(await evaluate(`document.querySelector('section[aria-label="Fechas e importes"]').textContent`), /02\/09\/2026/);
    await input('registro-subtotal', '-1'); assert.equal(await invalid('registro-subtotal'), true);
    assert.equal(await evaluate(`document.getElementById(document.getElementById('registro-subtotal').getAttribute('aria-describedby'))?.textContent.length > 0`), true);
    await input('registro-subtotal', '', true); assert.equal(await value('registro-subtotal'), ''); assert.equal(await invalid('registro-subtotal'), true);
    await input('registro-subtotal', '100', true); assert.equal(await invalid('registro-subtotal'), false);
    await input('registro-descuentoTotal', '200', true); assert.equal(await invalid('registro-descuentoTotal'), true);
    await input('registro-descuentoTotal', '0', true); assert.equal(await invalid('registro-descuentoTotal'), false);
    await input('registro-retencionTotal', '200', true); assert.equal(await invalid('registro-retencionTotal'), true);
    await input('registro-retencionTotal', '0', true); assert.equal(await invalid('registro-retencionTotal'), false);
    await input('registro-diferenciaRedondeo', '-0.01', true); assert.equal(await invalid('registro-diferenciaRedondeo'), false);
    await input('registro-moneda', 'USD', true); assert.equal(await value('registro-tipoCambio'), '');
    await input('registro-tipoCambio', '', true); assert.equal(await invalid('registro-tipoCambio'), true);
    await click('Continuar'); assert.equal(await evaluate('document.activeElement.id'), 'registro-tipoCambio');
    for (const rate of ['0', '-1']) { await input('registro-tipoCambio', rate); assert.equal(await invalid('registro-tipoCambio'), true); }
    await input('registro-tipoCambio', '7.5', true); assert.equal(await invalid('registro-tipoCambio'), false);
    assert.match(await evaluate(`document.getElementById('registro-tipoCambio-help').textContent`), /1 USD = 7.5 GTQ/);
    await input('registro-fechaDocumento', '2026-09-03', true);
    assert.equal(await value('registro-tipoCambio'), '7.5'); assert.equal(await invalid('registro-tipoCambio'), true);
    await input('registro-tipoCambio', '7.5', true); assert.equal(await invalid('registro-tipoCambio'), false);
    await until(() => evaluate(`document.querySelector('section[aria-label="Fechas e importes"]').textContent.includes('03/09/2026')`), 'No calculó fecha final');
    await capture('importes-y-cambio');
    await evaluate(`document.querySelector('[aria-label="Totales calculados"]').scrollIntoView({ block: 'center' })`);
    assert.match(await evaluate(`document.querySelector('[aria-label="Totales calculados"]').textContent`), /USD 99\.99.*USD 99\.99.*GTQ 749\.93/);
    await capture('totales-y-redondeo');
    await click('Anterior'); assert.equal(await value('registro-numeroDocumento'), 'PRUEBA-99');
    await click('Continuar'); assert.equal(await value('registro-subtotal'), '100'); assert.equal(await value('registro-tipoCambio'), '7.5');
    await click('Continuar'); await until(() => evaluate(`document.querySelector('section[aria-label="Revisión"]') !== null`), 'No avanzó a revisión');
    await capture('revision'); await click('Registrar documento');
    await until(() => writes.length === 1, 'No registró documento');
    assert.equal(writes[0].body.moneda, 'USD'); assert.equal(writes[0].body.tipoCambio, 7.5);
    assert.equal(writes[0].body.diferenciaRedondeo, -0.01);
    assert.equal(Object.hasOwn(writes[0].body, 'creadoPor'), false);
    assert.equal(writes[0].body.fechaTipoCambio, '2026-09-03');
    // Edición con un creador anterior distinto del operador autenticado.
    saved.creadoPor = 1;
    delete saved.hashOrigen; delete saved.observaciones;
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/cxp/documentos/99` });
    await until(() => evaluate(`[...document.querySelectorAll('button')].some(el => el.textContent === 'Editar cabecera')`), 'No abrió expediente');
    await evaluate(`[...document.querySelectorAll('button')].find(el => el.textContent === 'Editar cabecera').click()`);
    await until(() => evaluate(`!!document.querySelector('[aria-label="Secciones del formulario"]')`), 'No abrió edición');
    const section = async text => { await evaluate(`[...document.querySelectorAll('[aria-label="Secciones del formulario"] button')].find(el => el.textContent.includes(${JSON.stringify(text)})).click()`); await delay(100); };
    await section('Datos generales'); assert.equal(await value('cxp-nitEmisor'), '');
    await section('Auditoría');
    await until(async () => (await value('cxp-creadoPor')) === 'Autor original', 'No mostró autor original');
    assert.equal(await value('cxp-modificadoPor'), 'Operador autenticado');
    assert.equal(await evaluate(`document.getElementById('cxp-creadoPor').readOnly || document.getElementById('cxp-creadoPor').disabled`), true);
    await capture('autoria-original');
    await section('Importes y cantidades');
    assert.equal(await value('cxp-tipoCambio'), '7.5');
    await input('cxp-subtotal', '-1'); assert.equal(await invalid('cxp-subtotal'), true);
    await input('cxp-subtotal', '100', true); assert.equal(await invalid('cxp-subtotal'), false);
    await section('Información adicional'); await input('cxp-observaciones', 'Edición simulada', true);
    await capture('edicion'); await click('Guardar cambios');
    await until(() => writes.length === 2, 'No guardó edición');
    assert.equal(writes[1].method, 'PATCH'); assert.equal(writes[1].body.observaciones, 'Edición simulada');
    assert.equal(Object.hasOwn(writes[1].body, 'creadoPor'), false);
    assert.equal(saved.creadoPor, 1); assert.equal(saved.modificadoPor, 7);
    // La fila de detalle es un formulario distinto: abrirla vacía y validar sin escribir.
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/cxp/documentos-detalle?filterField=idDocumento&filterValue=99` });
    await until(() => evaluate(`[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Agregar línea')`), 'El enlace anterior no abrió la captura contextual');
    await evaluate(`[...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Agregar línea').click()`);
    await until(() => evaluate(`!!document.getElementById('concepto-cantidad')`), 'No abrió la fila de detalle vacía');
    assert.equal(await value('concepto-cantidad'), ''); assert.equal(await value('concepto-precioUnitario'), '');
    await click('Aplicar línea');
    await until(() => evaluate(`document.querySelector('[role="dialog"] [aria-invalid="true"]') !== null`), 'No validó la línea vacía');
    assert.equal(writes.length, 2);
    await capture('detalle-vacio-validado');
    assert.deepEqual(unexpected, []);
    assert.deepEqual(runtimeErrors, []);
    t.diagnostic(`Capturas revisables: ${artifacts}. Monedas, tasas y escrituras simuladas.`);
  } finally {
    socket?.close(); chrome.kill(); dev.kill(); api.closeAllConnections(); await new Promise(resolve => api.close(resolve));
  }
});
