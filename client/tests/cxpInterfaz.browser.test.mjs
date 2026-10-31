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

test('CXP: búsqueda de documentos, creación de contraseña, captura especial y diseño adaptable', { skip: !browser, timeout: 180000 }, async t => {
  const artifacts = path.join(client, 'node_modules/.cache/cxp-interfaz', String(Date.now()));
  await mkdir(artifacts, { recursive: true });
  const writes = [], queries = [], unexpected = [], errors = [];
  const docs = [
    { id: 101, nombre: 'A · 123', numeroDocumento: '123', serie: 'A', proveedor: 1, proveedorNombre: 'Proveedor Alfa', sucursal: 1, moneda: 'GTQ', saldo: 100 },
    { id: 102, nombre: 'B · 123', numeroDocumento: '123', serie: 'B', proveedor: 2, proveedorNombre: 'Proveedor Beta', sucursal: 2, moneda: 'GTQ', saldo: 200 },
    { id: 103, nombre: 'A · 124', numeroDocumento: '124', serie: 'A', proveedor: 1, proveedorNombre: 'Proveedor Alfa', sucursal: 2, moneda: 'GTQ', saldo: 80 },
    { id: 104, nombre: 'A · 125', numeroDocumento: '125', serie: 'A', proveedor: 1, proveedorNombre: 'Proveedor Alfa', sucursal: 1, moneda: 'USD', saldo: 50 },
    { id: 105, nombre: 'COMP-126', noFacturaCompra: 'COMP-126', proveedor: 1, proveedorNombre: 'Proveedor Alfa', sucursal: 1, moneda: 'GTQ', saldo: 90 },
  ];
  const optionData = documentos => ({ documentos, origenes: [{ id: 1, nombre: 'Empresa GTQ', moneda: 'GTQ' }, { id: 3, nombre: 'Empresa USD', moneda: 'USD' }],
    destinos: [{ id: 2, nombre: 'Alfa GTQ', proveedor: 1, moneda: 'GTQ' }, { id: 4, nombre: 'Beta GTQ', proveedor: 2, moneda: 'GTQ' }, { id: 5, nombre: 'Alfa USD', proveedor: 1, moneda: 'USD' }],
    formasPago: [{ id: 1, nombre: 'TRANSFERENCIA BANCARIA', tipo: 'TRANSFERENCIA' }], bancosConfigurados: true });
  let paymentProcess, special, failSearch = true;
  const documento = { idDocumento: 99, idProveedor: 1, idSucursal: 1, creadoPor: 7, estado: 'APROBADA', tipoDocumento: 'FACTURA', naturaleza: 'D', serie: 'A', numeroDocumento: '123',
    origenIngreso: 'FACTURACION_ELECTRONICA', fechaDocumento: '2026-10-01', fechaVencimiento: '2026-10-30', fechaRecepcion: '2026-10-01T10:00:00', diasCredito: 0, moneda: 'GTQ', tipoCambio: 1,
    subtotal: 100, descuentoTotal: 0, impuestoTotal: 0, retencionTotal: 0, totalNeto: 100, totalBruto: 100, totalLocal: 100, montoAplicado: 0, saldoPendiente: 100, proveedorNombre: 'Proveedor Alfa' };
  const api = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*'); res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.end(); return; }
    const url = new URL(req.url, 'http://localhost'), p = url.pathname;
    let body;
    if (req.method !== 'GET') { let raw = ''; for await (const bytes of req) raw += bytes; body = JSON.parse(raw || '{}'); }
    const json = value => res.end(JSON.stringify(value));
    if (p.endsWith('/contexto-pagos')) return json({reservadoDocumento:0,ordinariosDisponibles:0,motivos:[],procesos:[]});
    if (p === '/api/cxp/facturas-especiales/configuracion') return json({fechaDocumento:'2026-10-30',moneda:'GTQ',serie:'FESP',puedeRegistrar:true,impedimentos:[],advertencias:[],reglasVigentes:1});
    if (p === '/api/auth/session') return json({ username: 'simulado', name: 'Operador simulado', mustChangePassword: false, actor: { id: 7, nombre: 'Operador simulado', roles: [7], permisos: ['CREAR', 'TESORERIA', 'APROBAR'] }, csrfToken: 'prueba' });
    if (p === '/api/cxp/procesos/opciones') {
      queries.push(url); const search = url.searchParams.get('search') || '', provider = Number(url.searchParams.get('proveedor') || 0);
      if (search === 'lenta') await delay(1300);
      if (search === 'error' && failSearch) { failSearch = false; res.statusCode = 503; return json({ error: 'Error simulado de búsqueda' }); }
      const matches = !search && !provider ? [] : search === 'lenta' ? [docs[0]] : search === 'rapida' ? [docs[4]] : search === 'vacio' ? [] : docs.filter(d => !search || d.nombre.includes(search));
      return json(optionData(matches.filter(d => !provider || d.proveedor === provider)));
    }
    if (p === '/api/cxp/procesos' && req.method === 'POST') {
      writes.push({ p, body }); const selected = docs.filter(d => body.documentos.includes(d.id)), first = selected[0];
      assert.ok(first && selected.every(d => d.proveedor === body.idProveedor && d.moneda === first.moneda && d.sucursal === first.sucursal));
      paymentProcess = { id: 88, codigo: 'CP-SIMULADO-88', clave: body.clave, version: 'v1', estado: 'EMITIDA', creador: 7, solicitante: 7, proveedor: first.proveedor, proveedorNombre: first.proveedorNombre,
        sucursal: first.sucursal, moneda: first.moneda, tipoCambio: 1, total: selected.reduce((sum, d) => sum + d.saldo, 0), formaPago: 1, formaPagoNombre: 'TRANSFERENCIA BANCARIA',
        documentos: selected.map(d => ({ id: d.id, numero: d.nombre, importe: d.saldo })), aprobaciones: [], historial: [], pago: 88, fechaProgramada: body.fecha, aplicaciones: [], reimpresiones: 0 };
      return json(paymentProcess);
    }
    if (p === '/api/cxp/procesos') return json({ data: paymentProcess ? [paymentProcess] : [], page: 1, hasMore: false });
    if (p === '/api/cxp/proveedores/identidad') { const id=Number(url.searchParams.get('id')||1); return json({proveedores:[{idProveedor:id,nit:id===1?'123-1':'456-2',nombre:id===1?'Proveedor Alfa':'Proveedor Beta',activo:true}],coincidenciasExactas:1,limitado:false}); }
    if (p.endsWith('/opciones-tributos')) return json({identificaciones:[],reglas:[]});
    if (p.startsWith('/api/cxp/catalogos/')) return json(p.endsWith('proveedores') ? [{ id: 1, label: 'Proveedor Alfa' }, { id: 2, label: 'Proveedor Beta' }] : [{ id: 1, label: p.endsWith('sucursales') ? 'Sucursal Central' : 'Opción simulada' }]);
    if (p === '/api/cxp/documentos/monedas') return json({ monedaLocal: 'GTQ', fuenteTasas: null, monedas: [{ codigo: 'GTQ', nombre: 'Quetzal' }, { codigo: 'USD', nombre: 'Dólar simulado' }] });
    if (p === '/api/cxp/documentos') { queries.push(url); return json({ data: [documento], meta: { page: Number(url.searchParams.get('page') || 1), limit: 10, total: 11, totalPages: 2 } }); }
    if (p === '/api/cxp/documentos/99/expediente') return json({ documento, lineas: [], tributos: [], archivos: [], aplicaciones: [] });
    if (p.endsWith('/aprobacion')) return json({ reglas: [], decisiones: [], actor: null });
    if (p.endsWith('/archivos') || p.endsWith('/pagos-disponibles')) return json([]);
    if (p.endsWith('/componentes')) return json({ documento, version: 'a'.repeat(64), lineas: [], tributos: [], editable: false, catalogo: [], advertencias: [], adoptarTotales: false, confirmarEliminaciones: [] });
    if (p === '/api/cxp/facturas-especiales/calcular') {
      // Importes de prueba; no representan tasas fiscales ni se guardan en Oracle.
      const base = Math.round((body.subtotal - body.descuentoTotal) * 100) / 100, tax = Math.round(base * .1 * 100) / 100;
      return json({ baseImponible: base, tributos: [{ idReglaTributaria: 1, codigoRegla: 'SIMULADA', versionRegla: 1, tipoTributo: 'IMPUESTO', codigoTributo: 'SIM', nombreTributo: 'Tributo simulado', porcentaje: 10, monto: tax }], impuestoTotal: tax, retencionTotal: 0, totalBruto: base + tax, totalNeto: base + tax });
    }
    if (p === '/api/cxp/facturas-especiales' && req.method === 'POST') {
      writes.push({ p, body }); special = { ...body, idDocumento: 501, idFacturaEspecial: 1, serie: 'FE', numeroDocumento: 'SIMULADA', etapa: 'PREPARACION', estado: 'BORRADOR', estadoContable: 'PENDIENTE',
        proveedorNombre: body.proveedorNombre || 'Proveedor Alfa', totalNeto: 110, impuestoTotal: 10, retencionTotal: 0, montoAplicado: 0, saldoPendiente: 110,
        acciones: ['editar', 'enviarRevision', 'anular'], tributos: [], aprobaciones: [], historial: [] };
      return json({ mensaje: 'Preparación simulada registrada', factura: special });
    }
    if (p === '/api/cxp/facturas-especiales') return json({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    if (p === '/api/cxp/facturas-especiales/501') return json(special);
    unexpected.push(req.method + ' ' + p); res.statusCode = 404; json({ error: 'Ruta sin simulación' });
  });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening'); const port = probe.address().port; await new Promise(r => probe.close(r));
  const dev = spawn(process.execPath, [path.join(client, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: client, windowsHide: true, stdio: 'pipe', env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${api.address().port}/api` } });
  let output = ''; dev.stdout.on('data', b => output += b); dev.stderr.on('data', b => output += b);
  const profile = path.join(artifacts, 'profile');
  const chrome = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket, evaluate;
  try {
    await until(async () => { if (dev.exitCode !== null) throw Error(output); try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; } }, 'Vite no inició');
    const debug = await until(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; } }, 'Chrome no inició');
    const pages = await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json(); socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl); await once(socket, 'open');
    const send = connect(socket);
    socket.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); });
    await send('Runtime.enable'); await send('Page.enable');
    evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
    const input = async (id, value) => { await evaluate(`(() => {const el=document.getElementById(${JSON.stringify(id)});el.focus();const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`); await delay(80); };
    const click = async (text, scope = 'document') => { await evaluate(`[...${scope}.querySelectorAll('button')].find(el=>el.getClientRects().length && el.textContent.trim()===${JSON.stringify(text)}).click()`); await delay(120); };
    const value = id => evaluate(`document.getElementById(${JSON.stringify(id)}).value`);
    const key = async key => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: key === 'Enter' ? 13 : key === 'Escape' ? 27 : 40 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key }); await delay(120); };
    const navigate = async route => { await send('Page.navigate', { url: `http://127.0.0.1:${port}${route}` }); await until(() => evaluate(`!!document.querySelector('h1')`), 'No cargó ' + route); await evaluate(`window.confirmations=[];window.acceptChoice=false;window.confirm=message=>{window.confirmations.push(message);return window.acceptChoice;}`); };
    const capture = async name => { await delay(380); const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64')); };
    const catalog = async (id, index = 0) => { await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`); await until(() => evaluate(`!!document.getElementById(${JSON.stringify(id + '-option-' + index)})`), 'No cargó catálogo ' + id); await evaluate(`document.getElementById(${JSON.stringify(id + '-option-' + index)}).click()`); await delay(100); };
    const search = async (text, ids) => { await input('cxp-document-search', text); await until(() => evaluate(`JSON.stringify([...document.querySelectorAll('#cxp-document-suggestions [role="option"]')].map(el=>Number(el.id.split('-').pop())))===${JSON.stringify(JSON.stringify(ids))}`), 'Sugerencias incorrectas: ' + text); };
    const chosen = () => evaluate(`[...document.querySelectorAll('.cxp-create-dialog input[type="checkbox"]:checked')].map(el=>el.closest('label').textContent.trim())`);
    const openCreate = async () => { await until(() => evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Nueva contraseña'&&!el.disabled)`), 'No habilitó captura'); await click('Nueva contraseña'); await until(() => evaluate(`!!document.getElementById('cxp-document-search')`), 'No abrió captura'); };

    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/cxp/contrasenas'); await openCreate();
    await search('123', [101, 102]); assert.equal((await chosen()).length, 0);
    assert.equal(queries.filter(q => q.searchParams.get('search') === '123').at(-1).searchParams.has('proveedor'), false);
    await capture('sugerencias-sin-proveedor-escritorio');
    await key('Enter'); assert.equal((await chosen()).length, 0); // Sin opción activa, Enter no elige la primera.
    await key('ArrowDown'); await key('Enter');
    await until(async () => (await chosen()).length === 1 && await evaluate(`!document.getElementById('cxp-document-search').disabled`), 'No seleccionó por teclado');
    assert.match((await chosen())[0], /A · 123/);
    await search('123', [101]); assert.equal(queries.filter(q => q.searchParams.get('search') === '123').at(-1).searchParams.get('proveedor'), '1');
    await key('Escape'); assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Nueva contraseña de pago"]').length`), 1);
    await click('Siguiente');
    const paymentInputs = () => evaluate(`[...document.querySelectorAll('.cxp-create-dialog fieldset:not([hidden]) select')].map(el=>el.id)`);
    let selects = await paymentInputs(); await input(selects[0], '1'); await input(selects[1], '1'); await input(selects[2], '2');
    const dateId = await evaluate(`document.querySelector('.cxp-create-dialog input[type="date"]').id`);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    await input(dateId, today); await click('Anterior');
    await search('124', [103]); await evaluate(`document.getElementById('cxp-document-option-103').click()`); await delay(100);
    assert.match((await chosen())[0], /A · 123/); assert.match((await evaluate('window.confirmations')).at(-1), /sucursal o moneda/);
    await evaluate('window.acceptChoice=true;document.getElementById("cxp-document-option-103").click()'); await delay(180);
    assert.match((await chosen())[0], /A · 124/); assert.equal((await chosen()).length, 1);
    await click('Siguiente'); selects = await paymentInputs(); for (const id of selects) assert.equal(await value(id), ''); assert.equal(await value(dateId), ''); await click('Anterior');
    await evaluate('window.acceptChoice=false'); await search('125', [104]);
    await evaluate(`document.getElementById('cxp-document-option-104').click()`); await delay(100); assert.match((await chosen())[0], /A · 124/);
    await evaluate(`window.acceptChoice=true;document.getElementById('cxp-document-option-104').click()`); await delay(100); assert.match((await chosen())[0], /USD/);
    await search('124', [103]); await evaluate(`document.getElementById('cxp-document-option-103').click()`); await delay(100);
    await evaluate('window.acceptChoice=false'); await catalog('cxp-process-provider', 1); assert.match((await chosen())[0], /A · 124/);
    await evaluate('window.acceptChoice=true'); await catalog('cxp-process-provider', 1);
    await until(async () => (await chosen()).length === 0 && await evaluate(`!document.getElementById('cxp-document-search').disabled`), 'No limpió selección al confirmar proveedor');
    await search('123', [102]); await evaluate(`document.getElementById('cxp-document-option-102').click()`); await delay(100); assert.match((await chosen())[0], /Proveedor Beta/);
    await catalog('cxp-process-provider', 0); await until(() => evaluate(`!document.getElementById('cxp-document-search').disabled`), 'No volvió a Alfa');
    await search('124', [103]); await evaluate(`document.getElementById('cxp-document-option-103').click()`); await delay(100);
    await input('cxp-document-search', 'lenta'); await until(() => Promise.resolve(queries.some(q => q.searchParams.get('search') === 'lenta')), 'No inició consulta lenta');
    await search('rapida', [105]); await delay(1500); assert.equal(await evaluate(`document.querySelector('#cxp-document-suggestions [role="option"]').id`), 'cxp-document-option-105');
    await search('vacio', []); await until(() => evaluate(`document.body.innerText.includes('No hay documentos elegibles para ese número')`), 'No mostró vacío');
    await input('cxp-document-search', 'error'); await until(() => evaluate(`document.body.innerText.includes('Error simulado de búsqueda')`), 'No mostró error'); await click('Reintentar búsqueda');
    await until(() => evaluate(`!document.body.innerText.includes('Error simulado de búsqueda') && !document.querySelector('#cxp-document-suggestions[aria-busy="true"]')`), 'No reintentó');
    await input('cxp-document-search', '');
    await click('Siguiente'); selects = await paymentInputs(); await input(selects[0], '1'); await input(selects[1], '1'); await input(selects[2], '2'); await input(dateId, today); await click('Siguiente');
    await capture('revision-contrasena-escritorio'); await click('Crear contraseña (1)'); await until(() => Promise.resolve(writes.some(w => w.p === '/api/cxp/procesos')), 'No creó contraseña');
    assert.deepEqual(writes[0].body.documentos, [103]); assert.equal(writes[0].body.idProveedor, 1); assert.equal(paymentProcess.sucursal, 2); assert.equal(paymentProcess.moneda, 'GTQ'); assert.equal(paymentProcess.total, 80);
    assert.equal(Object.hasOwn(writes[0].body, 'creador'), false);

    for (const [name, width, height, mobile] of [['escritorio', 1440, 1000, false], ['movil', 390, 844, true]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
      await navigate('/cxp/pagos'); await capture('pagos-referencia-' + name);
      await navigate('/cxp/documentos'); await until(() => evaluate(`!!document.getElementById('documento-search') && !!document.querySelector('tbody tr')`), 'No cargó documentos'); await capture('documentos-' + name);
      assert.equal(await evaluate(`document.querySelectorAll('button').length>0 && [...document.querySelectorAll('button')].filter(el=>el.textContent.trim()==='Volver a Cuentas por pagar').length`), 1);
      await input('documento-search', '123'); await input('documento-estado', 'APROBADA'); await input('documento-vence-hasta', '2026-10-30'); await catalog('documento-proveedor');
      await until(() => Promise.resolve(queries.some(q => q.pathname === '/api/cxp/documentos' && q.searchParams.get('search') === '123' && q.searchParams.get('idProveedor') === '1' && q.searchParams.get('estado') === 'APROBADA' && q.searchParams.get('venceHasta') === '2026-10-30')), 'No conservó filtros');
      await click('Siguiente'); await until(() => Promise.resolve(queries.some(q => q.pathname === '/api/cxp/documentos' && q.searchParams.get('page') === '2')), 'No paginó');
      await click('Limpiar filtros'); assert.equal(await value('documento-search'), ''); assert.equal(await value('documento-estado'), '');
      await click('Nuevo documento'); await until(() => evaluate(`!!document.querySelector('[aria-label="Pasos del registro"]')`), 'No abrió registro'); await capture('registro-documento-' + name);
      assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Pasos del registro"] li').length`), 3);
      await evaluate('window.acceptChoice=true'); await click('Cerrar', `document.querySelector('[role="dialog"]')`);
      await navigate('/cxp/facturas-especiales'); await click('Nueva factura especial'); await until(() => evaluate(`!!document.getElementById('fe-proveedor')`), 'No abrió factura especial');
      await capture('registro-especial-' + name); await click('Continuar', `document.querySelector('[role="dialog"]')`); assert.match(await evaluate(`document.querySelector('[role="dialog"]').textContent`), /Revisa los campos/);
      await catalog('fe-proveedor'); await catalog('fe-sucursal'); await input('fe-referenciaExterna', 'PRUEBA-VISUAL-' + name); await input('fe-descripcionOperacion', 'Operación simulada sin datos reales');
      await click('Continuar', `document.querySelector('[role="dialog"]')`); await until(() => evaluate(`document.querySelector('[aria-label="Pasos de factura especial"] [aria-current="step"]').textContent.includes('Importes')`), 'No avanzó a importes');
      await input('fe-subtotal', '-1'); await click('Continuar', `document.querySelector('[role="dialog"]')`); assert.match(await evaluate(`document.querySelector('[role="dialog"]').textContent`), /Revisa los campos/);
      await input('fe-subtotal', '100'); await until(() => evaluate(`document.querySelector('[role="dialog"]').textContent.includes('GTQ 110.00')`), 'No calculó con servidor');
      await click('Continuar', `document.querySelector('[role="dialog"]')`); await until(() => evaluate(`!!document.querySelector('[aria-label="Revisión de factura especial"]')`), 'No mostró revisión');
      await capture('revision-especial-' + name); await click('Anterior', `document.querySelector('[role="dialog"]')`); assert.equal(await value('fe-subtotal'), '100'); await click('Continuar', `document.querySelector('[role="dialog"]')`);
      await click('Cancelar', `document.querySelector('[role="dialog"]')`); assert.equal(await evaluate(`!!document.querySelector('[aria-label="Revisión de factura especial"]')`), true);
      assert.equal(await evaluate(`!!document.querySelector('[role="alertdialog"]')`),true);await click('Seguir editando',`document.querySelector('[role="alertdialog"]')`);
      if (!mobile) { await click('Registrar factura especial', `document.querySelector('[role="dialog"]')`); await until(() => Promise.resolve(!!special), 'No registró especial'); assert.equal(special.etapa, 'PREPARACION'); assert.equal(special.usuario, 7); }
      else { await click('Cancelar', `document.querySelector('[role="dialog"]')`); await click('Salir sin guardar',`document.querySelector('[role="alertdialog"]')`); await until(() => evaluate(`!document.querySelector('[role="dialog"]')`), 'No cerró'); await click('Volver a Cuentas por pagar'); await until(() => evaluate(`location.pathname==='/cxp'`), 'No volvió al menú'); }
      await navigate('/cxp/contrasenas'); await openCreate(); await search('123', [101, 102]); await capture('sugerencias-' + name);
      await catalog('cxp-process-provider', 1); await until(() => evaluate(`!document.getElementById('cxp-document-search').disabled`), 'No cargó proveedor'); await search('123', [102]);
      await evaluate(`document.getElementById('cxp-document-option-102').click()`); await until(async () => (await chosen()).length === 1, 'No eligió proveedor primero');
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const state of ['RECIBIDO', 'PENDIENTE_APROBACION', 'APROBADA', 'PARCIALMENTE_PAGADA', 'PAGADA', 'RECHAZADA', 'ANULADA']) {
      documento.estado = state; documento.saldoPendiente = state === 'PAGADA' ? 0 : state === 'PARCIALMENTE_PAGADA' ? 50 : 100;
      documento.montoAplicado = 100 - documento.saldoPendiente;
      await navigate('/cxp/documentos/99'); await until(() => evaluate(`!!document.querySelector('[aria-label="Avance del documento"]')`), 'No mostró indicador');
      assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Avance del documento"] button').length`), 0);
      if (['RECHAZADA', 'ANULADA'].includes(state)) assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Avance del documento"] [data-step-state="completado"]').length`), 0);
      if (state === 'PAGADA') assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Avance del documento"] [data-step-state="completado"]').length`), 4);
      await evaluate(`document.querySelector('[aria-label="Flujo principal del documento"]').scrollIntoView({block:'start'})`);
      await capture('etapas-documento-' + state.toLowerCase());
    }
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    assert.deepEqual(writes.map(w => w.p), ['/api/cxp/procesos', '/api/cxp/facturas-especiales']);
    t.diagnostic('Capturas comparables de Pagos, documentos, capturas y sugerencias: ' + artifacts);
  } catch (error) { if (evaluate) t.diagnostic(await evaluate('document.body.innerText')); t.diagnostic(JSON.stringify(unexpected)); throw error;
  } finally { socket?.close(); chrome.kill(); dev.kill(); api.closeAllConnections(); await new Promise(r => api.close(r)); }
});

