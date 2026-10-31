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

test('CXP: pagos ordinarios/CP, configuración temprana, filtros y logout aislado entre cuentas', {skip:!browser,timeout:120000}, async t=>{
  const artifacts=path.join(client,'node_modules/.cache/cxp-correcciones-browser',String(Date.now()));await mkdir(artifacts,{recursive:true});
  const writes=[],queries=[],unexpected=[],errors=[];
  let account='A',activeSession=true,logoutCalls=0,configured=false,releaseOld,releaseBinary;
  const doc={idDocumento:101,idProveedor:1,idSucursal:1,creadoPor:1,diasCredito:0,estado:'APROBADA',tipoDocumento:'FACTURA',naturaleza:'D',serie:'SIM',numeroDocumento:'VERIF',fechaDocumento:'2026-10-30',fechaVencimiento:'2026-10-30',origenIngreso:'MANUAL',moneda:'GTQ',tipoCambio:1,subtotal:40,totalBruto:40,totalNeto:40,totalLocal:40,montoAplicado:0,saldoPendiente:40};
  let applications=[];
  const api=createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin',req.headers.origin??'*');res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-CSRF-Token');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Content-Type','application/json');
    if(req.method==='OPTIONS'){res.end();return;}
    const url=new URL(req.url,'http://localhost'),p=url.pathname;const json=v=>res.end(JSON.stringify(v));let body;
    if(req.method!=='GET'){let raw='';for await(const bytes of req)raw+=bytes;body=JSON.parse(raw||'{}');}
    if(p==='/api/auth/session'){if(!activeSession){res.statusCode=401;return json({error:'Sin sesión simulada'});}return json({username:'cuenta-'+account,name:'Cuenta '+account,mustChangePassword:false,actor:{id:account==='A'?1:2,nombre:account==='A'?'Cuenta Alfa':'Cuenta Beta',nombreRol:'OPERADOR_CXP',roles:[2],permisos:['CREAR']},csrfToken:'token-'+account});}
    if(p==='/api/auth/login'){account=body.username==='cuenta-b'?'B':'A';activeSession=true;return json({ok:true});}
    if(p==='/api/auth/logout'){logoutCalls++;await delay(220);if(logoutCalls===1){res.statusCode=503;return json({error:'Fallo simulado al revocar'});}activeSession=false;res.statusCode=204;res.end();return;}
    if(p==='/api/cxp/prueba-tardia'){await new Promise(resolve=>{releaseOld=resolve;});res.statusCode=401;return json({error:'Respuesta de la cuenta anterior'});}
    if(p==='/api/cxp/prueba-binaria'){await new Promise(resolve=>{releaseBinary=resolve;});res.setHeader('Content-Type','application/pdf');return res.end('contenido privado simulado A');}
    if (p === '/api/cxp/proveedores/identidad') { const id=Number(url.searchParams.get('id')||1); return json({proveedores:[{idProveedor:id,nit:id===1?'123-1':'456-2',nombre:id===1?'Proveedor Alfa':'Proveedor Beta',activo:true}],coincidenciasExactas:1,limitado:false}); }
    if (p.endsWith('/opciones-tributos')) return json({identificaciones:[],reglas:[]});
    if(p.startsWith('/api/cxp/catalogos/'))return json([{id:1,label:p.endsWith('proveedores')?(account==='A'?'Proveedor Alfa privado':'Proveedor Beta privado'):'Sucursal de prueba'}]);
    if(p==='/api/cxp/documentos/monedas')return json({monedaLocal:'GTQ',fuenteTasas:null,monedas:[{codigo:'GTQ',nombre:'Quetzal'}]});
    if(p==='/api/cxp/documentos')return json({data:[doc],meta:{page:1,limit:10,total:1,totalPages:1}});
    if(p==='/api/cxp/documentos/101/expediente')return json({documento:doc,lineas:[],tributos:[],archivos:[],aplicaciones:applications});
    if(p==='/api/cxp/documentos/102/expediente')return json({documento:{...doc,idDocumento:102,estado:'APROBADA',montoAplicado:0,saldoPendiente:605,totalNeto:605},lineas:[],tributos:[],archivos:[],aplicaciones:[]});
    if(p.endsWith('/aprobacion'))return json({reglas:[],decisiones:[],actor:null});
    if(p.endsWith('/archivos'))return json([]);
    if(p.endsWith('/componentes'))return json({documento:doc,version:'a'.repeat(64),lineas:[],tributos:[],editable:false,catalogo:[],advertencias:[],adoptarTotales:false,confirmarEliminaciones:[]});
    if(p.endsWith('/contexto-pagos'))return json(p.includes('/102/')?{reservadoDocumento:605,ordinariosDisponibles:0,motivos:['El documento tiene una reserva pendiente.'],procesos:[{idPago:8,codigo:'CP-00000008',estado:'PROGRAMADO',monto:605,saldoSinAplicar:605,reservado:605,aplicado:0}]}:{reservadoDocumento:0,ordinariosDisponibles:doc.saldoPendiente?1:0,motivos:doc.saldoPendiente?[]:['El documento ya no tiene saldo pendiente. No debe volver a aplicarse.'],procesos:[]});
    if(p.endsWith('/pagos-disponibles'))return json(doc.saldoPendiente?[{idPago:77,codigoPago:'ORD-SIMULADO',tipoPago:'ORDINARIO',idProveedor:1,moneda:'GTQ',estado:'CONFIRMADO',montoObligacion:40,montoNoAplicado:40}]:[]);
    if(p==='/api/cxp/documentos/101/aplicaciones/pago'){writes.push({p,body});doc.saldoPendiente=0;doc.montoAplicado=40;doc.estado='PAGADA';const app={idAplicacion:900,idDocumentoDestino:101,idPago:77,tipoAplicacion:'PAGO',montoTotalAplicado:40,saldoAnterior:40,saldoPosterior:0,estado:'APLICADA'};applications=[app];return json(app);}
    if(p==='/api/cxp/facturas-especiales/configuracion')return json({fechaDocumento:'2026-10-30',moneda:'GTQ',serie:configured?'FESP':null,puedeRegistrar:configured,impedimentos:configured?[]:['Configura el parámetro SERIE en CXP_FACTURA_ESPECIAL. Tus datos se conservarán.'],advertencias:[],reglasVigentes:2});
    if(p==='/api/cxp/facturas-especiales') {queries.push(url);return json({data:[],meta:{page:Number(url.searchParams.get('page')||1),limit:10,total:0,totalPages:1}});}
    if(p==='/api/cxp/procesos/opciones')return json({documentos:[],origenes:[],destinos:[],formasPago:[],bancosConfigurados:true});
    if(p==='/api/cxp/procesos')return json({data:[],page:1,hasMore:false});
    if(p==='/api/cxp/procesos/8')return json({id:8,codigo:'CP-00000008',clave:'simulada',version:'v1',estado:'PROGRAMADA',creador:1,proveedor:1,proveedorNombre:'Proveedor simulado',sucursal:1,moneda:'GTQ',tipoCambio:1,total:605,formaPago:1,formaPagoNombre:'TRANSFERENCIA BANCARIA',documentos:[{id:102,numero:'SIM-VERIF',importe:605}],aprobaciones:[],historial:[],pago:8,fechaProgramada:'2026-10-30',aplicaciones:[],reimpresiones:0});
    unexpected.push(req.method+' '+p);res.statusCode=404;return json({error:'Ruta sin simulación'});
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


    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate('/cxp/documentos/101');await until(()=>evaluate(`!!document.getElementById('payment-select') && !document.getElementById('payment-select').disabled`),'No cargó pago ordinario');
    assert.equal(await evaluate(`document.querySelector('.cxp-topbar').textContent.includes('Cuenta Alfa')`),false);
    assert.equal(await evaluate(`document.querySelectorAll('[title="Notificaciones"]').length`),0);
    assert.equal(await evaluate(`[...document.querySelectorAll('[aria-label="Sesión autenticada"]')].filter(el=>el.getClientRects().length).length`),1);
    assert.equal(await evaluate(`(()=>{const a=document.getElementById('payment-select').getBoundingClientRect(),b=document.getElementById('payment-amount').getBoundingClientRect();return a.top===b.top&&a.height===b.height})()`),true);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`(()=>{const a=document.getElementById('payment-search').getBoundingClientRect(),b=document.getElementById('payment-select').getBoundingClientRect(),c=document.getElementById('payment-amount').getBoundingClientRect();return a.top<b.top&&b.top<c.top&&a.left===b.left&&b.left===c.left&&b.height===c.height})()`),true);
    await evaluate(`document.getElementById('payment-search').scrollIntoView()`);await capture('ordinario-movil');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate('window.scrollTo(0,0)');
    await input('payment-select','77');await input('payment-amount','40');await evaluate('window.acceptChoice=true');await capture('ordinario-escritorio');await click('Confirmar aplicación');
    await until(()=>evaluate(`document.body.innerText.includes('No debe volver a aplicarse') && !document.getElementById('payment-select')`),'No actualizó el expediente');
    assert.equal(writes.length,1);assert.equal(writes[0].body.idPago,77);assert.equal(doc.saldoPendiente,0);
    await navigate('/cxp/documentos/102');await until(()=>evaluate(`document.body.innerText.includes('CP-00000008')`),'No mostró proceso relacionado');
    assert.equal(await evaluate(`document.getElementById('payment-select')`),null);await capture('reserva-cp-escritorio');
    await evaluate(`document.querySelector('a[href="/cxp/pagos"]').click()`);await until(()=>evaluate(`document.body.innerText.includes('CP-00000008') && !!document.querySelector('[aria-modal="true"]')`),'No abrió proceso existente');
    assert.equal(writes.length,1); // Navegar nunca aplica un CP ni ejecuta Bancos.
    await navigate('/cxp/documentos');await click('Nuevo documento');await until(()=>evaluate(`!!document.getElementById('registro-idProveedor')`),'No abrió registro');
    const normalStyle=await evaluate(`(()=>{const s=getComputedStyle(document.querySelector('[aria-label="Identificación"] h3'));return [s.color,s.fontSize,s.fontWeight,s.textTransform]})()`);
    await evaluate('window.acceptChoice=true');await click('Cerrar',`document.querySelector('[role="dialog"]')`);
    await navigate('/cxp/facturas-especiales');await until(()=>evaluate(`!!document.getElementById('fe-filtro-proveedor')`),'No cargó filtro independiente');
    assert.equal(await evaluate(`document.body.innerText.includes('Usuario de la operación')`),false);
    await catalog('fe-filtro-proveedor');await input('fe-buscar','VERIF');await input('fe-etapa','PREPARACION');
    await until(()=>Promise.resolve(queries.some(q=>q.searchParams.get('idProveedor')==='1'&&q.searchParams.get('search')==='VERIF'&&q.searchParams.get('etapa')==='PREPARACION')),'No combinó filtros');
    await click('Limpiar filtros');assert.equal(await value('fe-buscar'),'');assert.equal(await value('fe-etapa'),'');
    await click('Nueva factura especial');await until(()=>evaluate(`document.body.innerText.includes('Configura el parámetro SERIE')`),'No detectó serie ausente');
    const specialStyle=await evaluate(`(()=>{const s=getComputedStyle(document.querySelector('.cxp-create-dialog form h3'));return [s.color,s.fontSize,s.fontWeight,s.textTransform]})()`);assert.deepEqual(specialStyle,normalStyle);
    assert.deepEqual(await evaluate(`(()=>{const s=getComputedStyle(document.querySelector('section[aria-label="Proveedor"] h3'));return [s.color,s.fontSize,s.fontWeight,s.textTransform]})()`),[normalStyle[0],'14px','700','none']);
    await input('fe-referenciaExterna','CAPTURA-CONSERVADA');await capture('configuracion-ausente');configured=true;await click('Volver a comprobar');
    await until(()=>evaluate(`!document.body.innerText.includes('Configura el parámetro SERIE')&&!document.body.innerText.includes('Comprobando serie')`),'No revalidó configuración');assert.equal(await value('fe-referenciaExterna'),'CAPTURA-CONSERVADA');
    await click('Cancelar',`document.querySelector('[role="dialog"]')`);await click('Salir sin guardar',`document.querySelector('[role="alertdialog"]')`);
    // Se prima el mismo catálogo que usará la siguiente cuenta, sin recargar la aplicación.
    await catalog('fe-filtro-proveedor');
    await evaluate(`sessionStorage.setItem('cxp.openProcessId','8');localStorage.setItem('cxp.actor','Cuenta A');window.oldResult=null;void import('/src/shared/api/index.ts').then(m=>m.apiRequest('/cxp/prueba-tardia').catch(e=>{window.oldResult=e.status}));`);
    await evaluate(`window.binaryResult=null;void import('/src/modules/cxp/api.ts').then(m=>m.apiClient.download('/cxp/prueba-binaria').catch(e=>{window.binaryResult=e.status}));`);
    await until(()=>Promise.resolve(!!releaseOld),'No inició petición privada tardía');
    await until(()=>Promise.resolve(!!releaseBinary),'No inició descarga privada tardía');
    await evaluate(`(()=>{const b=[...document.querySelectorAll('[aria-label="Cerrar sesión"]')].find(el=>el.getClientRects().length);b.click();b.click();})()`);
    await until(()=>evaluate(`document.body.innerText.includes('Fallo simulado al revocar')`),'No mostró fallo de logout');assert.equal(logoutCalls,1);assert.equal(await evaluate('location.pathname'),'/cxp/facturas-especiales');
    await capture('logout-error-escritorio');await evaluate(`[...document.querySelectorAll('[aria-label="Cerrar sesión"]')].find(el=>el.getClientRects().length).click()`);
    await until(()=>evaluate(`location.pathname==='/login' && !!document.querySelector('input[autocomplete="username"]')`),'No redirigió al login');
    assert.equal(await evaluate(`sessionStorage.getItem('cxp.openProcessId')`),null);assert.equal(await evaluate(`localStorage.getItem('cxp.actor')`),null);
    await input(await evaluate(`document.querySelector('input[autocomplete="username"]').id`),'cuenta-b');await input(await evaluate(`document.querySelector('input[autocomplete="current-password"]').id`),'clave-ficticia-de-prueba');await click('Entrar');
    await until(()=>evaluate(`document.body.innerText.includes('Cuenta Beta') && !document.querySelector('input[autocomplete="current-password"]')`),'No inició cuenta B');
    releaseOld();await until(()=>evaluate('window.oldResult===409'),'No descartó respuesta de A');assert.equal(await evaluate(`document.body.innerText.includes('Cuenta Beta')`),true);
    releaseBinary();await until(()=>evaluate('window.binaryResult===409'),'No descartó descarga privada de A');
    // Si el retorno de login es el menú, se usa su enlace real sin recargar ni vaciar artificialmente las cachés.
    if(await evaluate(`location.pathname==='/cxp'`))await evaluate(`document.querySelector('a[href="/cxp/facturas-especiales"]').click()`);
    await until(()=>evaluate(`!!document.getElementById('fe-filtro-proveedor')`),'No volvió al listado');await evaluate(`document.getElementById('fe-filtro-proveedor').click()`);
    await until(()=>evaluate(`document.getElementById('fe-filtro-proveedor-option-0')?.textContent.includes('Beta privado')`),'Reutilizó catálogo privado de A');
    assert.equal(await evaluate(`document.getElementById('fe-filtro-proveedor-option-0').textContent.includes('Alfa')`),false);await key('Escape');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate(`document.querySelector('[aria-label="Abrir menú"]').click()`);
    await until(()=>evaluate(`!!document.querySelector('[aria-label="Menú de Cuentas por pagar"]')`),'No abrió menú móvil');await capture('sesion-menu-movil');
    assert.equal(await evaluate(`[...document.querySelectorAll('[aria-label="Cerrar sesión"]')].filter(el=>el.getClientRects().length).length`),1);
    await evaluate(`[...document.querySelectorAll('[aria-label="Cerrar sesión"]')].find(el=>el.getClientRects().length).click()`);await until(()=>evaluate(`location.pathname==='/login'`),'No cerró sesión móvil');assert.equal(logoutCalls,3);
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);t.diagnostic('Capturas con API simulada: '+artifacts);
  }catch(error){if(evaluate)t.diagnostic(await evaluate('document.body.innerText'));t.diagnostic(JSON.stringify(unexpected));throw error;
  }finally{releaseOld?.();releaseBinary?.();socket?.close();chrome.kill();dev.kill();api.closeAllConnections();await new Promise(r=>api.close(r));}
});

