import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Chrome real con API simulada: no inicia el servidor ERP ni abre Oracle.
const client = fileURLToPath(new URL('..', import.meta.url));
const browser = process.env.CXP_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { const result = await fn(); if (result) return result; await delay(80); }
  throw Error(message);
}
function connect(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    if (message.error) task.reject(Error(message.error.message)); else task.resolve(message.result);
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
}

test('merge Develop: inicio, buscador, recientes, reportes y logout con captura pendiente', { skip: !browser, timeout: 120000 }, async t => {
  const artifacts = path.join(client, 'node_modules/.cache/cxp-integracion-develop', String(Date.now()));
  await mkdir(artifacts, { recursive: true });
  const errors = [], unexpected = [], reports = [];
  let active = true, logoutCalls = 0;
  const api = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.end(); return; }
    const url = new URL(req.url, 'http://localhost'), p = url.pathname;
    const json = value => res.end(JSON.stringify(value));
    if (p === '/api/auth/session') {
      if (!active) { res.statusCode = 401; return json({ error: 'Sin sesión' }); }
      return json({ username: 'integracion-simulada', name: 'Operadora Integración', mustChangePassword: false,
        csrfToken: 'csrf-simulado', actor: { id: 7, nombre: 'Operadora Integración', nombreRol: 'OPERADOR_CXP', roles: [2], permisos: ['CREAR'] } });
    }
    if (p === '/api/auth/logout' && req.method === 'POST') {
      logoutCalls += 1;
      if (logoutCalls === 1) { res.statusCode = 503; return json({ error: 'Revocación simulada fallida' }); }
      active = false; return json({ ok: true });
    }
    if (p === '/api/cxp/documentos/monedas') return json({ monedaLocal: 'GTQ', fuenteTasas: null, monedas: [{ codigo: 'GTQ', nombre: 'Quetzal' }, { codigo: 'USD', nombre: 'Dólar' }] });
    if (p === '/api/cxp/documentos') return json({ data: [], meta: { page: 1, limit: 1, total: 0, totalPages: 0 } });
    if (p.startsWith('/api/cxp/catalogos/')) return json([{ id: 1, label: 'Proveedor simulado' }]);
    if (p === '/api/cxp/parametros') return json({ data: [] });
    if (p.startsWith('/api/cxp/reportes/')) {
      reports.push(url);
      const period = { fechaInicio: url.searchParams.get('fechaInicio'), fechaFin: url.searchParams.get('fechaFin') };
      if (p.endsWith('/antiguedad')) return json({ success: true, data: {
        fechaCorte: url.searchParams.get('fechaCorte'), detalle: [], totales: { cantidadDocumentos: 0, saldoTotal: 0 },
        resumenPorMoneda: [], resumenPorRango: [], rankingProveedores: [],
      } });
      if (p.endsWith('/retenciones')) return json({ success: true, ...period, detalle: [], resumenPorTributo: [], resumenPorMes: [], resumenPorProveedor: [],
        totales: { cantidad: 0, baseImponible: 0, monto: 0, montoRecuperable: 0, montoNoRecuperable: 0 } });
      if (p.endsWith('/estadistica')) return json({ success: true, data: { ...period, agrupacion: 'MES', detalle: [],
        totales: { cantidadDocumentos: 0, subtotal: 0, impuestoTotal: 0, retencionTotal: 0, totalNeto: 0, totalLocal: 0 },
        periodoComparable: { ...period, totalLocal: 0, disponible: false }, validacion: { estado: 'VALIDO', errores: [], advertencias: [] },
        resumen: { porMes: [], porProveedor: [], porTipoDocumento: [], variacionTotal: null },
      } });
    }
    unexpected.push(`${req.method} ${p}`); res.statusCode = 404; json({ error: 'Ruta sin simulación' });
  });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const dev = spawn(process.execPath, [path.join(client, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: client, windowsHide: true, stdio: 'pipe', env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${api.address().port}/api` },
  });
  let output = '';
  dev.stdout.on('data', b => output += b); dev.stderr.on('data', b => output += b);
  const profile = path.join(artifacts, 'profile');
  const chrome = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket, evaluate;
  try {
    await until(async () => { if (dev.exitCode !== null) throw Error(output); try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; } }, 'Vite no inició');
    const debug = await until(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; } }, 'Chrome no inició');
    const pages = await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json();
    socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl); await once(socket, 'open');
    const send = connect(socket);
    socket.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); });
    await send('Runtime.enable'); await send('Page.enable');
    evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
    const input = async (selector, value) => {
      await until(() => evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});return !!el&&(el.tagName!=='SELECT'||[...el.options].some(option=>option.value===${JSON.stringify(value)}));})()`), 'Campo sin cargar: ' + selector);
      await evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});el.focus();const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`); await delay(80);
    };
    const click = async label => {
      await until(() => evaluate(`[...document.querySelectorAll('button')].some(el=>el.getClientRects().length&&!el.disabled&&el.textContent.trim()===${JSON.stringify(label)})`), 'Botón sin habilitar: ' + label);
      await evaluate(`(() => {const el=[...document.querySelectorAll('button')].find(el=>el.getClientRects().length&&!el.disabled&&el.textContent.trim()===${JSON.stringify(label)});el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));el.click();})()`); await delay(100);
    };
    const navigate = async route => { await send('Page.navigate', { url: `http://127.0.0.1:${port}${route}` }); await until(() => evaluate(`location.pathname===${JSON.stringify(route.split('?')[0])}&&!!document.querySelector('h1')`), 'No cargó ' + route); };
    const capture = async name => { await delay(450); const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64')); };
    const settled = () => until(() => evaluate(`document.querySelector('form[aria-label="Filtros"]')?.getAttribute('aria-busy')==='false'`), 'Consulta sin terminar');
    const palette = async query => {
      await evaluate(`document.querySelector('[aria-haspopup="dialog"]').click()`);
      await until(() => evaluate(`!!document.querySelector('[role="combobox"][aria-label="Buscar pantallas"]')`), 'No abrió buscador');
      await input('[role="combobox"][aria-label="Buscar pantallas"]', query);
    };

    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/cxp');
    await until(() => evaluate(`document.body.innerText.includes('Áreas de trabajo')`), 'No cargó inicio nuevo');
    assert.equal(await evaluate(`!!document.querySelector('a[href="/cxp/parametros"]')&&!!document.querySelector('a[href="/cxp/conciliaciones-proveedor"]')`), true);
    await capture('inicio-escritorio');
    await palette('antiguedad');
    assert.equal(await evaluate(`document.querySelectorAll('[role="option"]').length`), 1);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await until(() => evaluate(`location.pathname==='/cxp/reportes/antiguedad'`), 'No navegó con Enter');
    await settled();
    await input('#ant-moneda', 'USD'); await click('Aplicar filtros'); await settled();
    assert.equal(await evaluate(`new URLSearchParams(location.search).get('moneda')`), 'USD');
    assert.ok(reports.some(url => url.pathname.endsWith('/antiguedad') && url.searchParams.get('moneda') === 'USD'));
    await evaluate(`document.querySelector('[aria-label="Quitar filtro Moneda: USD"]').click()`); await settled();
    assert.equal(await evaluate(`new URLSearchParams(location.search).has('moneda')`), false);
    await click('Cierre del mes anterior'); await settled();
    const shared = await evaluate('location.pathname+location.search');
    const cut = await evaluate(`document.getElementById('ant-corte').value`);
    await navigate(shared); await settled();
    assert.equal(await evaluate(`document.getElementById('ant-corte').value`), cut);
    await capture('antiguedad-filtros');

    for (const [route, prefix, title] of [['retenciones', 'ret', 'Retenciones'], ['estadistica', 'est', 'Estadística']]) {
      await navigate(`/cxp/reportes/${route}?desde=2026-01-01&hasta=2026-09-30&moneda=USD`); await settled();
      assert.match(await evaluate('document.querySelector("h1").textContent'), new RegExp(title));
      assert.equal(await evaluate(`document.getElementById('${prefix}-moneda').value`), 'USD');
      await click('Año anterior'); await settled();
      assert.equal(await evaluate(`new URLSearchParams(location.search).get('moneda')`), 'USD');
      assert.equal(await evaluate(`new URLSearchParams(location.search).get('desde')?.slice(5)`), '01-01');
    }
    await palette('Inicio'); await evaluate(`document.querySelector('[role="option"]').click()`);
    await until(() => evaluate(`location.pathname==='/cxp'&&document.body.innerText.includes('Continuar donde lo dejaste')`), 'No conservó recientes de la sesión');
    await palette('documento registrar');
    await evaluate(`document.querySelector('[role="option"]').click()`);
    await until(() => evaluate(`!!document.getElementById('registro-numeroDocumento')`), 'No abrió registro');
    await input('#registro-numeroDocumento', 'CAPTURA-CONSERVADA');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', modifiers: 2, windowsVirtualKeyCode: 75 });
    assert.equal(await evaluate(`!!document.querySelector('[role="combobox"][aria-label="Buscar pantallas"]')`), false);
    await palette('antiguedad'); await evaluate(`document.querySelector('[role="option"]').click()`);
    await until(() => evaluate(`!!document.querySelector('[role="alertdialog"]')`), 'Buscador omitió guarda');
    await click('Seguir editando');
    assert.equal(await evaluate(`document.getElementById('registro-numeroDocumento').value`), 'CAPTURA-CONSERVADA');
    await evaluate(`document.querySelector('[aria-haspopup="menu"]').click()`); await click('Cerrar sesión');
    await until(() => evaluate(`!!document.querySelector('[role="alertdialog"]')`), 'Logout omitió guarda');
    await click('Seguir editando'); assert.equal(logoutCalls, 0);
    await click('Cerrar sesión'); await click('Salir sin guardar');
    await until(() => evaluate(`document.body.innerText.includes('Revocación simulada fallida')`), 'No mostró error de logout');
    assert.equal(await evaluate(`document.getElementById('registro-numeroDocumento').value`), 'CAPTURA-CONSERVADA');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await capture('captura-conservada-movil');
    await click('Cerrar sesión'); await click('Salir sin guardar');
    await until(() => evaluate(`location.pathname==='/login'`), 'No cerró sesión al reintentar');
    assert.equal(logoutCalls, 2);
    assert.equal(await evaluate(`Object.keys(localStorage).some(key=>key.startsWith('cxp:recientes:'))`), false);
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    t.diagnostic('API simulada; capturas: ' + artifacts);
  } catch (error) {
    if (evaluate) t.diagnostic(await evaluate('document.body.innerText'));
    t.diagnostic(JSON.stringify(unexpected)); throw error;
  } finally {
    socket?.close(); chrome.kill(); dev.kill(); api.closeAllConnections(); await new Promise(resolve => api.close(resolve));
  }
});
