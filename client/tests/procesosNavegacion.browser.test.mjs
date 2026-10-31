import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Prueba la página real con Chrome/Edge y una API HTTP aislada en memoria.
// No inicia el servidor ERP, no conecta a Oracle y rechaza toda escritura HTTP.
const client = fileURLToPath(new URL('..', import.meta.url));
const browser = process.env.CXP_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await delay(100);
  }
  throw new Error(message);
}

function connect(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
}

test('navegación real 6/7/8: resaltado, filtros, contenido, recarga e historial', {
  skip: !browser,
  timeout: 120000,
}, async t => {
  const artifacts = path.join(client, 'node_modules/.cache/flow-navigation', String(Date.now()));
  await mkdir(artifacts, { recursive: true });
  const mutations = [];
  const payment = (id, estado) => ({
    id, codigo: `CP-TEST-${id}`, clave: `local-${id}`, version: 'v1', estado,
    creador: 1, proveedor: 1, proveedorNombre: 'Proveedor de prueba local', sucursal: 1,
    moneda: 'GTQ', tipoCambio: 1, total: 100, formaPago: 1, formaPagoNombre: 'TRANSFERENCIA',
    documentos: [{ id, numero: `F-TEST-${id}`, importe: 100 }], aprobaciones: [],
    historial: [], pago: id, aplicaciones: estado === 'PROGRAMADA' ? [] : [id], reimpresiones: 0,
    transferencia: { id: String(id), cuentaOrigen: '1', cuentaDestino: '2', moneda: 'GTQ',
      proveedor: 1, importe: 100, estado: estado === 'PROGRAMADA' ? 'PROGRAMADA' : 'EJECUTADA' },
  });
  const fixtures = [payment(6, 'PROGRAMADA'), payment(7, 'ENTREGADO'), payment(8, 'COBRADO')];
  const api = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.end(); return; }
    if (req.method !== 'GET') {
      mutations.push(req.method + ' ' + req.url); res.statusCode = 405; res.end('{}'); return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/auth/session') {
      res.end(JSON.stringify({ username: 'consulta.local', name: 'Prueba aislada', mustChangePassword: false,
        actor: { id: 3, nombre: 'Prueba aislada', roles: [3], permisos: ['TESORERIA'] }, csrfToken: 'simulado' }));
    } else if (url.pathname.endsWith('/opciones')) {
      res.end(JSON.stringify({ documentos: [], origenes: [], destinos: [], formasPago: [], bancosConfigurados: true }));
    } else if (url.pathname === '/api/cxp/procesos') {
      const status = url.searchParams.get('estado');
      res.end(JSON.stringify({ data: fixtures.filter(row => !status || row.estado === status), page: 1, hasMore: false }));
    } else {
      const selected = fixtures.find(row => url.pathname === `/api/cxp/procesos/${row.id}`);
      res.end(JSON.stringify(selected ?? {}));
    }
  });
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  const apiPort = api.address().port;
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  // Resolver Vite desde el enlace pnpm, sin depender de una versión del almacén.
  const dev = spawn(process.execPath, [path.join(client, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: client, windowsHide: true, stdio: 'pipe',
    env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${apiPort}/api` },
  });
  let devOutput = '';
  dev.stdout.on('data', bytes => { devOutput += bytes; });
  dev.stderr.on('data', bytes => { devOutput += bytes; });
  const profile = path.join(artifacts, 'profile');
  const chrome = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, '--window-size=1440,1100', 'about:blank'],
  { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    await until(async () => {
      if (dev.exitCode !== null) throw new Error(devOutput);
      try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; }
    }, 'Vite no inició');
    const debuggingPort = await until(async () => {
      try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); }
      catch { return false; }
    }, 'Chrome no habilitó CDP');
    const pages = await (await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await once(socket, 'open');
    const send = connect(socket);
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const snapshot = () => evaluate(`(() => ({
      url: location.pathname + location.search,
      active: document.querySelector('ol[aria-label="Bandejas del flujo de pago"] [aria-current="step"]')?.getAttribute('aria-label'),
      blue: [...document.querySelectorAll('ol[aria-label="Bandejas del flujo de pago"] li')].flatMap((row, index) =>
        row.querySelector('strong')?.classList.contains('text-blue-700') ? [index + 1] : []),
      completed: document.querySelectorAll('ol[aria-label="Bandejas del flujo de pago"] [data-step-state="completado"]').length,
      stage: document.querySelector('.cxp-workspace-filters select')?.value,
      view: document.querySelector('.cxp-workspace-views [aria-pressed="true"]')?.textContent.trim(),
      rows: [...document.querySelectorAll('.cxp-workspace-card tbody tr')].map(row => row.cells[0].textContent.trim())
    }))()`);
    const click = async number => {
      await evaluate(`document.querySelector('ol[aria-label="Bandejas del flujo de pago"] li:nth-child(${number}) button').click()`);
      await delay(150);
    };
    const capture = async name => {
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(path.join(artifacts, name + '.png'), Buffer.from(image.data, 'base64'));
    };
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/cxp/cheques` });
    await until(async () => (await snapshot()).rows.length > 0, 'La página no cargó los datos simulados');
    // Primero reproducir ambos clics, incluso si la versión anterior los ignora.
    for (const step of [7, 8]) { await click(step); t.diagnostic(JSON.stringify({ click: step, ...await snapshot() })); }
    await capture('finalizado');
    assert.match((await snapshot()).active ?? '', /^8\. Finalizado: actual$/);

    const expected = { 6: ['ejecucion', '5', 'CP-TEST-6'], 7: ['aplicacion', '6', 'CP-TEST-7'], 8: ['finalizado', '7', 'CP-TEST-8'] };
    const assertStage = async (step, expectedRows = [expected[step][2]]) => {
      const state = await snapshot();
      assert.equal(state.url, `/cxp/cheques?etapa=${expected[step][0]}`);
      assert.match(state.active, new RegExp(`^${step}\\.`));
      assert.deepEqual(state.blue, [step]);
      assert.equal(state.stage, expected[step][1]);
      assert.deepEqual(state.rows, expectedRows);
      assert.match(state.view, step === 8 ? /^Historial/ : /^En proceso/);
      assert.equal(state.completed, 0);
    };
    for (const step of [6, 7, 8, 6]) {
      await click(step);
      await assertStage(step);
      await capture(`paso-${step}`);
    }
    await evaluate('history.back()');
    await until(async () => (await snapshot()).stage === '7', 'Atrás no restauró Finalizado');
    await assertStage(8);
    await evaluate('history.back()');
    await until(async () => (await snapshot()).stage === '6', 'Atrás no restauró Aplicación');
    await assertStage(7);
    await evaluate('history.forward()');
    await until(async () => (await snapshot()).stage === '7', 'Adelante no restauró Finalizado');
    await assertStage(8);
    // Page.reload responde antes de sustituir el documento. No aceptar filas del DOM anterior.
    await evaluate('window.cxpNavigationBeforeReload = true');
    await send('Page.reload', { ignoreCache: true });
    await until(async () => await evaluate('!window.cxpNavigationBeforeReload') &&
      (await snapshot()).rows.includes('CP-TEST-8'), 'Recargar no restauró los registros finalizados');
    await assertStage(8);
    await capture('finalizado-recargado');
    // Caso reportado: solo un finalizado, sin registros en Ejecución/Aplicación.
    fixtures.splice(0, 2);
    await evaluate(`[...document.querySelectorAll('.cxp-workspace-filter-actions button')].find(button => button.textContent.includes('Actualizar')).click()`);
    await until(() => evaluate(`document.querySelector('.cxp-workspace-card-heading p')?.textContent.includes('1 solicitudes')`), 'No actualizó la API simulada');
    for (const step of [6, 7, 8]) {
      await click(step);
      await assertStage(step, step === 8 ? ['CP-TEST-8'] : []);
    }
    await capture('finalizado-sin-pendientes');
    // El detalle sigue mostrando el avance real, independientemente de la navegación.
    await evaluate(`document.querySelector('.cxp-workspace-card tbody button').click()`);
    await until(() => evaluate(`!!document.querySelector('ol[aria-label="Avance de CP-TEST-8"]')`), 'No abrió el detalle');
    assert.equal(await evaluate(`document.querySelectorAll('ol[aria-label="Avance de CP-TEST-8"] [data-step-state="completado"]').length`), 8);
    assert.equal((await snapshot()).completed, 0);
    assert.deepEqual(mutations, []);
    t.diagnostic(`Capturas: ${artifacts}`);
  } finally {
    socket?.close(); chrome.kill(); dev.kill(); api.closeAllConnections();
    await new Promise(resolve => api.close(resolve));
  }
});
